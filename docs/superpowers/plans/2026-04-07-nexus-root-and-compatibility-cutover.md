# Nexus Root And Compatibility Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nexus the primary install root, helper ownership surface, and host support state root while preserving explicit Gstack compatibility fallbacks.

**Architecture:** Add one shared host-root contract that freezes Nexus-primary and Gstack-compat roots, then cut over the helper scripts and setup/generation code to use Nexus-owned entrypoints and Nexus-primary install locations. Keep `lib/nexus/` and canonical `.planning/` artifacts unchanged as the governed truth layer, and treat `~/.nexus` and `~/.gstack` as host/support state only.

**Tech Stack:** Bun, TypeScript, bash setup/bin scripts, markdown docs, generated `SKILL.md`, Bun test

---

## Execution Base

This plan should execute from:

- branch: `codex/nexus-governed-runtime-completion`
- baseline: Milestone 7 complete

Do not begin implementation from `main`.

## Locked Rules

- canonical Nexus lifecycle commands remain unchanged
- `lib/nexus/` remains the only contract owner
- canonical `.planning/` artifacts remain the only governed lifecycle truth
- host roots and host state remain convenience/support only
- primary install/runtime roots become `nexus`
- `gstack` roots remain compatibility-only
- primary helper ownership becomes `nexus-*`
- `gstack-*` helpers become shims only
- primary host support state root becomes `~/.nexus`
- compatibility host support state root remains `~/.gstack`
- state migration must be conservative and must not silently bless partial
  migrations
- this milestone does not delete all legacy Gstack surfaces
- CCB remains transport only

## File Structure

### Existing Files To Modify

- `setup`
- `README.md`
- `docs/skills.md`
- `bin/gstack-config`
- `bin/gstack-relink`
- `bin/gstack-uninstall`
- `bin/gstack-update-check`
- `bin/gstack-patch-names`
- `bin/nexus-config`
- `bin/nexus-relink`
- `bin/nexus-uninstall`
- `bin/nexus-update-check`
- `scripts/gen-skill-docs.ts`
- `scripts/resolvers/types.ts`
- `scripts/resolvers/codex-helpers.ts`
- `scripts/resolvers/preamble.ts`
- `lib/nexus/product-surface.ts`
- `upstream-notes/legacy-host-migration-history.md`
- `upstream-notes/absorption-status.md`
- `test/relink.test.ts`
- `test/uninstall.test.ts`
- `test/gen-skill-docs.test.ts`
- `test/skill-validation.test.ts`
- `test/nexus/product-surface.test.ts`
- `test/nexus/inventory.test.ts`

### New Files To Add

- `lib/nexus/host-roots.ts`
- `test/nexus/host-roots.test.ts`
- `docs/superpowers/closeouts/2026-04-07-nexus-root-and-compatibility-cutover-closeout.md`

## Task 1: Freeze Dual-Root Contracts And State Precedence

**Files:**
- Create: `lib/nexus/host-roots.ts`
- Create: `test/nexus/host-roots.test.ts`
- Modify: `lib/nexus/product-surface.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for root and state precedence**

Require:

- shared constants for primary Nexus roots and compatibility Gstack roots
- shared constants for `~/.nexus` and `~/.gstack`
- explicit state-root precedence:
  - `NEXUS_STATE_DIR`
  - `GSTACK_STATE_DIR`
  - initialized `~/.nexus`
  - migration from `~/.gstack`
- helper and setup layers must be able to consume the same contract

- [ ] **Step 2: Run the targeted contract tests**

Run:

```bash
bun test test/nexus/host-roots.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because the shared root/state contract does not exist yet.

- [ ] **Step 3: Add the shared host-root contract**

Define in `lib/nexus/host-roots.ts`:

- primary host roots for Claude, Codex, Kiro, and Factory
- compatibility host roots for the same hosts
- primary state root
- compatibility state root
- helper-precedence and state-precedence helpers

Keep this file descriptive and reusable. It must not gain lifecycle authority.

- [ ] **Step 4: Re-run the targeted contract tests**

Run:

```bash
bun test test/nexus/host-roots.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/host-roots.ts lib/nexus/product-surface.ts test/nexus/host-roots.test.ts test/nexus/product-surface.test.ts
git commit -m "feat: freeze nexus host root contracts"
```

## Task 2: Make Nexus Helpers The Real Owners

