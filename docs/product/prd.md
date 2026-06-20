# PRD — lifecycle decomposition step (RFC phase 1)

> Run: `run-2026-06-18T14-50-00-320Z` · Stage: frame · Lane: bounded · Parent: `docs/architecture/lifecycle-multimodality-rfc.md` (Adoption decision, item #1).

## 1. Problem statement

Operators running the Nexus lifecycle on non-trivial work hit a specific failure: `/discover` can emit a brief that **conflates several independent problems of different sizes**, and nothing in `discover → frame` forces the question *"is this one problem or several?"* `/frame` then scopes the fused brief as a single problem, the conflation surfaces only under review, and the frame has to be torn down and re-routed per sub-problem. In the evidence-base work unit, **one brief fused three problems (A/B/C) and it took six review passes to separate them** — the single most expensive avoidable cost in that unit.

## 2. Hypothesis

**If we** add a required, explicit decomposition record to the `discover → frame` boundary (one problem or several, and how big is each), **then** operators framing a multi-problem brief **will** split it into independently-routed sub-problems *at intake* instead of after N failed reviews, **because** the evidence shows the failure mode is the decomposition question never being *asked*, not operators being unable to answer it (idea-brief Sources 1–6; RFC Hole 2).

## 3. Success criteria (observable, falsifiable)

- A frame run on a single-problem brief records `decomposition.problems` with exactly one entry and proceeds — verifiable by a frame-stage test asserting the field is present and `length === 1`.
- A frame run on a multi-problem brief returns `not_ready` and enumerates each sub-problem — verifiable by a test feeding a 2-problem brief and asserting `decision === 'not_ready'` plus the listed sub-problems.
- The decomposition field is **required and explicit** (no silent single-problem default) — verifiable by a test that a brief with an absent/empty decomposition record does not reach `ready`.
- Verification command: `bun run scripts/test/unit.ts` exits 0 with 0 fail markers; `bun run typecheck:check` shows baseline 0, 0 new.

## 4. Non-goals (≥3)

- The **lane taxonomy** itself (RFC item #2) — `size_hint` is free-text here; the typed `lane` binding lands with #2.
- **Backward transitions** (#3), the **spike lane** (#4), and **Hole 5 / operator-is-worker** (owned by Problem A).
- **Auto-decomposition** — the step forces the operator to answer "one or several?"; it does not split problems for them.
- Changing `/discover`'s content contract beyond carrying the decomposition record.

## 5. Risks (≥3, with mitigations)

- **`lane` dependency on RFC #2 (lanes not built yet).** Mitigation: v1 uses free-text `size_hint`; decomposition ships independently first.
- **Operators rubber-stamp a single-problem default.** Mitigation: the field is required and explicit; a wrong "one problem" is a routing defect, auditable like a wrong lane under the adopted classifier doctrine.
- **Schema churn on the frame contract.** Mitigation: additive field on the existing artifact, covered by the typecheck ratchet + frame-stage tests. Accepted; revisit if downstream consumers break.

## 6. Alternatives considered

- **A new canonical `decompose` stage** between discover and frame — rejected: the RFC's own non-goal is "do not add stages"; a check/field on the existing boundary is lighter and matches "stage subsets, not new machinery."
- **LLM auto-decomposition** — rejected for v1: the failure mode is the operator not being *asked*, not being unable to split; forcing the explicit question is the cheap fix, automation is speculative.

## 7. Decision rationale

Decomposition is RFC item #1 because it is the one hole that, applied at idea-brief Source 1, would have prevented most of the evidence-base work unit's rework, **and** it is independently shippable (no dependency on lanes or backward transitions). Shipping it first delivers the RFC's highest-leverage value at the lowest risk, and dogfoods the bounded-lane doctrine by being built as a bounded item. When this ships, a fused multi-problem brief can no longer silently become a fused frame.

## User story (acceptance criteria)

> **Given** a discover brief that names two independent problems, **when** the operator runs `/frame`, **then** the frame returns `not_ready`, lists both sub-problems, and does not emit a single fused `design-intent.json`.

## Out-of-scope

Adjacent things operators may expect but this work does not address: it does not retro-actively decompose already-framed runs; it does not change how `/plan` consumes a single-problem frame; it does not introduce per-sub-problem worktrees or routing automation (each sub-problem is framed through the normal path).
