# RFC: The Nexus lifecycle is mono-modal — add lane-tiering, not stages

| | |
|---|---|
| **Status** | PROPOSED — not decided. Per the discipline this RFC itself argues for, it needs a grounded independent review before adoption. |
| **Date** | 2026-05-18 |
| **Author** | Henry Wen (operator) + Claude Opus 4.7 (synthesis) |
| **Scope** | Process/architecture of the canonical lifecycle. NOT a `lib/nexus/` implementation spec. |
| **Evidence base** | A single ~30-turn work unit run end-to-end through the real lifecycle. Full chain: `docs/product/idea-brief.md` Sources 1-12 + `.planning/current/plan/sprint-contract.md` on `claude/jovial-jang-9618ea`; PR #160 (merged `857253c`), PR #163 (Problem B). |

## TL;DR

The canonical lifecycle `discover → frame → plan → handoff → build → review → qa → ship → closeout` is **structurally sound but mono-modal**: it applies one rigid 9-stage pipeline to every work unit regardless of size, uncertainty, or shape. Its disciplines are excellent and must be kept. Its single fixed path is the defect. The fix is not more stages or fewer stages; it is **lane-tiering** plus three missing first-class concepts (spike, decomposition, legal backward transition). This RFC is grounded in one work unit that ran the real lifecycle and hit the mono-modality wall five distinct times.

## What the lifecycle gets right (do not remove)

These were validated, not assumed, by the evidence-base work unit:

