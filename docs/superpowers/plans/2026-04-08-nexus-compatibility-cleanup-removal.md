# Nexus Compatibility Cleanup And Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining `gstack`-owned internal runtime and product identities from the active Nexus path while preserving only a narrow set of explicit boundary compatibility shims.

**Architecture:** Freeze one compatibility budget contract, promote Nexus-native internal utilities and the upgrade surface, cut active setup/generation/resolver paths over to Nexus names, then shrink compatibility tests so they prove shim behavior instead of primary runtime behavior. Keep `lib/nexus/` and canonical `.planning/` truth untouched.

**Tech Stack:** Bun, TypeScript, bash helper scripts, generated `SKILL.md`, markdown docs, Bun test

---

## Execution Base

This plan should execute from:

- branch: `codex/nexus-compatibility-cleanup-removal`
- baseline: Milestone 9 internal substrate cutover complete

Do not begin implementation from `main`.

## Locked Rules

- canonical Nexus lifecycle commands remain unchanged
- `lib/nexus/` remains the only contract owner
- canonical `.planning/` artifacts remain the only governed lifecycle truth
- CCB remains dispatch and transport only
- Nexus becomes the only active internal runtime/product identity
- `gstack` may remain only in a narrow external compatibility budget
- active setup, relink, generation, resolver, and runtime paths must stop depending on `gstack-*` internal utilities
- canonical upgrade identity must be Nexus-owned
- compatibility tests must prove legacy shims only, not primary happy paths
- repository remote rename remains out of scope

## File Structure

### Existing Files To Modify

- `README.md`
- `docs/skills.md`
- `setup`
- `scripts/gen-skill-docs.ts`
- `scripts/resolvers/review-army.ts`
- `scripts/resolvers/design.ts`
- `scripts/resolvers/testing.ts`
- `bin/nexus-relink`
- `bin/nexus-update-check`
- `bin/nexus-telemetry-log`
- `bin/gstack-patch-names`
- `bin/gstack-diff-scope`
- `bin/gstack-platform-detect`
- `bin/gstack-open-url`
- `bin/gstack-extension`
- `gstack-upgrade/SKILL.md.tmpl`
- `gstack-upgrade/SKILL.md`
- `upstream-notes/legacy-host-migration-history.md`
- `upstream-notes/absorption-status.md`
- `test/gen-skill-docs.test.ts`
- `test/relink.test.ts`
- `test/diff-scope.test.ts`
- `test/audit-compliance.test.ts`
- `test/skill-validation.test.ts`
- `test/skill-routing-e2e.test.ts`
- `test/skill-e2e.test.ts`
- `test/skill-e2e-workflow.test.ts`
- `test/skill-llm-eval.test.ts`
- `test/skill-e2e-review.test.ts`
- `test/skill-e2e-review-army.test.ts`
- `test/helpers/touchfiles.ts`
- `test/nexus/product-surface.test.ts`
- `test/nexus/inventory.test.ts`

### New Files To Add

- `lib/nexus/compatibility-surface.ts`
- `test/nexus/compatibility-surface.test.ts`
- `bin/nexus-patch-names`
- `bin/nexus-diff-scope`
- `bin/nexus-platform-detect`
- `bin/nexus-open-url`
- `bin/nexus-extension`
- `nexus-upgrade/SKILL.md.tmpl`
- `docs/superpowers/closeouts/2026-04-08-nexus-compatibility-cleanup-removal-closeout.md`

## Task 1: Freeze Compatibility Budget Contracts

**Files:**
- Create: `lib/nexus/compatibility-surface.ts`
- Create: `test/nexus/compatibility-surface.test.ts`
- Modify: `test/nexus/product-surface.test.ts`
- Modify: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Add failing tests for the compatibility budget**

Require:

- explicit list of retained boundary shims
- explicit list of internal `gstack` utility identities that must be removed from the active path
- product surface tests proving `gstack` remains compatibility-only
- inventory tests proving legacy remnants are classified as removed, retained, or deferred

- [ ] **Step 2: Run the targeted contract tests**

Run:

```bash
bun test test/nexus/compatibility-surface.test.ts test/nexus/product-surface.test.ts test/nexus/inventory.test.ts
```

Expected:

- FAIL because no compatibility budget contract exists yet

- [ ] **Step 3: Add the shared compatibility-surface contract**

Define in `lib/nexus/compatibility-surface.ts`:

- retained boundary compatibility shims
- internal Gstack identities slated for removal from the active path
- compatibility status enum or equivalent descriptive contract
- reusable constants for docs, setup, inventory, and tests

Keep this file descriptive. It must not gain lifecycle authority.

- [ ] **Step 4: Re-run the targeted contract tests**

Run:

