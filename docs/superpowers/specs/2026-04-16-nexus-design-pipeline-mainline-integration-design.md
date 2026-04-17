# Nexus Design Pipeline Mainline Integration Design

Date: 2026-04-16
Milestone: design pipeline lifecycle integration
Branch: `codex/ccb-session-orchestration`

## Goal

Integrate design work into the canonical Nexus lifecycle without introducing
new lifecycle stages.

The result should be:

- design-bearing work is identified explicitly during framing
- materially visual work cannot reach governed execution without a design
  contract
- implementation and audit stages consume the same approved design intent
- visual verification becomes part of governed readiness for UI-bearing runs
- pure backend or infra work is not slowed down by unnecessary design gates

## Scope

- add explicit design classification to the canonical run contract
- define when design is advisory versus when it is a readiness gate
- introduce repo-visible design artifacts that live inside canonical stages
- make `/plan` the point where material design work becomes execution-ready
- make `/build`, `/review`, and `/qa` consume the design contract when present
- define how existing design sidecars feed the canonical lifecycle
- keep the canonical lifecycle unchanged

## Non-Goals

- adding a new canonical lifecycle stage for design
- making every run pass through design-specific skills
- forcing aesthetic review on backend, infra, or non-UI implementation work
- turning `/review` into an open-ended visual taste discussion
- replacing the existing design skills with new command surfaces
- implementing the full integration in this spec

## Problem Statement

Nexus currently treats design as a support surface rather than a first-class
governed contract.

That creates three gaps:

1. design-heavy work can move through `frame -> plan -> handoff -> build`
   without any canonical proof that design intent was actually resolved
2. design skills such as `/design-consultation`, `/plan-design-review`,
   `/design-shotgun`, `/design-html`, and `/design-review` exist, but their
   outputs are not formally absorbed by the governed lifecycle
3. visual verification is not part of the standard governed readiness model, so
   UI work can appear complete with only functional or code-review evidence

The result is a product experience that feels split:

- engineering work follows a clear lifecycle
- design work feels like an optional sidecar system

For Nexus to feel like a cohesive operating system, design-bearing work must
have explicit lifecycle semantics.

## Approaches Considered

### 1. Keep design as optional sidecars only

Pros:

- smallest implementation cost
- no new artifact contracts

Cons:

- preserves the current split-brain experience
- continues to rely on operator memory instead of governed readiness
- does not make design intent auditable from repo-visible artifacts

### 2. Make design mandatory for every run

Pros:

- simple rule
- strong consistency

Cons:

- wrong cost model for backend, infra, and narrow bugfix work
- slows down the mainline for work with no meaningful visual surface
- adds noise and ceremony where design is not part of the problem

### 3. Conditionally gate design-bearing work, recommended

Pros:

- keeps the mainline fast for non-UI work
- makes material UI work pass through explicit design readiness
- integrates existing design skills into canonical lifecycle artifacts
- lets `/review` and `/qa` reason against explicit design intent

Cons:

- requires a clear classification model
- requires new lifecycle artifacts and gate logic

## Recommendation

Use approach 3.

Nexus should keep the canonical lifecycle unchanged, but add explicit
design-bearing semantics inside that lifecycle.

The lifecycle should answer two questions early:

1. does this run materially change the user-facing visual or interaction
   surface?
2. if yes, is there an approved design contract that governed implementation is
   expected to follow?

That means:

- `/frame` classifies design impact
- `/plan` turns material design work into an explicit design contract
- `/build` executes against that contract
- `/review` checks for contract presence and obvious contract violations
- `/qa` carries visual verification for design-bearing work

## Core Rules

### 1. Design impact classification

Every run must carry a design impact classification:

- `none`
- `touchup`
- `material`

Definitions:

- `none`: no meaningful user-facing visual or interaction change
- `touchup`: small visual or UX change that should be visually verified, but
  does not need a new or revised design direction
- `material`: substantial page, flow, interaction, or design-system affecting
  work that requires explicit design intent before governed implementation

