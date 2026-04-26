# Nexus Fresh-Run Worktree Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every new Nexus run allocate a fresh branch and linked worktree, keep fix cycles inside that same workspace, and keep CCB provider session discovery rooted at the repository session root instead of the execution worktree.

**Architecture:** Extend the existing workspace substrate instead of inventing a second lifecycle. `discover` rollover becomes the only place that allocates a fresh run workspace. The ledger becomes the sole owner of execution workspace and session-root provenance. Handoff/build/review/qa/ship reuse that run-owned workspace, while CCB `mounted`/`ping`/`autonew` continue to resolve from the repo root containing `.ccb/`.

**Tech Stack:** Bun, TypeScript modules in `lib/nexus/`, git worktree commands, JSON lifecycle artifacts under `.planning/`, existing Nexus tests under `test/nexus/`

---

## File Structure

- Modify: `lib/nexus/types.ts`
  - Extend workspace provenance so a run-owned worktree can be distinguished from reused legacy worktrees.
  - Add a session-root provenance record and workspace retirement state.
- Modify: `lib/nexus/execution-topology.ts`
  - Carry session-root and fresh-run workspace metadata through ledger and stage-status helpers.
- Modify: `lib/nexus/workspace-substrate.ts`
  - Stop acting as “best existing worktree selector” for fresh runs.
  - Add helpers for:
    - resolving the repository primary branch
    - allocating a fresh branch + linked worktree for a run
    - resolving repo-root CCB session root
    - retiring and optionally cleaning up old run worktrees
- Modify: `lib/nexus/ledger.ts`
  - Start fresh-run ledgers with an allocated workspace instead of a blank execution workspace.
  - Archive/rollover logic should preserve old run ledgers while leaving room to retire old worktrees.
- Modify: `lib/nexus/commands/discover.ts`
  - On rollover after completed closeout, allocate a fresh run workspace before writing the new ledger.
- Modify: `lib/nexus/commands/handoff.ts`
  - Fresh-run handoff must trust only the current ledger workspace.
  - It must not inherit workspace provenance from prior-run handoff or review artifacts.
- Modify: `lib/nexus/commands/build.ts`
  - Build should always use the run-owned workspace already bound in the ledger.
- Modify: `lib/nexus/commands/review.ts`
  - Review retries reuse the same run-owned workspace.
- Modify: `lib/nexus/commands/qa.ts`
  - QA must prove the same workspace provenance and never rotate worktrees mid-run.
- Modify: `lib/nexus/commands/ship.ts`
  - Ship must continue to report the run-owned workspace and session-root provenance.
- Modify: `lib/nexus/commands/closeout.ts`
  - Closeout marks the run workspace retired and records cleanup state.
- Modify: `lib/nexus/adapters/ccb.ts`
  - Keep `mounted`/`ping`/`autonew` at repo-root session root.
  - Keep build/review/qa dispatch at execution workspace `cwd`/`PWD`.
- Modify: `test/nexus/workspace-substrate.test.ts`
  - Lock fresh-run allocation, same-run reuse, and retirement rules.
- Modify: `test/nexus/discover-frame.test.ts`
  - Lock `/closeout -> /discover` rollover so a new run gets a new worktree/branch.
- Modify: `test/nexus/ccb-runtime-adapter.test.ts`
  - Lock the split between repo-root session control and worktree execution.
- Modify: `test/nexus/build-routing.test.ts`
  - Lock handoff/build against stale prior-run workspace inheritance.
- Modify: `test/nexus/closeout.test.ts`
  - Lock workspace retirement and next-run cleanup behavior.

## Task 1: Freeze the workspace/session provenance contract

**Files:**
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/execution-topology.ts`
- Modify: `test/nexus/types.test.ts`

- [ ] **Step 1: Add the new provenance types and enums**

Add explicit types for:

```ts
export const WORKSPACE_RETIREMENT_STATES = [
  'active',
  'retired_pending_cleanup',
  'retained',
  'removed',
] as const;

export interface SessionRootRecord {
  path: string;
  kind: 'repo_root';
  source: 'ccb_root';
}