```bash
bun test test/nexus/compatibility-surface.test.ts test/nexus/product-surface.test.ts test/nexus/inventory.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/compatibility-surface.ts test/nexus/compatibility-surface.test.ts test/nexus/product-surface.test.ts test/nexus/inventory.test.ts
git commit -m "feat: freeze nexus compatibility budget"
```

## Task 2: Promote Nexus-Native Internal Utilities

**Files:**
- Create: `bin/nexus-patch-names`
- Create: `bin/nexus-diff-scope`
- Create: `bin/nexus-platform-detect`
- Create: `bin/nexus-open-url`
- Create: `bin/nexus-extension`
- Modify: `bin/gstack-patch-names`
- Modify: `bin/gstack-diff-scope`
- Modify: `bin/gstack-platform-detect`
- Modify: `bin/gstack-open-url`
- Modify: `bin/gstack-extension`
- Modify: `test/diff-scope.test.ts`
- Modify: `test/relink.test.ts`

- [ ] **Step 1: Add failing tests for internal utility ownership**

Require:

- Nexus utility binaries own implementation
- `gstack-*` utility binaries become pure compatibility shims
- diff-scope tests and relink tests target Nexus utilities as the canonical path

- [ ] **Step 2: Run the targeted utility tests**

Run:

```bash
bun test test/diff-scope.test.ts test/relink.test.ts
```

Expected:

- FAIL because the active utilities still exist only as `gstack-*`

- [ ] **Step 3: Add Nexus-owned utility binaries and shim legacy binaries**

Implement:

- real Nexus utility bodies under `bin/nexus-*`
- shim-only legacy wrappers under `bin/gstack-*`
- canonical test coverage proving Nexus ownership and Gstack delegation

- [ ] **Step 4: Re-run the targeted utility tests**

Run:

```bash
bun test test/diff-scope.test.ts test/relink.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-patch-names bin/nexus-diff-scope bin/nexus-platform-detect bin/nexus-open-url bin/nexus-extension bin/gstack-patch-names bin/gstack-diff-scope bin/gstack-platform-detect bin/gstack-open-url bin/gstack-extension test/diff-scope.test.ts test/relink.test.ts
git commit -m "feat: promote nexus internal utilities"
```

## Task 3: Canonicalize The Upgrade Surface

**Files:**
- Create: `nexus-upgrade/SKILL.md.tmpl`
- Modify: `gstack-upgrade/SKILL.md.tmpl`
- Modify: `gstack-upgrade/SKILL.md`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/skill-validation.test.ts`
- Modify: `test/skill-routing-e2e.test.ts`
- Modify: `test/skill-e2e.test.ts`
- Modify: `test/skill-e2e-workflow.test.ts`
- Modify: `test/skill-llm-eval.test.ts`

- [ ] **Step 1: Add failing tests for upgrade identity**

Require:

- canonical upgrade skill is `nexus-upgrade`
- product docs no longer treat `gstack-upgrade` as a primary command
- any remaining `gstack-upgrade` path is explicitly compatibility-only

- [ ] **Step 2: Run the targeted upgrade-surface tests**

Run:

```bash
bun test test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Expected:

- FAIL because upgrade identity still centers `gstack-upgrade`

- [ ] **Step 3: Move the upgrade surface to Nexus**

Implement:

- canonical `nexus-upgrade` skill/template
- compatibility-only handling for `gstack-upgrade`
- updated docs and E2E fixtures to prefer Nexus upgrade identity

- [ ] **Step 4: Re-run the targeted upgrade-surface tests**

Run:

```bash
bun test test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add nexus-upgrade/SKILL.md.tmpl gstack-upgrade/SKILL.md.tmpl gstack-upgrade/SKILL.md README.md docs/skills.md test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/skill-e2e.test.ts test/skill-e2e-workflow.test.ts test/skill-llm-eval.test.ts
git commit -m "feat: canonicalize nexus upgrade surface"
```

## Task 4: Cut Setup, Generation, And Relink To Nexus Utilities

**Files:**
- Modify: `setup`
- Modify: `scripts/gen-skill-docs.ts`
- Modify: `bin/nexus-relink`
- Modify: `bin/nexus-update-check`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/relink.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for setup/generation cutover**

Require:

- setup and relink invoke Nexus utility names first
- skill generation warnings and prefix hints reference Nexus helpers only
- active update-check telemetry wiring does not call `gstack-*` as the primary helper path

- [ ] **Step 2: Run the targeted setup/generation tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/relink.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because setup, generation, and relink still rely on internal `gstack-*` names

- [ ] **Step 3: Cut setup and generation to Nexus-owned utilities**

Implement:

- `setup` uses Nexus utility names and Nexus guidance only on the active path
- `scripts/gen-skill-docs.ts` reads Nexus config roots and prints Nexus relink guidance
- `bin/nexus-relink` and `bin/nexus-update-check` stop using legacy utility names as their active implementation path

