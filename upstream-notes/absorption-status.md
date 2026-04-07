# Nexus Absorption Status

This file tracks which imported upstream capability sources have been absorbed into
Nexus-owned stage content and stage packs, and which seams remain inactive.

## Imported upstream sources

| Source | Imported path | Current role in Nexus |
| --- | --- | --- |
| PM Skills | `upstream/pm-skills` | Source material only for the discovery and framing stage content and stage packs |
| GSD | `upstream/gsd` | Source material only for the planning and closeout stage content and stage packs |
| Superpowers | `upstream/superpowers` | Source material only for the build stage content and stage pack |
| CCB | `upstream/claude-code-bridge` | Source material only for handoff/build routing content and transport under Nexus control |

## Active Nexus-owned stage content

| Nexus content | Content path | Source systems | Canonical commands |
| --- | --- | --- | --- |
| `nexus-discover-content` | `lib/nexus/stage-content/discover/` | PM Skills | `/discover` |
| `nexus-frame-content` | `lib/nexus/stage-content/frame/` | PM Skills | `/frame` |
| `nexus-plan-content` | `lib/nexus/stage-content/plan/` | GSD | `/plan` |
| `nexus-handoff-content` | `lib/nexus/stage-content/handoff/` | CCB | `/handoff` |
| `nexus-build-content` | `lib/nexus/stage-content/build/` | Superpowers, CCB | `/build` |
| `nexus-review-content` | `lib/nexus/stage-content/review/` | Superpowers, GSD | `/review` |
| `nexus-qa-content` | `lib/nexus/stage-content/qa/` | Superpowers, GSD | `/qa` |
| `nexus-ship-content` | `lib/nexus/stage-content/ship/` | Superpowers, CCB | `/ship` |
| `nexus-closeout-content` | `lib/nexus/stage-content/closeout/` | GSD | `/closeout` |

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
The active Nexus-owned units are the canonical stage content under `lib/nexus/stage-content/`
and the runtime stage packs under `lib/nexus/stage-packs/`.

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
