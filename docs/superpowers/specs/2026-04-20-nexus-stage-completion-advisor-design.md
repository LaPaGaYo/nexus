Date: 2026-04-20
Milestone: post-v1.0.36 interaction polish
Branch: `main`

# Nexus Stage Completion Advisor Design

## Goal

Make Nexus stage-end interactions clearer and more useful without turning the
runtime into a chat-driven wizard.

The product outcome is:

- every meaningful stage end presents the right next action clearly
- side skills surface only when they are relevant to the current stage and
  state
- compatibility aliases and session utilities stop polluting lifecycle
  interactions
- headless and scripted execution remain intact

## Scope

- define a unified completion-advisor model for stage-end interactions
- apply the model to `/frame`, `/plan`, `/handoff`, `/build`, `/review`,
  `/qa`, `/ship`, and `/closeout`
- classify post-stage suggestions into primary next actions, recommended side
  skills, and hidden utilities
- define when AskUserQuestion should appear and when it should not
- define which support workflows should surface at which stage boundaries

## Non-Goals

- moving interaction logic into core runtime state transitions
- adding new canonical lifecycle stages
- turning compatibility aliases into first-class lifecycle steps
- surfacing every available skill after every stage
- forcing interactive prompts in non-interactive or scripted execution

## Problem Statement

Nexus now has a richer support surface:

- browser and QA helpers
- design workflows
- deploy workflows
- retros and learnings
- advisory handling and follow-on support

That is good, but the current interaction layer is still too flat.

The current problems are:

1. some stage-end prompts are useful, but they are inconsistent across stages
2. side skills can be relevant without being promoted in a disciplined way
3. compatibility aliases like `/plan-ceo-review` and `/plan-eng-review` can
   confuse users if surfaced as though they were canonical next steps
4. session utilities like `/careful` and `/freeze` do not belong in lifecycle
   completion prompts
5. if every stage shows a large skill menu, users lose the actual canonical
   path

The interaction layer needs to become conditional, stage-aware, and concise.

## Desired End State

- the canonical path remains visually obvious at every stage boundary
- side skills appear only when the current stage and current state make them
  relevant
- required user decisions are clearly distinguished from optional suggestions
- headless runs still print deterministic next commands without any prompt
- compatibility aliases remain available, but are not surfaced as lifecycle
  guidance

## Core Design Decisions

### 1. Completion interaction stays in the skill layer, not runtime

The governed runtime continues to own:

- stage legality
- status objects
- artifact creation
- errors and readiness

The interaction layer remains in generated `SKILL.md` front doors.

Reason:

- interactive guidance is host- and session-dependent
- runtime must remain scriptable and deterministic
- headless runs should not depend on AskUserQuestion

### 2. Every stage ends with the same advisor model

Each completion advisor should conceptually produce:

- `stage_outcome`
- `primary_next_actions`
- `recommended_side_skills`
- `requires_user_choice`
- `choice_reason`
- `hidden_compat_aliases`
- `hidden_utility_skills`

Not every field needs to be emitted as a file. The important point is that all
stage-end interactions should follow the same conceptual model.

### 3. There are three surfacing classes

#### A. Primary next actions

These are lifecycle-dominant actions.

Examples:

- `/plan` after `/frame`
- `/handoff` after `/plan`
- `/review` after `/build`
- `/qa` after a clean `/review`
- `/ship` after `/qa`
- `/closeout` or `/land-and-deploy` after `/ship`
- fresh `/discover` after `/closeout`

Primary next actions should always be short and obvious.

#### B. Recommended side skills

These are optional but contextually strong support workflows.

They should surface only when:

- the current stage makes them relevant
- the current state makes them timely
- they are likely to help now rather than later

#### C. Hidden utilities

These remain available but should not appear in stage completion prompts by
default.

Examples:

- `/careful`
- `/freeze`
- `/guard`
- `/unfreeze`
- `/nexus-upgrade`

These are session utilities, not lifecycle guidance.

### 4. Compatibility aliases remain hidden from completion prompts

The following remain compatibility-only entrypoints:

- `/office-hours`
- `/autoplan`
- `/plan-ceo-review`
- `/plan-eng-review`

They should not be surfaced as recommended next actions after `/discover`,
`/frame`, or any later stage.

Reason:

- they are aliases, not separate lifecycle steps
- surfacing them after canonical stages would imply fake additional process
- users should see the real path, not compatibility scaffolding

### 5. Prompts appear only when there is real decision value

There are two prompt classes:

#### A. Required-choice prompts

These appear when Nexus cannot correctly continue without an explicit decision.

Examples:

- `/review` pass with advisories and no disposition
- `/review` fail where the only correct next step is a fix cycle
- `/qa` fail where the only correct next step is a fix cycle

#### B. Recommended-choice prompts

These appear when there are multiple valid next actions, but one is clearly the
default.

Examples:

- `/ship` complete: `/closeout` now vs leave handoff for `/land-and-deploy`
- `/closeout` complete: next run vs post-closeout follow-on work

No prompt should appear when there is only one meaningful next action and no
useful branching value.

### 6. Side skill surfacing must be stage-specific

The interaction layer should not use a global menu.

Instead it should use a stage-conditioned allowlist.

## Stage-by-Stage Advisor Design

### `/frame`

Primary next action:

- `/plan`

Recommended side skills:

- `/plan-design-review` only when framing indicates meaningful UI or design
  work

Hidden:

- `/plan-ceo-review`
- `/plan-eng-review`

Reason:

- the canonical path after framing is planning
- alias review commands add noise and imply a fake extra stage

### `/plan`

Primary next action:

- `/handoff`

