Date: 2026-04-20
Spec: `docs/superpowers/specs/2026-04-20-nexus-stage-completion-advisor-design.md`
Branch: `main`

# Nexus Stage Completion Advisor Plan

## Objective

Refactor the stage-end interaction layer so canonical next actions stay obvious,
side skills surface only when they are contextually relevant, and compatibility
aliases plus session utilities no longer pollute lifecycle completion prompts.

This slice should remain a skill-layer/documentation change. Core governed
runtime semantics should not change.

## Task 1: Add Advisor Coverage To Earlier Lifecycle Stages

### Files

- Modify: `frame/SKILL.md.tmpl`
- Modify: `plan/SKILL.md.tmpl`
- Modify: `handoff/SKILL.md.tmpl`
- Regenerate: `frame/SKILL.md`
- Regenerate: `plan/SKILL.md`
- Regenerate: `handoff/SKILL.md`
- Modify: `test/gen-skill-docs.test.ts`

### Work

- add completion-advisor sections to `/frame`, `/plan`, and `/handoff`
- keep the primary path explicit:
  - `/frame -> /plan`
  - `/plan -> /handoff`
  - `/handoff -> /build`
- surface `/plan-design-review` only as a conditional side skill when
  design-bearing work makes it relevant
- explicitly avoid surfacing:
  - `/plan-ceo-review`
  - `/plan-eng-review`
  - `/office-hours`
  - `/autoplan`

### Verification

- `bun run gen:skill-docs`
- `bun test test/gen-skill-docs.test.ts`

## Task 2: Tighten `/build` Through `/closeout` Completion Advisors

### Files

- Modify: `build/SKILL.md.tmpl`
- Modify: `review/SKILL.md.tmpl`
- Modify: `qa/SKILL.md.tmpl`
- Modify: `ship/SKILL.md.tmpl`
- Modify: `closeout/SKILL.md.tmpl`
- Regenerate: `build/SKILL.md`
- Regenerate: `review/SKILL.md`
- Regenerate: `qa/SKILL.md`
- Regenerate: `ship/SKILL.md`
- Regenerate: `closeout/SKILL.md`
- Modify: `test/gen-skill-docs.test.ts`

### Work

- convert existing stage-end prompts to the new completion-advisor policy:
  - primary next action first
  - conditional side skills second
  - no flat all-skills menu
- preserve required-choice prompts where they are semantically necessary:
  - `/review` advisories disposition
  - failing `/review`
  - failing `/qa`
- narrow side-skill surfacing by stage:
  - `/build`: `/browse`, `/design-review`, `/investigate` only when relevant
  - `/review`: `/benchmark`, `/design-review`, `/cso`, `/codex` only when relevant
  - `/qa`: `/benchmark`, `/design-review`, `/browse`, `/connect-chrome`,
    `/setup-browser-cookies` only when relevant
  - `/ship`: `/land-and-deploy`, `/setup-deploy`, `/document-release`, `/cso`
  - `/closeout`: `/land-and-deploy`, `/canary`, `/document-release`, `/retro`,
    `/learn`
- explicitly keep session utilities out of completion prompts:
  - `/careful`
  - `/freeze`
  - `/guard`
  - `/unfreeze`
  - `/nexus-upgrade`

### Verification

- `bun run gen:skill-docs`
- `bun test test/gen-skill-docs.test.ts`

## Task 3: Sync Public Product Surface Copy

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`

### Work

- document the interaction-layer split clearly:
  - canonical next actions
  - conditional side-skill surfacing
  - hidden compatibility aliases
  - hidden session utilities
- keep the distinction explicit between:
  - lifecycle stages
  - support workflows
  - compatibility aliases
  - utilities
- ensure README and skills docs do not imply that every stage shows every side
  skill

### Verification

- `bun test test/nexus/product-surface.test.ts`

## Task 4: Lock The Generated Skill Surface

### Files

- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-e2e-deploy.test.ts` only if generated completion copy
  requires expectation updates

### Work

- add or tighten assertions so generated skill docs keep:
  - alias commands out of stage completion prompts
  - utility skills out of stage completion prompts
  - stage-specific side-skill suggestions scoped correctly
- only update deploy E2E expectations if completion-advisor wording changes
  require it

### Verification

- `bun test test/gen-skill-docs.test.ts`
- `bun test test/skill-e2e-deploy.test.ts`

## Final Verification

- `bun run gen:skill-docs`
- `bun test test/gen-skill-docs.test.ts`
- `bun test test/nexus/product-surface.test.ts`
- `bun test test/skill-e2e-deploy.test.ts`
- `git diff --check`

## Commit Shape

Preferred single commit if the wording and generated surfaces stay coherent:

- `feat: tighten stage completion advisor prompts`
