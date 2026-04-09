# Nexus Final Legacy Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining live `gstack` runtime, helper, and product identities so the repository behaves as a complete Nexus-only system.

**Architecture:** First freeze the final-removal contract in inventory and tests, then cut browse and helper substrates to Nexus-only roots and names, then rewrite active docs/templates and generated output to Nexus-only language, and finally close out the migration inventory as complete. Historical records remain untouched.

**Tech Stack:** Bun, TypeScript, bash helper scripts, generated `SKILL.md`, markdown docs, Bun test

---

## Execution Base

This plan executes from:

- branch: `codex/nexus-final-legacy-removal`
- baseline: Milestone 10 compatibility cleanup and removal complete

## Locked Rules

- canonical Nexus lifecycle commands remain unchanged
- `lib/nexus/` remains the only contract owner
- canonical `.planning/` artifacts remain the only governed lifecycle truth
- CCB remains transport/dispatch only
- active runtime and product identity must be Nexus-only
- `gstack` may remain only in archival docs and deliberate historical notes
- active helpers, setup, browse runtime, templates, and tests must not depend on
  `gstack` names or `gstack` state roots

## File Structure

### Existing Files To Modify

- `CLAUDE.md`
- `README.md`
- `upstream-notes/legacy-host-migration-history.md`
- `upstream-notes/absorption-status.md`
- `lib/nexus/compatibility-surface.ts`
- `bin/nexus-config`
- `bin/nexus-relink`
- `bin/nexus-uninstall`
- `bin/nexus-update-check`
- `bin/nexus-telemetry-log`
- `bin/nexus-telemetry-sync`
- `bin/dev-setup`
- `bin/dev-teardown`
- `browse/src/config.ts`
- `browse/src/server.ts`
- `browse/src/sidebar-agent.ts`
- `browse/src/browser-manager.ts`
- `browse/src/cli.ts`
- `browse/src/find-browse.ts`
- `browse/src/platform.ts`
- `browse/src/cookie-picker-ui.ts`
- `browse/src/write-commands.ts`
- `browse/bin/find-browse`
- `browse/bin/remote-slug`
- `browse/SKILL.md.tmpl`
- `browse/SKILL.md`
- `scripts/gen-skill-docs.ts`
- selected active `SKILL.md.tmpl` files that still emit `gstack` wording or
  `gstack_contributor`
- `docs/skills.md`
- `test/nexus/compatibility-surface.test.ts`
- `test/nexus/product-surface.test.ts`
- `test/nexus/inventory.test.ts`
- `test/gen-skill-docs.test.ts`
- `test/relink.test.ts`
- `test/uninstall.test.ts`
- `test/analytics.test.ts`
- `test/learnings.test.ts`
- `test/review-log.test.ts`
- `test/global-discover.test.ts`
- `test/helpers/eval-store.ts`
- `test/helpers/e2e-helpers.ts`
- `browse/test/*.test.ts` files that still assert `.gstack`/`skills/gstack`

### New Files To Add

- `docs/superpowers/closeouts/2026-04-08-nexus-final-legacy-removal-closeout.md`

## Task 1: Freeze Final Removal Contracts

**Files:**
- Modify: `lib/nexus/compatibility-surface.ts`
- Modify: `upstream-notes/legacy-host-migration-history.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `test/nexus/compatibility-surface.test.ts`
- Modify: `test/nexus/product-surface.test.ts`
- Modify: `test/nexus/inventory.test.ts`

- [ ] Add failing tests that require retained `gstack` shims to be removed and
  deferred legacy roots to be marked complete.
- [ ] Run `bun test test/nexus/compatibility-surface.test.ts test/nexus/product-surface.test.ts test/nexus/inventory.test.ts` and confirm failure.
- [ ] Update the compatibility contract and inventories so `gstack` is
  historical-only, not a retained compatibility surface.
- [ ] Re-run the targeted Nexus contract tests and confirm pass.
- [ ] Commit the contract freeze.

## Task 2: Cut Browse Runtime To Nexus Roots

**Files:**
- Modify: `browse/src/config.ts`
- Modify: `browse/src/server.ts`
- Modify: `browse/src/sidebar-agent.ts`
- Modify: `browse/src/browser-manager.ts`
- Modify: `browse/src/cli.ts`
- Modify: `browse/src/find-browse.ts`
- Modify: `browse/src/platform.ts`
- Modify: `browse/src/cookie-picker-ui.ts`
- Modify: `browse/src/write-commands.ts`
- Modify: `browse/bin/find-browse`
- Modify: `browse/bin/remote-slug`
- Modify: `browse/SKILL.md.tmpl`
- Modify: `browse/SKILL.md`
- Modify: browse tests that still assert `.gstack` or `skills/gstack`

- [ ] Add failing browse/runtime tests for `.nexus` state roots and
  `skills/nexus` binary lookup.
- [ ] Run the targeted browse test set and confirm failure.
- [ ] Move browse runtime, sidecar, and helper lookup to Nexus-owned roots and
  wording.
- [ ] Regenerate `browse/SKILL.md` if needed and re-run the targeted browse
  tests until they pass.
- [ ] Commit the browse cutover.

## Task 3: Remove Remaining Gstack Helper Surface

**Files:**
- Modify: `bin/nexus-config`
- Modify: `bin/nexus-relink`
- Modify: `bin/nexus-uninstall`
- Modify: `bin/nexus-update-check`
- Modify: `bin/nexus-telemetry-log`
- Modify: `bin/nexus-telemetry-sync`
- Modify: `bin/dev-setup`
- Modify: `bin/dev-teardown`
- Remove or stop generating retained `gstack-*` compatibility binaries
- Modify: `test/relink.test.ts`
- Modify: `test/uninstall.test.ts`
- Modify: helper-related tests under `test/`

- [ ] Add failing helper tests that require Nexus-only helper ownership and no
  active `.gstack` fallback behavior.
- [ ] Run the targeted helper tests and confirm failure.
- [ ] Cut helper implementations to Nexus-only behavior and remove legacy shim
  expectations from tests and scripts.
- [ ] Re-run the targeted helper tests and confirm pass.
- [ ] Commit the helper cutover.

## Task 4: Rewrite Active Docs, Templates, And Generated Output

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `scripts/gen-skill-docs.ts`
- Modify: active `SKILL.md.tmpl` files that still emit `gstack` wording or
  `gstack_contributor`
- Modify: `docs/skills.md`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: any skill validation tests that still assume live `gstack` language

- [ ] Add failing generation/docs tests that require active Nexus-only language
  in generated skills and top-level docs.
- [ ] Run the targeted generation/docs tests and confirm failure.
- [ ] Rewrite active docs/templates and generator expectations to Nexus-only
  product/runtime language.
- [ ] Run `bun run gen:skill-docs --host codex` and the targeted doc/generation
  tests until they pass.
- [ ] Commit the surface rewrite.

## Task 5: Final Regression And Closeout

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-08-nexus-final-legacy-removal-closeout.md`
- Modify: any touched files needed for regression fixes

- [ ] Run the full Nexus test suite: `bun test test/nexus/*.test.ts`.
- [ ] Run the host/runtime regression suite covering skill docs, validation,
  browse, relink, uninstall, telemetry, learnings, review-log, and global
  discover.
- [ ] Run `bun run gen:skill-docs --host codex` and `git diff --check`.
- [ ] Write the closeout with the exact commands/results and confirm that only
  archival docs still mention `gstack`.
- [ ] Commit the milestone closeout.
