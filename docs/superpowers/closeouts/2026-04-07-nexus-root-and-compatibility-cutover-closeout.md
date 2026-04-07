# Nexus Root And Compatibility Cutover Closeout

## Outcome

Milestone 8 moved the host/install surface to Nexus-primary roots while keeping
governed lifecycle truth unchanged in `lib/nexus/` and canonical `.planning/`
artifacts.

The cutover now recorded in the repo is:

- `~/.claude/skills/nexus`, `~/.codex/skills/nexus`, `.agents/skills/nexus`,
  and `~/.factory/skills/nexus*` are the primary host roots
- `~/.nexus` is the primary host support state root
- `nexus-config`, `nexus-relink`, `nexus-uninstall`, and `nexus-update-check`
  are the preferred host helpers
- generated Codex and Factory skill roots are Nexus-only on the primary surface
- `gstack-*` host helpers and `~/.gstack` remain compatibility-only substrate

## Inventory State

The repo-visible inventories now reflect the cutover:

- `upstream-notes/gstack-host-migration-inventory.md` marks Nexus-primary roots,
  helpers, and state while keeping Gstack host structures migration-only
- `upstream-notes/absorption-status.md` records `~/.nexus` as primary,
  `~/.gstack` as compatibility-only, and `nexus-*` helpers as the preferred
  host entrypoints

## Verification

Completed during the inventory closeout task:

- `bun test test/nexus/inventory.test.ts`
- `git diff --check`

Observed results:

- inventory regression: `19 passed, 0 failed`
- formatting check: clean

## Remaining Final Verification

The final milestone regression still runs in the next task:

- `bun test test/nexus/*.test.ts`
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts`
- `bun run gen:skill-docs --host codex`

These commands do not change the cutover contract; they validate it end to end.
