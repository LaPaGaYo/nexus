Date: 2026-04-17
Milestone: post-v1.0.32 support-surface integration
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Retro Archive + Continuity Integration Design

## Goal

Absorb `/retro` into Nexus repo-visible governed truth as archived historical
evidence, then feed recent retrospective findings back into fresh-run continuity
without turning `/retro` into a canonical lifecycle stage.

## Scope

- define canonical repo-scoped retrospective archive artifacts
- define how repo-scoped `/retro` reads archived run artifacts by default
- define how fresh `/discover` absorbs recent retros into continuity context
- define how `/retro compare` and default repo retros persist historical
  evidence
- keep global retro behavior compatible while separating it from repo-scoped
  governed truth

## Non-Goals

- adding `/retro` as a canonical lifecycle stage
- making retrospectives required for every run
- making retro findings gate `/ship`, `/closeout`, or any lifecycle readiness
- replacing git-history analysis with archive-only analysis
- mutating completed `/closeout` artifacts after the fact

## Problem Statement

Nexus already has a strong post-run archive model:

- `/closeout` archives governed run truth
- archived runs preserve review, QA, ship, learnings, and next-run bootstrap
- fresh `/discover` can continue from archived closeout outputs

But `/retro` still lives outside that model in repo mode:

- repo retros currently persist only to `.context/retros/*.json`
- retrospective snapshots are not part of repo-visible Nexus archive truth
- fresh-run continuity does not automatically see recent retrospective findings
- there is no canonical link between repo retros and archived governed runs

This creates a continuity gap:

1. retros are useful historical evidence but not part of Nexus archive truth
2. retros can surface cross-run patterns, but fresh runs do not absorb them
3. `/closeout` and `/retro` both speak about "what happened", but they do not
   share a stable repo-visible attachment model

## Desired End State

- repo-scoped `/retro` writes canonical retrospective artifacts under
  `.planning/archive/retros/`
- each repo retrospective references the archived runs and closeout artifacts it
  analyzed
- fresh `/discover` can surface recent retrospective findings as continuity
  context on new runs
- `/retro` remains a sidecar workflow that reads canonical artifacts and emits
  attached evidence, not a lifecycle owner

## Core Design Decisions

### 1. `/retro` remains Stage-Attached, not stage-owned

`/retro` stays outside the canonical lifecycle.

It does not own transitions, readiness, or gate decisions.

It becomes:

- **Stage-Attached historical evidence**
- attached to archived runs and fresh-run continuity

### 2. Repo retros belong in `.planning/archive/retros/`

Repo-scoped retrospective snapshots should no longer use `.context/retros/` as
their primary persistence location.

Canonical repo-scoped archive paths:

- `.planning/archive/retros/<retro-id>/retro.json`
- `.planning/archive/retros/<retro-id>/RETRO.md`

Where `<retro-id>` is a stable archive folder key such as:

- `2026-04-17-01`
- `2026-04-17-02`

Rationale:

- retrospective outputs are historical evidence, not current-stage truth
- `.planning/archive/` is the canonical home for completed-run history
- repo retros should be versioned and inspectable alongside archived runs

### 3. Global retros stay outside repo archive

`/retro global` remains a separate host-level workflow.

Its snapshots may continue to live under:

- `~/.nexus/retros/`

This slice concerns **repo-scoped** retros only.

### 4. `/retro` should read archived run artifacts by default

Repo-scoped retros should continue using git history and existing metrics, but
they should also treat archived Nexus run artifacts as first-class source
material.

Primary Nexus inputs:

- `.planning/archive/runs/*/current-run.json`
- `.planning/archive/runs/*/closeout/CLOSEOUT-RECORD.md`
- `.planning/archive/runs/*/closeout/learnings.json`
- `.planning/archive/runs/*/closeout/next-run-bootstrap.json`

This lets retrospectives reason over governed outcomes, learnings, and run
completion decisions instead of only commit history.

### 5. Fresh-run continuity should absorb retros at discover time, not closeout time

`/closeout` cannot predict future retrospectives.

Therefore, retro continuity must be synthesized when a fresh `/discover` starts,
not baked into the original `NEXT-RUN.md` at closeout time.

This is a hard boundary:

- `/closeout` writes immutable closeout-owned truth
- `/retro` writes later historical evidence
- fresh `/discover` reads both and composes continuity context

### 6. Retro continuity is discover-attached, not bootstrap-owned

Fresh `/discover` should generate continuity artifacts from recent repo retros:

- `.planning/current/discover/retro-continuity.json`
- `.planning/current/discover/RETRO-CONTINUITY.md`

These artifacts should:

- list the recent retrospective artifacts considered
- summarize carry-forward findings for the new run
- point back to archived retro snapshots

They are attached continuity evidence, not lifecycle gates.

## Canonical Retro Archive Record

Minimum repo-scoped retro JSON shape:

- `schema_version`
- `retro_id`
- `mode`
  - `repo`
  - `compare`
- `window`
- `generated_at`
- `repository_root`
- `linked_run_ids`
- `source_artifacts`
- `summary`
- `key_findings`
- `follow_ups`

Notes:

- `mode=compare` still persists only the current-window snapshot, matching the
  existing retro semantics
- `linked_run_ids` should refer to archived governed runs covered by the retro
- `source_artifacts` should include the archived closeout artifacts used as
  Nexus evidence

## Discover Continuity Attachment

When a fresh run begins from archived continuity, `/discover` should look for
recent repo-scoped retros and materialize a continuity attachment.

Minimum continuity JSON shape:

- `schema_version`
- `run_id`
- `generated_at`
- `source_retro_artifacts`
- `recent_findings`
- `recommended_attention_areas`

Selection rules:

- prefer the most recent repo-scoped retros
- ignore global retros
- cap the number of retros included to keep discover context bounded

## Lifecycle Interaction

### `/closeout`

- unchanged as lifecycle owner
- does not write retro artifacts
- does not mutate archived run truth after completion

### `/retro`

- consumes archived Nexus run artifacts plus existing git/test metrics
- writes repo-scoped retro archive records under `.planning/archive/retros/`
- keeps global mode behavior separate

### fresh `/discover`

- may consume recent repo retros as predecessor context
- writes discover-attached retro continuity artifacts
- may mention recent retros in session continuation guidance and bootstrap-style
  continuity summaries

## Gate Semantics

Retro artifacts are **never gate-affecting** in this slice.

They may:

- inform future framing or planning
- surface recurring issues
- improve next-run continuity

They may not:

- block `/plan`
- block `/ship`
- block `/closeout`
- change reviewed or shipped provenance

## Compatibility

Backward compatibility requirements:

- old repos without `.planning/archive/retros/` remain valid
- fresh `/discover` should treat missing retro archive as normal
- global retro storage remains supported
- repo retros may continue to read older `.context/retros/*.json` during a
  migration window, but new canonical repo snapshots should be written under
  `.planning/archive/retros/`

## Success Criteria

This integration is complete when:

1. repo-scoped `/retro` writes canonical retrospective artifacts under
   `.planning/archive/retros/`
2. retro archive records clearly link to archived governed runs and closeout
   artifacts
3. fresh `/discover` writes repo-visible retro continuity artifacts when recent
   retros exist
4. no lifecycle gates depend on retro output
5. README, skill docs, and tests describe `/retro` as attached historical
   evidence rather than hidden side storage
