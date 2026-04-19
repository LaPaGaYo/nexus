Date: 2026-04-17
Spec: `docs/superpowers/specs/2026-04-17-nexus-retro-archive-continuity-integration-design.md`
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Retro Archive + Continuity Integration Plan

## Objective

Move repo-scoped `/retro` into repo-visible historical evidence by writing
canonical retro archive records under `.planning/archive/retros/`, then let
fresh `/discover` absorb recent retros as continuity context without changing
the canonical lifecycle.

## Task 1: Add Retro Archive And Discover-Continuity Artifact Contracts

### Files

- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `test/nexus/types.test.ts`

### Work

- add artifact helpers for:
  - `.planning/archive/retros/<retro-id>/retro.json`
  - `.planning/archive/retros/<retro-id>/RETRO.md`
  - `.planning/current/discover/retro-continuity.json`
  - `.planning/current/discover/RETRO-CONTINUITY.md`
- define typed shapes for:
  - repo retro archive records
  - discover retro continuity records
- keep the shapes stage-attached and explicitly non-gating

### Verification

- `bun test test/nexus/types.test.ts`

## Task 2: Add Retro Archive + Continuity Helpers

### Files

- Add: `lib/nexus/retro-archive.ts`
- Modify: `lib/nexus/run-bootstrap.ts`
- Modify: `test/nexus/discover-frame.test.ts`

### Work

- implement helper logic to:
  - enumerate recent repo-scoped retro archives
  - ignore global retros for repo continuity
  - summarize recent findings into bounded discover continuity context
- keep closeout bootstrap immutable; synthesize retro continuity only when a
  fresh discover starts

### Verification

- `bun test test/nexus/discover-frame.test.ts`

## Task 3: Move Repo-Scoped `/retro` Persistence Into `.planning/archive/retros/`

### Files

- Modify: `retro/SKILL.md.tmpl`
- Modify: generated `retro/SKILL.md`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: retro-related skill validation / e2e tests as needed

### Work

- update repo-scoped `/retro` instructions so snapshots write to
  `.planning/archive/retros/` instead of `.context/retros/`
- keep `global` mode on `~/.nexus/retros/`
- make repo retro snapshots reference archived run artifacts when present
- keep compare-mode persistence semantics compatible: persist current-window
  snapshot only

### Verification

- `bun run gen:skill-docs`
- `bun test test/gen-skill-docs.test.ts`
- targeted retro skill tests if changed

## Task 4: Make Fresh `/discover` Emit Retro Continuity Artifacts

### Files

- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/session-continuation-advice.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `test/nexus/discover-frame.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

### Work

- on fresh runs, detect recent repo retros and write:
  - `.planning/current/discover/retro-continuity.json`
  - `.planning/current/discover/RETRO-CONTINUITY.md`
- thread those artifacts into discover predecessor context where appropriate
- update continuation advice so it distinguishes:
  - lifecycle legality
  - session advice
  - recent retro continuity evidence

### Verification

- `bun test test/nexus/discover-frame.test.ts`
- `bun test test/nexus/product-surface.test.ts`

## Task 5: Docs And Surface Sync

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: generated skill docs if templates changed
- Modify: `test/nexus/product-surface.test.ts`

### Work

- document `/retro` as stage-attached historical evidence
- clarify that repo retros now live in `.planning/archive/retros/`
- clarify that fresh `/discover` can absorb recent retrospective findings
- keep canonical lifecycle unchanged

### Verification

- `bun test test/nexus/product-surface.test.ts`
- `bun run gen:skill-docs` if templates changed

## Final Verification

- `bun test test/nexus/*.test.ts`
- `git diff --check`

## Commit Shape

Preferred single coherent commit:

- `feat: attach retrospectives to archive continuity`
