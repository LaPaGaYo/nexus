# Nexus Internal Substrate Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nexus the primary implementation identity for retained runtime support helpers, support-state writes, and developer substrate roots while preserving explicit Gstack compatibility shims and migration fallbacks.

**Architecture:** Freeze one shared support-surface contract for helper names, support-state paths, and developer substrate roots; move primary implementation authority to Nexus-native binaries and paths; regenerate preamble/runtime/docs to use Nexus-first names; keep `gstack-*`, `~/.gstack`, `.gstack-worktrees`, and `~/.gstack-dev` only as compatibility shims or migration sources.

**Tech Stack:** Bun, TypeScript, bash helper scripts, generated `SKILL.md`, markdown docs, Bun test

---

## Execution Base

This plan should execute from:

- branch: `codex/nexus-internal-substrate-cutover`
- baseline: Milestone 8 complete

Do not begin implementation from `main`.

## Locked Rules

- canonical Nexus lifecycle commands remain unchanged
- `lib/nexus/` remains the only contract owner
- canonical `.planning/` artifacts remain the only governed lifecycle truth
- CCB remains dispatch and transport only
- `nexus-*` support helpers become the implementation owners
- `gstack-*` support helpers become shim-only compatibility wrappers
- primary support-state writes land in `~/.nexus`
- compatibility support-state reads may still consult `~/.gstack`
- primary developer substrate writes land in `.nexus-worktrees` and `~/.nexus-dev`
- compatibility reads and cleanup may still touch `.gstack-worktrees` and `~/.gstack-dev`
- generated runtime content and docs must prefer Nexus names and paths
- this milestone does not delete every Gstack compatibility surface
- repository host/remote rename is out of scope

## File Structure

### Existing Files To Modify

- `README.md`
- `package.json`
- `setup`
- `scripts/gen-skill-docs.ts`
- `scripts/eval-compare.ts`
- `scripts/eval-list.ts`
- `scripts/eval-summary.ts`
- `scripts/eval-watch.ts`
- `scripts/resolvers/preamble.ts`
- `scripts/resolvers/learnings.ts`
- `scripts/resolvers/review.ts`
- `scripts/resolvers/design.ts`
- `lib/worktree.ts`
- `lib/nexus/product-surface.ts`
- `upstream-notes/gstack-host-migration-inventory.md`
- `upstream-notes/absorption-status.md`
- `bin/gstack-analytics`
- `bin/gstack-community-dashboard`
- `bin/gstack-global-discover`
- `bin/gstack-global-discover.ts`
- `bin/gstack-learnings-log`
- `bin/gstack-learnings-search`
- `bin/gstack-review-log`
- `bin/gstack-review-read`
- `bin/gstack-repo-mode`
- `bin/gstack-slug`
- `bin/gstack-telemetry-log`
- `bin/gstack-telemetry-sync`
- `test/gen-skill-docs.test.ts`
- `test/global-discover.test.ts`
- `test/learnings.test.ts`
- `test/review-log.test.ts`
- `test/telemetry.test.ts`
- `test/worktree.test.ts`
- `test/helpers/observability.test.ts`
- `test/helpers/session-runner.ts`
- `test/helpers/eval-store.ts`
- `test/skill-validation.test.ts`
- `test/nexus/product-surface.test.ts`
- `test/nexus/inventory.test.ts`

### New Files To Add

- `lib/nexus/support-surface.ts`
- `test/nexus/support-surface.test.ts`
- `bin/nexus-analytics`
- `bin/nexus-community-dashboard`
- `bin/nexus-global-discover`
- `bin/nexus-global-discover.ts`
- `bin/nexus-learnings-log`
- `bin/nexus-learnings-search`
- `bin/nexus-review-log`
- `bin/nexus-review-read`
- `bin/nexus-repo-mode`
- `bin/nexus-slug`
- `bin/nexus-telemetry-log`
- `bin/nexus-telemetry-sync`
- `docs/superpowers/closeouts/2026-04-07-nexus-internal-substrate-cutover-closeout.md`

## Task 1: Freeze Support Surface Contracts

**Files:**
- Create: `lib/nexus/support-surface.ts`
- Create: `test/nexus/support-surface.test.ts`
- Modify: `lib/nexus/product-surface.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for helper and substrate contracts**

Require:

- shared constants for primary Nexus support helpers and legacy Gstack shim names
- shared constants for primary and legacy developer substrate roots
- shared helpers for support-state and dev-root precedence
- a single reusable contract for docs, preamble, helper scripts, and tests

- [ ] **Step 2: Run the targeted contract tests**

Run:

```bash
bun test test/nexus/support-surface.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because the shared support-surface contract does not exist yet.

