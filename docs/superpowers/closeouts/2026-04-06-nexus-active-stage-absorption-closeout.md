# Milestone 4 Closeout: Nexus Active Stage Absorption

Date: 2026-04-06

Branch: `codex/nexus-command-surface`

## Outcome

Milestone 4 is complete.

The active governed path now routes through Nexus-owned stage packs instead of exposing
backend system identity as the primary runtime shape. PM Skills, GSD, Superpowers, and
CCB remain traceable capability sources, but the runtime-facing units for active stages
are now the Nexus packs under `lib/nexus/stage-packs/`.

## What Landed

### Nexus-owned active stage packs

- `nexus-discover-pack`
- `nexus-frame-pack`
- `nexus-plan-pack`
- `nexus-handoff-pack`
- `nexus-build-pack`
- `nexus-closeout-pack`

These packs now own the active stage-level runtime identity for:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/closeout`

### Upstream systems demoted to source material

- PM Skills now feed the discover/frame stage packs as source material only
- GSD now feeds the plan/closeout stage packs as source material only
- Superpowers now feeds the build stage pack as discipline source material only
- CCB now feeds the handoff/build stage packs as transport source material only

Active inventory rows now link to explicit Nexus stage pack ids, and the absorption
status note records `lib/nexus/stage-packs/` as the active internal units.

### Authority boundaries preserved

- canonical Nexus commands remain the only front door
- `.planning/` and canonical stage artifacts remain the only governed truth
- `lib/nexus/` remains the only contract owner
- CCB remains transport only and does not gain lifecycle authority
- reserved future seams remain inactive:
  - `review.superpowers`
  - `review.ccb`
  - `ship.superpowers`

## Verification Evidence

Nexus regression:

```bash
bun test test/nexus/*.test.ts
```

Result:

- 70 passed
- 0 failed

Host and wrapper regression:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Result:

- 429 passed
- 225 skipped
- 0 failed

Generated wrapper freshness:

```bash
bun run gen:skill-docs --host codex
```

Result:

- exited 0
- regenerated Codex wrapper docs without introducing drift

## Baseline Locked

- active stages now route through Nexus-owned stage packs
- imported upstream repos remain source material only
- CCB remains transport only
- canonical Nexus commands remain the only front door

## Remaining Deliberate Gaps

- `/review` and `/ship` still keep their Superpowers/CCB reserved future seams inactive
- `/qa` remains a placeholder canonical command
- `/ship` remains a placeholder canonical command
- deeper host-shell reduction and full product-surface cleanup remain future work

## Commit Trail

- `a230843` import Milestone 4 product-unification spec and plan
- `488d170` freeze Nexus stage pack contracts
- `94ad19f` route PM seams through Nexus stage packs
- `c1c17f3` route GSD seams through Nexus stage packs
- `4caf049` route build and handoff through Nexus stage packs
- `169103e` align inventories and docs with Nexus stage packs

## Next Step

Continue from the stage-pack baseline toward the final Nexus product surface:

- absorb more backend method assets directly into Nexus-owned stage content
- reduce remaining Gstack host identity in generated wrappers and install surface
- complete the remaining canonical stages so the whole product presents as one finished Nexus
