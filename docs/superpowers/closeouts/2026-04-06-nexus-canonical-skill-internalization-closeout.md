# Milestone 5 Closeout: Nexus Canonical Skill Internalization

Date: 2026-04-06

Branch: `codex/nexus-canonical-skill-internalization`

## Outcome

Milestone 5 is complete.

Canonical Nexus lifecycle skills now render their operator-facing meaning from
Nexus-owned stage content under `lib/nexus/stage-content/`. The generated wrappers no
longer depend on hand-authored per-command body text as the semantic source. Runtime
stage identity, governed status, transitions, and canonical artifacts remain owned by
`lib/nexus/` and `.planning/`.

## What Landed

### Nexus-owned canonical skill content

All nine canonical lifecycle commands now have dedicated stage-content packs:

- `nexus-discover-content`
- `nexus-frame-content`
- `nexus-plan-content`
- `nexus-handoff-content`
- `nexus-build-content`
- `nexus-review-content`
- `nexus-qa-content`
- `nexus-ship-content`
- `nexus-closeout-content`

These packs now provide the canonical:

- stage overview
- operator checklist
- artifact contract
- routing guidance

for the generated lifecycle wrappers.

### Canonical wrappers now render from stage-content

The canonical lifecycle templates now resolve through `scripts/resolvers/nexus-stage-content.ts`
instead of carrying bespoke body prose in each template. The wrappers keep their frontmatter,
invocation shape, and preamble, but the command meaning now comes from Nexus-authored
stage content.

### Documentation and inventories aligned

Repo docs and absorption notes now describe the internal split explicitly:

- `lib/nexus/stage-content/` owns canonical lifecycle skill content
- `lib/nexus/stage-packs/` owns active runtime stage identity
- imported upstream repos remain source material only
- CCB remains transport and dispatch only

Inventory notes now describe active operator-facing identity and runtime identity
together where relevant.

## Authority Boundaries Preserved

- canonical Nexus commands remain the only lifecycle front door
- `lib/nexus/` remains the only contract owner
- `.planning/` and canonical stage artifacts remain the only governed truth
- stage-content packs describe behavior but do not gain lifecycle authority
- upstream repos remain source material only
- CCB remains transport only and does not gain contract or stage ownership
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

- 77 passed
- 0 failed

Host and generator regression:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Result:

- 431 passed
- 225 skipped
- 0 failed

Generated wrapper freshness:

```bash
bun run gen:skill-docs --host codex
```

Result:

- exited 0
- regenerated Codex wrapper docs without drift

## Baseline Locked

- canonical lifecycle wrapper meaning is now Nexus-owned
- runtime stage packs remain the semantic owner of stage identity
- upstream repos remain source material only
- CCB remains transport only
- canonical Nexus commands remain the only lifecycle front door

## Remaining Deliberate Gaps

- `/qa` remains a placeholder canonical command at runtime depth
- `/ship` remains a placeholder canonical command at runtime depth
- `/review` content is Nexus-owned, but reserved future transport and discipline seams remain inactive
- host-shell reduction and final product-surface unification remain future work

## Commit Trail

- `47459b3` freeze Nexus stage content contracts
- `ca567ea` add Nexus content packs for discover, frame, and plan
- `d9d89c0` add Nexus content packs for handoff, build, and closeout
- `f0ae613` add Nexus content packs for review, qa, and ship
- `7d2ccfd` render canonical wrappers from Nexus stage content

## Next Step

Continue from the canonical-skill baseline toward the finished Nexus product surface:

- internalize more absorbed methods into Nexus-owned content and runtime assets
- keep shrinking Gstack host identity at the user-facing surface
- complete the remaining placeholder runtime stages so the whole lifecycle presents as one finished Nexus
