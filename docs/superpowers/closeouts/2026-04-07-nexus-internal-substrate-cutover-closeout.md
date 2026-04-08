# Nexus Internal Substrate Cutover Closeout

Date: 2026-04-07
Milestone: Nexus internal substrate cutover
Branch: `codex/nexus-internal-substrate-cutover`

## Outcome

Nexus is now the primary implementation identity for:

- retained host support helpers
- support-state writes
- developer substrate roots
- install and setup guidance

`gstack` remains present only as explicit compatibility substrate.

## Nexus-Owned Support Helper Surface

Primary helper entrypoints are:

- `bin/nexus-analytics`
- `bin/nexus-community-dashboard`
- `bin/nexus-global-discover`
- `bin/nexus-learnings-log`
- `bin/nexus-learnings-search`
- `bin/nexus-review-log`
- `bin/nexus-review-read`
- `bin/nexus-repo-mode`
- `bin/nexus-slug`
- `bin/nexus-telemetry-log`
- `bin/nexus-telemetry-sync`
- `bin/nexus-config`
- `bin/nexus-relink`
- `bin/nexus-uninstall`
- `bin/nexus-update-check`

Compatibility shims still retained:

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
- `bin/gstack-config`
- `bin/gstack-relink`
- `bin/gstack-uninstall`
- `bin/gstack-update-check`

These `gstack-*` binaries no longer own implementation authority.

## Primary Roots

Primary Nexus roots:

- host support state: `~/.nexus`
- developer worktrees: `.nexus-worktrees`
- developer scratch/eval substrate: `~/.nexus-dev`
- Claude install root: `~/.claude/skills/nexus`
- Codex install root: `~/.codex/skills/nexus`
- repo-local Codex root: `.agents/skills/nexus`
- Factory install root: `~/.factory/skills/nexus*`

Compatibility-only roots still supported:

- `~/.gstack`
- `.gstack-worktrees`
- `~/.gstack-dev`
- `~/.claude/skills/gstack`
- `.claude/skills/gstack`
- `.agents/skills/gstack`

Compatibility roots may still be read for migration or cleanup, but are no longer the active write targets.

## Implementation Notes

- `lib/worktree.ts` now writes new worktrees to `.nexus-worktrees` and new harvest data to `~/.nexus-dev`, while still pruning legacy `.gstack-worktrees`.
- eval/watch and observability helpers now prefer `~/.nexus-dev` and only read legacy `~/.gstack-dev` when needed for compatibility.
- eval persistence now writes to Nexus-primary state roots and only falls back to legacy roots in read mode.
- README and setup now present Nexus install paths and Nexus helper names as the active surface.
- migration inventory and absorption status now explicitly classify legacy developer substrate as compatibility-only.

## Deferred

Deferred to the next cleanup/removal milestone:

- removing `gstack-*` compatibility binaries
- removing legacy install roots entirely
- removing remaining internal host variable names and compatibility comments where they do not affect active behavior
- repository remote/host rename away from the historical `gstack` GitHub path

## Verification

Commands run:

```bash
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts test/worktree.test.ts test/helpers/observability.test.ts
bun run gen:skill-docs --host codex
git diff --check
```

Results:

- `bun test test/nexus/*.test.ts` -> `108 passed, 0 failed`
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/global-discover.test.ts test/learnings.test.ts test/review-log.test.ts test/telemetry.test.ts test/worktree.test.ts test/helpers/observability.test.ts` -> `530 passed, 0 failed, 214 skipped`
- `bun run gen:skill-docs --host codex` -> success
- `git diff --check` -> clean
