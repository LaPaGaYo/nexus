Date: 2026-04-19
Milestone: post-v1.0.33 delivery polish
Branch: `codex/qa-advisories-fix-cycle`

# Nexus Land-and-Deploy CI Failure Re-entry Design

## Goal

Make `/land-and-deploy` failures repo-visible and operationally correct when a
PR cannot be merged because CI, mergeability, or merge-queue checks fail.

The key product outcome is simple:

- when `/land-and-deploy` stops before merge, Nexus should say whether the user
  can simply retry `/land-and-deploy` or must return to `/build -> /review ->
  /qa -> /ship`
- this decision should be recorded in repo-visible artifacts, not only in chat

## Scope

- define a canonical failure model for `/land-and-deploy`
- extend `deploy-result.json` semantics so failed and pre-merge outcomes are
  still recorded
- distinguish pre-merge CI failure, merge conflict, merge-queue failure, and
  post-merge deploy failure
- define when ship handoff becomes stale and requires rerunning `/ship`
- define when code changes invalidate the existing ship handoff and require
  rerunning `/build -> /review -> /qa -> /ship`

## Non-Goals

- turning `/land-and-deploy` into a canonical lifecycle stage
- auto-editing `.planning/nexus/current-run.json` from `/land-and-deploy`
- auto-running `/build`, `/review`, `/qa`, or `/ship` from `/land-and-deploy`
- redesigning deploy verification or canary monitoring from scratch
- introducing a new PR management state machine outside the existing ship
  handoff artifacts

## Problem Statement

Today `/land-and-deploy` already stops on merge blockers:

- required CI checks failing
- merge conflicts
- merge-queue rejections
- post-merge deploy failures

That is the right instinct, but the stop condition is underspecified.

The current workflow tells the user what happened, but it does not clearly
record:

1. whether the PR was merged or not
2. whether the ship handoff is still valid
3. whether the user should simply rerun `/land-and-deploy`
4. whether the user must return to the governed implementation chain

This creates a real gap:

- a pre-merge CI failure often means the code or CI config must change
- once code or PR contents change, the old `/ship` handoff is no longer the
  correct authority
- without a canonical re-entry rule, users are tempted to keep retrying
  `/land-and-deploy` against stale ship evidence

## Desired End State

- every `/land-and-deploy` run writes `.planning/current/ship/deploy-result.json`
  even when it stops before merge
- `deploy-result.json` distinguishes pre-merge failure from post-merge failure
- the artifact records whether the ship handoff is still current
- the artifact records the recommended next action in Nexus terms
- the workflow refuses to keep landing a PR when the PR head SHA no longer
  matches the SHA recorded by `/ship`

## Core Design Decisions

### 1. `/land-and-deploy` is a consumer of ship handoff, not an authority over it

`/land-and-deploy` remains a post-lifecycle support workflow.

It consumes ship evidence:

- `.planning/current/ship/pull-request.json`
- `.planning/current/ship/deploy-readiness.json`
- optional `.planning/current/ship/canary-status.json`

It does not mutate governed lifecycle state or create synthetic review/QA
history.

If the ship handoff is stale, `/land-and-deploy` must stop and tell the user to
refresh the governed chain instead of trying to repair it itself.

### 2. Pre-merge and post-merge failures are different classes of failure

There are four relevant failure classes:

#### A. `pre_merge_ci_failed`

- PR is still open
- required checks are failing before merge
- merge has not happened

This often means code, tests, CI config, or branch contents must change.

#### B. `pre_merge_conflict`

- PR is still open
- GitHub reports merge conflicts
- merge has not happened

This means the branch contents must change before the PR can land.

#### C. `merge_queue_failed`

- PR entered auto-merge / merge queue
- PR later returns to `OPEN` without merging
- GitHub likely rejected the merge commit because of CI or queue conflict

This is still a pre-merge failure and should not be treated as a successful
land.

#### D. `post_merge_deploy_failed`

- PR already merged
- deployment or canary verification failed after merge

This is not a re-entry to the normal fix-cycle by default. It remains a
fix-forward / investigate / revert problem.

### 3. `deploy-result.json` must exist for failed pre-merge runs

The existing deploy result artifact should be extended from "success summary" to
"full landing attempt summary".

New required semantics:

- artifact is written for success and failure
- it records merge state, deploy state, verification state, and next action
- it records whether the ship handoff still matches the current PR head

Recommended shape additions:

```json
{
  "phase": "pre_merge | merge_queue | post_merge",
  "failure_kind": "pre_merge_ci_failed | pre_merge_conflict | merge_queue_failed | post_merge_deploy_failed | null",
  "ci_status": "passed | pending | failed | unknown",
  "ship_handoff_head_sha": "<sha or null>",
  "pull_request_head_sha": "<sha or null>",
  "ship_handoff_current": true,
  "next_action": "rerun_land_and_deploy | rerun_ship | rerun_build_review_qa_ship | investigate_deploy | revert"
}
```

