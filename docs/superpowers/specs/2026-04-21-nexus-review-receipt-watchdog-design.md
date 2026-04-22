Date: 2026-04-21
Milestone: post-v1.0.41 governed review reliability
Branch: `main`

# Nexus Review Receipt Watchdog Design

## Goal

Make governed `/review` less sensitive to foreground CCB timing races by
separating provider-authored audit receipts from Nexus-owned canonical review
truth.

The product outcome is:

- Codex and Gemini can finish at different times without directly mutating the
  canonical current audit set
- watchdog recovery can wait for durable provider receipts instead of relying
  only on one foreground `ask` call finishing cleanly
- late or stale provider replies become isolated attempt artifacts, not current
  governed truth

## Scope

- define an attempt-scoped receipt contract for review audits
- define how watchdog and late-recovery logic should wait on receipts
- define how Nexus promotes receipts into `.planning/audits/current/*`
- define how stale or orphan late receipts should be recorded
- keep the governed gate decision Nexus-owned

## Non-Goals

- letting Codex or Gemini write `.planning/audits/current/codex.md` or
  `.planning/audits/current/gemini.md` directly
- moving review gate decision authority out of Nexus
- redesigning `/qa` or `/build` receipt semantics in the same change
- replacing CCB transport, request ids, or session reset policy wholesale
- making provider-written markdown the only persisted review evidence

## Problem Statement

Today governed `/review` already uses provider-authored audit content, but the
promotion path is too tightly coupled to the foreground dispatch finishing in a
single successful step.

The current flow is:

1. dispatch Codex and Gemini audits
2. wait for both adapter calls to return `success`
3. read `raw_output.markdown`
4. parse verdicts
5. write canonical current audit files

This creates a reliability gap:

- providers sometimes continue working after the foreground ask exits nonzero
- watchdog/pend recovery can rescue some replies, but the recovery target is
  still "did the in-memory adapter call complete cleanly?"
- when retries happen, late old replies can still show up after a new attempt
  has already completed

Nexus has already added attempt ids, request ids, split-brain detection, and
false-start recovery. That improves correctness, but the last coupling remains:

- provider output is still treated as part of one foreground call lifecycle
- there is no durable attempt-scoped receipt layer between provider completion
  and canonical promotion

## Desired End State

- every governed review attempt gets an attempt-scoped receipt directory
- Codex and Gemini receipts are written independently and durably
- review watchdog logic waits for receipt completion, not just a foreground ask
  exit code
- Nexus promotes only the current attempt's complete receipt set into
  `.planning/audits/current/*`
- late results from old attempts remain visible for diagnosis but cannot
  overwrite current governed truth

## Core Design Decisions

### 1. Provider content should be provider-authored, but current audit truth must remain Nexus-owned

This boundary stays explicit:

- provider owns its audit content
- Nexus owns canonical lifecycle truth

That means provider output may be persisted earlier and more durably, but only
Nexus may write:

- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`
- `.planning/audits/current/synthesis.md`
- `.planning/audits/current/gate-decision.md`
- `.planning/audits/current/meta.json`
- `.planning/current/review/status.json`

Reason:

- canonical truth must remain attempt-aware, route-validated, and atomically
  promoted
- old late provider replies must never directly mutate current truth

### 2. Review attempts need a receipt directory

Each review attempt should get a durable receipt root:

` .planning/current/review/attempts/<review_attempt_id>/ `

Recommended contents:

- `codex.md`
- `codex.json`
- `gemini.md`
- `gemini.json`

The markdown file is the provider-authored audit body.

The json sidecar is the receipt contract Nexus uses for validation and
promotion.

Recommended minimum shape:

```json
{
  "schema_version": 1,
  "review_attempt_id": "review-2026-04-21T01-23-45-678Z",
  "provider": "codex",
  "request_id": "20260421-...",
  "generated_at": "2026-04-21T01:23:45.678Z",
  "requested_route": { "...": "..." },
  "actual_route": { "...": "..." },
  "verdict": "pass",
  "markdown_path": ".planning/current/review/attempts/<attempt>/codex.md"
}
```

The receipt should only exist once Nexus has a canonical provider audit body
for that attempt.

### 3. Watchdog should wait on receipts, not current audit files

The watchdog target should not be:

- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`

Those are canonical current-truth files and should only appear after final
promotion.

Instead, watchdog and late recovery should poll for:

- `attempts/<attemptId>/codex.json`
- `attempts/<attemptId>/gemini.json`

The gate decision becomes legal only when:

1. both receipt json files exist
2. both receipt markdown files exist
3. both receipts match the current `review_attempt_id`
4. both receipts have route / provider / request-id data consistent enough for
   current Nexus review checks

This gives the provider more time to finish without letting it mutate current
truth directly.

### 4. Promotion to current audit set remains atomic

Once both receipts are present and validated, Nexus should promote them in one
canonical write step:

- copy or rewrite receipt markdown into `current/codex.md` and `current/gemini.md`
- compute `synthesis.md`
- compute `gate-decision.md`
- compute `meta.json`
- write `review/status.json`

This is still one normalization boundary.

No provider should independently update any file under
`.planning/audits/current/`.

### 5. Old late replies become orphan receipts, not split-brain current truth

When a late reply arrives after a newer review attempt has already become
current, Nexus should treat it as one of:

- `stale_attempt_receipt`
- `orphan_late_receipt`

Expected handling:

- the receipt may still be written under its original attempt directory
- it must not promote into `.planning/audits/current/*`
- it should be diagnosable from runtime state or doctor tooling

This keeps postmortem evidence without letting stale replies overwrite current
truth.

### 6. Request ids remain important, but attempt id is the primary fence

Request ids are useful but not sufficient by themselves.

The promotion fence should primarily be:

- `review_attempt_id`

Then strengthened by:

- `request_id`
- provider
- requested route
- actual route

Reason:

- request ids may be missing in some false-start cases
- review retries are attempt-level lifecycle events, not only transport-level
  dispatch events

### 7. Direct provider writing to current audit files is explicitly rejected

Nexus should not adopt a design where Codex or Gemini directly writes:

- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`

That design would:

- bypass attempt isolation
- make stale late writes harder to suppress
- move canonical truth mutation into provider timing behavior
- reintroduce split-brain risk at the filesystem layer

The provider may write or yield receipts. Nexus promotes them.

## Proposed Runtime Flow

### Current flow

1. review dispatches both audits
2. adapter returns two success payloads
3. review parses both markdown bodies
4. review writes canonical current audit set

### Proposed flow

1. review allocates `review_attempt_id`
2. review dispatches both audits
3. each provider success writes its own attempt receipt pair:
   - `<attempt>/codex.md` + `<attempt>/codex.json`
   - `<attempt>/gemini.md` + `<attempt>/gemini.json`
4. watchdog / late recovery waits until both current-attempt receipts exist or
   timeout policy is exhausted
5. review validates both receipts
6. review promotes the attempt receipt set into canonical current audit files
7. review writes synthesis, gate decision, meta, and status

## Artifact Model

### New attempt-scoped review receipts

Under:

` .planning/current/review/attempts/<review_attempt_id>/ `

Required:

- provider markdown
- provider receipt json

Optional later:

- raw stdout/stderr excerpts
- recovery notes
- finalize/watchdog markers

### Existing canonical files stay unchanged

Canonical current review truth remains:

- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`
- `.planning/audits/current/synthesis.md`
- `.planning/audits/current/gate-decision.md`
- `.planning/audits/current/meta.json`

This is important because closeout, ledger doctor, verification matrix, and
archive logic already depend on those paths.

## Watchdog and Recovery Semantics

### Foreground false-start

If review audit foreground dispatch fails but later yields a valid receipt for
the current attempt, Nexus should treat that as recoverable without blocking the
entire review immediately.

### Missing second provider

If one provider receipt exists and the other does not, watchdog should continue
polling the attempt receipt directory until:

- both receipts exist, or
- timeout / retry policy is exhausted

### Late stale attempt

If a receipt appears for an older attempt after a newer attempt has already
promoted, it should be recorded only as stale/orphan evidence.

## Ledger-Doctor Implications

`nexus-ledger-doctor` should eventually learn two new diagnostics:

1. current review status references attempt `A`, but current audit set was
   promoted from attempt `B`
2. orphan late receipts exist for older attempts after a newer attempt became
   canonical

This is not required in the first implementation, but the receipt model should
leave room for it.

## Risks and Tradeoffs

### Benefit

- less sensitivity to foreground transport timing
- clearer separation between provider completion and governed truth promotion
- better postmortem diagnostics
- safer retry behavior

### Cost

- more artifact surface under `.planning/current/review/`
- more promotion logic in review normalization
- more cleanup policy to define for old attempt receipts

### Main tradeoff

This adds complexity to gain stronger correctness.

That trade is justified because governed review already depends on:

- dual-provider agreement
- request/route provenance
- retry safety
- closeout legality

Review is one of the places where extra state is worth it.

## Recommended Implementation Order

1. add review attempt receipt artifact helpers and types
2. write receipt files when individual provider audits complete
3. teach watchdog / late recovery to wait on receipts
4. promote receipts into canonical current audit files only after both receipts
   validate
5. add orphan/stale receipt diagnostics
6. extend doctor coverage if needed

## Acceptance Criteria

- a review retry can succeed even when one provider foreground ask false-starts,
  as long as both current-attempt receipts are eventually present
- a late old provider reply cannot overwrite `.planning/audits/current/*`
- `current/codex.md` and `current/gemini.md` are still written only by Nexus
  promotion logic
- canonical gate decision still comes from Nexus parsing and synthesis, not
  from providers directly mutating current audit files
- existing closeout and archive flows remain compatible with the canonical
  current audit paths
