# Nexus Active Stage Absorption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the currently active governed path from adapter-led upstream identity into Nexus-owned internal stage assets while keeping the canonical Nexus command surface and repo-visible truth model unchanged.

**Architecture:** Build on the existing `codex/nexus-command-surface` branch. Introduce Nexus-owned stage packs for active commands and route PM, GSD, Superpowers, and CCB behavior through those packs so upstream repos remain source material and CCB remains transport only.

**Tech Stack:** Bun, TypeScript, Bun test, existing `lib/nexus/` runtime, repo-visible `.planning/` artifacts, imported upstream repos under `upstream/`

---

## Execution Base

This plan should not execute from `main`.

Execution base:

- branch: `codex/nexus-command-surface`
- baseline: Milestone 3 Phase 1 complete

Do not begin work until the execution worktree is created from that branch.

## Locked Rules

- canonical Nexus commands remain unchanged
- `lib/nexus/` remains the only contract owner
- `.planning/` and canonical stage artifacts remain the only governed truth
- PM Skills, GSD, and Superpowers must move toward absorbed Nexus-owned stage assets, not parallel command surfaces
- CCB remains dispatch and transport only
- review and ship reserved seams remain inactive unless explicitly planned later
- backend output only counts after Nexus normalization and canonical writeback

## File Structure

### Existing Runtime Files To Modify

- `lib/nexus/absorption/index.ts`
- `lib/nexus/adapters/pm.ts`
- `lib/nexus/adapters/gsd.ts`
- `lib/nexus/adapters/superpowers.ts`
- `lib/nexus/adapters/ccb.ts`
- `lib/nexus/adapters/types.ts`
- `lib/nexus/adapters/registry.ts`
- `lib/nexus/commands/discover.ts`
- `lib/nexus/commands/frame.ts`
- `lib/nexus/commands/plan.ts`
- `lib/nexus/commands/handoff.ts`
- `lib/nexus/commands/build.ts`
- `lib/nexus/commands/closeout.ts`
- `lib/nexus/normalizers/pm.ts`
- `lib/nexus/normalizers/gsd.ts`
- `lib/nexus/normalizers/superpowers.ts`
- `lib/nexus/normalizers/ccb.ts`
- `lib/nexus/types.ts`

### New Nexus-Owned Stage Asset Files

- `lib/nexus/stage-packs/types.ts`
- `lib/nexus/stage-packs/index.ts`
- `lib/nexus/stage-packs/discover.ts`
- `lib/nexus/stage-packs/frame.ts`
- `lib/nexus/stage-packs/plan.ts`
- `lib/nexus/stage-packs/handoff.ts`
- `lib/nexus/stage-packs/build.ts`
- `lib/nexus/stage-packs/closeout.ts`
- `lib/nexus/stage-packs/source-map.ts`

### Inventory And Docs Files

- `upstream-notes/pm-skills-inventory.md`
- `upstream-notes/gsd-inventory.md`
- `upstream-notes/superpowers-inventory.md`
- `upstream-notes/ccb-inventory.md`
- `upstream-notes/absorption-status.md`
- `README.md`
- `docs/skills.md`

### Test Files

- `test/nexus/absorption-runtime.test.ts`
- `test/nexus/discover-frame.test.ts`
- `test/nexus/plan-handoff-build.test.ts`
- `test/nexus/build-routing.test.ts`
- `test/nexus/build-discipline.test.ts`
- `test/nexus/closeout.test.ts`
- `test/nexus/inventory.test.ts`

## Task 1: Freeze The Nexus-Owned Stage Pack Contract

