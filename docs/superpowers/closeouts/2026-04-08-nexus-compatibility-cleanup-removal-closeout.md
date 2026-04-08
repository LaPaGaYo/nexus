# Nexus Compatibility Cleanup And Removal Closeout

Date: 2026-04-08
Milestone: Nexus compatibility cleanup and removal
Branch: `codex/nexus-final-legacy-removal`

## Outcome

Nexus is now the only active internal runtime and product identity across setup,
generation, helper binaries, resolver guidance, telemetry payloads, Supabase
contracts, and routing-test surfaces.

`gstack` no longer survives as an active helper, upgrade entrypoint, or runtime
identity. It remains only in explicit historical metadata and archived records.

## What Changed

- compatibility budget contracts are now frozen in
  `lib/nexus/compatibility-surface.ts`
- host migration inventory and absorption status now classify legacy surfaces as:
  - `removed_from_active_path`
  - `historical_record_only`
- routing install tests now treat `nexus` as the root installed skill identity
- `gstack-upgrade` has been removed from the active surface entirely
- telemetry and Supabase contracts now use `nexus_version` and `NEXUS_*` naming only
- active docs, generated skills, extension UI, and helper implementations no
  longer expose live `gstack` wording
- E2E fixtures that describe active Nexus-owned paths now point at:
  - `~/.nexus`
  - `.nexus`
  - Nexus-first contributor/session wording
- touchfile metadata now tracks the canonical `nexus-upgrade-happy-path` name

## Compatibility Budget

Removed from active path:

- `bin/gstack-config`
- `bin/gstack-relink`
- `bin/gstack-uninstall`
- `bin/gstack-update-check`
- `bin/gstack-analytics`
- `bin/gstack-community-dashboard`
- `bin/gstack-global-discover`
- `bin/gstack-learnings-log`
- `bin/gstack-learnings-search`
- `bin/gstack-review-log`
- `bin/gstack-review-read`
- `bin/gstack-repo-mode`
- `bin/gstack-slug`
- `bin/gstack-telemetry-log`
- `bin/gstack-telemetry-sync`
- `bin/gstack-patch-names`
- `bin/gstack-diff-scope`
- `bin/gstack-platform-detect`
- `bin/gstack-open-url`
- `bin/gstack-extension`
- `gstack-upgrade`

Historical record only:

- `~/.gstack`
- `.gstack-worktrees`
- `~/.gstack-dev`
- repository remote naming
- archived docs and closeouts

## Deferred

Deferred to the next legacy-removal milestone:

- deciding whether historical metadata for legacy roots should remain in helper
  contracts or move fully into archive-only documentation
- cleaning remaining non-active legacy textual residue outside the active product
  surface
- repository remote rename away from the historical `gstack` identity

## Verification

Commands run:

```bash
bun run gen:skill-docs --host codex
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/telemetry.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts test/worktree.test.ts
bun test browse/test/gstack-config.test.ts browse/test/gstack-update-check.test.ts
git diff --check
```

Results:

- `bun run gen:skill-docs --host codex` -> success
- `bun test test/nexus/*.test.ts` -> `111 passed, 0 failed`
- `bun test test/gen-skill-docs.test.ts test/telemetry.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts test/worktree.test.ts` -> `588 passed, 0 failed, 225 skipped`
- `bun test browse/test/gstack-config.test.ts browse/test/gstack-update-check.test.ts` -> `14 passed, 0 failed`
- `git diff --check` -> clean