Recommended side skills:

- `/plan-design-review` only when design-bearing work still needs explicit plan
  critique or contract tightening

### `/handoff`

Primary next action:

- `/build`

Recommended side skills:

- none by default

Reason:

- handoff freezes execution intent
- the next meaningful step is bounded implementation

### `/build`

If completed and ready:

- Primary next action: `/review`

Recommended side skills:

- `/browse` only when the changed surface is clearly browser-facing
- `/design-review` only when the run is design-bearing and a visual check is
  already useful before formal QA

If blocked:

- Primary recovery action: `/handoff` when routing/handoff is stale or invalid
- Primary recovery action: `/investigate` when the block is substantive rather
  than routing-related

Do not surface broad side-skill menus here.

### `/review`

If `fail`:

- required-choice prompt
- Primary next action: `/build`

If `pass` with advisories and no disposition:

- required-choice prompt
- choices:
  - `fix_before_qa`
  - `continue_to_qa`
  - `defer_to_follow_on`

If `pass` cleanly:

- Primary next action: `/qa`

Recommended side skills:

- `/benchmark` for performance-sensitive work
- `/design-review` for design-bearing work
- `/cso` for security-sensitive changes
- `/codex` only when an additional explicit second opinion is valuable

`/qa-only` should not be presented as the normal next step after canonical
`/review`. It is an alternative testing mode, not a standard post-review
continuation.

### `/qa`

If `fail`:

- required-choice prompt
- Primary next action: `/build`

If `pass`:

- Primary next action: `/ship`

Recommended side skills:

- `/benchmark`
- `/design-review`
- `/browse`
- `/connect-chrome`
- `/setup-browser-cookies`

These should surface only when the current run actually benefits from expanded
interactive QA, authenticated QA, or performance validation.

### `/ship`

If ready:

- Primary next actions:
  - `/closeout`
  - `/land-and-deploy`

Recommended side skills:

- `/setup-deploy` when deploy contract is missing or incomplete
- `/document-release`
- `/cso` for high-risk releases

This is the strongest stage for surfacing post-lifecycle support workflows.

### `/closeout`

If complete:

- Primary next action:
  - fresh `/discover`

Recommended side skills:

- `/land-and-deploy` when the shipped handoff still has not been landed
- `/canary` when deployment already happened and live monitoring is timely
- `/document-release`
- `/retro`
- `/learn`

This is the main bridge into post-run support workflows.

## Skill Visibility Rules

### Surface conditionally

- `/browse`
- `/connect-chrome`
- `/setup-browser-cookies`
- `/design-consultation`
- `/design-shotgun`
- `/design-html`
- `/design-review`
- `/investigate`
- `/document-release`
- `/retro`
- `/land-and-deploy`
- `/canary`
- `/benchmark`
- `/cso`
- `/setup-deploy`
- `/learn`
- `/qa-only`
- `/codex`

Each of these should have an explicit stage and state condition before it is
surfaced.

### Keep out of completion prompts by default

- `/careful`
- `/freeze`
- `/guard`
- `/unfreeze`
- `/nexus-upgrade`

### Keep out because they are compatibility aliases

- `/office-hours`
- `/autoplan`
- `/plan-ceo-review`
- `/plan-eng-review`

## Interactive vs Non-Interactive Behavior

### Interactive sessions

- AskUserQuestion should appear only for required-choice and recommended-choice
  cases
- prompts should stay short
- prompts should prefer 2-3 options over large menus

### Non-interactive sessions

- no AskUserQuestion
- print the canonical next command
- if a required decision exists, print the exact commands that satisfy the
  decision

## Decision Table

| Stage | State | Prompt class | Primary action | Side skill policy |
|-------|-------|--------------|----------------|-------------------|
| `/frame` | complete | recommended | `/plan` | only `/plan-design-review` when design-bearing |
| `/plan` | complete | recommended | `/handoff` | only `/plan-design-review` when still relevant |
| `/handoff` | complete | none or recommended | `/build` | none by default |
| `/build` | ready | recommended | `/review` | narrow UI/debug helpers only |
| `/build` | blocked | required or recommended | `/handoff` or `/investigate` | none |
| `/review` | fail | required | `/build` | none |
| `/review` | pass + advisories | required | disposition decision | no broad menu |
| `/review` | pass clean | recommended | `/qa` | performance/design/security second-opinion options only |
| `/qa` | fail | required | `/build` | none |
| `/qa` | pass | recommended | `/ship` | QA-expansion helpers only |
| `/ship` | ready | recommended | `/closeout` or `/land-and-deploy` | deploy/docs/security support |
| `/closeout` | complete | recommended | `/discover` | deploy/retro/learn/docs/canary |

## Consequences

### Positive

- stage-end guidance becomes clearer
- users see the real lifecycle path first
- side skills become easier to discover without turning into clutter
- compatibility aliases stop distorting lifecycle understanding
- interactive and scripted modes remain compatible

### Tradeoff

- some useful skills will be less visible globally because they only surface
  when context makes them relevant
- stage templates need a more explicit per-stage visibility policy than today

## Implementation Direction

This design should be implemented by updating generated stage skill templates
first, not by changing core governed runtime semantics.

The immediate implementation targets are:

- `build/SKILL.md.tmpl`
- `review/SKILL.md.tmpl`
- `qa/SKILL.md.tmpl`
- `ship/SKILL.md.tmpl`
- `closeout/SKILL.md.tmpl`

and then, if desired, extending the same advisor pattern upward to:

- `frame/SKILL.md.tmpl`
- `plan/SKILL.md.tmpl`
- `handoff/SKILL.md.tmpl`
