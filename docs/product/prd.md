# PRD — Problem A: honest execution-provenance for "the calling session is the worker" (milestone frame)

| | |
|---|---|
| **Run** | Nexus Problem-A milestone frame (Nexus-native, not GSD — see idea-brief Vehicle Decision) |
| **Worktree** | `claude/jovial-jang-9618ea` |
| **Date** | 2026-05-18 |
| **Upstream** | `docs/product/idea-brief.md` — DECOMPOSITION + Vehicle Decision sections (supersede all prior framings; v1.1.x-hotfix and v1.2-single-concept framings above them are disproven records) |
| **Scope class** | **Milestone (multi-phase). Explicitly NOT a point release.** Per Completeness Principle this is flagged as a model change requiring phase decomposition; this frame bounds and phases it, it does NOT pick the solution. |
| **Discipline** | This frame MUST NOT pre-decide the solution shape (operator_attested-as-schema, trust-anchor mechanism, specific `/review` edits). Solutioning-in-disguise is the verified reason the v1.2 framing was disproven (codex 0.130, idea-brief Source 6). Solution decisions belong to each phase's own `/frame`/`/plan`. |

---

## 1. Problem statement

Operators running Nexus `local_provider` + `primary_provider=claude` from inside an active Claude Code session (the majority Nexus environment) cannot complete the governed lifecycle in-session: the canonical bin's execution model represents only two provenances — *spawned local provider* and *governed CCB dispatch* — and has no first-class representation for "the calling session itself did the work." Post-#160 the lifecycle is runnable (the `assertNestedClaudeAllowed` throw at `local.ts:812` tells the operator to use a terminal, CCB, or `NEXUS_ALLOW_NESTED_CLAUDE=1`), so the cost is not "cannot run" — it is: every governed stage forces a context-switch out of the working session, and when operators route around that by hand-authoring artifacts there is no honest provenance value, so they fabricate `dispatch_command`/`receipt`/`actual_route` (idea-brief Source 1) which `/review`'s provenance gate (`review.ts:541`, `:1188`, `build.ts:107`) cannot distinguish from real dispatch. ≥3 recorded occurrences across 2 projects on a ~15-day cadence (Sources 1, 2, 4), plus a structural disproof (Source 6) that no bounded patch closes it.

## 2. Hypothesis

**If we** introduce a first-class third execution-provenance into Nexus's governed-execution model — representing "the calling session is the named worker" as an enforced, distinguishable artifact state with a defined writer for `status.json`/ledger advancement and a non-circular trust anchor — decomposed into bounded phases whose individual solution shapes are decided per-phase, **then** operators in the majority `local_provider/claude`-inside-Claude-Code environment **will** complete the full governed lifecycle in-session without fabricating provenance and `/review`/`/ship` **will** be able to tell attested execution from spawned execution, **because** idea-brief Sources 1/2/4/6 show the fabrication is forced by the absent concept (not by operator error), and three independent grounded reviews established the concept must be modeled across schema + ownership + review-contract, not patched.

## 3. Success criteria (milestone-level, observable, falsifiable; per-phase criteria deferred to phase frames)

1. **Honest provenance exists and is enforced**: a governed `/build` performed by the calling session produces an artifact whose execution provenance is a distinct, schema-enforced value (not an operator-typed string in a free field). Falsifiable: schema validation rejects an attested artifact that omits the provenance discriminator; a spawned artifact and an attested artifact are distinguishable by a single typed field, not by prose.
2. **No fabrication required**: completing a session-is-worker `/build` requires zero hand-fabrication of `dispatch_command`/`receipt`/`actual_route`. Falsifiable: the attested path has a defined writer such that those fields are legitimately absent/null and schema still validates.
3. **`/review` consumes the attested shape end-to-end**: `/review` run against an attested build neither crashes (`review.ts:541` null `actual_route`, `:1084` null deref) nor silently passes the provenance gate it should not (`review.ts:1188`/`build.ts:107` fix-cycle eligibility). Falsifiable: a test exercises `/review` over an attested build and asserts a defined, non-degraded verdict.
4. **Trust anchor is non-circular**: the attestation references something the attesting session did not author. Falsifiable: removing/forging the anchor causes `/review` (or `/ship`) to reject or downgrade; the anchor is not "the session says so."
5. **Milestone is phase-bounded**: the milestone roadmap decomposes Problem A into phases each with its own bounded `/frame` scope; no phase is "design the whole model." Falsifiable: the roadmap exists with ≥3 phases, each phase frame-able independently, and the phase order is justified by dependency not convenience.