This classification is established during `/frame` and persists through the
run.

### 2. Material design readiness rule

If `design_impact = material`, `/plan` must not become `ready` unless a design
contract exists.

That contract may be backed by one or more of:

- an existing approved `DESIGN.md`
- approved output from `/design-consultation`
- approved output from `/plan-design-review`
- an approved mockup or variant selection from `/design-shotgun`
- implementation-ready HTML/design reference produced by `/design-html`

The governed lifecycle does not need to know which support skill created the
evidence. It does need a canonical, repo-visible contract that downstream
stages can consume.

### 3. Touchup verification rule

If `design_impact = touchup`, `/plan` may still become `ready` without a full
design contract, but the run must carry a visual verification requirement into
`/qa`.

This keeps minor UI work fast while still preventing visual regressions from
shipping without explicit verification.

### 4. Build contract rule

When a design contract exists, governed `/build` must treat it as part of the
bounded execution contract, not as optional reference material.

That means:

- the build request must include the design contract artifact
- the build prompt must explicitly say that visual and interaction constraints
  are part of the implementation contract
- design-bearing work is not complete just because functional behavior exists

### 5. Review contract rule

Governed `/review` must not become an open-ended design critique.

For design-bearing work, review is limited to:

- checking that the required design contract is present when the run is
  classified `material`
- identifying clear implementation divergences from the approved contract
- recording additional visual concerns as advisories unless the contract
  explicitly makes them gating

This preserves review discipline and prevents aesthetic drift from turning into
an unbounded audit.

### 6. QA visual verification rule

If `design_impact != none`, `/qa` must record visual verification.

For `touchup` runs, lightweight visual verification is sufficient.

For `material` runs, visual verification must prove that the approved design
intent was implemented and validated. This can absorb evidence from
`/design-review` or another governed visual validation path, but the canonical
truth must be written into the run's QA artifacts.

### 7. Ship readiness rule

If `design_impact != none`, `/ship` must include design verification in its
checklist state.

This does not require `/ship` to perform visual review itself. It does require
`/ship` to refuse readiness when the run's required design verification has not
been recorded.

## Lifecycle Integration

### `/discover`

No hard design gate is added here.

Discovery may surface product, workflow, or visual ambiguity, but it does not
own the final design classification.

### `/frame`

`/frame` becomes the first canonical design checkpoint.

It must determine:

- `design_impact`
- the affected user-facing surfaces, if any
- whether the run expects to follow an existing design system
- whether a new or revised design direction is required

This should be written into a canonical frame artifact, not left implicit in
prose.

### `/plan`

`/plan` becomes the primary design readiness gate for `material` runs.

It must produce a canonical design contract artifact when required and carry
forward any approved design evidence from support skills.

For `material` runs:

- no design contract means `not_ready`

For `touchup` runs:

- design contract optional
- visual verification requirement required

### `/handoff`

`/handoff` must include the design contract in governed predecessor artifacts
when present.

This ensures downstream providers receive the same bounded design intent that
`/plan` declared ready.

### `/build`

`/build` consumes the design contract as part of the execution packet.

Build prompts and contract inputs must explicitly reference:

- the design impact classification
- the design contract path, if any
- required visual verification path, if any

### `/review`

`/review` consumes the design classification and design contract.

It should not invoke design sidecars itself. Its job is to confirm contract
presence and identify obvious violations, not to replace dedicated visual QA.

### `/qa`

`/qa` becomes the canonical home for design verification evidence.

If design verification is required, `/qa` must write a structured record of:

- what was visually verified
- against which approved design source
- whether the verification passed

### `/ship`

`/ship` consumes the recorded QA design verification state and includes it in
the release checklist.

### `/closeout`

`/closeout` remains unchanged in role. It archives the run after governed
readiness is explicit. It does not become a design-specific stage.

## Canonical Artifact Additions

### 1. Framing artifact

Add a new canonical frame artifact:

- `.planning/current/frame/design-intent.json`

This should record:

- `design_impact`
- affected surfaces
- expected design-system source
- whether explicit design contract is required

### 2. Planning artifact

Add a new canonical plan artifact:

- `.planning/current/plan/design-contract.md`

This is the design contract consumed by governed execution.

It should include:

- design system source
- approved references or mockups
- affected surfaces
- required visual and interaction constraints
- required verification path

### 3. QA artifact

Add a new canonical QA artifact:

- `.planning/current/qa/design-verification.md`

It should include:

- verification scope
- verification method
- design evidence source
- result
- notable advisories or deviations

## Data Model Additions

Add explicit design fields to canonical stage status and run-facing types.

Minimum additions:

- `design_impact: none | touchup | material`
- `design_contract_required: boolean`
- `design_contract_path: string | null`
- `design_verified: boolean | null`

These should appear where they are most useful for lifecycle enforcement and
artifact traceability, not as isolated side tables.

## Support Skill Absorption

The existing design skills remain, but they no longer float outside the
governed lifecycle.

### `/design-consultation`

Primary use:

- bootstrap a design system for `material` work when `DESIGN.md` is missing or
  insufficient

Lifecycle role:

- upstream design evidence for `design-contract.md`

### `/plan-design-review`

Primary use:

- pressure-test the UX and visual plan before implementation

Lifecycle role:

- strengthens or revises the design contract during `/plan`

### `/design-shotgun`

Primary use:

- explore multiple design directions when visual intent is unresolved

Lifecycle role:

- provides approved direction that can be absorbed into `design-contract.md`

### `/design-html`

Primary use:

- generate implementation-ready design reference from an approved direction

Lifecycle role:

- optional upstream design evidence for design-bearing implementation

### `/design-review`

Primary use:

- post-implementation visual audit and polish

Lifecycle role:

- major input into `design-verification.md`

## Gate Semantics

### `design_impact = none`

- no design gate at `/plan`
- no required visual verification at `/qa`

### `design_impact = touchup`

- no blocking design contract required at `/plan`
- visual verification required at `/qa`
- `/ship` requires `design_verified = true`

### `design_impact = material`

- design contract required at `/plan`
- build/review must consume the contract
- visual verification required at `/qa`
- `/ship` requires both contract provenance and `design_verified = true`

## Backward Compatibility

This design should not break existing non-design runs.

Safe default:

- if no explicit design classification exists in legacy runs, treat them as
  `design_impact = none`

This prevents retroactive blocking while allowing the new rules to govern new
or refreshed runs.

## Rollout Plan

### Phase 1

- add design impact classification and canonical design artifacts
- wire `/frame` and `/plan` to record them
- do not gate `/ship` yet

### Phase 2

- wire `/handoff`, `/build`, and `/review` to consume design contract inputs
- enforce `material` plan readiness gate

### Phase 3

- wire `/qa` and `/ship` to require design verification for design-bearing runs

## Risks

### 1. Over-classification

If too much work is labeled `material`, the lifecycle becomes slower than it
needs to be.

Mitigation:

- keep `touchup` available for small UI work
- document clear classification criteria

### 2. Artifact duplication

If support skills and canonical lifecycle both write overlapping design truth,
repo-visible ambiguity will return.

Mitigation:

- treat `design-contract.md` and `design-verification.md` as the canonical
  lifecycle truth
- treat support skill outputs as upstream evidence, not parallel truth

### 3. Review scope creep

If `/review` becomes a broad visual critique, dual-audit latency and ambiguity
will rise.

Mitigation:

- limit review to contract presence and obvious violations
- keep broad visual polish in `/design-review` or QA verification

## Recommendation Summary

Integrate design into the canonical lifecycle through conditional gates and
explicit artifacts, not through new stages.

The critical path is:

1. classify design impact in `/frame`
2. require design contract at `/plan` for `material` work
3. make governed execution consume that contract
4. require visual verification in `/qa` for design-bearing work
5. make `/ship` consume that verification as part of readiness

That gives Nexus a smoother product feel without penalizing non-UI work.
