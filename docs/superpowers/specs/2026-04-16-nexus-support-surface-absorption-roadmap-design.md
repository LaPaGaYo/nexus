# Nexus Support Surface Absorption Roadmap Design

Date: 2026-04-16
Milestone: post-v1.0.32 support-surface integration
Branch: `main`

## Goal

Define how Nexus should absorb important support workflows into the canonical
product without turning every support skill into a new lifecycle stage.

The end state should be:

- one stable canonical lifecycle
- support workflows that connect to repo-visible governed truth
- clear rules for which capabilities become stage-owned contracts versus
  stage-attached evidence versus permanent sidecars
- a priority roadmap for the highest-value remaining integrations

## Scope

- define the canonical absorption model for support workflows
- classify the current support surface by absorption type
- define where repo-visible artifacts should live for each absorbed function
- define which integrations should affect lifecycle readiness or gate decisions
- define a priority order for the next absorption work

## Non-Goals

- adding new canonical lifecycle stages for every support workflow
- implementing the integrations in this spec
- replacing the current canonical lifecycle
- collapsing all validation into a single `/test` stage
- forcing every run to execute every support workflow

## Problem Statement

Nexus now has a complete governed mainline:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

The remaining product question is not whether the mainline exists. It does.

The remaining question is how support workflows should relate to that mainline.

Today, some support workflows are already connected:

- design workflows now feed governed design contract and verification artifacts
- `/land-and-deploy` now consumes `/ship` PR handoff metadata

But several other surfaces still feel partially outside canonical truth:

- `/learn`
- `/retro`
- `/setup-deploy`
- validation-oriented flows such as `/qa-only`, `/benchmark`, `/canary`, and
  implicit repo test commands
- follow-on support flows such as `/document-release`

The risk is not that these workflows are useless. The risk is that they remain
semantically important without being clearly represented in repo-visible Nexus
artifacts.

That creates three kinds of drift:

1. useful project knowledge lives outside `.planning/`
2. support workflows may feel disconnected from stage decisions
3. the product surface looks broader than the governed truth model actually is

## Core Design Principle

Do not absorb support workflows by turning them all into new lifecycle stages.

Instead, absorb them according to the degree to which they affect governed
truth.

There are exactly three absorption modes.

## Absorption Modes

### 1. Stage-Owned

A capability becomes stage-owned when it directly affects lifecycle readiness,
stage legality, or pass/fail/ship gating.

Properties:

- must be represented in repo-visible canonical artifacts
- may affect `ready`, `blocked`, `fail`, `pass`, or `merge_ready`
- is owned by an existing canonical stage
- should not require a separate new lifecycle stage unless the existing stage
  model is truly insufficient

Examples:

- design contracts for design-bearing work
- ship-owned PR handoff
- future deploy contract inputs

### 2. Stage-Attached

A capability becomes stage-attached when it contributes evidence or structured
follow-on output for a canonical stage but does not itself determine stage
transitions.

Properties:

- should be persisted in repo-visible artifacts
- should be linked from the owning stage's artifact index or follow-on outputs
- may inform future runs, closeout, or operator judgment
- does not become a new transition owner

Examples:

- retrospective outputs tied to archived runs
- performance evidence attached to `/qa`
- release documentation sync records attached to `/closeout`

### 3. Remain Sidecar

A capability remains a sidecar when it is genuinely tool-like, specialized, or
not needed on most governed runs.

Properties:

- may still consume canonical artifacts
- may still produce useful outputs
- should not become required lifecycle state
- should stay outside readiness and gate logic unless a future spec changes that

Examples:

- `/browse`
- `/investigate`
- `/qa-only`

## Classification Of The Current Support Surface

### Already Integrated Adequately

- `/design-consultation`, `/plan-design-review`, `/design-shotgun`,
  `/design-html`, `/design-review`
  - already connected through design-impact classification, design contracts,
    and design verification
- `/land-and-deploy`
  - already connected through `/ship` PR handoff metadata

These should continue to evolve, but they are not the highest-priority
absorption gaps.

### Highest-Priority Remaining Absorption Candidates

#### `/learn`

Current state:

- useful learnings exist
- primary storage is not centered on repo-visible run truth
- learning capture is not yet a normal output of governed execution

Desired state:

- governed runs emit learning candidates into repo-visible artifacts
- `/closeout` consolidates run learnings into canonical run outputs
- global learn stores may continue to exist, but repo-visible run learnings
  become the primary governed truth

Absorption mode:

- **Stage-Owned at `/closeout`**
- **Stage-Attached from `/review`, `/qa`, `/ship` as candidate inputs**

#### `/setup-deploy`

Current state:

- useful deployment bootstrap helper
- deployment configuration is not yet clearly a Nexus-owned governed contract

Desired state:

- deployment settings become a repo-visible deploy contract
- `/ship` can verify whether deploy prerequisites are known
- `/land-and-deploy` consumes the same canonical contract

Absorption mode:

- **Stage-Owned input to `/ship` and `/land-and-deploy`**

#### Validation/Test Semantics

Current state:

- testing semantics are distributed across `/build`, `/review`, `/qa`,
  `/qa-only`, `/benchmark`, `/canary`, and project-native test commands
- there is no unified verification model describing which checks belong to
  which stage

Desired state:

- a canonical verification matrix defines expected checks by lifecycle layer
- the system absorbs test intent without introducing a new `/test` stage

Absorption mode:

- **Stage-Owned verification contract across `/plan`, `/build`, `/review`,
  `/qa`, and `/ship`**

