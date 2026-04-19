Date: 2026-04-18
Milestone: post-v1.0.32 support-surface integration
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Attached-Evidence Mainline Integration Design

## Goal

Absorb the remaining high-value follow-on support workflows as **stage-attached
evidence** so their outputs become repo-visible governed context without
turning them into new lifecycle stages or new default gates.

This slice covers:

- `/benchmark`
- `/canary`
- `/document-release`

## Scope

- define the canonical artifact locations for benchmark, canary, and
  document-release follow-on evidence
- define which canonical stage each evidence type attaches to
- define which skill owns authoring each evidence artifact
- define how these artifacts relate to the verification matrix, ship state, and
  closeout continuity
- implement repo-visible truth for these workflows without changing lifecycle
  transitions

## Non-Goals

- adding new canonical lifecycle stages for `/benchmark`, `/canary`, or
  `/document-release`
- making benchmark, canary, or documentation sync mandatory gates in this slice
- replacing raw `.nexus/*-reports` output directories
- redesigning `/land-and-deploy` or ship gate behavior from scratch
- retrofitting historical runs with synthetic attached evidence

## Problem Statement

Nexus already distinguishes between Stage-Owned verification obligations and
Stage-Attached evidence, but three support workflows still stop short of
canonical repo-visible truth:

- `/benchmark` writes raw benchmark reports under `.nexus/benchmark-reports`
  but does not attach a governed QA-facing summary to the current run
- `/canary` writes raw monitoring reports under `.nexus/canary-reports` but
  does not attach a governed ship-facing status artifact to the current run
- `/document-release` updates documentation files but does not leave a
  canonical closeout-facing sync record in `.planning/current/closeout/`

That means these workflows are operationally useful but still feel external to
the lifecycle:

1. support evidence exists, but not where governed operators expect it
2. future runs and retros cannot reliably discover the latest evidence from the
   canonical stage directories
3. README and skill surface describe follow-on support, but repo-visible truth
   is incomplete

## Desired End State

- `/benchmark` writes a QA-attached performance summary at
  `.planning/current/qa/perf-verification.md`
- `/canary` writes a ship-attached canary status record at
  `.planning/current/ship/canary-status.json`
- `/document-release` writes a closeout-attached documentation sync record at
  `.planning/current/closeout/documentation-sync.md`
- raw support reports remain in `.nexus/*-reports/` as detailed evidence
- none of these artifacts become default lifecycle gates in this slice

## Core Design Decisions

### 1. These remain Stage-Attached, not Stage-Owned

Benchmark, canary, and document-release remain support workflows.

They become **repo-visible attached evidence**, not new lifecycle stages and
not new default readiness gates.

Rationale:

- the canonical lifecycle is already stable
- these workflows are important, but not universal requirements on every run
- their primary value is traceability, continuity, and operator clarity

### 2. `/benchmark` attaches to `/qa`

Canonical attached artifact:

- `.planning/current/qa/perf-verification.md`

Owning workflow:

- `/benchmark`

Why `/qa`:

- benchmark results are verification evidence
- performance checks are closer to QA semantics than to build or review
- the verification matrix already models benchmark as attached evidence

The attached record should summarize:

- URL or page set tested
- mode used (`baseline`, `diff`, `quick`, `trend`, or standard comparison)
- whether a baseline existed
- high-level verdict (`no_regression`, `warning`, `regression_detected`)
- paths to the raw `.nexus/benchmark-reports/*` outputs

### 3. `/canary` attaches to `/ship`

Canonical attached artifact:

- `.planning/current/ship/canary-status.json`

Owning workflow:

- `/canary`

Why `/ship`:

- canary evidence is post-deploy ship follow-on evidence
- the ship layer already owns release readiness and deploy-related metadata
- `/land-and-deploy` is a follow-on workflow from ship, not a new lifecycle
  owner

This status record should summarize:

- URL monitored
- source workflow (`canary` for this slice)
- duration
- pages monitored
- canary verdict (`healthy`, `degraded`, `broken`)
- alert counts
- pointers to raw `.nexus/canary-reports/*` outputs

### 4. `/document-release` attaches to `/closeout`

Canonical attached artifact:

- `.planning/current/closeout/documentation-sync.md`

Owning workflow:

- `/document-release`

Why `/closeout`:

- document sync is a post-ship, post-code-delivery follow-on
- the correct lifecycle attachment is "what documentation state did this run
  leave behind?"
- closeout already owns the terminal governed record for the run

The sync record should summarize:

- which documentation files were reviewed
- which were updated
- whether CHANGELOG was touched
- whether VERSION was changed or skipped
- whether the docs were already current

### 5. Raw reports stay where they are

This slice does **not** move:

- `.nexus/benchmark-reports/*`
- `.nexus/canary-reports/*`

Those locations remain the detailed evidence stores.

The new `.planning/current/*` artifacts are compact canonical summaries that
point back to the raw reports.

### 6. No new default gates in this slice

These attached-evidence artifacts do not become default blockers for:

- `/qa`
- `/ship`
- `/closeout`

The lifecycle may mention and surface them, but absence of benchmark, canary,
or documentation sync evidence should not block canonical stage completion in
this slice.

Future specs may decide to promote some of this evidence into stricter policy,
but not here.

## Canonical Artifact Map

### Benchmark

- raw reports:
  - `.nexus/benchmark-reports/{date}-benchmark.md`
  - `.nexus/benchmark-reports/{date}-benchmark.json`
- attached evidence:
  - `.planning/current/qa/perf-verification.md`

### Canary

- raw reports:
  - `.nexus/canary-reports/{date}-canary.md`
  - `.nexus/canary-reports/{date}-canary.json`
- attached evidence:
  - `.planning/current/ship/canary-status.json`

### Document Release

- documentation file edits remain in normal repo files
- attached evidence:
  - `.planning/current/closeout/documentation-sync.md`

## Product-Surface Implications

README, `docs/skills.md`, and generated skill docs should explicitly describe
these workflows as attached evidence producers:

- `/benchmark` -> QA-attached performance evidence
- `/canary` -> ship-attached post-deploy evidence
- `/document-release` -> closeout-attached documentation sync evidence

This makes the support surface legible without pretending these workflows are
new lifecycle stages.

## Completion Criteria

This slice is complete when:

- artifact helpers exist for the three canonical attached-evidence paths
- benchmark/canary/document-release skill contracts instruct writing the new
  artifacts
- tests lock the helper paths and generated skill-surface expectations
- README and `docs/skills.md` describe the attachments clearly
- no lifecycle transitions or default gates change
