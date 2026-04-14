# Nexus Fresh-Run Worktree Allocation Design

Date: 2026-04-13
Milestone: governed fresh-run workspace discipline
Branch: `main`

## Goal

Make each new governed Nexus run start in a fresh branch and a fresh linked
worktree, while keeping CCB provider session control rooted at the repository
root.

The result should match normal professional team practice:

- one run or phase gets one isolated execution branch
- one run or phase gets one isolated execution worktree
- fix cycles stay inside that same worktree
- closeout retires the worktree instead of silently reusing it for the next run

## Scope

- allocate a fresh linked worktree and fresh branch when a new run starts after
  a completed closeout
- persist the run-owned workspace identity in the ledger before governed
  handoff/build execution
- stop inheriting workspace provenance from prior-run handoff or review
  artifacts
- keep CCB mounted-session discovery and provider control at the repository
  session root
- keep governed build/review/qa execution in the run-owned worktree
- mark worktrees as retired at closeout and define cleanup behavior
- make artifacts prove both the execution workspace and the CCB session root

## Non-Goals

- creating a new worktree for every stage inside a run
- creating a new worktree for every fix cycle
- making CCB sessions worktree-local by default
- redesigning the governed lifecycle surface
- changing the current primary provider topology
- implementing stacked-branch coordination as the default path

## Problem Statement

Nexus currently prefers an existing linked worktree when one is available.
That causes two failures:

1. a new run can silently reuse an old `feature/implement` worktree from a
   prior phase
2. fresh-run `/handoff` can inherit workspace provenance from stale
   `handoff/review` artifacts instead of allocating a run-owned workspace

That behavior is not professional execution discipline. It weakens provenance,
blurs phase boundaries, and makes it too easy for a new phase to continue on an
old branch with old local state.

At the same time, CCB session discovery is repo-root scoped because `.ccb/`
lives at the repository root, not in each worktree. Treating worktree path and
CCB session root as the same thing causes provider verification failures.

## Approaches Considered

### 1. Reuse any existing implement worktree

Pros:

- small implementation delta
- no extra git worktree management

Cons:

- phase boundaries remain weak
- old branch state leaks into new runs
- provenance stays ambiguous
- does not match normal team branch/worktree discipline

### 2. Fresh worktree per new run, repo-root CCB session root

Pros:

- clear run isolation
- stable provider session model
- fix cycles remain local to one run-owned workspace
- matches how strong engineering teams separate implementation from control

Cons:

- requires worktree allocation and retirement logic
- requires ledger and artifact schema updates for session-root provenance

### 3. Fresh worktree and fresh CCB session namespace per run

Pros:

- strongest isolation model

Cons:

- every new run must remount providers
- provider lifecycle becomes more fragile
- parallel runs become operationally expensive
- significantly more complexity than the problem requires

## Recommendation

Use approach 2.

Nexus should allocate a fresh branch and worktree for every new run after
closeout, but CCB should stay repo-root scoped. The execution workspace and the
provider session root are different resources with different lifecycles:

- execution workspace: where code changes happen
- provider session root: where governed provider sessions are discovered and
  controlled

Mixing them is what caused the recent handoff bugs.

## Core Rules

### 1. Run-to-workspace rule

Every fresh run gets exactly one execution workspace.

That workspace is created before governed handoff and stays bound to the run for
all subsequent stages:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

If review fails and a fix cycle is required, Nexus must reuse the same
workspace. It must not rotate to a new worktree mid-run.

### 2. Run-to-branch rule

Every fresh run gets exactly one execution branch created from the current
repository primary branch.

Default source branch:

- resolved repository primary branch
- default fallback: `main`

Default branch naming:

- `codex/run-<timestamp-or-slug>`

Default worktree location:

- `.nexus-worktrees/<run-id-or-slug>`

If branch creation collides, Nexus may append a suffix, but it must keep the
run-to-branch mapping explicit in the ledger.

### 3. CCB control-plane rule

CCB session discovery, mounted-provider checks, `autonew`, and provider ping
must run against the resolved repository session root, not the execution
workspace.

Default session root:

- repository root containing `.ccb/` or `.ccb_config/`

This remains true even when build/review/qa execution happens inside a linked
worktree.

### 4. Execution-plane rule

Governed provider execution must use the run-owned execution workspace as the
real command `cwd` and `PWD`.

That applies to:

- `/build` generator dispatch
- `/review` audit dispatch
- `/qa` dispatch
- any local-provider fallback path that is allowed by policy

### 5. Closeout retirement rule

When `/closeout` completes, Nexus must mark the run workspace as retired.

Retirement states:

- `active`
- `retired_pending_cleanup`
- `retained`
- `removed`

Default behavior:

- mark retired at closeout
- cleanup happens conservatively on the next fresh `/discover`
- only fresh-run worktrees under `.nexus-worktrees/` are eligible for automatic
  removal
- safe cleanup uses `git worktree remove`, not raw directory deletion
- worktrees that are dirty, still unsafe to remove, or outside the managed
  worktree root are marked `retained`

Nexus should not silently reuse a retired workspace for a new run.

## Architecture

### 1. New run bootstrap

When `/discover` starts and the prior ledger is a completed closeout:

1. archive the completed run ledger
2. archive the prior closeout artifact set
3. if the prior run workspace is retired and safely removable, remove it via
   `git worktree remove`; otherwise mark it `retained`
4. create a fresh execution branch from the resolved repository primary branch
5. create a fresh linked worktree under `.nexus-worktrees/`
6. write the new ledger with execution workspace already bound

This means fresh-run workspace allocation is part of run bootstrap, not an
incidental side effect of `/handoff`.

The archived run ledger and archived closeout status should reflect the final
retirement outcome (`removed` or `retained`), not only the immediate
closeout-time `retired_pending_cleanup` marker.

### 2. Workspace record contract

The run ledger and stage status records should carry:

```json
{
  "workspace": {
    "path": "/repo/.nexus-worktrees/run-2026-04-13-phase-2",
    "kind": "worktree",
    "branch": "codex/run-2026-04-13-phase-2",
    "source": "allocated:fresh_run",
    "run_id": "run-2026-04-13T22-14-17-306Z",
    "retirement_state": "active"
  },
  "session_root": {
    "path": "/repo",
    "kind": "repo_root",
    "source": "ccb_root"
  }
}
```

The exact schema can be normalized to existing Nexus type patterns, but the
important distinction is mandatory:

- workspace provenance
- session-root provenance

must both be explicit.

### 3. Handoff behavior

`/handoff` must no longer resolve workspace from prior-run handoff or review
artifacts.

For a fresh run, `/handoff` should trust only:

- the current run ledger execution workspace

For a fix-cycle refresh inside the same run, `/handoff` may reuse:

- current run ledger workspace
- same-run review workspace if needed for self-healing

but never a prior-run artifact.

### 4. Build/review/qa behavior

`/build`, `/review`, and `/qa` must:

- execute in the run-owned worktree
- prove that workspace in their artifacts
- continue using the repo-root CCB session root for provider-control commands

### 5. Cleanup behavior

Default cleanup policy:

- on the next fresh `/discover`, Nexus checks for retired run worktrees
- if the branch has been merged or the worktree is otherwise eligible, Nexus
  removes the retired worktree
- if it is not safe to remove, Nexus leaves it as `retained`

Nexus should not destroy an active or unmerged run workspace by default.

## Verification

Required verification cases:

1. fresh `/discover` after completed `/closeout` creates a new worktree and new
   branch under `.nexus-worktrees/`
2. the new ledger records the fresh workspace before `/handoff`
3. fresh `/handoff` does not inherit stale workspace provenance from the prior
   run
4. `/build`, `/review`, and `/qa` execute with `cwd/PWD` set to the run-owned
   worktree
5. CCB `mounted`, `ping`, and `autonew` run against the repo-root session root
6. fix-cycle `/build` after failing `/review` reuses the same workspace
7. `/closeout` marks the workspace retired
8. the next fresh `/discover` does not reuse that retired workspace

## Implementation Notes

Expected code areas:

- `lib/nexus/commands/discover.ts`
- `lib/nexus/ledger.ts`
- `lib/nexus/workspace-substrate.ts`
- `lib/nexus/adapters/ccb.ts`
- `lib/nexus/types.ts`
- `test/nexus/discover-frame.test.ts`
- `test/nexus/workspace-substrate.test.ts`
- `test/nexus/ccb-runtime-adapter.test.ts`
- `test/nexus/closeout.test.ts`

The key migration rule is simple:

- old behavior: select an existing usable worktree
- new behavior: allocate a fresh worktree for a fresh run, and only reuse the
  bound workspace within that same run
