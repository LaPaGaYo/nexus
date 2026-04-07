# Nexus Absorption Status

This file tracks which imported upstream capability sources have been absorbed into
Nexus-owned stage packs and which seams remain inactive.

## Imported upstream sources

| Source | Imported path | Current role in Nexus |
| --- | --- | --- |
| PM Skills | `upstream/pm-skills` | Source material only for the discovery and framing stage packs |
| GSD | `upstream/gsd` | Source material only for the planning and closeout stage packs |
| Superpowers | `upstream/superpowers` | Source material only for the build stage pack |
| CCB | `upstream/claude-code-bridge` | Source material only for handoff/build transport under Nexus control |

## Active Nexus-owned stage packs

| Nexus pack | Runtime path | Source systems | Active stages |
| --- | --- | --- | --- |
| `nexus-discover-pack` | `lib/nexus/stage-packs/discover.ts` | PM Skills | `/discover` |
| `nexus-frame-pack` | `lib/nexus/stage-packs/frame.ts` | PM Skills | `/frame` |
| `nexus-plan-pack` | `lib/nexus/stage-packs/plan.ts` | GSD | `/plan` |
| `nexus-handoff-pack` | `lib/nexus/stage-packs/handoff.ts` | CCB | `/handoff` |
| `nexus-build-pack` | `lib/nexus/stage-packs/build.ts` | Superpowers, CCB | `/build` |
| `nexus-closeout-pack` | `lib/nexus/stage-packs/closeout.ts` | GSD | `/closeout` |

The absorbed builders under `lib/nexus/absorption/` remain implementation detail only.
The active Nexus-owned units are the stage packs under `lib/nexus/stage-packs/`.

## Reserved future seams

The following seams are present in code shape but remain inactive in the runtime registry:

- `review.superpowers`
- `review.ccb`
- `ship.superpowers`

These seams do not own lifecycle authority and are not active front doors.

## Authority boundary

- Nexus canonical commands are the only lifecycle entrypoints.
- `lib/nexus/` owns command contracts, transitions, and repo-visible governed state.
- Traceability artifacts and absorbed source maps do not become lifecycle truth on their own.
- Imported upstream repos remain source material only, not runtime front doors.
