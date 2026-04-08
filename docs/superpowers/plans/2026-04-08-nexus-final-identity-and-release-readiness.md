# Nexus Final Identity And Release Readiness Plan

Date: 2026-04-08
Milestone: Nexus final identity and release readiness
Branch: `codex/nexus-final-identity-release-readiness`

## Task 1

Freeze Nexus-only live contracts.

Files:

- `lib/nexus/support-surface.ts`
- `lib/nexus/host-roots.ts`
- `lib/nexus/product-surface.ts`
- `test/nexus/support-surface.test.ts`
- `test/nexus/host-roots.test.ts`
- `test/nexus/product-surface.test.ts`

## Task 2

Remove legacy root fallback reads from active runtime/support code.

Files:

- `lib/worktree.ts`
- `scripts/eval-watch.ts`
- `test/helpers/eval-store.ts`
- related regression tests

## Task 3

Move remaining legacy contract language to archive-only records.

Files:

- `upstream-notes/legacy-host-migration-history.md`
- `upstream-notes/absorption-status.md`
- `docs/superpowers/closeouts/2026-04-08-nexus-compatibility-cleanup-removal-closeout.md`

## Task 4

Add final release-readiness closeout and run fresh verification.

Files:

- `docs/superpowers/closeouts/2026-04-08-nexus-final-identity-and-release-readiness-closeout.md`

Verification:

- `bun test test/nexus/*.test.ts`
- `bun test test/gen-skill-docs.test.ts test/telemetry.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts test/worktree.test.ts`
- `bun test browse/test/nexus-config.test.ts browse/test/nexus-update-check.test.ts`
- `bun test`
- `git diff --check`