- [ ] **Step 3: Add the shared support-surface contract**

Define in `lib/nexus/support-surface.ts`:

- Nexus-primary support helper names
- legacy Gstack compatibility helper names
- primary developer roots: `.nexus-worktrees`, `~/.nexus-dev`
- legacy developer roots: `.gstack-worktrees`, `~/.gstack-dev`
- reusable resolution helpers for primary vs compatibility paths

Keep this file descriptive and reusable. It must not gain lifecycle authority.

- [ ] **Step 4: Re-run the targeted contract tests**

Run:

```bash
bun test test/nexus/support-surface.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/support-surface.ts lib/nexus/product-surface.ts test/nexus/support-surface.test.ts test/nexus/product-surface.test.ts
git commit -m "feat: freeze nexus support surface contracts"
```

## Task 2: Move Retained Support Helpers To Nexus Ownership

**Files:**
- Create: `bin/nexus-analytics`
- Create: `bin/nexus-community-dashboard`
- Create: `bin/nexus-global-discover`
- Create: `bin/nexus-global-discover.ts`
- Create: `bin/nexus-learnings-log`
- Create: `bin/nexus-learnings-search`
- Create: `bin/nexus-review-log`
- Create: `bin/nexus-review-read`
- Create: `bin/nexus-repo-mode`
- Create: `bin/nexus-slug`
- Create: `bin/nexus-telemetry-log`
- Create: `bin/nexus-telemetry-sync`
- Modify: `bin/gstack-analytics`
- Modify: `bin/gstack-community-dashboard`
- Modify: `bin/gstack-global-discover`
- Modify: `bin/gstack-global-discover.ts`
- Modify: `bin/gstack-learnings-log`
- Modify: `bin/gstack-learnings-search`
- Modify: `bin/gstack-review-log`
- Modify: `bin/gstack-review-read`
- Modify: `bin/gstack-repo-mode`
- Modify: `bin/gstack-slug`
- Modify: `bin/gstack-telemetry-log`
- Modify: `bin/gstack-telemetry-sync`
- Modify: `package.json`
- Modify: `test/global-discover.test.ts`
- Modify: `test/learnings.test.ts`
- Modify: `test/review-log.test.ts`
- Modify: `test/telemetry.test.ts`

- [ ] **Step 1: Add failing tests for support helper ownership**

Require:

- `nexus-*` binaries own behavior and write to Nexus-primary support roots
- `gstack-*` binaries delegate into the Nexus-owned implementations
- build output compiles Nexus-primary binaries
- support binaries keep compatibility behavior only through shared path helpers

- [ ] **Step 2: Run the targeted helper tests**

Run:

```bash
bun test test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts
```

Expected:

- FAIL because Gstack helpers still own behavior and some Nexus binaries do not exist yet.

- [ ] **Step 3: Move retained helper authority to Nexus**

Implement:

- real Nexus-owned support binary bodies
- shim-only `gstack-*` wrappers that exec Nexus binaries
- Nexus-primary messaging and path resolution
- `package.json` build output compiling `bin/nexus-global-discover.ts`

- [ ] **Step 4: Re-run the targeted helper tests**

Run:

```bash
bun test test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json bin/nexus-analytics bin/nexus-community-dashboard bin/nexus-global-discover bin/nexus-global-discover.ts bin/nexus-learnings-log bin/nexus-learnings-search bin/nexus-review-log bin/nexus-review-read bin/nexus-repo-mode bin/nexus-slug bin/nexus-telemetry-log bin/nexus-telemetry-sync bin/gstack-analytics bin/gstack-community-dashboard bin/gstack-global-discover bin/gstack-global-discover.ts bin/gstack-learnings-log bin/gstack-learnings-search bin/gstack-review-log bin/gstack-review-read bin/gstack-repo-mode bin/gstack-slug bin/gstack-telemetry-log bin/gstack-telemetry-sync test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts
git commit -m "feat: move support helper ownership to nexus"
```

## Task 3: Cut Support-State Writes To Nexus Paths

