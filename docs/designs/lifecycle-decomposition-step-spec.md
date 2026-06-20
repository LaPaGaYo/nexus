# Bounded spec — lifecycle decomposition step (RFC phase 1)

> **Lane:** bounded. Per the RFC adoption decision (`docs/architecture/lifecycle-multimodality-rfc.md` §Adoption), bounded work skips the full `discover → frame` ceremony; this tight spec is the bounded-lane equivalent of framing. Parent: RFC item #1 (the highest-leverage, lowest-risk primitive).
>
> **Why a spec, not a governed `/frame`:** `lib/nexus/commands/frame.ts` requires `docs/product/idea-brief.md` + a prior `/discover` ledger; forcing that for a bounded change is the exact mono-modal over-ceremony the RFC diagnoses. Dogfooding the adopted bounded doctrine instead.

## Problem

`/discover` can emit a brief that **conflates several problems of different sizes**, and the mono-modal lifecycle has no step that asks *"is this one problem or several?"* before `/frame` tries to scope it as one. This is not hypothetical: idea-brief Sources 1–6 show one brief fused **three independent problems (A/B/C)**, and it took **six review passes** to separate them. The cost is real rework: framing churns against a target that is actually N targets.

## Hypothesis

**If we** add a required, explicit decomposition check between `discover` and `frame`, **then** operators framing a multi-problem brief **will** split it into independently-routed sub-problems at intake instead of after N failed reviews, **because** the evidence-base work unit burned six review cycles on exactly the un-asked "one or several?" question (idea-brief Sources 1–6).

## Scope (mechanism)

A typed decomposition record on the `discover → frame` boundary:

```ts
decomposition: {
  problems: Array<{
    id: string;        // stable slug, e.g. "streaming-parity"
    summary: string;   // one line: who hurts / what changes
    size_hint?: string;// free-text until the lane taxonomy (RFC item #2) lands
  }>;
}
```

- **Default is a single atomic problem**, but the field MUST be explicit — the point is to force the question that Source 1 skipped, not to add a default-bypass.
- **Frame is gated:** a brief whose `decomposition.problems.length > 1` does NOT proceed as a single frame. Each sub-problem routes to its own framing. `frame.ts` returns `not_ready` with the enumerated sub-problems when the brief is multi-problem and not yet split.

## Acceptance criteria

- **Given** a discover brief naming one problem, **when** frame runs, **then** it records `decomposition.problems` with one entry and proceeds normally.
- **Given** a brief naming several problems, **when** frame runs, **then** it returns `not_ready` listing each sub-problem, and does not produce a single fused frame.
- **Given** a multi-problem brief that has been split, **when** each sub-problem is framed, **then** each gets its own `design-intent.json`.

## Verification

- `bun test test/nexus/commands/` (frame-stage tests, incl. the new decomposition cases) — exit 0, 0 fail markers via `bun run scripts/test/unit.ts`.
- `bun run typecheck:check` — baseline 0, no new errors (the typed `decomposition` field added to the frame contract).

## Non-goals

- The **lane taxonomy** itself (RFC item #2) — `size_hint` is free-text here; the typed `lane` binding lands with #2. This keeps decomposition independent and shippable first.
- **Backward transitions** (#3), the **spike lane** (#4), and **Hole 5 / operator-is-worker** (owned by Problem A).
- Changing `/discover`'s content contract beyond adding the decomposition record.
- Auto-classifying or auto-splitting problems — the operator decides; the step only *forces the question* and *gates the fused frame*.

## Risks

1. **`lane` dependency on RFC item #2.** Mitigation: v1 uses `size_hint` free-text; the typed lane is added when #2 lands. Decomposition ships independently.
2. **Operators rubber-stamp a single-problem default.** Mitigation: the field is required and explicit (no silent default); a wrong "one problem" is a routing defect auditable like a wrong lane (per the adopted classifier doctrine).
3. **Schema churn on the frame contract.** Mitigation: additive optional field on the existing frame artifact; covered by the typecheck ratchet + frame-stage tests.

## Alternatives considered

- **A new canonical `decompose` stage** between discover and frame — rejected: the RFC's own non-goal is "do not add stages." A check/field on the existing boundary is lighter and matches "stage subsets, not new machinery."
- **Auto-decomposition (LLM splits the brief)** — rejected for v1: the failure mode is the operator not *being asked*, not the operator being unable to split. Forcing the explicit question is the cheap fix; automation is speculative.

## Decision rationale

Decomposition is RFC item #1 because it is the one hole that, applied at idea-brief Source 1, would have prevented most of the evidence-base work unit's rework — and it is independently shippable (no dependency on lanes/backward-transitions). Shipping it first delivers the RFC's highest-leverage value at the lowest risk, and validates the bounded-lane doctrine by being built *as* a bounded item.