These fields should be additive to the current deploy result contract, not a
replacement.

### 4. Ship handoff must be SHA-bound

`/ship` currently records PR handoff metadata, but `/land-and-deploy` should
also treat ship readiness as SHA-specific.

The ship handoff must be considered valid only when:

- the PR number still matches
- the PR head SHA still matches the handoff SHA

If the PR head SHA changed after `/ship`, then `/land-and-deploy` must stop with
`next_action = "rerun_ship"`.

Reason:

- `/ship` certified a specific branch state
- if the branch contents changed, that certification is stale even if no new
  code review findings are known yet

### 5. Code-changing failures require returning to the governed build chain

If `/land-and-deploy` stops because CI or mergeability failed and the remedy
requires changing code, tests, configs, or branch contents, then the current
ship handoff should be treated as invalidated by the upcoming fix.

Canonical next action:

- `next_action = "rerun_build_review_qa_ship"`

Expected user path:

1. fix on the PR branch
2. rerun `/build`
3. rerun `/review`
4. rerun `/qa`
5. rerun `/ship`
6. rerun `/land-and-deploy`

This prevents a stale ship handoff from being used as if it still certified the
current PR contents.

### 6. Non-code operational failures may retry `/land-and-deploy` directly

Not every pre-merge stop means the governed chain must restart.

Examples:

- temporary GitHub outage
- missing merge permission
- transient CI reporting issue
- deploy platform outage unrelated to repo contents

These should remain:

- `next_action = "rerun_land_and_deploy"`

The key distinction is whether the remedy changes the branch contents or the PR
certified by `/ship`.

### 7. Post-merge failures stay in land/deploy territory

If the PR is already merged, `/land-and-deploy` should not redirect the user
back into the normal pre-merge governed chain by default.

Instead:

- `next_action = "investigate_deploy"` when the right response is diagnosis or
  fix-forward
- `next_action = "revert"` when rollback is the correct action

This preserves the current split:

- pre-merge failures belong to the normal governed change path
- post-merge failures belong to production landing and rollback handling

## Decision Table

| Situation | Merge happened? | Branch contents need to change? | Next action |
|-----------|-----------------|----------------------------------|-------------|
| CI failing before merge | No | Usually yes | `rerun_build_review_qa_ship` |
| Merge conflict before merge | No | Yes | `rerun_build_review_qa_ship` |
| Merge queue rejected and PR reopened | No | Usually yes | `rerun_build_review_qa_ship` |
| Permission denied to merge | No | No | `rerun_land_and_deploy` |
| GitHub outage / transient status issue | No | No | `rerun_land_and_deploy` |
| PR head SHA changed after `/ship` | No | Already changed | `rerun_ship` |
| Deploy failed after merge | Yes | Not necessarily | `investigate_deploy` or `revert` |

## Artifact Implications

### Existing artifact

- `.planning/current/ship/deploy-result.json`

This becomes the canonical landing-attempt result, not just a happy-path deploy
summary.

### Existing follow-on summary

- `.planning/current/closeout/FOLLOW-ON-SUMMARY.md`
- `.planning/current/closeout/follow-on-summary.json`

These should continue to refresh from `deploy-result.json` regardless of whether
the land/deploy outcome is success, blocked pre-merge, or post-merge degraded.

That gives later `/discover`, `/learn`, and `/retro` runs a truthful record of
what actually happened after `/closeout`.

## UX Implications

When `/land-and-deploy` stops before merge, the user-facing message should stop
being generic.

It should explicitly say one of:

- "No merge happened. Fix the branch, then rerun `/build -> /review -> /qa -> /ship` before landing again."
- "No merge happened. The PR contents changed after `/ship`, so rerun `/ship` before landing again."
- "No merge happened. The code is unchanged, so rerun `/land-and-deploy` once the external blocker is cleared."

That is the real missing product behavior.

## Implementation Notes

This slice likely touches:

- `land-and-deploy/SKILL.md.tmpl`
- generated `land-and-deploy/SKILL.md`
- `lib/nexus/types.ts`
- `lib/nexus/follow-on-evidence.ts`
- `lib/nexus/closeout-follow-on-refresh.ts`
- tests covering land/deploy report generation and follow-on summary refresh

It should not require changing lifecycle transitions, because `/land-and-deploy`
is still post-lifecycle.

## Recommendation

Implement this slice before making `/land-and-deploy` more automatic.

Reason:

- the biggest current gap is not automation, it is incorrect re-entry guidance
- until that guidance is repo-visible, users can still end up retrying land on
  stale ship evidence