export interface WorkspaceRecord {
  path: string;
  kind: 'root' | 'worktree';
  branch: string | null;
  source:
    | 'repo_root'
    | 'existing:nexus_worktree'
    | 'existing:legacy_worktree'
    | 'allocated:fresh_run';
  run_id?: string;
  retirement_state?: 'active' | 'retired_pending_cleanup' | 'retained' | 'removed';
}
```

- [ ] **Step 2: Extend stage and ledger execution fields**

Update the execution records to carry session root alongside workspace:

```ts
execution: {
  mode: ExecutionMode;
  primary_provider: PrimaryProvider;
  provider_topology: ProviderTopology;
  workspace?: WorkspaceRecord;
  session_root?: SessionRootRecord;
  requested_path: string;
  actual_path: string | null;
}
```

And extend `StageStatus` so the provenance written into stage artifacts can prove both:

```ts
workspace?: WorkspaceRecord;
session_root?: SessionRootRecord;
```

- [ ] **Step 3: Update execution helper functions**

Adjust `executionFieldsFromLedger()` and add a `withExecutionSessionRoot()` helper:

```ts
export function withExecutionSessionRoot(ledger: RunLedger, sessionRoot: SessionRootRecord): RunLedger {
  return {
    ...ledger,
    execution: {
      ...ledger.execution,
      session_root: sessionRoot,
    },
  };
}
```

- [ ] **Step 4: Lock the schema with targeted tests**

Add or extend `test/nexus/types.test.ts` to verify:
- `WorkspaceRecord.source` accepts `allocated:fresh_run`
- workspace retirement states are stable
- run ledger and stage status can carry `session_root`

- [ ] **Step 5: Verify the schema task**

Run:

```bash
bun test test/nexus/types.test.ts
```

Expected:
- PASS with the new workspace/session provenance schema

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/types.ts lib/nexus/execution-topology.ts test/nexus/types.test.ts
git commit -m "feat: add run workspace and session root provenance"
```

## Task 2: Allocate a fresh worktree and branch for every new run

**Files:**
- Modify: `lib/nexus/workspace-substrate.ts`
- Modify: `lib/nexus/ledger.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `test/nexus/workspace-substrate.test.ts`
- Modify: `test/nexus/discover-frame.test.ts`

- [ ] **Step 1: Write failing tests for fresh-run allocation**

Add tests that prove:

```ts
test('allocates a fresh run workspace under .nexus-worktrees for a new run', async () => {
  // close out one run, start discover again
  // expect a new run_id, a new worktree path, and a new branch/run-* branch
});

