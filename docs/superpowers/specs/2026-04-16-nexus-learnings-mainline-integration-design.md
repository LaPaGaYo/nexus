# Nexus Learnings Mainline Integration Design

Date: 2026-04-16
Milestone: support-surface absorption follow-on
Branch: `main`

## Goal

Integrate `/learn` into the governed Nexus mainline without turning learnings
into a new lifecycle stage.

The end state should be:

- governed runs emit repo-visible learning candidates
- `/closeout` consolidates canonical per-run learnings into `.planning/`
- archived runs retain their learning record as part of governed truth
- the existing global learnings store under `~/.nexus/` remains useful, but no
  longer acts as the only meaningful source of learning state

## Scope

- define how learnings move from support workflow into canonical run artifacts
- define stage ownership for learning candidates and final learning records
- define the relationship between repo-visible run learnings and the existing
  append-only global learnings log
- define candidate artifact shapes and ownership rules
- define the minimum compatibility path for the existing `/learn` surface

## Non-Goals

- adding `/learn` as a new canonical lifecycle stage
- replacing the existing `nexus-learnings-log` and `nexus-learnings-search`
  scripts immediately
- building automatic contradiction pruning in this spec
- making every stage emit learnings by default
- redesigning cross-project learnings policy in this spec

## Problem Statement

Today, `/learn` is useful but structurally separate from governed run truth.

Current state:

- learnings are primarily stored at
  `~/.nexus/projects/<slug>/learnings.jsonl`
- the storage is append-only and useful for search, pruning, and cross-session
  recall
- the governed Nexus lifecycle does not currently emit canonical repo-visible
  learning artifacts during or after a run

That creates a product gap:

- important lessons discovered during `/review`, `/qa`, `/ship`, or `/closeout`
  may exist only in the global store
- archived governed work does not have a canonical learning summary attached to
  it
- a future run can search past learnings, but the run itself does not clearly
  publish what it learned as governed truth

This is the highest-value remaining support-surface absorption candidate because
it compounds across runs and directly reduces repeated mistakes.

## Recommendation

Absorb `/learn` into the mainline as a **closeout-owned canonicalization flow**
with **stage-attached learning candidates**.

That means:

- `/review`, `/qa`, and `/ship` may emit learning candidates when a genuine
  learning emerges
- `/closeout` becomes the canonical owner of the run's final learning record
- the final learning record is written into repo-visible `.planning/current/`
  and archived with the run
- the global `~/.nexus/.../learnings.jsonl` store remains a useful append-only
  operational memory layer, but canonical run truth lives in-repo

This keeps the lifecycle unchanged while making learnings part of governed
completion.

## Absorption Mode

`/learn` should be absorbed in two modes:

### 1. Stage-Attached candidate generation

Eligible stages:

- `/review`
- `/qa`
- `/ship`
- optional future `/investigate` summary hook when it is explicitly tied to the
  governed run

These stages may emit candidate learnings, but they do not own the final run
learning record.

### 2. Stage-Owned canonicalization at `/closeout`

`/closeout` owns:

- final per-run learning consolidation
- repo-visible learning summary
- archival of the run's learning record

This matches the semantics of `/closeout`: it is already the run-completion
stage that consolidates what the governed work unit actually produced.

## Core Rules

### 1. Learning candidate rule

Intermediate stages may emit learning candidates only when they discovered a
genuine reusable lesson, pitfall, preference, architecture note, or tool
insight that would save future time.

They must not log generic observations or duplicate obvious stage output.

### 2. Closeout ownership rule

Only `/closeout` may publish the canonical per-run learning summary.

That summary becomes part of the run's governed truth and archive.

### 3. Dual-store rule

The system will temporarily support two learning layers:

- global append-only operational memory:
  `~/.nexus/projects/<slug>/learnings.jsonl`
- repo-visible governed run learnings under `.planning/`

During this phase:

- the global store remains useful for `/learn search`, pruning, and cross-run
  recall
- repo-visible run learnings become the canonical record of what a governed run
  learned

### 4. No-new-stage rule

Do not add a `/learn` stage.

Learning absorption happens through artifacts and closeout ownership, not by
changing the lifecycle.

### 5. Candidate-to-record rule

Learning candidates are provisional.

The canonical run learning record is the result of closeout consolidation, not
the raw union of all candidate files.

### 6. Completion rule

Learning capture should not block every closeout by default.

However, when valid learning candidates exist, `/closeout` should absorb them
into the run record rather than silently dropping them.

## Proposed Artifact Model