1. **Gates with teeth.** "No stage advance without grounded independent review" caught a real blocker **seven consecutive times**, including three times catching the operator's own errors on the operator's own work (notably the confirmed #160 test-env regression, Source 12, surfaced only because `/build`'s verification forced a real `bun test` + baseline compare). Evidence-before-claims is the single highest-value property and is non-negotiable.
2. **Repo-visible artifacts = cold-start safe.** The Sources 1-12 chain plus the sprint-contract are resumable by anyone reading git, with zero dependence on chat memory. This is the ADR/RFC discipline working.
3. **`/plan` Law 1 (bite-sized + observable acceptance + verification command)** produced a Problem B sprint-contract that executed B-1/B-2/B-3 one-pass, zero-rework.

Any change here must preserve all three.

## The problem: mono-modality (five evidenced holes)

The lifecycle encodes assumptions that do not hold for all work. Each time the evidence-base work unit violated one, the lifecycle treated normal work as an error.

### Hole 1 — no spike/research lane (the biggest)

The pipeline assumes every problem can flow `discover → frame`. Some problems are **research problems**: the constraint surface must be discovered empirically before the problem is framable at all. "Problem A" (honest execution-provenance for session-is-worker) was framed solution-neutrally and **failed independent review six times** for solutioning-in-disguise; the seventh attempt (codex 0.130, Source 8) established the failure was structural, not wording. Only a *spike* (Sources 9-10: probe the type model, measure what it forces) converted the problem from assertion to a measured surface, and even refuted a prior reviewer's claim. The lifecycle has no spike stage; it was bolted on ad-hoc. Professional teams keep spike / tracer-bullet / RFC as a first-class lane that sits beside `frame` for high-uncertainty work.

### Hole 2 — no decomposition step

The pipeline treats each work unit as atomic. The highest-value output of the entire work unit was **decomposition**: discovering that one `discover` brief conflated **three independent problems of different sizes** (A: milestone-scale; B, C: bounded). It took six reviews to separate them (Source 6 onward). The lifecycle has no "is this one problem or several?" step between `discover` and `frame`; `discover` happily produced a 7-source brief that fused them.

### Hole 3 — no legal backward transition

`lib/nexus/governance/transitions.ts` is strictly forward; `frame → discover` is rejected as `Illegal Nexus transition` (Source 7, hit live this session). Real work is iterative: framing gets disproven and you legitimately re-discover. The lifecycle models a normal, evidence-driven retreat as an error, which forced the operator-attested workaround pattern repeatedly.

### Hole 4 — stage granularity does not scale to work size (the core "too coarse")

The same 9 stages apply to a ~16-line streaming-parity fix (Problem B) and a multi-quarter governed-model rewrite (Problem A):
- Problem B legitimately **skipped `/frame`** (the decomposition itself said it should) and `/review`+`/qa` collapsed (the regression test *is* the QA).
- Problem A needed a **milestone with a phased roadmap**, not a single lifecycle pass; `/frame` for it failed because the work is not single-pass-frameable.
- `/handoff` is ~30s of routing-record, near-vacuous for single-provider local work; it exists for the governed-CCB multi-provider case but is mandatory for all.

One pipeline, all sizes, is exactly the coarseness the question named.

### Hole 5 — no "operator is the worker" model

The original triggering bug and Problem A share a root: the lifecycle assumes execution is always *delegated/dispatched* (spawn a provider, dispatch via CCB). It has no honest representation for "the orchestrating session did the work itself," which is the common case for bounded work. This forced fabricated-provenance artifacts (Source 1) and a fail-fast guard that then misfired on the test suite (Source 12). This is a model gap, not an implementation detail.

## Proposal: same disciplines, lane-tiered paths

Do **not** add or remove stages. Replace "one mandatory 9-stage pipeline" with "one discipline set + a lane that selects a stage subset by work shape." Four additions:

### A. Work-shape lanes

At intake, classify the work unit into a lane. The lane selects which stages are mandatory; the disciplines (gates with teeth, repo-visible artifacts, evidence-before-claims) apply to every lane unchanged.

| Lane | When | Mandatory stages | Collapsed/skipped |
|---|---|---|---|
| **trivial** | typo, comment, one-line, no behavior change | `build → ship` | discover/frame/plan/handoff/review/qa/closeout |
| **bounded** | small behavior change, single module, ≤1 day, low uncertainty (e.g. Problem B) | `decompose-check → plan → build → review+qa (merged) → ship` | frame skipped (plan reads a one-line problem record), handoff optional (only if multi-provider), closeout folded into ship |
| **feature** | multi-task, user-facing, moderate uncertainty | full `discover → frame → plan → handoff → build → review → qa → ship → closeout` | none — this is the current default path, now one lane among several |
| **milestone** | multi-phase, model/architecture change, high uncertainty (e.g. Problem A) | `discover → decompose → (spike?) → roadmap → [per-phase: frame → plan → build → review → qa] → ship → closeout` | single-pass frame/plan replaced by phased roadmap; each phase is itself a `feature`-lane sub-run |
| **spike** | problem not yet framable; constraint surface unknown (e.g. Problem A pre-Source-9) | `discover → spike → (decompose | reframe | route-to-milestone)` | no frame/plan/build — deliverable is a measured constraint surface, NOT a design; explicitly forbids solutioning |

The lane is recorded in the run artifact and is itself a reviewable decision (wrong lane = a routing event, like scope creep is today).

### B. Spike/research as a first-class lane

Deliverable contract: "here is what the system forces" (measured), never "here is the design." Spike has its own anti-solutioning Iron Law (the exact failure that sank Problem A's framing six times). A spike exits to one of: `decompose`, `reframe` (now framable), or `route-to-milestone` (confirmed unbounded).

### C. Explicit decomposition step

Between `discover` and `frame` (and as a spike exit): "is this one problem or several, and what size is each?" Output maps each sub-problem to a lane. Atomic-by-default is the current implicit assumption and it was wrong on the one work unit we tested.

### D. Legal, recorded backward transitions

`frame → discover`, `plan → frame`, etc. become legal **with a recorded justification artifact** (not silent). Forward-only is correct for ceremony integrity but models evidence-driven retreat as illegal. Re-entry with a recorded "why" is the honest primitive; it also removes the structural pressure toward the operator-attested fabrication workaround.

## Non-goals

- Not removing any discipline. Gates, artifacts, evidence-before-claims apply to every lane.
- Not adding stages. The stage set is unchanged; only path selection changes.
- Not a `lib/nexus/` implementation design. Lane mechanics, transition schema, and the spike contract are downstream `/frame` work, deliberately not pre-decided here (this RFC follows the anti-solutioning discipline it cites).
- Not changing `governed_ccb`.

## Risks and open questions

1. **Lane misclassification.** A milestone misfiled as bounded re-creates the Problem-A failure (treat-deep-as-shallow). Mitigation: lane is a reviewed decision; the spike lane is the escape hatch when classification is itself uncertain. Risk accepted, not eliminated.
2. **Lane proliferation.** Five lanes could become bureaucracy. Mitigation: lanes are stage *subsets* of the existing pipeline, not new machinery; trivial/bounded are deliberately tiny.
3. **Backward-transition abuse.** Legal re-entry could mask thrash. Mitigation: each backward transition writes a justification artifact `/review` can audit, same as scope-creep routing today.
4. **Open: who classifies the lane, and when.** At `discover` exit? A pre-discover triage? Unresolved; a `/frame` question, not pre-decided here.
5. **Open: does `spike` need its own gate/advisor, or reuse `/investigate`'s?** Unresolved.

## Adoption (incremental, not a rewrite)

1. Land the `trivial` and `bounded` lanes first (highest volume, lowest risk; Problem B would have been a clean `bounded` run).
2. Add the `decomposition` step (cheapest, highest-leverage — it is the one thing that, applied at Source 1, would have saved most of this work unit).
3. Add `spike` lane.
4. Add legal backward transitions last (touches `transitions.ts` governance semantics — itself a `bounded`-lane change, ideally dogfooded through the new bounded lane).

Each step is independently shippable and independently reviewable. No big-bang.

## Decision requested

Adopt lane-tiering + the three missing primitives (spike, decomposition, legal backtransition) as the lifecycle's modality model, keeping all current disciplines, with the incremental adoption order above? Or reject / amend. Per the discipline this RFC argues for, route this RFC itself through a grounded independent review before any adoption decision.

---

## Review disposition (independent, 2026-06-18)

| | |
|---|---|
| **Reviewer** | Claude Fable 5 — independent of the Opus 4.7 that co-synthesized this RFC |
| **Method** | Grounded against `lib/nexus/governance/transitions.ts` + the evidence-base work unit (idea-brief Sources 1–13), not prose-only |
| **Verdict** | **AMEND & PHASE** — adopt the diagnosis + the two lowest-risk primitives now; reframe one doctrine and gather more evidence before the rest. Not adopt-as-one-package; not reject. |

### Verified sound
- Diagnosis is **code-accurate**: 9 canonical stages confirmed; no lane/mode/tier concept exists anywhere in `lib/nexus` → the **mono-modal premise holds**. Disciplines-preservation instinct and incremental adoption order are right. The RFC correctly routes itself through review.

### Concerns (ranked)
1. **Evidence base is n=1 and self-referential.** All five holes come from one ~30-turn unit that was *Nexus fixing Nexus* — over-sampling spike/decomposition/backtransition needs. Counter-evidence in the same session: the type-burndown (9 PRs) and SP6 flowed through bounded/feature shapes fine. Validate lanes against ordinary work units before institutionalizing five of them.
2. **Internal tension: `trivial`/`bounded` lanes remove the gates the RFC calls non-negotiable** (`trivial = build→ship`, no review/qa). Reconcile by reframing: **evidence-before-claims applies to every lane; review/qa *intensity* scales with lane risk.** This session's burndown proves the safe form — every PR ran typecheck + the unit gate before merge with no separate `/review` stage.
3. **"Who classifies the lane, and when" is the keystone, left open.** Misclassification re-creates the Problem-A failure (RFC's own Risk 1). Cannot adopt lane-tiering without it. Recommend: lane assigned at intake, itself the first reviewable gate; spike is the escape hatch when classification is uncertain.
4. **Hole 5 ("operator is the worker") duplicates Problem A** (session-is-worker provenance), which already has its own milestone frame. Reference Problem A as the owner; don't create a second governance surface.
5. **"Strictly forward" is imprecise — and that helps addition D.** Backward edges already exist (`review → {handoff, build}`, `qa → build` fix-cycles). Legalizing `frame→discover`/`plan→frame` *extends an existing primitive to early stages*, not invents one — lower-risk than framed.
6. *(Minor)* **"No new machinery" is overstated** — spike lane, decomposition step, and backtransition justification artifacts are new contracts; the "not bureaucracy" claim depends on trivial/bounded actually being tiny.

### Recommended adoption path (amended)
1. **Now:** the **decomposition step** (discover→frame: "one problem or several, what size each?") — highest-leverage, lowest-risk, most generic evidence.
2. **Resolve concerns #3 (classifier) and #2 (gate doctrine) first, *then*** adopt `trivial`/`bounded` lanes — these answers are prerequisites, not follow-ups.
3. **Legalize early backward transitions** with a recorded justification artifact, framed as extending the existing fix-cycle precedent.
4. **Defer the `spike` lane** until 2–3 more high-uncertainty units confirm it's needed first-class.
5. **Hand Hole 5 to Problem A**; do not duplicate.

**Decision returned to the operator:** adopt diagnosis + decomposition + backward-transitions now; gate the lane taxonomy on resolving #2/#3; defer spike. This disposition satisfies the RFC's own "grounded independent review before adoption" requirement.
