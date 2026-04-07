# Nexus Absorption Status

This file tracks which imported upstream capability sources have been absorbed into
Nexus-owned runtime packs and which seams remain inactive.

## Imported upstream sources

| Source | Imported path | Current role in Nexus |
| --- | --- | --- |
| PM Skills | `upstream/pm-skills` | Absorbed discovery and framing method packs |
| GSD | `upstream/gsd` | Absorbed planning and closeout method packs |
| Superpowers | `upstream/superpowers` | Absorbed build-discipline method pack |
| CCB | `upstream/claude-code-bridge` | Absorbed routing and generator transport packs |

## Active absorbed packs

| Nexus pack | Source system | Active stages |
| --- | --- | --- |
| `lib/nexus/absorption/pm/*` | PM Skills | `/discover`, `/frame` |
| `lib/nexus/absorption/gsd/*` | GSD | `/plan`, `/closeout` |
| `lib/nexus/absorption/superpowers/*` | Superpowers | `/build` |
| `lib/nexus/absorption/ccb/*` | CCB | `/handoff`, `/build` |

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
- Imported upstream repos remain source material, not runtime front doors.
