# Decision Brief — lifecycle decomposition step (RFC phase 1)

## Nexus Execution Context

- Run ID: run-2026-06-18T14-50-00-320Z
- Command: frame
- Stage: frame
- Continuation mode: project_reset
- Execution mode: local_provider
- Primary provider: claude
- Provider topology: agent_team
- Predecessor: docs/product/idea-brief.md

## Hypothesis

If we add a required, explicit decomposition record to the `discover → frame` boundary (one problem or several, and how big is each) and gate frame on multi-problem briefs, then operators split multi-problem briefs into independently-routed sub-problems at intake instead of after N failed reviews, because the evidence (idea-brief Sources 1–6, RFC Hole 2) shows the failure mode is the question never being *asked*, not operators being unable to answer it.

## Chosen scope

A **bounded** lifecycle change: a typed `decomposition.problems[]` record on the discover→frame boundary; default single atomic problem but **explicit** (no silent default); frame returns `not_ready` on a multi-problem brief until each sub-problem is split and routed to its own framing. `lane` per sub-problem is deferred to free-text `size_hint` so this ships independently of the lane taxonomy (RFC item #2).

## Rejected alternatives

- **A new canonical `decompose` stage** — rejected: violates the RFC's own "do not add stages" non-goal. A check/field on the existing boundary is lighter and matches "stage subsets, not new machinery."
- **LLM auto-decomposition** — rejected for v1: the failure mode is the operator not being *asked*, not being unable to split. Forcing the explicit question is the cheap fix; automation is speculative.

## Decision rationale

Decomposition is RFC item #1: the one hole that, applied at idea-brief Source 1, would have prevented most of the evidence-base work unit's rework, and the only adopt-now primitive with no dependency on lanes or backward transitions. Building it first delivers the RFC's highest-leverage value at the lowest risk and dogfoods the bounded-lane doctrine.

## Open framing questions surviving to `/plan`

1. Where the check lives — discover-exit field, frame-entry gate, or both (the gate gives it teeth).
2. Whether to require a `lane` per sub-problem now (depends on RFC #2) or defer to free-text `size_hint`.
3. Gate behavior on a multi-problem brief — hard `not_ready` vs route-and-continue.

## Status

Framing complete and Law 1/2/3 compliant (7-section PRD, four-clause hypothesis, falsifiable success criteria, ≥3 non-goals, out-of-scope, ≥1 Given/When/Then story). Bounded lane: per the RFC's adopted gate doctrine, the frame-stage regression tests serve as the merged review+qa. Ready for `/plan` (or direct bounded `/build` per the lane).
