Date: 2026-04-17
Spec: `docs/superpowers/specs/2026-04-17-nexus-verification-matrix-mainline-integration-design.md`
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Verification-Matrix Mainline Integration Plan

## Objective

Introduce a plan-owned canonical verification matrix so Nexus has one
repo-visible contract for run-level verification semantics, then thread that
contract through `/handoff`, `/build`, `/review`, `/qa`, and `/ship` without
adding a `/test` stage.

## Task 1: Add Verification-Matrix Paths And Types

### Files

- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `test/nexus/types.test.ts`

### Work

- add canonical artifact helper for:
  - `.planning/current/plan/verification-matrix.json`
- define verification-matrix types
- extend stage-status shape only where needed so later stages can report matrix
  alignment without duplicating truth
- document matrix as a durable plan output in manifest/type expectations

### Verification

- `bun test test/nexus/types.test.ts`

## Task 2: Make `/plan` Author The Canonical Matrix

### Files

- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `test/nexus/discover-frame.test.ts`

### Work

- derive verification obligations from:
  - frame design intent
  - frame `verification_required`
  - current canonical lifecycle defaults
- write `.planning/current/plan/verification-matrix.json`
- include the matrix in plan outputs and artifact index
- block or fail canonicalization if a successful plan does not persist the
  matrix

### Verification

- `bun test test/nexus/discover-frame.test.ts`

## Task 3: Thread The Matrix Through Governed Execution Inputs

### Files

- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/review.ts`
- Modify: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/review.test.ts`
- Modify: `test/nexus/ccb-runtime-adapter.test.ts`

### Work

- add `.planning/current/plan/verification-matrix.json` to predecessor artifacts
  where governed stages should consume it
- ensure build/review prompt contracts can reference the matrix without
  changing their canonical response shape
- keep review scope as the source of bounded/full-acceptance behavior; the
  matrix should supplement, not replace it

### Verification

- `bun test test/nexus/build-routing.test.ts`
- `bun test test/nexus/review.test.ts`
- `bun test test/nexus/ccb-runtime-adapter.test.ts`

## Task 4: Make QA Interpret Matrix-Owned Obligations

### Files

- Modify: `lib/nexus/commands/qa.ts`
- Modify: `test/nexus/qa.test.ts`

### Work

- read the verification matrix when present
- distinguish:
  - QA required
  - QA optional
  - design verification required
- preserve compatibility defaults when old runs do not yet have a matrix
- keep QA-owned artifacts canonical, especially design verification for
  design-bearing runs

### Verification

- `bun test test/nexus/qa.test.ts`

## Task 5: Make Ship Gate On Matrix-Owned Lifecycle Obligations

### Files

- Modify: `lib/nexus/commands/ship.ts`
- Modify: `test/nexus/ship.test.ts`

### Work

- read the verification matrix when present
- block ready ship state when required lifecycle obligations are missing:
  - QA when matrix says QA is required
  - design verification when matrix says design verification is required
- do not gate on attached-evidence slots such as benchmark or canary in this
  slice
- retain compatibility defaults for legacy in-flight runs with no matrix

### Verification

- `bun test test/nexus/ship.test.ts`

## Task 6: Docs And Surface Sync

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: affected generated `SKILL.md` files only if contract text changes
- Modify: `test/nexus/product-surface.test.ts`

### Work

- document the verification matrix as the canonical home for run-level test
  semantics
- clarify that `/benchmark`, `/canary`, and `/qa-only` are attached evidence,
  not canonical stages
- update product-surface expectations to mention the new contract

### Verification

- `bun test test/nexus/product-surface.test.ts`
- `bun run gen:skill-docs` if templates changed

## Final Verification

- `bun test test/nexus/*.test.ts`
- `git diff --check`

## Commit Shape

Preferred single commit if the work stays coherent:

- `feat: add a canonical verification matrix`
