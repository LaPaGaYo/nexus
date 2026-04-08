# Nexus Compatibility Cleanup And Removal Closeout

Date: 2026-04-08
Milestone: Nexus compatibility cleanup and removal
Branch: `codex/nexus-compatibility-cleanup-removal`

## Outcome

Nexus is now the only active internal runtime and product identity across the
remaining setup, generation, resolver guidance, and routing-test surfaces.

`gstack` remains only in the explicit compatibility budget:

- retained boundary shims
- deferred legacy cleanup roots
- compatibility-only aliases and upgrade entrypoints

Active-path `gstack` utility ownership has been removed from the Nexus-primary
surface.

## What Changed

- compatibility budget contracts are now frozen in `lib/nexus/compatibility-surface.ts`
- host migration inventory and absorption status now classify legacy surfaces as:
  - `removed_from_active_path`
  - `retained_compatibility_shim`
  - `deferred_final_removal`
- routing install tests now treat `nexus` as the root installed skill identity
- `gstack-upgrade` no longer participates in canonical routing install fixtures
- E2E fixtures that describe active Nexus-owned paths now point at:
  - `~/.nexus`
  - `.nexus`
  - Nexus-first contributor/session wording
- touchfile metadata now tracks the canonical `nexus-upgrade-happy-path` name

## Compatibility Budget

Retained compatibility shims:

- `bin/gstack-config`
- `bin/gstack-relink`
- `bin/gstack-uninstall`
- `bin/gstack-update-check`

Removed from active path:

- `bin/gstack-patch-names`
- `bin/gstack-diff-scope`
- `bin/gstack-platform-detect`
- `bin/gstack-open-url`
- `bin/gstack-extension`
- `gstack-upgrade`

Deferred final removal:

- `~/.gstack`
- `.gstack-worktrees`
- `~/.gstack-dev`
- repository remote naming

## Deferred

Deferred to the next legacy-removal milestone:

- removing retained `gstack-*` boundary shims entirely
- removing deferred legacy roots after compatibility cutover is no longer needed
- cleaning remaining legacy textual residue that does not currently own active
  runtime behavior
- repository remote rename away from the historical `gstack` identity

## Verification

Commands run:

```bash
bun run gen:skill-docs --host codex
bun test test/nexus/inventory.test.ts test/skill-routing-e2e.test.ts
bun test test/skill-e2e.test.ts test/skill-e2e-workflow.test.ts test/skill-e2e-bws.test.ts test/skill-e2e-plan.test.ts
bun test test/touchfiles.test.ts
bun test
git diff --check
```

Results:

- `bun run gen:skill-docs --host codex` -> success
- `bun test test/nexus/inventory.test.ts test/skill-routing-e2e.test.ts` -> `21 passed, 0 failed, 11 skipped`
- `bun test test/skill-e2e.test.ts test/skill-e2e-workflow.test.ts test/skill-e2e-bws.test.ts test/skill-e2e-plan.test.ts` -> `0 passed, 0 failed, 151 skipped`
- `bun test test/touchfiles.test.ts` -> `23 passed, 0 failed`
- `bun test` -> success (`EXIT:0`)
- `git diff --check` -> clean
