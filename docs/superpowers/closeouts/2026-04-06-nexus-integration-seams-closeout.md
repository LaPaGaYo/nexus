# Milestone 2 Closeout: Nexus Integration Seams

Date: 2026-04-06

Branch: `codex/nexus-command-surface`

## Outcome

Milestone 2 is complete.

Nexus remains the sole contract owner and repo-visible source of truth while the current Gstack repository continues to act as the host shell.

The canonical Nexus command surface is unchanged:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

## What Landed

### Active backend seams

- PM Skills injected behind `/discover`
- PM Skills injected behind `/frame`
- GSD injected behind `/plan`
- GSD injected behind `/closeout`
- CCB routing/transport injected behind `/handoff`
- CCB generator transport injected behind `/build`
- Superpowers build discipline injected behind `/build`

### Reserved future seams

The following seams remain present in code shape but inactive in runtime:

- `review.superpowers = reserved_future`
- `review.ccb = reserved_future`
- `ship.superpowers = reserved_future`

### Governing artifact model

Governed truth remains in canonical Nexus artifacts only:

- `.planning/nexus/current-run.json`
- `.planning/current/*/status.json`
- canonical stage markdown/json artifacts under `.planning/current/`
- `.planning/audits/current/*`

Traceability artifacts remain non-authoritative:

- `adapter-request.json`
- `adapter-output.json`
- `normalization.json`

### Inventory layer

Repo-visible inventories now exist for:

- `upstream-notes/pm-skills-inventory.md`
- `upstream-notes/gsd-inventory.md`
- `upstream-notes/superpowers-inventory.md`
- `upstream-notes/ccb-inventory.md`
- `upstream-notes/gstack-host-migration-inventory.md`

The Gstack host migration inventory is identification-only for post-M2 cleanup planning. It does not authorize cleanup work or host-state truth.

## Locked Behaviors Verified

- `status.json` and canonical stage artifacts win over traceability artifacts by definition.
- Partial canonical write failure blocks the stage and writes conflict artifacts.
- `/handoff` treats route availability and Nexus approval as separate concepts.
- `/build` keeps `requested_route` and `actual_route` distinct.
- Superpowers discipline runs before CCB generator transport.
- A blocked/refused Superpowers discipline stops build execution before routed transport starts.
- `/closeout` remains Nexus-gated on transition legality, review completeness, provenance consistency, and archive consistency.
- Legacy aliases route only through the canonical Nexus runtime and do not own alternate artifact roots or transition semantics.

## Verification Evidence

Final Nexus regression:

```bash
bun test test/nexus/*.test.ts
```

Result:

- 46 passed
- 0 failed

Host and generated-skill regression:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Result:

- 423 passed
- 225 skipped
- 0 failed

## Milestone 2 Commit Trail

- `5ed798e` freeze shared route and provenance contracts
- `ef383e6` add adapter registry and canonical writeback
- `62b7d1a` integrate PM seams for discover and frame
- `e607de7` integrate GSD seams for plan and closeout
- `d3e751b` add conservative CCB routing and provenance
- `cadc9c2` add Superpowers build discipline seam
- `e13d83f` lock inventories and alias safety

## Remaining Deliberate Gaps

- `/review` still uses a thin audit implementation; real CCB-backed audit transport is not active yet.
- `/qa` remains a placeholder command.
- `/ship` remains a placeholder command.
- Flat compatibility provenance fields still exist in `meta.json`, but nested `implementation.*` fields are authoritative.
- Gstack host structures are still present and intentionally not reduced in Milestone 2.

## Recommended Next Step

Milestone 3 planning is complete and its Phase 1 absorption baseline has landed. See:

- `docs/superpowers/specs/2026-04-06-nexus-absorption-and-surface-unification-design.md`
- `docs/superpowers/plans/2026-04-06-nexus-absorption-and-surface-unification.md`
- `docs/superpowers/closeouts/2026-04-06-nexus-absorption-phase-1-closeout.md`

The next remaining reduction work is host cleanup and deeper surface unification after the
Phase 1 absorbed packs baseline.

That work should continue using `upstream-notes/gstack-host-migration-inventory.md` as
the migration inventory and should keep the following rule unchanged:

Nexus owns contracts, governance, transitions, artifacts, and repo-visible lifecycle truth; Gstack remains host shell only until cleanup is explicitly planned and executed.
