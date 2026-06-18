# Idea Brief — lifecycle decomposition step (RFC phase 1)

## Nexus Execution Context

- Run ID: run-2026-06-18T14-50-00-320Z
- Command: discover
- Stage: discover
- Continuation mode: project_reset
- Execution mode: local_provider
- Primary provider: claude
- Provider topology: agent_team

## Look Inward (the problem in our own lifecycle)

`/discover` can emit a brief that **conflates several independent problems of different sizes**, and the mono-modal lifecycle has **no step that asks "is this one problem or several?"** before `/frame` tries to scope it as one. Framing then churns against a target that is actually N targets.

This is observed, not hypothetical. In `docs/architecture/lifecycle-multimodality-rfc.md` (Hole 2) and the evidence-base work unit, **one discover brief fused three independent problems (A: milestone-scale, B/C: bounded)** and it took **six review passes** to separate them (idea-brief Sources 1–6 on the `claude/jovial-jang-9618ea` branch). The highest-value output of that entire work unit was the decomposition itself — and it arrived late and expensively because nothing forced the question at intake.

## Look Outward (who hurts, how much)

- **Segment:** operators running the Nexus lifecycle on non-trivial, multi-faceted work units (the common case for anything past a one-line fix).
- **Pain + cost:** a fused brief produces a fused frame; the conflation surfaces only under review, costing N review cycles of rework (six, in the evidence case) and a frame that has to be torn down and re-routed per sub-problem.
- **Evidence sources:** RFC §"Hole 2 — no decomposition step"; idea-brief Sources 1–6; the RFC's own self-assessment that decomposition "applied at Source 1 would have saved most of this work unit."

## Hypothesis hint (for `/frame` to sharpen)

If `discover→frame` carries a **required, explicit decomposition record** ("one problem or several, and how big is each?"), operators split multi-problem briefs at intake instead of after N failed reviews, because the failure mode is the question never being *asked*, not operators being unable to answer it.

## Open questions for `/frame`

1. **Where does the check live** — a typed field on the discover-exit artifact, a gate at frame-entry, or both? (The gate is what gives it teeth.)
2. **Does the decomposition record require a `lane` per sub-problem now** — which depends on the lane taxonomy (RFC item #2, not yet built) — or defer lane to a free-text `size_hint` so decomposition ships independently first?
3. **What is the gate behavior on a multi-problem brief** — hard `not_ready` with the enumerated sub-problems, or route-and-continue (frame the first, queue the rest)?
4. **Default handling:** is a single atomic problem the default, and must the field still be explicit (forcing the question) rather than silently assumed?

## Non-goals seeded for framing

- The lane taxonomy itself (RFC item #2), backward transitions (#3), the spike lane (#4), and Hole 5 / operator-is-worker (owned by Problem A) are out of scope for this work unit.

## Transition Rule

Advance to `/frame` only after Nexus writes the discovery artifacts.
