Date: 2026-04-21
Spec: `docs/superpowers/specs/2026-04-21-nexus-review-receipt-watchdog-design.md`
Branch: `main`

# Nexus Review Receipt Watchdog Plan

## Objective

Introduce attempt-scoped review receipts so governed `/review` can wait on
durable provider completion signals, then promote the validated receipt set into
canonical current audit truth atomically.

This slice should improve review reliability without moving canonical audit
ownership away from Nexus.

## Task 1: Add Review Receipt Contracts And Artifact Helpers

### Files

- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/artifacts.ts`
- Modify: `test/nexus/types.test.ts`

### Work

- add review receipt record types for provider-scoped attempt receipts
- add artifact helpers for:
  - `.planning/current/review/attempts/<attempt>/codex.md`
  - `.planning/current/review/attempts/<attempt>/codex.json`
  - `.planning/current/review/attempts/<attempt>/gemini.md`
  - `.planning/current/review/attempts/<attempt>/gemini.json`
- keep canonical current audit helpers unchanged:
  - `.planning/audits/current/codex.md`
  - `.planning/audits/current/gemini.md`
  - `.planning/audits/current/synthesis.md`
  - `.planning/audits/current/gate-decision.md`
  - `.planning/audits/current/meta.json`
- freeze the receipt contract in type tests so later changes do not silently
  weaken attempt isolation

### Verification

- `bun test test/nexus/types.test.ts`

## Task 2: Persist Provider Audit Receipts Per Review Attempt

### Files

- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/normalizers/index.ts` only if helper extraction is needed
- Modify: `test/nexus/review.test.ts`

### Work

- once a provider audit yields canonical markdown for the current review attempt,
  write the provider receipt markdown and json into the attempt directory
- include in each receipt:
  - `review_attempt_id`
  - `provider`
  - `request_id`
  - `generated_at`
  - `requested_route`
  - `actual_route`
  - `verdict`
  - `markdown_path`
- ensure receipt writes happen before current-audit promotion
- do not let receipt writes mutate `.planning/audits/current/*`
- extend review tests to verify:
  - receipt files are written on success
  - canonical current audit files are still written only by final promotion

### Verification

- `bun test test/nexus/review.test.ts`

## Task 3: Teach CCB Recovery To Gate On Receipts

### Files

- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/ccb-runtime-state.ts` only if dispatch state needs receipt-aware fields
- Modify: `test/nexus/ccb-runtime-adapter.test.ts`

### Work

- extend review watchdog / late-recovery logic so it can wait for current
  attempt receipts instead of assuming the foreground call must return the final
  successful payload in one step
- keep the existing foreground retry and pend recovery model, but make the
  completion condition review-receipt-aware
- ensure the adapter still records:
  - request ids
  - retry provenance
  - latency summary
- only treat receipts matching the current `review_attempt_id` as valid for the
  active review
- explicitly avoid promoting or reading `.planning/audits/current/*.md` as
  watchdog completion signals

### Verification

- `bun test test/nexus/ccb-runtime-adapter.test.ts`

## Task 4: Promote Receipt Sets Into Canonical Current Audit Truth

### Files

- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/ledger-doctor.ts`
- Modify: `test/nexus/review.test.ts`
- Modify: `test/nexus/ledger-doctor.test.ts`

### Work

- change review success normalization to read the validated current-attempt
  receipts and promote them into:
  - `current/codex.md`
  - `current/gemini.md`
  - `synthesis.md`
  - `gate-decision.md`
  - `meta.json`
- preserve current review gate behavior:
  - Nexus still parses verdicts
  - Nexus still writes synthesis
  - Nexus still writes gate decision
  - Nexus still owns `review/status.json`
- add diagnostics for stale/orphan late receipts where practical
- extend ledger doctor so it can distinguish:
  - healthy current audit set
  - split-brain current audit set
  - stale/orphan receipts from older attempts

### Verification

- `bun test test/nexus/review.test.ts`
- `bun test test/nexus/ledger-doctor.test.ts`

## Task 5: Sync Runbook And Product Surface Copy

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`

### Work

- document the new review receipt model in product-facing copy:
  - providers author receipts
  - Nexus promotes canonical truth
  - late stale replies no longer directly threaten current audit files
- keep the ownership boundary explicit:
  - provider content
  - Nexus truth
- avoid implying that providers directly write `.planning/audits/current/*`

### Verification

- `bun test test/nexus/product-surface.test.ts`

## Final Verification

- `bun test test/nexus/types.test.ts`
- `bun test test/nexus/review.test.ts`
- `bun test test/nexus/ccb-runtime-adapter.test.ts`
- `bun test test/nexus/ledger-doctor.test.ts`
- `bun test test/nexus/product-surface.test.ts`
- `bun test test/nexus/*.test.ts`
- `git diff --check`

## Commit Shape

Preferred single commit if the receipt contract and recovery changes stay
coherent:

- `feat: add review receipt watchdog gating`