This spec defines the target artifact model.

### Candidate artifacts

These are stage-attached and optional:

- `.planning/current/review/learning-candidates.json`
- `.planning/current/qa/learning-candidates.json`
- `.planning/current/ship/learning-candidates.json`

Purpose:

- capture potential reusable lessons discovered during governed stages
- preserve enough structure for later consolidation

Suggested record shape:

```json
{
  "schema_version": 1,
  "run_id": "run-...",
  "stage": "review",
  "generated_at": "2026-04-16T00:00:00.000Z",
  "candidates": [
    {
      "type": "pitfall",
      "key": "owner-mutation-requires-db-lock",
      "insight": "Concurrent owner mutations must serialize through the database.",
      "confidence": 8,
      "source": "observed",
      "files": ["apps/web/src/server/workspaces/service.ts"]
    }
  ]
}
```

### Closeout-owned canonical record

These are canonical run outputs:

- `.planning/current/closeout/LEARNINGS.md`
- `.planning/current/closeout/learnings.json`

Purpose:

- summarize the run's final governed learnings
- give the archive a structured machine-readable record and a readable markdown
  summary

Suggested `learnings.json` shape:

```json
{
  "schema_version": 1,
  "run_id": "run-...",
  "generated_at": "2026-04-16T00:00:00.000Z",
  "source_candidates": [
    ".planning/current/review/learning-candidates.json",
    ".planning/current/qa/learning-candidates.json"
  ],
  "learnings": [
    {
      "type": "pitfall",
      "key": "owner-mutation-requires-db-lock",
      "insight": "Concurrent owner mutations must serialize through the database.",
      "confidence": 8,
      "source": "observed",
      "origin_stage": "review",
      "files": ["apps/web/src/server/workspaces/service.ts"]
    }
  ]
}
```

### Archived run learnings

These should be preserved with the run archive:

- `.planning/archive/runs/<run-id>/closeout/learnings.json`
- `.planning/archive/runs/<run-id>/closeout/LEARNINGS.md`

This makes learnings part of archived governed work instead of an external-only
memory layer.

## Relationship To Existing `~/.nexus` Learnings

The current learnings tooling should not be broken.

### Existing behavior to preserve

- `nexus-learnings-log` continues to append JSONL records
- `nexus-learnings-search` continues to search and deduplicate the operational
  store
- `/learn` continues to support show/search/prune/export/stats/manual add flows

### New behavior to add over time

- canonical closeout learnings should be optionally mirrored into the global
  store for continuity
- `/learn export` should prefer canonical archived run learnings when available
- `/learn show` should be able to surface the latest canonical run learnings in
  addition to the operational JSONL store

The migration rule is:

- do not remove the global store first
- first make repo-visible run learnings authoritative for governed runs
- then teach `/learn` to incorporate them

## Stage Ownership And Flow

### `/review`

May emit learning candidates for:

- non-obvious security or correctness pitfalls
- repeated anti-patterns
- verified architectural lessons revealed by the audit

### `/qa`

May emit learning candidates for:

- non-obvious validation gotchas
- environment or workflow pitfalls
- reproducible UI or runtime verification lessons

### `/ship`

May emit learning candidates for:

- release-process pitfalls
- PR/deploy handoff constraints
- release-gate quirks with high future reuse value

### `/closeout`

Must:

- gather available candidate artifacts
- normalize and consolidate them
- write canonical closeout learnings artifacts
- add them to the run artifact index
- preserve them into the archive

## Gate Semantics

Learning integration should remain informational at first.

That means:

- absence of learning candidates does not block closeout
- malformed candidate artifacts may block closeout only if the candidate files
  are claimed as canonical outputs for the current run
- the first implementation should optimize for safe capture, not mandatory
  authoring pressure

## Migration Plan

### Phase 1

- introduce candidate artifact support
- introduce closeout-owned `LEARNINGS.md` and `learnings.json`
- archive the canonical run learnings

### Phase 2

- teach `/learn` to read canonical archived run learnings
- teach `/learn export` to prefer canonical run records

### Phase 3

- decide whether the global JSONL store should become a derived mirror rather
  than the primary operator surface

## Recommendation

Implement `/learn` absorption next, using this sequence:

1. add candidate artifact support to `/review`, `/qa`, and `/ship`
2. make `/closeout` write canonical run learnings artifacts
3. archive those artifacts with the run
4. update `/learn` to consume canonical run learnings alongside the global store

This gives Nexus a governed learning loop without changing the lifecycle or
breaking the current `/learn` support surface.
