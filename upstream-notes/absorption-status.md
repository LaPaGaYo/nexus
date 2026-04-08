# Nexus Absorption Status

This file tracks which imported upstream capability sources have been absorbed into
Nexus-owned stage content and stage packs, and which seams remain inactive.

## Imported upstream sources

| Source | Imported path | Current role in Nexus |
| --- | --- | --- |
| PM Skills | `upstream/pm-skills` | Source material only for the discovery and framing stage content and stage packs |
| GSD | `upstream/gsd` | Source material only for the planning and closeout stage content and stage packs |
| Superpowers | `upstream/superpowers` | Source material only for the build, review, and ship stage content and stage packs |
| CCB | `upstream/claude-code-bridge` | Source material only for handoff, build, review, and QA routing/transport under Nexus control |

## Active Nexus-owned stage content

| Nexus content | Content path | Source systems | Canonical commands |
| --- | --- | --- | --- |
| `nexus-discover-content` | `lib/nexus/stage-content/discover/` | PM Skills | `/discover` |
| `nexus-frame-content` | `lib/nexus/stage-content/frame/` | PM Skills | `/frame` |
| `nexus-plan-content` | `lib/nexus/stage-content/plan/` | GSD | `/plan` |
| `nexus-handoff-content` | `lib/nexus/stage-content/handoff/` | CCB | `/handoff` |
| `nexus-build-content` | `lib/nexus/stage-content/build/` | Superpowers, CCB | `/build` |
| `nexus-review-content` | `lib/nexus/stage-content/review/` | Superpowers, CCB | `/review` |
| `nexus-qa-content` | `lib/nexus/stage-content/qa/` | CCB | `/qa` |
| `nexus-ship-content` | `lib/nexus/stage-content/ship/` | Superpowers | `/ship` |
| `nexus-closeout-content` | `lib/nexus/stage-content/closeout/` | GSD | `/closeout` |

## Active Nexus-owned stage packs

| Nexus pack | Runtime path | Source systems | Active stages |
| --- | --- | --- | --- |
| `nexus-discover-pack` | `lib/nexus/stage-packs/discover.ts` | PM Skills | `/discover` |
| `nexus-frame-pack` | `lib/nexus/stage-packs/frame.ts` | PM Skills | `/frame` |
| `nexus-plan-pack` | `lib/nexus/stage-packs/plan.ts` | GSD | `/plan` |
| `nexus-handoff-pack` | `lib/nexus/stage-packs/handoff.ts` | CCB | `/handoff` |
| `nexus-build-pack` | `lib/nexus/stage-packs/build.ts` | Superpowers, CCB | `/build` |
| `nexus-review-pack` | `lib/nexus/stage-packs/review.ts` | Superpowers, CCB | `/review` |
| `nexus-qa-pack` | `lib/nexus/stage-packs/qa.ts` | CCB | `/qa` |
| `nexus-ship-pack` | `lib/nexus/stage-packs/ship.ts` | Superpowers | `/ship` |
| `nexus-closeout-pack` | `lib/nexus/stage-packs/closeout.ts` | GSD | `/closeout` |

The absorbed builders under `lib/nexus/absorption/` remain implementation detail only.
The active Nexus-owned units are the canonical stage content under `lib/nexus/stage-content/`
and the runtime stage packs under `lib/nexus/stage-packs/`.

## Active governed tail seams

The governed verification tail now runs through active Nexus-owned runtime seams:

- `review.superpowers`
- `review.ccb`
- `qa.ccb`
- `ship.superpowers`

These seams remain subordinate runtime inputs only. They do not own lifecycle authority, contract truth, or front-door command semantics.

## Product surface status

The visible product surface is now Nexus-primary across the main user entrypoints:

- `package.json` now identifies the package as `nexus`
- `README.md` and `docs/skills.md` present Nexus as the only product surface
- `~/.claude/skills/nexus`, `~/.codex/skills/nexus`, `.agents/skills/nexus`, and `~/.factory/skills/nexus*` are now the primary host roots
- `~/.nexus` is now the primary host support state root
- `.nexus-worktrees` and `~/.nexus-dev` are now the primary developer substrate roots
- setup and relink flows now prefer `nexus-*` names when namespacing is enabled
- `nexus-*` host helpers are the preferred entrypoints, with `bin/nexus-config`, `bin/nexus-relink`, `bin/nexus-uninstall`, and `bin/nexus-update-check` as the primary host helper surface

Compatibility substrate intentionally remains in place:

- `~/.gstack` remains compatibility-only for older host support state
- `.gstack-worktrees` and `~/.gstack-dev` remain compatibility-only read and cleanup roots
- `gstack-*` host binaries still work as shims
- legacy install roots such as `~/.claude/skills/gstack` and `.agents/skills/gstack` remain compatibility fallbacks only until a later cleanup milestone

## Authority boundary

- Nexus canonical commands are the only lifecycle entrypoints.
- `lib/nexus/` owns command contracts, transitions, and repo-visible governed state.
- Traceability artifacts and absorbed source maps do not become lifecycle truth on their own.
- Imported upstream repos remain source material only, not runtime front doors.
