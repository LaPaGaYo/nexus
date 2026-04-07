# Nexus Product Surface Unification Closeout

## Outcome

Milestone 7 made the visible product surface Nexus-primary while keeping governed
runtime truth unchanged in `lib/nexus/` and canonical `.planning/` artifacts.

The main user-facing changes are now in place:

- generated wrapper and preamble prose present Nexus as the product
- namespaced installs prefer `nexus-*` for lifecycle skills
- `nexus-config`, `nexus-relink`, `nexus-uninstall`, and `nexus-update-check`
  now exist as preferred host helpers
- package metadata, README, and `docs/skills.md` now present Nexus as the only
  product surface

Compatibility substrate intentionally remains:

- `~/.gstack` remains the compatibility state root
- `gstack-*` binaries remain working compatibility shims
- compatibility install roots such as `~/.claude/skills/gstack` and
  `.agents/skills/gstack` remain unchanged for now

## Verification

Completed verification for this milestone:

- `bun test test/nexus/*.test.ts`
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts`
- `bun run gen:skill-docs --host codex`
- `git diff --check`

Observed results:

- Nexus regression: `100 passed, 0 failed`
- Host/install regression: `450 passed, 0 failed, 225 skipped`
- host doc generation: success
- formatting check: clean

## Notes

- No governed lifecycle contracts were moved into setup scripts, host helpers, or
  compatibility state.
- Gstack remains only as compatibility substrate and migration-era host shell.
- A later milestone still needs to decide whether and how to migrate the
  compatibility state roots and install paths away from `gstack`.
