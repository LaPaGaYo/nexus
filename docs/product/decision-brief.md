# Decision Brief — Problem A milestone frame

## Hypothesis

If we introduce a first-class third execution-provenance into Nexus's governed-execution model — "the calling session is the named worker" as an enforced, distinguishable artifact state with a defined `status.json`/ledger writer and a non-circular trust anchor — decomposed into bounded phases whose solution shapes are decided per-phase, then operators in the majority `local_provider/claude`-inside-Claude-Code environment complete the governed lifecycle in-session without fabricating provenance and `/review`/`/ship` can distinguish attested from spawned, because Sources 1/2/4/6 show the fabrication is forced by the absent concept and three grounded reviews established it must be modeled, not patched.

## Chosen scope

Problem A only, framed as a **Nexus-native milestone (multi-phase), explicitly not a point release**. This frame bounds and will phase-decompose the problem; it deliberately does NOT pick the solution (provenance schema, trust-anchor mechanism, `/review` edits) — those are per-phase decisions. Problems B (streaming parity) and C (lifecycle re-entry) are out, separately routed.

## Rejected alternatives

- **Bounded hotfix (v1.1.x / v1.2 framings)** — disproven 3x by grounded review (idea-brief Source 6). Treating model-depth as patch-depth.
- **codex's bounded steelman** (keep #160 + streaming parity + bless direct-terminal + narrow import-review) — a real contender, not a strawman. Rejected as the answer to Problem A (accepts permanent context-switch + leaves fabrication possible) but partially adopted as the boundary: it IS the right answer for B/C and the interim, which is why #160 stays and B/C route separately.
- **GSD to manage the milestone** — would create a second governance surface in `.planning/` (violates repo CLAUDE.md). Nexus-native milestone chosen (idea-brief Vehicle Decision).

## Decision rationale

Problem A is the genuinely structural, recurring one of the three decomposed problems. Framing it as a milestone is the honest correction of the patch-depth error this work unit kept making. #160 made the failure survivable but not solved; fabrication risk persists every time an operator routes around the context-switch. The frame deliberately does not pick *how* — every prior attempt to decide *how* at framing time was disproven by independent review.

## Open framing questions surviving to `/plan`

1. Phase 1 = the ownership-model question (`status.json`/ledger writer when nothing spawns, `build.ts:468`), scoped as a decision-gate phase, not an implementation phase.
2. Dependency spine for ≥3 phases: ownership model → provenance carrier → `/review` contract → trust anchor → (optional) migration. `/plan` proposes; each phase gets its own `/frame`.
3. Milestone gate: commit to phases 2+ only after Phase 1's frame proves bounded (Risk 5).
4. Independent-review gate placement: after this milestone frame (before `/plan`) and after each phase frame. This session's iron rule, recorded not skipped.
5. Hard deferral: provenance field shape, trust-anchor mechanism, exact `review.ts` edits, migration policy — must NOT leak into planning as pre-decided (the codex-flagged relapse vector).

## Status

Framing complete and Law-1/2/3 compliant. NOT auto-advanced to `/plan`: per this session's iron rule (no stage advance without grounded independent review — applied 3x, caught a blocker 3x), this milestone frame requires an independent grounded review before planning.
