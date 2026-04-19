Date: 2026-04-17
Milestone: post-v1.0.32 support-surface integration
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Verification-Matrix Mainline Integration Design

## Goal

Absorb Nexus "test semantics" into the canonical lifecycle by introducing a
plan-owned verification matrix that records per-run verification obligations
across `/build`, `/review`, `/qa`, and `/ship` without adding a redundant
`/test` lifecycle stage.

## Scope

- define the canonical verification matrix artifact and ownership boundary
- define how `/plan` writes that matrix for every execution-ready run
- define how `/handoff`, `/build`, `/review`, `/qa`, and `/ship` consume the
  matrix as governed contract input
- define which verification obligations may affect lifecycle readiness now
- define how future support workflows (`/benchmark`, `/canary`, `/qa-only`)
  attach to the matrix without becoming stages

## Non-Goals

- adding a new canonical `/test` command or lifecycle stage
- moving `/benchmark`, `/canary`, or `/qa-only` into the canonical lifecycle
- redesigning build discipline, review scope, or QA reporting from scratch
- making benchmark or canary mandatory in this slice
- retrofitting every historical run with a verification matrix

## Problem Statement

Nexus currently has real verification behavior, but the contract is scattered:

- `/plan` writes execution readiness and sprint contract, but not a canonical
  verification contract
- `/build` records implementation-side verification summaries
- `/review` enforces full-acceptance or bounded fix-cycle audit behavior
- `/qa` records explicit validation and design verification
- `/ship` checks release readiness and deploy readiness
- `/benchmark`, `/canary`, and `/qa-only` remain outside lifecycle truth

That creates a persistent ambiguity:

1. where the per-run verification contract actually lives
2. which stage owns which verification obligation
3. which verification evidence is gate-affecting versus advisory

This is the remaining "where does test live?" gap in the support-surface
absorption roadmap.

## Desired End State

- `/plan` writes a canonical verification matrix for every ready run
- the matrix makes stage-owned verification responsibilities explicit
- `/build`, `/review`, `/qa`, and `/ship` consume the same matrix as contract
  input
- lifecycle gates only depend on Stage-Owned verification obligations
- support workflows can attach verification evidence to the matrix later
  without becoming new stages

## Core Design Decisions

### 1. Verification matrix is plan-owned

The canonical verification matrix is authored by `/plan`, not by `/qa`.

Rationale:

- verification intent belongs to execution planning
- later stages should consume the same run-level contract
- readiness should become explicit before governed execution starts

### 2. The matrix is a canonical stage artifact

The canonical artifact path is:

- `.planning/current/plan/verification-matrix.json`

There is no markdown companion in this slice.

Rationale:

- the contract is primarily machine-consumed by later lifecycle stages
- execution readiness already has human-readable markdown artifacts
- adding a second rendering would duplicate truth too early

### 3. No new `/test` stage

The verification matrix absorbs test semantics as **contract**, not as
additional lifecycle surface.

Lifecycle remains:

- `/discover -> /frame -> /plan -> /handoff -> /build -> /review -> /qa -> /ship -> /closeout`

### 4. The matrix distinguishes Stage-Owned and Stage-Attached verification

The matrix will separate:

- **Stage-Owned obligations**
  - may affect readiness or release gates
  - owned by `/build`, `/review`, `/qa`, or `/ship`
- **Stage-Attached evidence**
  - informative or future-facing
  - used for `/benchmark`, `/canary`, `/qa-only`, or later follow-on work

Only Stage-Owned obligations may block canonical lifecycle readiness in this
slice.

### 5. Current scope only gates canonical lifecycle obligations

This slice will make the following verification obligations explicit:

- implementation verification owned by `/build`
- audit verification owned by `/review`
- QA verification owned by `/qa`
- release-readiness verification owned by `/ship`
- design verification as a QA-owned specialization for design-bearing runs
- deploy readiness as a ship-owned specialization for shipping runs

The matrix may include placeholders for `benchmark` and `canary`, but they are
advisory in this slice.

## Canonical Verification Matrix

The matrix should be structured enough for later stages to answer:

- what verification obligations exist for this run
- which stage owns each obligation
- whether the obligation is gate-affecting
- which artifact is expected to record completion

Minimum JSON shape:

- `schema_version`
- `run_id`
- `generated_at`
- `design_impact`
- `verification_required`
- `obligations`
  - `build`
    - `owner_stage`
    - `required`
    - `gate_affecting`
    - `expected_artifacts`
  - `review`
    - `owner_stage`
    - `required`
    - `gate_affecting`
    - `mode`
    - `expected_artifacts`
  - `qa`
    - `owner_stage`
    - `required`
    - `gate_affecting`
    - `design_verification_required`
    - `expected_artifacts`
  - `ship`
    - `owner_stage`
    - `required`
    - `gate_affecting`
    - `deploy_readiness_required`
    - `expected_artifacts`
- `attached_evidence`
  - `benchmark`
    - `supported`
    - `required`
  - `canary`
    - `supported`
    - `required`
  - `qa_only`
    - `supported`
    - `required`

Defaults:

- `build.required = true`
- `review.required = true`
- `qa.required = frameStatus.verification_required || design_impact !== 'none'`
- `ship.required = true`
- `qa.design_verification_required = design_impact !== 'none'`
- `ship.deploy_readiness_required = true`
- all attached evidence entries default to `supported=true`, `required=false`

## Plan Integration

`/plan` should always write `.planning/current/plan/verification-matrix.json`.

Plan readiness behavior:

- missing matrix after a nominally successful `/plan` is a plan canonicalization
  failure
- the matrix becomes a durable output of `/plan`
- the matrix should reflect current design-impact classification and existing
  `verification_required` plan intent

## Handoff Integration

`/handoff` should include the verification matrix as predecessor input.

Purpose:

- governed handoff should freeze not just execution routing, but also the run's
  verification contract
- downstream governed stages should not guess whether QA or design verification
  is expected

## Build Integration

`/build` should consume the matrix as contract input.

This does not change build's core role.

It clarifies that:

- build owns implementation-side verification evidence
- build should not claim completion against obligations owned by later stages
- build prompts may reference the matrix to explain what remains downstream

## Review Integration

`/review` should consume the matrix as contract input.

The matrix does not replace review scope.

Instead:

- review scope still determines bounded vs full-acceptance audit behavior
- the matrix records that review is a gate-affecting verification obligation
- review can report against the same expected evidence model used by ship

## QA Integration

`/qa` should consume the matrix and reflect whether QA obligations were required
for the run.

In this slice:

- if `qa.required = true`, `/qa` remains the canonical owner of explicit
  validation evidence
- design-bearing runs continue to use
  `.planning/current/qa/design-verification.md`
- matrix alignment should make it explicit when QA was optional versus required

## Ship Integration

`/ship` should consume the matrix and refuse ready state when required
verification obligations are still missing.

In this slice, `ship` should only gate on canonical lifecycle obligations:

- completed review
- completed QA when matrix says QA is required
- design verification when matrix says design verification is required
- deploy readiness as ship-owned evidence

`benchmark` and `canary` remain advisory here.

## Migration Strategy

This slice should be forward-only for current runs.

- new `/plan` executions write the matrix
- later stages consume it when present
- if a legacy run lacks the matrix, later stages may derive compatibility
  defaults rather than refusing immediately

Compatibility defaults should be conservative:

- assume `build.required = true`
- assume `review.required = true`
- derive `qa.required` from existing `verification_required` and design impact
- assume `ship.required = true`

The matrix should become required for fresh runs after migration, but not break
active in-flight runs immediately.

## Acceptance Criteria

This integration is complete when:

- `/plan` writes `.planning/current/plan/verification-matrix.json`
- `verification-matrix.json` becomes a durable plan artifact
- `/handoff`, `/build`, `/review`, `/qa`, and `/ship` accept the matrix as
  governed input
- `/ship` gates only on Stage-Owned obligations from the matrix
- `benchmark`, `canary`, and `qa-only` appear only as attached evidence slots,
  not lifecycle gates
- docs and tests describe the verification matrix as the canonical home for
  run-level test semantics
