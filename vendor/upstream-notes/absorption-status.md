# Nexus Absorption Status

This file tracks which imported upstream capability sources have been absorbed
into Nexus-owned stage content and stage packs.

Upstream freshness maintenance is frozen in `vendor/upstream-notes/upstream-lock.json`,
with `vendor/upstream-notes/update-status.md` as the human-readable summary. Imported
upstreams remain source material only and never become runtime truth. The initial
lock is a bootstrap snapshot with unknown check state.

## Maintainer absorption review outcomes

These labels are maintainer-only review state and not governed lifecycle truth.

| Decision | Maintainer meaning | Release impact |
| --- | --- | --- |
| `ignore` | No absorption work is warranted for the refresh candidate. | No Nexus release required. |
| `defer` | Review is postponed or left open for later maintainer action. | No Nexus release required. |
| `absorb_partial` | Absorb only the Nexus-owned portions that should change. | Release may be required if Nexus-owned assets changed. |
| `absorb_full` | Absorb the upstream delta into Nexus-owned assets in full. | Release is required if Nexus-owned assets changed. |
| `reject` | Do not absorb the candidate. | No Nexus release required. |

Maintainer review records live in `vendor/upstream-notes/upstream-lock.json` and the
refresh-candidate notes. They do not override governed lifecycle truth.

If a candidate is still under review, `last_absorption_decision` stays unset
until a maintainer records an actual outcome.

## Imported upstream sources

| Source | Imported path | Current role in Nexus |
| --- | --- | --- |
| PM Skills | `vendor/upstream/pm-skills` | Source material only for discovery and framing stage content and stage packs |
| GSD | `vendor/upstream/gsd` | Source material only for planning and closeout stage content and stage packs |
| Superpowers | `vendor/upstream/superpowers` | Source material only for build, review, and ship stage content and stage packs |
| CCB | `vendor/upstream/claude-code-bridge` | Source material only for handoff, build, review, and QA compatibility infrastructure under Nexus control; not a full-retirement target |

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

Nexus-owned stage packs under `lib/nexus/stage-packs/` remain the active
internal runtime units.

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

The absorbed builders under `lib/nexus/absorption/` remain implementation detail
only. Imported upstream repos remain source material only, not runtime front
doors.

## Product surface status

The visible product surface is now Nexus-only across active paths:

- `package.json` identifies the package as `nexus`
- `README.md` and `docs/skills.md` present Nexus as the only active product surface
- `~/.claude/skills/nexus`, `~/.codex/skills/nexus`, `.agents/skills/nexus`, and `~/.factory/skills/nexus` are the active host roots
- `~/.nexus` is now the primary host support state root
- `.nexus-worktrees` and `~/.nexus-dev` are now the primary developer substrate roots
- `nexus-*` host helpers are the active entrypoints

`gstack` now survives only in archived records:

- archived docs and closeouts

## Authority boundary

- Nexus canonical commands are the only lifecycle entrypoints.
- `lib/nexus/` owns command contracts, transitions, and repo-visible governed state.
- Traceability artifacts and absorbed source maps do not become lifecycle truth on their own.
- Imported upstream repos remain source material only, not runtime front doors.