**Files:**
- Modify: `bin/nexus-config`
- Modify: `bin/nexus-relink`
- Modify: `bin/nexus-uninstall`
- Modify: `bin/nexus-update-check`
- Modify: `bin/gstack-config`
- Modify: `bin/gstack-relink`
- Modify: `bin/gstack-uninstall`
- Modify: `bin/gstack-update-check`
- Modify: `test/relink.test.ts`
- Modify: `test/uninstall.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for helper ownership**

Require:

- `nexus-*` helpers own behavior and state-root resolution
- `gstack-*` helpers delegate into `nexus-*`
- relink and uninstall output recommend `nexus-*`
- helper behavior still honors compatibility overrides

- [ ] **Step 2: Run the targeted helper tests**

Run:

```bash
bun test test/relink.test.ts test/uninstall.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because Nexus helpers are still wrappers and Gstack helpers still own real behavior.

- [ ] **Step 3: Move helper implementation authority to Nexus**

Implement:

- real `nexus-*` script bodies
- `gstack-*` shim wrappers that exec the corresponding Nexus helpers
- shared env handling for `NEXUS_STATE_DIR` plus compatibility `GSTACK_STATE_DIR`
- Nexus-primary user messaging

- [ ] **Step 4: Re-run the targeted helper tests**

Run:

```bash
bun test test/relink.test.ts test/uninstall.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-config bin/nexus-relink bin/nexus-uninstall bin/nexus-update-check bin/gstack-config bin/gstack-relink bin/gstack-uninstall bin/gstack-update-check test/relink.test.ts test/uninstall.test.ts test/nexus/product-surface.test.ts
git commit -m "feat: make nexus helpers own host operations"
```

## Task 3: Introduce Conservative `~/.nexus` State Migration

**Files:**
- Modify: `bin/nexus-config`
- Modify: `bin/nexus-update-check`
- Modify: `bin/nexus-uninstall`
- Modify: `setup`
- Modify: `test/uninstall.test.ts`
- Modify: `test/nexus/host-roots.test.ts`

- [ ] **Step 1: Add failing tests for state-root migration**

Require:

- fresh host support state initializes under `~/.nexus`
- existing `~/.gstack` state migrates or copies into `~/.nexus`
- partial migration stays conservative and visible
- compatibility fallback remains available if migration does not complete

- [ ] **Step 2: Run the targeted migration tests**

Run:

```bash
bun test test/nexus/host-roots.test.ts test/uninstall.test.ts
```

Expected:

- FAIL because state-root migration and precedence are not implemented.

- [ ] **Step 3: Implement conservative migration markers**

Implement:

- one-time migration detection
- marker or metadata for completed migration
- fallback behavior for partial/incomplete migration
- no lifecycle truth interaction

- [ ] **Step 4: Re-run the targeted migration tests**

Run:

```bash
bun test test/nexus/host-roots.test.ts test/uninstall.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add setup bin/nexus-config bin/nexus-update-check bin/nexus-uninstall test/nexus/host-roots.test.ts test/uninstall.test.ts
git commit -m "feat: add nexus state root migration"
```

## Task 4: Cut Over Setup And Runtime Root Generation

**Files:**
- Modify: `setup`
- Modify: `bin/gstack-patch-names`
- Modify: `scripts/resolvers/types.ts`
- Modify: `scripts/resolvers/codex-helpers.ts`
- Modify: `scripts/resolvers/preamble.ts`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`
- Modify: `test/relink.test.ts`

- [ ] **Step 1: Add failing tests for Nexus-primary runtime roots**

Require:

- Claude/Codex/Kiro/Factory generation prefers `nexus` roots
- sidecar paths point to `.agents/skills/nexus`
- runtime helper references point to Nexus helpers
- namespace behavior still uses flat canonical commands or `nexus-*`
- compatibility `gstack` roots continue to work only as fallbacks/shims

- [ ] **Step 2: Run the targeted generation tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/relink.test.ts
```

Expected:

- FAIL because setup and generated assets still target `gstack` roots.

- [ ] **Step 3: Rework setup and generated root creation**

Implement:

- Nexus-primary install root variables
- Nexus-primary Codex/Factory/Kiro runtime roots
- Kiro rewrite rules toward `nexus`
- updated patch-name and relink behavior for Nexus roots
- unchanged governed lifecycle ownership

- [ ] **Step 4: Regenerate host docs**

Run:

```bash
bun run gen:skill-docs --host codex
bun run gen:skill-docs --host factory
```

Expected:

- succeeds and rewrites generated host assets with Nexus-primary roots.

- [ ] **Step 5: Re-run the targeted generation tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/relink.test.ts
```

Expected:

- PASS.

- [ ] **Step 6: Commit**

```bash
git add setup bin/gstack-patch-names scripts/resolvers/types.ts scripts/resolvers/codex-helpers.ts scripts/resolvers/preamble.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts test/relink.test.ts .agents/skills .factory/skills
git commit -m "feat: cut over host generation to nexus roots"
```

## Task 5: Update Docs And Compatibility Guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for Nexus-root documentation**

Require:

- install docs recommend Nexus roots first
- helper docs recommend `nexus-*`
- Gstack paths appear only in compatibility sections
- docs do not imply `~/.gstack` is the primary state root anymore

- [ ] **Step 2: Run the targeted docs tests**

Run:

```bash
bun test test/nexus/product-surface.test.ts
```

Expected:

- FAIL because docs still describe Gstack compatibility roots as the main paths.

- [ ] **Step 3: Rewrite install and helper guidance**

Implement:

- Nexus-primary install snippets
- Nexus-primary helper examples
- explicit compatibility notes for existing Gstack installs
- unchanged canonical command surface

- [ ] **Step 4: Re-run the targeted docs tests**

Run:

```bash
bun test test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/skills.md test/nexus/product-surface.test.ts
git commit -m "docs: make install and helper guidance nexus-rooted"
```

## Task 6: Update Inventories And Close Out The Cutover

**Files:**
- Modify: `upstream-notes/legacy-host-migration-history.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `test/nexus/inventory.test.ts`
- Create: `docs/superpowers/closeouts/2026-04-07-nexus-root-and-compatibility-cutover-closeout.md`

- [ ] **Step 1: Add failing tests for post-cutover inventory state**

Require:

- host inventory now marks roots/state/helpers as Nexus-primary with Gstack compatibility fallback
- helper ownership is recorded as Nexus-owned
- remaining Gstack entries stay explicitly compatibility-only or post-cutover migration targets

- [ ] **Step 2: Run the targeted inventory tests**

Run:

```bash
bun test test/nexus/inventory.test.ts
```

Expected:

- FAIL because inventory and absorption status still describe the pre-cutover state.

- [ ] **Step 3: Update inventories and write closeout**

Record:

- which roots are now Nexus-primary
- which Gstack roots remain compatibility-only
- that `~/.nexus` is now the primary host support state root
- that governed truth remains unchanged

- [ ] **Step 4: Re-run the targeted inventory tests**

Run:

```bash
bun test test/nexus/inventory.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add upstream-notes/legacy-host-migration-history.md upstream-notes/absorption-status.md test/nexus/inventory.test.ts docs/superpowers/closeouts/2026-04-07-nexus-root-and-compatibility-cutover-closeout.md
git commit -m "docs: close out nexus root and compatibility cutover"
```

## Task 7: Run Full Regression And Confirm Cutover Safety

**Files:**
- No new files; verification and final checkpoint only

- [ ] **Step 1: Run the full Nexus regression**

Run:

```bash
bun test test/nexus/*.test.ts
```

Expected:

- PASS.

- [ ] **Step 2: Run the host-surface regression**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts
```

Expected:

- PASS.

- [ ] **Step 3: Regenerate generated docs and verify formatting**

Run:

```bash
bun run gen:skill-docs --host codex
git diff --check
```

Expected:

- both commands succeed with no formatting errors.

- [ ] **Step 4: Record final milestone verification**

Summarize:

- Nexus-primary roots are now default
- Nexus helpers now own behavior
- `~/.nexus` is primary host support state root
- Gstack remains compatibility-only
- governed lifecycle truth is unchanged

- [ ] **Step 5: Commit any generated artifacts if needed**

```bash
git status --short
```

Expected:

- clean or only known generated artifacts ready to commit.

## Milestone Outcome

After this plan:

- a fresh install should default to Nexus roots everywhere
- helper ownership should belong to `nexus-*`
- host support state should default to `~/.nexus`
- Gstack should remain functional only as compatibility substrate
- governed lifecycle truth should remain entirely Nexus-owned

## Not Part Of This Plan

- deleting all Gstack compatibility roots or helpers
- broader cleanup/removal of host legacy structure
- changing canonical lifecycle commands
- moving host support state into the governed truth model
- changing CCB ownership or lifecycle semantics