**Files:**
- Create: `lib/nexus/stage-packs/types.ts`
- Create: `lib/nexus/stage-packs/index.ts`
- Create: `lib/nexus/stage-packs/source-map.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `test/nexus/absorption-runtime.test.ts`

- [ ] **Step 1: Add a failing test that requires Nexus-owned stage pack identity**

Expected additions to the test:

- active runtime seams expose `nexus_stage_pack`
- traceability still preserves upstream `source_map`
- absorbed pack identity no longer equals raw backend product identity

- [ ] **Step 2: Run the targeted test to confirm the contract is missing**

Run: `bun test test/nexus/absorption-runtime.test.ts`
Expected: FAIL because `nexus_stage_pack` is not defined yet.

- [ ] **Step 3: Add the stage pack type contract**

Create:

- `NexusStagePackId`
- `StagePackTraceability`
- a shared source-map helper that links stage packs to imported upstream files

- [ ] **Step 4: Export the stage pack registry skeleton**

Create empty-but-typed stage pack exports for:

- `discover`
- `frame`
- `plan`
- `handoff`
- `build`
- `closeout`

- [ ] **Step 5: Re-run the targeted test**

Run: `bun test test/nexus/absorption-runtime.test.ts`
Expected: PASS for the new contract shape.

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/stage-packs/types.ts lib/nexus/stage-packs/index.ts lib/nexus/stage-packs/source-map.ts lib/nexus/types.ts test/nexus/absorption-runtime.test.ts
git commit -m "feat: freeze nexus stage pack contracts"
```

## Task 2: Build Nexus-Owned PM Stage Packs

**Files:**
- Create: `lib/nexus/stage-packs/discover.ts`
- Create: `lib/nexus/stage-packs/frame.ts`
- Modify: `lib/nexus/adapters/pm.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/commands/frame.ts`
- Modify: `test/nexus/discover-frame.test.ts`
- Modify: `test/nexus/absorption-runtime.test.ts`

- [ ] **Step 1: Add failing tests that require discover/frame to report Nexus stage packs**

Add expectations that:

- `/discover` reports `nexus-discover-pack`
- `/frame` reports `nexus-frame-pack`
- upstream PM traceability remains visible but secondary

- [ ] **Step 2: Run the PM seam tests**

Run: `bun test test/nexus/discover-frame.test.ts test/nexus/absorption-runtime.test.ts`
Expected: FAIL because PM still exposes backend-centered identity only.

- [ ] **Step 3: Implement the Nexus-owned PM stage packs**

Create stage pack helpers that:

- hold normalized discovery/framing method structure
- wrap upstream PM source references
- expose Nexus-owned pack ids and stage semantics

- [ ] **Step 4: Route the PM adapter through the stage packs**

The adapter should:

- consume Nexus-owned packs
- preserve upstream source-map provenance
- stop presenting PM-native identity as the primary runtime shape

- [ ] **Step 5: Re-run the PM tests**

Run: `bun test test/nexus/discover-frame.test.ts test/nexus/absorption-runtime.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/stage-packs/discover.ts lib/nexus/stage-packs/frame.ts lib/nexus/adapters/pm.ts lib/nexus/commands/discover.ts lib/nexus/commands/frame.ts test/nexus/discover-frame.test.ts test/nexus/absorption-runtime.test.ts
git commit -m "feat: route pm seams through nexus stage packs"
```

## Task 3: Build Nexus-Owned GSD Stage Packs

**Files:**
- Create: `lib/nexus/stage-packs/plan.ts`
- Create: `lib/nexus/stage-packs/closeout.ts`
- Modify: `lib/nexus/adapters/gsd.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `test/nexus/plan-handoff-build.test.ts`
- Modify: `test/nexus/closeout.test.ts`
- Modify: `test/nexus/absorption-runtime.test.ts`

- [ ] **Step 1: Add failing tests for GSD-backed Nexus stage pack identity**

Require:

- `/plan` reports `nexus-plan-pack`
- `/closeout` reports `nexus-closeout-pack`
- closeout still stays Nexus-gated on legality, archive, and provenance

- [ ] **Step 2: Run the failing tests**

Run: `bun test test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts test/nexus/absorption-runtime.test.ts`
Expected: FAIL on missing stage pack identity.

- [ ] **Step 3: Implement the plan/closeout stage packs**

These packs should encapsulate:

- GSD-derived planning structure
- GSD-derived closeout structure
- Nexus-owned stage naming and semantics

- [ ] **Step 4: Route the GSD adapter through the stage packs**

Keep:

- GSD source maps for provenance
- Nexus-written status and artifact truth

- [ ] **Step 5: Re-run the tests**

Run: `bun test test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts test/nexus/absorption-runtime.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/stage-packs/plan.ts lib/nexus/stage-packs/closeout.ts lib/nexus/adapters/gsd.ts lib/nexus/commands/plan.ts lib/nexus/commands/closeout.ts test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts test/nexus/absorption-runtime.test.ts
git commit -m "feat: route gsd seams through nexus stage packs"
```

## Task 4: Build Nexus-Owned Build And Handoff Packs

**Files:**
- Create: `lib/nexus/stage-packs/handoff.ts`
- Create: `lib/nexus/stage-packs/build.ts`
- Modify: `lib/nexus/adapters/superpowers.ts`
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/build-discipline.test.ts`
- Modify: `test/nexus/absorption-runtime.test.ts`

