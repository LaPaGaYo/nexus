Date: 2026-04-17
Spec: `docs/superpowers/specs/2026-04-17-nexus-setup-deploy-mainline-integration-design.md`
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Setup-Deploy Mainline Integration Plan

## Objective

Move deploy configuration out of `CLAUDE.md` and into a canonical Nexus-owned
deploy contract consumed by both `/ship` and `/land-and-deploy`, while keeping a
safe legacy fallback during migration.

## Task 1: Add Deploy Contract Paths And Types

### Files

- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/types.ts`
- Add: `lib/nexus/deploy-contract.ts`
- Modify: `test/nexus/types.test.ts`

### Work

- add artifact helpers for:
  - `.planning/deploy/deploy-contract.json`
  - `.planning/deploy/DEPLOY-CONTRACT.md`
  - `.planning/current/ship/deploy-readiness.json`
- define deploy contract and ship deploy-readiness types
- add parse/read helpers for canonical deploy contract and legacy fallback state

### Verification

- `bun test test/nexus/types.test.ts`

## Task 2: Integrate Deploy Readiness Into `/ship`

### Files

- Modify: `lib/nexus/commands/ship.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `lib/nexus/stage-content/ship/artifact-contract.md`
- Modify: `test/nexus/ship.test.ts`

### Work

- make `/ship` read canonical deploy contract
- persist `.planning/current/ship/deploy-readiness.json`
- distinguish:
  - canonical deploy contract present
  - legacy `CLAUDE.md` compatibility config only
  - no deploy config
- preserve non-deploying project behavior

### Verification

- `bun test test/nexus/ship.test.ts`

## Task 3: Migrate `/setup-deploy` To Canonical Deploy Contract

### Files

- Modify: `setup-deploy/SKILL.md.tmpl`
- Regenerate: `setup-deploy/SKILL.md`
- Modify: `test/skill-e2e-deploy.test.ts`
- Modify: `test/gen-skill-docs.test.ts`

### Work

- rewrite `/setup-deploy` instructions so canonical output is `.planning/deploy/*`
- stop presenting `CLAUDE.md` as deploy source of truth
- keep optional `CLAUDE.md` note only as migration/operator guidance if needed
- update E2E expectations from `CLAUDE.md` deploy section to canonical deploy contract

### Verification

- `bun test test/skill-e2e-deploy.test.ts`
- `bun test test/gen-skill-docs.test.ts`

## Task 4: Make `/land-and-deploy` Consume Canonical Contract First

### Files

- Modify: `land-and-deploy/SKILL.md.tmpl`
- Regenerate: `land-and-deploy/SKILL.md`
- Modify: `test/skill-e2e-deploy.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

### Work

- change `/land-and-deploy` to read `.planning/deploy/deploy-contract.json`
- keep legacy `CLAUDE.md` parsing only as fallback migration behavior
- switch first-run fingerprint hashing from `CLAUDE.md` deploy section to the
  canonical contract plus workflow files
- update user-facing copy to match the new contract boundary

### Verification

- `bun test test/skill-e2e-deploy.test.ts`
- `bun test test/nexus/product-surface.test.ts`

## Task 5: Docs, README, And Generated Skill Sync

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Regenerate affected `SKILL.md` files

### Work

- document `.planning/deploy/*` as canonical deploy state
- clarify `/setup-deploy` as deploy-contract authoring workflow
- clarify `/land-and-deploy` as deploy-contract consumer

### Verification

- `bun run gen:skill-docs`
- `bun test test/nexus/product-surface.test.ts`

## Final Verification

- `bun test test/nexus/*.test.ts`
- `bun test test/gen-skill-docs.test.ts`
- `git diff --check`

## Commit Shape

Preferred single commit if the work stays coherent:

- `feat: absorb setup-deploy into canonical deploy contract`
