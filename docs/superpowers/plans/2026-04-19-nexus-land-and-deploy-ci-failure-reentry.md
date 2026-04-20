Date: 2026-04-19
Spec: `docs/superpowers/specs/2026-04-19-nexus-land-and-deploy-ci-failure-reentry-design.md`
Branch: `codex/qa-advisories-fix-cycle`

# Nexus Land-and-Deploy CI Failure Re-entry Plan

## Objective

Make `/land-and-deploy` record pre-merge failures as canonical deploy results,
bind ship handoff validity to the PR head SHA, and tell the user exactly
whether to rerun `/land-and-deploy`, rerun `/ship`, or return to
`/build -> /review -> /qa -> /ship`.

## Task 1: Extend Ship Handoff And Deploy Result Contracts

### Files

- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/ship-pull-request.ts`
- Modify: `lib/nexus/commands/ship.ts`
- Modify: `test/nexus/types.test.ts`
- Modify: `test/nexus/ship.test.ts`

### Work

- extend `PullRequestRecord` so `/ship` persists the PR head SHA alongside:
  - PR number
  - PR URL
  - head/base branches
- update GitHub PR discovery to request and persist the head SHA from
  `gh pr view`
- extend `DeployResultRecord` from "successful deploy summary" to "full landing
  attempt summary"
- add additive deploy-result fields for:
  - `phase`
  - `failure_kind`
  - `ci_status`
  - `ship_handoff_head_sha`
  - `pull_request_head_sha`
  - `ship_handoff_current`
  - `next_action`
- keep the existing success-path fields so current closeout/follow-on summary
  consumers do not lose information

### Verification

- `bun test test/nexus/types.test.ts`
- `bun test test/nexus/ship.test.ts`

## Task 2: Tighten `/land-and-deploy` Pre-Merge Failure Semantics

### Files

- Modify: `land-and-deploy/SKILL.md.tmpl`
- Regenerate: `land-and-deploy/SKILL.md`
- Modify: `test/skill-e2e-deploy.test.ts`
- Modify: `test/gen-skill-docs.test.ts`

### Work

- require `/land-and-deploy` to read:
  - `.planning/current/ship/pull-request.json`
  - `.planning/current/ship/deploy-readiness.json`
  - optional `.planning/current/ship/canary-status.json`
- add explicit pre-merge failure classes to the workflow:
  - `pre_merge_ci_failed`
  - `pre_merge_conflict`
  - `merge_queue_failed`
- preserve `post_merge_deploy_failed` as a separate post-merge class
- require `.planning/current/ship/deploy-result.json` to be written for:
  - success
  - pre-merge stop
  - post-merge failure
- add the SHA freshness rule:
  - if PR head SHA differs from ship handoff SHA, stop and record
    `next_action = "rerun_ship"`
- encode the re-entry rules in the skill contract:
  - code/config/branch changes required -> `rerun_build_review_qa_ship`
  - ship handoff stale but no code judgment yet -> `rerun_ship`
  - operational-only retry -> `rerun_land_and_deploy`
  - merged but deploy/canary broken -> `investigate_deploy` or `revert`

### Verification

- `bun run gen:skill-docs`
- `bun test test/skill-e2e-deploy.test.ts`
- `bun test test/gen-skill-docs.test.ts`

## Task 3: Surface Re-entry Guidance In Follow-On Evidence

### Files

- Modify: `lib/nexus/closeout-follow-on-refresh.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/run-bootstrap.ts`
- Modify: `test/nexus/follow-on-summary-refresh.test.ts`
- Modify: `test/nexus/closeout.test.ts`

### Work

- make follow-on summary refresh preserve the new deploy-result failure fields
  so later runs can see whether the last landing attempt:
  - never merged
  - merged but failed verification
  - requires governed re-entry
- update closeout/bootstrap summaries so they can reference the new
  `next_action` and `ship_handoff_current` fields without inventing lifecycle
  state
- keep `/closeout` post-lifecycle behavior unchanged; this slice is summary
  enrichment only

### Verification

- `bun test test/nexus/follow-on-summary-refresh.test.ts`
- `bun test test/nexus/closeout.test.ts`

## Task 4: Sync Product Surface And Runbook Copy

### Files

- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`

### Work

- document the tightened `/land-and-deploy` semantics:
  - CI fail before merge does not merge
  - code-changing fixes require rerunning the governed chain
  - stale ship handoff requires rerunning `/ship`
  - post-merge failures stay in land/deploy territory
- keep the lifecycle split explicit:
  - `/ship` records readiness
  - `/closeout` ends the governed run
  - `/land-and-deploy` consumes ship evidence and records landing results

### Verification

- `bun test test/nexus/product-surface.test.ts`

## Final Verification

- `bun run gen:skill-docs`
- `bun test test/nexus/types.test.ts`
- `bun test test/nexus/ship.test.ts`
- `bun test test/nexus/follow-on-summary-refresh.test.ts`
- `bun test test/nexus/closeout.test.ts`
- `bun test test/skill-e2e-deploy.test.ts`
- `bun test test/gen-skill-docs.test.ts`
- `bun test test/nexus/product-surface.test.ts`
- `bun test test/nexus/*.test.ts`
- `git diff --check`

## Commit Shape

Preferred single commit if the work stays coherent:

- `feat: tighten land-and-deploy CI failure re-entry`