- [ ] **Step 1: Add failing tests for Nexus-owned handoff/build packs**

Require:

- `/handoff` reports `nexus-handoff-pack`
- `/build` reports `nexus-build-pack`
- Superpowers and CCB remain supporting contributors, not pack owners

- [ ] **Step 2: Run the failing tests**

Run: `bun test test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts test/nexus/absorption-runtime.test.ts`
Expected: FAIL on missing pack identities.

- [ ] **Step 3: Implement the handoff/build stage packs**

These packs should capture:

- Nexus-owned governed handoff structure
- Nexus-owned build structure
- subordinate contribution points for Superpowers discipline and CCB routing/transport

- [ ] **Step 4: Route Superpowers and CCB through the stage packs**

Keep the boundary explicit:

- Superpowers contributes discipline only
- CCB contributes dispatch/transport only
- Nexus pack owns the stage semantic identity

- [ ] **Step 5: Re-run the tests**

Run: `bun test test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts test/nexus/absorption-runtime.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/stage-packs/handoff.ts lib/nexus/stage-packs/build.ts lib/nexus/adapters/superpowers.ts lib/nexus/adapters/ccb.ts lib/nexus/commands/handoff.ts lib/nexus/commands/build.ts test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts test/nexus/absorption-runtime.test.ts
git commit -m "feat: route build and handoff through nexus stage packs"
```

## Task 5: Demote Backend Identity In Inventory And Docs

**Files:**
- Modify: `upstream-notes/pm-skills-inventory.md`
- Modify: `upstream-notes/gsd-inventory.md`
- Modify: `upstream-notes/superpowers-inventory.md`
- Modify: `upstream-notes/ccb-inventory.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Add failing tests for inventory wording and stage-pack linkage**

Require inventories to point at:

- canonical Nexus commands
- Nexus stage pack ids
- imported upstream paths as source material only

- [ ] **Step 2: Run the inventory tests**

Run: `bun test test/nexus/inventory.test.ts`
Expected: FAIL until the new linkage and wording exist.

- [ ] **Step 3: Update inventories and docs**

Make explicit:

- upstream systems are source material only
- stage packs are Nexus-owned internal units
- product surface remains Nexus only

- [ ] **Step 4: Re-run the inventory tests**

Run: `bun test test/nexus/inventory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add upstream-notes/pm-skills-inventory.md upstream-notes/gsd-inventory.md upstream-notes/superpowers-inventory.md upstream-notes/ccb-inventory.md upstream-notes/absorption-status.md README.md docs/skills.md test/nexus/inventory.test.ts
git commit -m "docs: align inventories with nexus stage packs"
```

## Task 6: Run Full Regression And Lock The Milestone 4 Baseline

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-06-nexus-active-stage-absorption-closeout.md`
- Test: `test/nexus/*.test.ts`
- Test: `test/gen-skill-docs.test.ts`
- Test: `test/skill-validation.test.ts`
- Test: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Run the Nexus regression suite**

Run: `bun test test/nexus/*.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the host regression suite**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
Expected: PASS.

- [ ] **Step 3: Refresh generated wrapper docs**

Run: `bun run gen:skill-docs --host codex`
Expected: exits 0.

- [ ] **Step 4: Write the closeout note**

Record:

- active stages now route through Nexus-owned stage packs
- upstream systems remain source material only
- CCB remains transport only
- canonical Nexus commands remain the only front door

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-06-nexus-active-stage-absorption-closeout.md
git commit -m "docs: add active stage absorption closeout"
```

## Self-Review Checklist

- The plan only targets one decomposed sub-project: active stage asset absorption.
- The canonical Nexus command surface remains unchanged.
- No task reintroduces backend-native command surfaces.
- No task grants CCB lifecycle ownership.
- Every task preserves repo-visible Nexus truth and Nexus-owned normalization.