## 4. Non-goals

1. **Not picking the solution in this frame.** This milestone frame does NOT decide that provenance is an `operator_attested` enum on `Local*Raw`, nor the trust-anchor mechanism (pre-execution ledger SHA vs CI signature vs lower-trust gating), nor the specific `review.ts` edits. Those are per-phase decisions. Pre-deciding them here repeats the verified v1.2 failure.
2. **Not Problems B or C.** Streaming parity (Source 3) and lifecycle re-entry (Source 7) are independent, separately routed, explicitly excluded.
3. **Not changing `governed_ccb` or non-claude/non-single-host dispatch.** CCB dispatch to codex/gemini is a legitimate separate-process execution and is untouched.
4. **Not retroactively re-running historical fabricated artifacts** (novelWriter SP2 + prior). Their migration/annotation is a phase question, not a precondition; this milestone does not re-validate them.
5. **Not a point release.** Explicitly not packageable as a hotfix; attempting that is the disproven error class.

## 5. Risks

1. **Scope re-collapse (the recurring failure).** This milestone could itself be under-scoped into a "v1.2" again. Mitigation: success criterion 5 forces a ≥3-phase decomposition with dependency-justified order; the frame is reviewed independently before `/plan` (this session's iron rule: no stage advance without grounded review — applied 3x, caught a blocker 3x).
2. **Solutioning re-creeps via "open questions" that are design menus.** Mitigation: open questions below are sizing/sequencing only; any that name a mechanism are rewritten. codex 0.130 already flagged this exact pattern (Source 6) — it is a known relapse vector.
3. **Ownership-model decision is itself unbounded.** "Who writes status.json when nothing spawns" (`build.ts:468`) may have no bounded answer. Mitigation: make that the FIRST phase's frame; if it proves unbounded, the milestone is re-scoped or paused honestly rather than forced.
4. **Trust anchor may not exist non-circularly in the current architecture.** The ledger has no pre-execution base ref (verified earlier: `ledger.ts` `WorkspaceRecord` has none). Mitigation: a dedicated phase frames the anchor; "accept attested as explicitly lower-trust" is a legitimate phase outcome, not a failure.
5. **Milestone never ships because each phase keeps expanding.** Mitigation: phase 1 (ownership model) is the riskiest; gate the milestone on phase 1's frame being bounded before committing to phases 2+.

## 6. Alternatives considered

**Rejected: bounded hotfix (the v1.1.x and v1.2 framings).** Disproven three times by grounded independent review (idea-brief Source 6): early-exit orphans status.json/ledger ownership, attested shape crashes `/review` downstream, provenance has no honest carrier, the "survival branch" silently degrades the trust gate. The error was treating model-depth work as patch-depth.

**Rejected: codex's bounded steelman (keep #160 + fix streaming parity + bless direct-terminal + narrow import-review rule).** A real contender, NOT a strawman — codex (Source 6) noted the brief had not disproven it. It is rejected as the *answer to Problem A* because it accepts permanent context-switching as the design and leaves fabrication possible; but it is partially adopted as the *non-goal boundary* (it IS the right answer for Problems B/C and the interim, which is why #160 stays and B/C route separately). Recorded so the milestone does not re-litigate it.

**Rejected: introduce GSD to manage the milestone.** Would create a second governance surface in `.planning/` (violates repo CLAUDE.md). Decided in idea-brief Vehicle Decision: Nexus-native milestone.

## 7. Decision rationale

Why this scope: Problem A is the one of the three decomposed problems that is genuinely structural and recurring; B and C are bounded and routed separately. Framing it as a milestone (not a release) is the honest correction of the error this whole work unit kept making. Why now: the failure recurs on a ~15-day cadence and #160 made it survivable but not solved — the audit-trail fabrication risk persists every time an operator routes around the context-switch. What changes when the milestone ships: the majority Nexus environment gains an honest, enforced way to record "I did this work myself," `/review` and `/ship` can trust the provenance field instead of unverifiable prose, and the fabricate-state anti-pattern this entire work unit exists to eliminate is structurally prevented rather than documented after the fact. What this frame deliberately does NOT do: pick how. The roadmap phases decide how, each under its own bounded frame, because every prior attempt to decide how at framing time was disproven.

---

## User stories (acceptance criteria)

**Story 1 — session-is-worker build records honest provenance**

> **Given** an operator in a Claude Code session, `local_provider`/`claude`, who performed the implementation in-session,
> **when** they complete the governed `/build` for that work,
> **then** the resulting artifact carries a schema-enforced provenance discriminator marking it session-attested (not spawned), with no hand-fabricated dispatch/receipt fields, and schema validation passes.

**Story 2 — `/review` handles the attested shape without crash or silent pass**

> **Given** a session-attested build artifact (provenance discriminator set, `actual_route` legitimately absent),
> **when** `/review` runs against it,
> **then** `/review` neither throws on the null route nor records `provenance_consistent` in a way that silently grants fix-cycle eligibility it should not; it produces a defined verdict appropriate to attested provenance.

**Story 3 — milestone is phase-decomposed before any solution is built**

> **Given** this milestone frame is approved,
> **when** the roadmap is created,
> **then** Problem A is decomposed into ≥3 dependency-ordered phases, the first being the ownership-model question (`status.json`/ledger writer when nothing spawns), and no phase's scope is "design the entire model."

## Out-of-scope (distinct from non-goals)

Adjacent things an operator might expect this milestone to touch but it does not:

1. **Problem B (streaming parity) and Problem C (lifecycle re-entry).** Independently routed; an operator seeing "execution-provenance milestone" might assume the silent-agent_team gap or the frame→discover rejection are included. They are not.
2. **The novelWriter SP2 historical run.** Stays as committed (operator-attested, disclosed). This milestone does not retroactively fix or re-grade it; whether a migration ships is a phase question, not a milestone promise.
3. **`governed_ccb` provenance.** Operators may expect "execution provenance" to also reshape CCB dispatch records. It does not; CCB is out.
4. **A specific `provenance_kind` field name / schema.** Operators (and a future impatient pass) may expect this frame to specify the schema. It deliberately does not — that is the disproven solutioning-in-disguise.

## Open questions for `/plan` (sizing/sequencing only — NOT solution menus)

1. **Phase 1 boundary**: the ownership-model question (who writes `status.json`/advances ledger when nothing spawns, `build.ts:468`) is the riskiest and most likely unbounded. Is Phase 1 scoped as "frame the ownership model and decide if it is bounded" (a decision-gate phase) rather than "implement it"? `/plan` sequences; it does not answer the ownership question here.
2. **Phase count and order**: success criterion 5 requires ≥3 dependency-ordered phases. What is the dependency spine — ownership model → provenance carrier → `/review` contract → trust anchor → (optional) migration? `/plan` proposes; each phase gets its own `/frame`.
3. **Milestone gate**: should the milestone commit to phases 2+ only after Phase 1's frame proves bounded (Risk 5 mitigation)? i.e. is this a "frame Phase 1, then re-evaluate" milestone rather than a fully-pre-planned roadmap?
4. **Independent-review gate placement**: per this session's iron rule, where do the grounded independent reviews sit — after this milestone frame (before `/plan`), and after each phase frame? `/plan` records the gate, does not skip it.
5. **What is explicitly deferred to per-phase frames and must NOT leak here**: the provenance field shape, the trust-anchor mechanism, the exact `review.ts` edits, the migration policy. Recorded so the next pass does not re-smuggle them (the relapse vector codex flagged).

---

## Status

Law 1 (7 sections): problem ✓ hypothesis ✓ success criteria ✓ non-goals (5) ✓ risks (5) ✓ alternatives (3 rejected incl. the non-strawman steelman) ✓ decision rationale ✓.
Law 2 (hypothesis 4 clauses): action (introduce phased first-class provenance, no solution picked) ✓ users (operators local_provider/claude inside Claude Code) ✓ outcome (complete lifecycle in-session, no fabrication, distinguishable provenance) ✓ evidence (Sources 1/2/4/6 + 3 grounded reviews) ✓.
Law 3 gate: success criteria observable/falsifiable ✓; non-goals ≥3 (5) ✓; ≥1 Given/When/Then story (3) ✓; out-of-scope non-empty and distinct (4) ✓; hypothesis present ✓.
Anti-solutioning self-check: no provenance schema named; no trust-anchor mechanism picked; no `review.ts` edit specified; open questions are sizing/sequencing. The one verified relapse vector (solutioning-in-disguise, Source 6) is explicitly guarded in Non-goal 1, Risk 2, Out-of-scope 4, Open question 5.

**Verdict: framing complete and Law-compliant. Per this session's iron rule (no stage advance without grounded independent review — applied 3x, caught a blocker 3x), this milestone frame is NOT auto-advanced to `/plan`; it requires an independent grounded review first.**
