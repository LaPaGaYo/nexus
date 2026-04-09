# Milestone 3 Phase 1 Closeout: Nexus Absorption and Surface Unification

Date: 2026-04-06

Branch: `codex/nexus-command-surface`

## Outcome

Milestone 3 Phase 1 is complete.

Nexus remains the only governed command surface while imported PM Skills, GSD,
Superpowers, and CCB capabilities are now represented as Nexus-owned absorbed packs
under `lib/nexus/absorption/`.

## What Landed

### Absorbed capability packs

- `lib/nexus/absorption/pm/`
- `lib/nexus/absorption/gsd/`
- `lib/nexus/absorption/superpowers/`
- `lib/nexus/absorption/ccb/`

These packs are traceable back to imported upstream source maps, but they do not replace
canonical Nexus status files or stage artifacts as lifecycle truth.

### Active absorbed seams

- PM discovery absorbed behind `/discover`
- PM framing absorbed behind `/frame`
- GSD planning absorbed behind `/plan`
- GSD closeout absorbed behind `/closeout`
- Superpowers build discipline absorbed behind `/build`
- CCB routing absorbed behind `/handoff`
- CCB generator transport absorbed behind `/build`

### Reserved future seams still inactive

- `review.superpowers = reserved_future`
- `review.ccb = reserved_future`
- `ship.superpowers = reserved_future`

No reserved future seam was activated in this phase.

### Surface unification

- canonical wrappers now state they are the only supported lifecycle entrypoints
- compatibility aliases remain explicit pass-through wrappers only
- `README.md` and `docs/skills.md` now present Nexus as the only lifecycle command surface
- `upstream-notes/absorption-status.md` records the imported upstreams, active absorbed
  packs, and inactive reserved seams

### Migration safety and host boundary

- backend-native lifecycle entrypoints are refused before lifecycle resolution
- `CLAUDE.md` routing guidance remains discovery-only, not contract truth
- the host preamble stays a shell/bootstrap layer and does not regain governed ownership
- repo-visible canonical artifacts remain the only governed truth

## Verification Evidence

Nexus regression:

```bash
bun test test/nexus/*.test.ts
```

Result:

- 60 passed
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
- generated Codex wrapper output without unresolved placeholders

## Migration Baseline Locked

- absorbed capability packs created under `lib/nexus/absorption/`
- host preamble reduced to shell/bootstrap role
- backend-native lifecycle entrypoints refused
- canonical Nexus commands remain the only governed front door

## Deliberate Remaining Gaps

- the repo still carries Gstack host structure while deeper cleanup/reduction is deferred
- `/qa` remains a placeholder canonical command
- `/ship` remains a placeholder canonical command
- imported upstream repos remain source material directories until later absorption work
  rewrites more stage assets directly into Nexus-owned structures

## Commit Trail

- `2841d89` freeze absorbed source-map contracts
- `7557a60` route PM and GSD through absorbed Nexus packs
- `cc6d296` route active Superpowers and CCB seams through absorbed Nexus packs
- `5a6176c` enforce backend non-authority and migration safety
- `7159638` reduce host preamble and CLAUDE contract leakage
- `c8f6f62` unify wrapper surface and docs around Nexus-only discoverability

## Next Step

Continue with host cleanup and deeper surface unification using the locked absorption
baseline from this closeout. That work should reduce remaining Gstack host structure
without reintroducing any alternate command surface or artifact truth layer.