**Files:**
- Modify: `scripts/resolvers/preamble.ts`
- Modify: `scripts/resolvers/learnings.ts`
- Modify: `scripts/resolvers/review.ts`
- Modify: `scripts/resolvers/design.ts`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`

- [ ] **Step 1: Add failing tests for support-state write paths**

Require:

- generated preamble uses `~/.nexus/*` for sessions, analytics, and markers
- generated runtime instructions invoke `nexus-*` support helpers
- learnings and review helper examples point at Nexus names and Nexus support roots
- legacy Gstack paths appear only in explicit compatibility sections where intended

- [ ] **Step 2: Run the targeted generator/runtime tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts
```

Expected:

- FAIL because generated content still uses Gstack support paths and helper names in active runtime sections.

- [ ] **Step 3: Cut generated support writes to Nexus**

Implement:

- Nexus-primary support-state directories in preamble output
- Nexus helper names in resolver instructions and generated runtime snippets
- explicit compatibility-only wording where Gstack paths remain referenced

- [ ] **Step 4: Re-run the targeted generator/runtime tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/resolvers/preamble.ts scripts/resolvers/learnings.ts scripts/resolvers/review.ts scripts/resolvers/design.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts
git commit -m "feat: move generated support runtime to nexus paths"
```

## Task 4: Cut Developer Substrate To Nexus Roots

**Files:**
- Modify: `lib/worktree.ts`
- Modify: `scripts/eval-compare.ts`
- Modify: `scripts/eval-list.ts`
- Modify: `scripts/eval-summary.ts`
- Modify: `scripts/eval-watch.ts`
- Modify: `test/worktree.test.ts`
- Modify: `test/helpers/observability.test.ts`
- Modify: `test/helpers/session-runner.ts`
- Modify: `test/helpers/eval-store.ts`

- [ ] **Step 1: Add failing tests for developer substrate cutover**

Require:

- new worktree writes land under `.nexus-worktrees`
- eval and harvest scratch state lands under `~/.nexus-dev`
- compatibility reads still understand legacy roots where required
- cleanup flows can still remove legacy roots

- [ ] **Step 2: Run the targeted developer-substrate tests**

Run:

```bash
bun test test/worktree.test.ts test/helpers/observability.test.ts
```

Expected:

- FAIL because the current implementation still writes to `.gstack-worktrees` and `~/.gstack-dev`.

- [ ] **Step 3: Move developer substrate writes to Nexus roots**

Implement:

- Nexus-primary worktree and eval root helpers
- compatibility read/fallback behavior for legacy dev roots
- updated worktree comments and cleanup behavior

- [ ] **Step 4: Re-run the targeted developer-substrate tests**

Run:

```bash
bun test test/worktree.test.ts test/helpers/observability.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/worktree.ts scripts/eval-compare.ts scripts/eval-list.ts scripts/eval-summary.ts scripts/eval-watch.ts test/worktree.test.ts test/helpers/observability.test.ts test/helpers/session-runner.ts test/helpers/eval-store.ts
git commit -m "feat: move developer substrate roots to nexus"
```

## Task 5: Finish Nexus-Primary Docs And Inventory

**Files:**
- Modify: `README.md`
- Modify: `setup`
- Modify: `upstream-notes/gstack-host-migration-inventory.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `test/nexus/inventory.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for product and inventory surface**

Require:

- active product docs recommend Nexus support helpers only
- install/setup guidance stops presenting Gstack support helpers as the active path
- inventory explicitly distinguishes compatibility-only Gstack substrate from
  Nexus-owned primary substrate
- remaining Gstack references in README are compatibility-only or historical

- [ ] **Step 2: Run the targeted product-surface tests**

Run:

```bash
bun test test/nexus/inventory.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because README and inventories still present some Gstack support surfaces as active.

- [ ] **Step 3: Cut docs and inventory to Nexus-primary**

Implement:

- Nexus-primary README/setup guidance for retained support helpers
- explicit compatibility-only language for remaining Gstack references
- updated migration inventory entries for support helpers and developer substrate

- [ ] **Step 4: Re-run the targeted product-surface tests**

Run:

```bash
bun test test/nexus/inventory.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md setup upstream-notes/gstack-host-migration-inventory.md upstream-notes/absorption-status.md test/nexus/inventory.test.ts test/nexus/product-surface.test.ts
git commit -m "docs: make support substrate nexus-primary"
```

## Task 6: Full Regression And Closeout

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-07-nexus-internal-substrate-cutover-closeout.md`

- [ ] **Step 1: Run targeted regression for this milestone**

Run:

```bash
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts test/worktree.test.ts test/helpers/observability.test.ts
bun run gen:skill-docs --host codex
git diff --check
```

Expected:

- PASS across the milestone-specific regression suite
- generated docs succeed
- no diff formatting errors

- [ ] **Step 2: Write closeout**

Record:

- which support binaries are now Nexus-owned
- which Gstack compatibility shims remain
- which support and developer roots are now Nexus-primary
- what remains deferred to the next cleanup/removal milestone
- verification commands and results

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-07-nexus-internal-substrate-cutover-closeout.md
git commit -m "docs: close out nexus internal substrate cutover"
```
