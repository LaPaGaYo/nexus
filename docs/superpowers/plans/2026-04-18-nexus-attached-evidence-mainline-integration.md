Date: 2026-04-18
Spec: `docs/superpowers/specs/2026-04-18-nexus-attached-evidence-mainline-integration-design.md`
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Attached-Evidence Mainline Integration Plan

## Objective

Connect `/benchmark`, `/canary`, and `/document-release` to canonical
repo-visible stage directories by adding attached-evidence artifacts, updating
skill contracts, and locking the surface with tests and docs.

## Task 1: Add Canonical Attached-Evidence Paths And Types

### Files

- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `test/nexus/types.test.ts`

### Work

- add artifact helpers for:
  - `.planning/current/qa/perf-verification.md`
  - `.planning/current/ship/canary-status.json`
  - `.planning/current/closeout/documentation-sync.md`
- define the canary status schema in Nexus types
- extend type tests to freeze the new helpers and attached-evidence record

### Verification

- `bun test test/nexus/types.test.ts`

## Task 2: Attach `/benchmark` To QA Evidence

### Files

- Modify: `benchmark/SKILL.md.tmpl`
- Modify: generated `benchmark/SKILL.md`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-e2e-deploy.test.ts`

### Work

- keep raw benchmark reports in `.nexus/benchmark-reports/`
- instruct `/benchmark` to also write `.planning/current/qa/perf-verification.md`
- make the attached evidence summarize verdict, scope, and raw report paths
- lock the generated skill surface so the canonical QA evidence path is visible

### Verification

- `bun test test/gen-skill-docs.test.ts`
- `bun test test/skill-e2e-deploy.test.ts`

## Task 3: Attach `/canary` To Ship Evidence

### Files

- Modify: `canary/SKILL.md.tmpl`
- Modify: generated `canary/SKILL.md`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-e2e-deploy.test.ts`

### Work

- keep raw canary reports in `.nexus/canary-reports/`
- instruct `/canary` to also write `.planning/current/ship/canary-status.json`
- define a stable JSON summary shape for verdict, alerts, and raw report
  pointers
- lock the generated skill surface so the canonical ship evidence path is
  visible

### Verification

- `bun test test/gen-skill-docs.test.ts`
- `bun test test/skill-e2e-deploy.test.ts`

## Task 4: Attach `/document-release` To Closeout Evidence

### Files

- Modify: `document-release/SKILL.md.tmpl`
- Modify: generated `document-release/SKILL.md`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-e2e.test.ts`

### Work

- instruct `/document-release` to always write
  `.planning/current/closeout/documentation-sync.md`
- make the sync record summarize reviewed files, updated files, changelog
  handling, and version-bump outcome
- preserve the existing commit/no-clobber rules while adding the attached
  evidence output

### Verification

- `bun test test/gen-skill-docs.test.ts`
- `bun test test/skill-e2e.test.ts`

## Task 5: Docs And Product Surface Sync

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `lib/nexus/stage-content/qa/artifact-contract.md`
- Modify: `lib/nexus/stage-content/ship/artifact-contract.md`
- Modify: `lib/nexus/stage-content/closeout/artifact-contract.md`
- Modify: `test/nexus/product-surface.test.ts`

### Work

- describe benchmark/canary/document-release as stage-attached evidence
- make the attached artifact destinations explicit in user-facing docs
- clarify that these artifacts do not become new default gates in this slice

### Verification

- `bun test test/nexus/product-surface.test.ts`

## Final Verification

- `bun run gen:skill-docs`
- `bun test test/nexus/types.test.ts`
- `bun test test/gen-skill-docs.test.ts`
- `bun test test/skill-e2e-deploy.test.ts`
- `bun test test/skill-e2e.test.ts`
- `bun test test/nexus/product-surface.test.ts`
- `bun test test/nexus/*.test.ts`
- `git diff --check`

## Commit Shape

Preferred single commit if the slice stays coherent:

- `feat: attach benchmark canary and doc sync evidence`