- [ ] **Step 4: Re-run the targeted setup/generation tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/relink.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add setup scripts/gen-skill-docs.ts bin/nexus-relink bin/nexus-update-check test/gen-skill-docs.test.ts test/relink.test.ts test/nexus/product-surface.test.ts
git commit -m "feat: cut setup and generation to nexus utilities"
```

## Task 5: Cut Active Resolvers And Runtime Guidance To Nexus Utilities

**Files:**
- Modify: `scripts/resolvers/review-army.ts`
- Modify: `scripts/resolvers/design.ts`
- Modify: `scripts/resolvers/testing.ts`
- Modify: `test/audit-compliance.test.ts`
- Modify: `test/skill-e2e-review-army.test.ts`
- Modify: `test/skill-e2e-review.test.ts`
- Modify: `test/skill-e2e-deploy.test.ts`
- Modify: `test/helpers/touchfiles.ts`

- [ ] **Step 1: Add failing tests for active resolver/runtime references**

Require:

- review-army uses Nexus diff-scope and Nexus learnings helpers
- design and testing resolvers no longer instruct active users to invoke `gstack-*`
- compliance tests treat any remaining Gstack reference as compatibility-only

- [ ] **Step 2: Run the targeted resolver/runtime tests**

Run:

```bash
bun test test/audit-compliance.test.ts test/skill-e2e-review-army.test.ts test/skill-e2e-review.test.ts
```

Expected:

- FAIL because active generated/runtime guidance still invokes `gstack-*`

- [ ] **Step 3: Cut resolvers and runtime guidance to Nexus utilities**

Implement:

- Nexus utility names in review-army, design, and testing resolver output
- updated E2E fixtures and touchfile maps
- explicit compatibility-only wording where legacy names remain in edge-case tests

- [ ] **Step 4: Re-run the targeted resolver/runtime tests**

Run:

```bash
bun test test/audit-compliance.test.ts test/skill-e2e-review-army.test.ts test/skill-e2e-review.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/resolvers/review-army.ts scripts/resolvers/design.ts scripts/resolvers/testing.ts test/audit-compliance.test.ts test/skill-e2e-review-army.test.ts test/skill-e2e-review.test.ts test/skill-e2e-deploy.test.ts test/helpers/touchfiles.ts
git commit -m "feat: cut active runtime guidance to nexus utilities"
```

## Task 6: Shrink Compatibility Tests And Inventory

**Files:**
- Modify: `upstream-notes/legacy-host-migration-history.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `test/nexus/inventory.test.ts`
- Modify: `test/skill-e2e.test.ts`
- Modify: `test/skill-e2e-workflow.test.ts`
- Modify: `test/skill-llm-eval.test.ts`
- Modify: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Add failing tests for compatibility-only classification**

Require:

- inventories explicitly classify which Gstack surfaces were removed from the active path
- retained compatibility shims are named explicitly
- E2E and routing suites stop treating Gstack identities as canonical success paths

- [ ] **Step 2: Run the targeted compatibility/inventory tests**

Run:

```bash
bun test test/nexus/inventory.test.ts test/skill-routing-e2e.test.ts
```

Expected:

- FAIL because inventories and routing fixtures still over-credit Gstack identities

- [ ] **Step 3: Update inventories and narrow compatibility tests**

Implement:

- inventory rows for removed, retained, and deferred legacy surfaces
- compatibility-only phrasing in absorption status
- E2E and routing fixtures that reserve Gstack to explicit shim tests only

- [ ] **Step 4: Re-run the targeted compatibility/inventory tests**

Run:

```bash
bun test test/nexus/inventory.test.ts test/skill-routing-e2e.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add upstream-notes/legacy-host-migration-history.md upstream-notes/absorption-status.md test/nexus/inventory.test.ts test/skill-e2e.test.ts test/skill-e2e-workflow.test.ts test/skill-llm-eval.test.ts test/skill-routing-e2e.test.ts
git commit -m "test: shrink gstack compatibility surface"
```

## Task 7: Full Regression And Closeout

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-08-nexus-compatibility-cleanup-removal-closeout.md`

- [ ] **Step 1: Run milestone regression**

Run:

```bash
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/relink.test.ts test/diff-scope.test.ts test/audit-compliance.test.ts test/skill-routing-e2e.test.ts test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts test/worktree.test.ts test/helpers/observability.test.ts
bun run gen:skill-docs --host codex
git diff --check
```

Expected:

- PASS across milestone-specific regression
- generated docs succeed
- no diff formatting errors

- [ ] **Step 2: Write closeout**

Record:

- which internal `gstack` utilities were replaced by Nexus-owned implementations
- whether `gstack-upgrade` remains as a compatibility alias or is fully retired from the active path
- which boundary compatibility shims remain
- which legacy surfaces are still deferred to the final removal milestone
- verification commands and results

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-08-nexus-compatibility-cleanup-removal-closeout.md
git commit -m "docs: close out nexus compatibility cleanup and removal"
```