#### `/retro`

Current state:

- retrospective output exists
- it is not yet tightly wired into run archive and next-run continuity

Desired state:

- retrospectives read canonical archived run artifacts by default
- retro outputs become repo-visible historical evidence
- future `NEXT-RUN.md` and continuity seed can reference recent retro outcomes

Absorption mode:

- **Stage-Attached to `/closeout` and archived runs**

### Important But Lower-Priority Attachments

#### `/benchmark`

Desired state:

- attach performance verification outputs to `/qa`
- optionally influence `/ship` only when a plan explicitly requires performance
  validation

Absorption mode:

- **Stage-Attached to `/qa`**

#### `/canary`

Desired state:

- persist post-deploy verification evidence tied to `/land-and-deploy` or ship
  archives

Absorption mode:

- **Stage-Attached to post-ship deployment workflows**

#### `/document-release`

Desired state:

- persist documentation sync status as a follow-on closeout or ship attachment

Absorption mode:

- **Stage-Attached to `/closeout`**

### Sidecars That Should Remain Sidecars

- `/browse`
- `/investigate`
- `/qa-only`
- `/careful`
- `/freeze`
- `/guard`
- `/unfreeze`

These may consume canonical artifacts and assist execution, but they should not
be elevated into lifecycle-owning contracts.

## Proposed Canonical Artifact Model

This spec defines target artifact directions, not final filenames for every
future implementation. The guiding model is:

### Learnings

Candidate artifacts:

- `.planning/current/review/learning-candidates.json`
- `.planning/current/qa/learning-candidates.json`
- `.planning/current/ship/learning-candidates.json`
- `.planning/current/closeout/LEARNINGS.md`
- `.planning/archive/runs/<run-id>/learnings.json`

Rules:

- intermediate stages may propose learning candidates
- `/closeout` owns the canonical per-run learning consolidation

### Deploy Contract

Candidate artifacts:

- `.planning/deploy/deploy-contract.json`
- `.planning/current/ship/deploy-readiness.json`

Rules:

- `/setup-deploy` may author or refresh the deploy contract
- `/ship` verifies whether required deploy knowledge exists
- `/land-and-deploy` consumes the same contract rather than re-discovering
  deployment settings ad hoc

### Verification Matrix

Candidate artifact:

- `.planning/current/plan/verification-matrix.json`

Rules:

- `/plan` defines the required verification classes for this run
- `/build` consumes implementation-side checks
- `/review` consumes audit-side checks
- `/qa` consumes explicit validation checks
- `/ship` verifies that required checks completed

### Retrospective / Historical Continuity

Candidate artifacts:

- `.planning/archive/retros/<date>.md`
- `.planning/archive/retros/index.json`
- optional references from archived run closeout records or next-run bootstrap

Rules:

- retrospectives are not new lifecycle stages
- they become canonical historical analysis attached to archived governed work
- future fresh-run continuity may cite recent retro conclusions

### Attached Evidence For Specialized Validation

Candidate artifacts:

- `.planning/current/qa/perf-verification.md`
- `.planning/current/ship/canary-status.json`
- `.planning/current/closeout/documentation-sync.md`

Rules:

- only become required when the governing plan or ship checklist says they are
- otherwise remain optional structured evidence

## Gate And Transition Rules

This roadmap preserves a strict boundary:

- only Stage-Owned integrations may affect lifecycle gate decisions
- Stage-Attached integrations may inform operator judgment and future planning
  but do not create new legal transitions by themselves
- Remain-Sidecar capabilities stay outside the lifecycle state machine

Implications:

- do not add `/learn`, `/retro`, `/setup-deploy`, or `/test` as new canonical
  stages
- absorb their value through artifacts and contract ownership instead

## Priority Roadmap

### Priority 1: `/learn`

Reason:

- highest-value knowledge currently furthest from repo-visible governed truth
- strongest fit for closeout-owned canonicalization
- directly reduces repeated mistakes across runs

Target outcome:

- run learnings become part of archived governed truth

### Priority 2: `/setup-deploy`

Reason:

- deployment configuration is operationally important
- `/land-and-deploy` becomes more reliable when deploy assumptions are explicit
- `/ship` can become more honest about deploy readiness

Target outcome:

- repo-visible deploy contract consumed by both `/ship` and `/land-and-deploy`

### Priority 3: Verification Matrix

Reason:

- resolves the lingering "where does test live?" ambiguity
- absorbs test semantics without creating a redundant `/test` stage

Target outcome:

- explicit per-run verification contract across plan/build/review/qa/ship

### Priority 4: `/retro`

Reason:

- valuable for continuity and organizational learning
- lower immediate runtime pressure than `/learn` or deploy contract

Target outcome:

- retrospectives attached to archived runs and continuity inputs

### Priority 5: `/benchmark`, `/canary`, `/document-release`

Reason:

- useful specialized evidence
- best treated as attached evidence after the higher-value contracts are in
  place

Target outcome:

- specialized validation and documentation become structured follow-on artifacts

## Recommendation

Adopt this roadmap and implement the remaining support-surface integrations in
the following sequence:

1. `/learn` as closeout-owned repo-visible run learnings
2. `/setup-deploy` as a canonical deploy contract
3. verification matrix as the canonical home for test semantics
4. `/retro` as archive-attached continuity input
5. `/benchmark`, `/canary`, and `/document-release` as stage-attached evidence

This preserves one canonical lifecycle while continuing to absorb product value
from the broader support surface.