test('does not reuse prior phase feature/implement worktree for a fresh run', async () => {
  // seed a legacy .worktrees/implement path
  // expect the new run to allocate .nexus-worktrees/<run-slug> instead
});
```

- [ ] **Step 2: Add fresh-run allocation helpers**

Extend `workspace-substrate.ts` with helpers like:

```ts
export function resolveRepositoryPrimaryBranch(repoRoot: string): string {
  return gitStdout(repoRoot, ['symbolic-ref', 'refs/remotes/origin/HEAD'])
    ?.trim()
    ?.replace(/^refs\/remotes\/origin\//, '')
    || 'main';
}

export function allocateFreshRunWorkspace(repoRoot: string, runId: string): WorkspaceRecord {
  // create branch/run-<slug> from primary branch
  // git worktree add <repo>/.nexus-worktrees/<slug> -b <branch> <primary>
  // return WorkspaceRecord with source=allocated:fresh_run, run_id, retirement_state=active
}
```

- [ ] **Step 3: Bind the new workspace at run start**

Update `startLedger()` and fresh-run `/discover` rollover so the new ledger is created with:

```ts
const workspace = allocateFreshRunWorkspace(ctx.cwd, runId);
const sessionRoot = resolveSessionRootRecord(ctx.cwd);
const ledger = startLedger(runId, 'discover', ctx.execution, { workspace, sessionRoot });
```

Do not allocate a new workspace when:
- the run is continuing inside the same lifecycle
- the command is not a fresh post-closeout `/discover`

- [ ] **Step 4: Keep legacy behavior only for same-run reuse**

Refactor `resolveExecutionWorkspace()` so:
- fresh runs never “pick the best existing worktree”
- existing selection logic is used only when repairing or reloading the same run-owned workspace

- [ ] **Step 5: Verify fresh-run allocation**

Run:

```bash
bun test test/nexus/workspace-substrate.test.ts test/nexus/discover-frame.test.ts
```

Expected:
- PASS
- fresh `/discover` after `/closeout` gets a new `.nexus-worktrees/...` path
- the new run ledger already contains that workspace before `/handoff`

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/workspace-substrate.ts lib/nexus/ledger.ts lib/nexus/commands/discover.ts test/nexus/workspace-substrate.test.ts test/nexus/discover-frame.test.ts
git commit -m "feat: allocate a fresh worktree for each new run"
```

## Task 3: Bind governed stages to the run-owned workspace and repo-root session root

**Files:**
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/commands/qa.ts`
- Modify: `lib/nexus/commands/ship.ts`
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/ccb-runtime-adapter.test.ts`

- [ ] **Step 1: Write failing tests for fresh-run handoff workspace binding**

Add tests for:

```ts
test('fresh handoff ignores prior-run handoff workspace artifacts', async () => {
  // leave a stale current handoff status from a prior run
  // start a fresh run
  // expect handoff to use ledger.execution.workspace only
});

test('ccb route verification runs at repo-root session root while build dispatch runs in the worktree', async () => {
  // expect ccb-mounted/ping/autonew cwd = repo root
  // expect ask/build prompt cwd = .nexus-worktrees/<run>
});
```

- [ ] **Step 2: Remove prior-run workspace inheritance from handoff**

Change `runHandoff()` from:

```ts
resolveExecutionWorkspace(
  ctx.cwd,
  ledger.execution.workspace ?? priorHandoffStatus?.workspace ?? reviewStatus?.workspace ?? null,
)
```

to same-run-safe logic:

```ts
const workspace = resolveExecutionWorkspace(
  ctx.cwd,
  ledger.execution.workspace
    ?? (ledger.current_stage === 'review' ? reviewStatus?.workspace ?? null : null),
);
```

Fresh-run handoff must never consume `priorHandoffStatus.workspace`.

- [ ] **Step 3: Make every governed stage use ledger-owned workspace/session-root provenance**

In build/review/qa/ship:
- prefer `ledger.execution.workspace`
- use `ledger.execution.session_root`
- only fall back to same-run stage status when self-healing a blocked/retry path

Expected shape:

```ts
const workspace = ledger.execution.workspace ?? handoffStatus.workspace;
const ledgerWithWorkspace = withExecutionWorkspace(ledger, workspace);
const ledgerWithSessionRoot = withExecutionSessionRoot(ledgerWithWorkspace, ledger.execution.session_root ?? resolveSessionRootRecord(ctx.cwd));
```

- [ ] **Step 4: Keep CCB control-plane at repo root**

Update `ccb.ts` so:
- `sessionRootPath()` first consults `ctx.ledger.execution.session_root`
- `runRouteVerification()` and `runAutonew()` use `session_root.path`
- generator/audit/qa dispatch still uses `executionWorkspacePath(ctx)`

The critical invariant is:

```ts
verificationCwd === ledger.execution.session_root.path;
executionCwd === ledger.execution.workspace.path;
```

- [ ] **Step 5: Verify stage binding and CCB separation**

Run:

```bash
bun test test/nexus/build-routing.test.ts test/nexus/ccb-runtime-adapter.test.ts
```

Expected:
- PASS
- fresh-run handoff does not leak old worktree provenance
- CCB control commands run at repo root
- governed execution commands run inside the run-owned worktree

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/commands/handoff.ts lib/nexus/commands/build.ts lib/nexus/commands/review.ts lib/nexus/commands/qa.ts lib/nexus/commands/ship.ts lib/nexus/adapters/ccb.ts test/nexus/build-routing.test.ts test/nexus/ccb-runtime-adapter.test.ts
git commit -m "feat: bind governed stages to the run workspace"
```

## Task 4: Retire worktrees at closeout and clean them up on the next run

**Files:**
- Modify: `lib/nexus/workspace-substrate.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/ledger.ts`
- Modify: `test/nexus/closeout.test.ts`
- Modify: `test/nexus/discover-frame.test.ts`

- [ ] **Step 1: Write failing retirement and cleanup tests**

Add tests for:

```ts
test('closeout marks the run workspace retired_pending_cleanup', async () => {
  // complete ship/closeout and inspect current closeout status + ledger
});

test('next fresh discover does not reuse the retired workspace', async () => {
  // close out run A
  // start run B
  // expect a different workspace path and run-owned branch
});
```

- [ ] **Step 2: Mark the workspace retired at closeout**

When closeout succeeds:

```ts
const retiredWorkspace = {
  ...ledger.execution.workspace,
  retirement_state: 'retired_pending_cleanup',
};
```

Write that back into:
- ledger
- closeout status

- [ ] **Step 3: Add safe cleanup checks to fresh-run discover**

Before allocating the next run workspace:
- inspect the prior retired workspace
- if it still exists and is removable, remove it with `git worktree remove`
- if not safe to remove, preserve it and mark it `retained`

Keep the cleanup rule conservative:
- never remove the active repo root
- never remove a workspace still bound to an active run
- never delete with raw `rm -rf`

- [ ] **Step 4: Verify retirement behavior**

Run:

```bash
bun test test/nexus/closeout.test.ts test/nexus/discover-frame.test.ts
```

Expected:
- PASS
- closeout marks the workspace retired
- the next discover allocates a fresh workspace
- no retired workspace is silently reused

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/workspace-substrate.ts lib/nexus/commands/closeout.ts lib/nexus/commands/discover.ts lib/nexus/ledger.ts test/nexus/closeout.test.ts test/nexus/discover-frame.test.ts
git commit -m "feat: retire run worktrees at closeout"
```

## Task 5: Run the full Nexus regression sweep and update the operator-facing docs

**Files:**
- Modify: `docs/superpowers/specs/2026-04-13-nexus-fresh-run-worktree-allocation-design.md`
- Modify: `CHANGELOG.md`
- Modify: `test/nexus/workspace-substrate.test.ts`
- Modify: `test/nexus/discover-frame.test.ts`
- Modify: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/ccb-runtime-adapter.test.ts`
- Modify: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Update the spec if implementation details shifted**

If the final implementation chooses a slightly different helper shape or cleanup state name, update the spec so it stays the repo-visible contract owner.

- [ ] **Step 2: Add the changelog entry**

Record the user-visible behavior change:
- new run => fresh worktree + branch
- fix-cycle => same worktree
- CCB control remains repo-root scoped

- [ ] **Step 3: Run the targeted regression suite**

Run:

```bash
bun test test/nexus/types.test.ts test/nexus/workspace-substrate.test.ts test/nexus/discover-frame.test.ts test/nexus/build-routing.test.ts test/nexus/ccb-runtime-adapter.test.ts test/nexus/closeout.test.ts
```

Expected:
- PASS

- [ ] **Step 4: Run the full Nexus test suite**

Run:

```bash
bun test test/nexus/*.test.ts
```

Expected:
- PASS with no regressions across the governed lifecycle

- [ ] **Step 5: Run the whitespace and diff integrity check**

Run:

```bash
git diff --check
```

Expected:
- no output

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-04-13-nexus-fresh-run-worktree-allocation-design.md CHANGELOG.md test/nexus/types.test.ts test/nexus/workspace-substrate.test.ts test/nexus/discover-frame.test.ts test/nexus/build-routing.test.ts test/nexus/ccb-runtime-adapter.test.ts test/nexus/closeout.test.ts
git commit -m "test: lock fresh-run worktree allocation lifecycle"
```

## Self-Review

- Spec coverage:
  - fresh branch/worktree per new run: Task 2
  - same-worktree fix cycle: Task 3
  - repo-root CCB session root: Task 3
  - workspace retirement and cleanup: Task 4
  - proof in artifacts/tests: Tasks 1, 3, 5
- Placeholder scan:
  - no `TBD`/`TODO`
  - all commands and touched files are explicit
- Type consistency:
  - `WorkspaceRecord`, `SessionRootRecord`, and `retirement_state` naming is consistent across tasks
