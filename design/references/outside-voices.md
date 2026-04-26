# Design Outside Voices Reference

Use this reference when a Nexus design skill asks for parallel outside voices.

## plan-design-review

Codex design voice:

- read the plan file
- classify MARKETING/LANDING PAGE vs APP UI vs HYBRID
- apply Design Hard Rules and Litmus Checks
- return hard rejections first
- include what breaks if unresolved and the specific fix

Claude subagent:

- review information hierarchy
- identify missing loading/empty/error/success states
- evaluate user journey and emotional arc
- flag generic UI language and unresolved decisions

Synthesis requires a `DESIGN OUTSIDE VOICES — LITMUS SCORECARD`.

## design-review

Codex design voice:

- review frontend source and rendered evidence
- focus on spacing, typography, color, responsive behavior, accessibility, motion, and card misuse
- reference file:line for source-backed findings

Claude subagent:

- focus on consistency patterns across files
- identify scattered color systems, inconsistent breakpoints, spotty accessibility, or one-off component styling

Use output headers with "source audit".

## design-consultation

Codex design voice:

- propose visual thesis, typography, color system, composition-first layout, differentiators, and anti-slop constraints
- be opinionated and specific

Claude subagent:

- propose a surprising alternative direction with specific fonts, colors, spacing, and first-3-second emotional reaction

Use output headers with "design direction".

## Error Handling

Codex auth failure, timeout, or empty response is non-blocking. Continue with the available model voice and tag output as `[single-model]` when only one perspective returns.
