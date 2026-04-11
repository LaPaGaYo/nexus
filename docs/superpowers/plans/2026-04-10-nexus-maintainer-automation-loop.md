# Nexus Maintainer Automation Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Nexus-owned maintainer loop that turns upstream freshness, refresh candidates, release readiness, and published-release verification into one repo-visible report with one recommended next action.

**Architecture:** Add a maintainer-only contract under `lib/nexus/maintainer-loop.ts` that reads existing Nexus-owned maintenance inputs instead of inventing new truth layers. Keep the runtime split strict: `upstream-notes/upstream-lock.json`, `release.json`, `VERSION`, release notes, git/tag state, and optional remote release metadata remain the inputs; the new maintainer report and CLI are derived outputs only. Scheduled automation, if added, must invoke the same Nexus CLI and must not bypass or replace the repo-visible report.

**Tech Stack:** Bun, TypeScript, existing Nexus release/upstream libraries, bash entrypoints, GitHub Actions YAML

---

## File Structure

- `lib/nexus/maintainer-loop.ts`
  - New shared contract for maintainer report types, next-action resolution, JSON validation, and Markdown rendering.
- `bin/nexus-maintainer-check`
  - New thin maintainer CLI that gathers local git/release/upstream state, optionally consults remote release metadata, writes the report, and exits non-zero when the loop is blocked or action-required.
- `package.json`
  - Add a single maintainer script entrypoint, routing through the Nexus CLI only.
- `test/nexus/maintainer-loop.test.ts`
  - Freeze the report schema and pure next-action resolution rules.
- `test/nexus/maintainer-check-cli.test.ts`
  - Exercise CLI writeback, strict exit behavior, and refusal paths.
- `docs/superpowers/runbooks/upstream-refresh.md`
  - Update maintainer flow to point at the unified report instead of making maintainers synthesize multiple files manually.
- `docs/superpowers/runbooks/nexus-release-publish.md`
  - Fold the unified maintainer loop into the release publish instructions.
- `.github/workflows/maintainer-loop.yml`
  - Optional schedule-friendly notification workflow that runs the Nexus CLI without creating a second truth layer.

## Scope Locks

- Keep `stable` as the only active public release channel.
- Do not activate `candidate` or `nightly`.
- Do not remove compatibility bridges in this milestone; only surface them as existing deferred work when relevant.
- Do not auto-refresh upstreams, auto-absorb changes, auto-tag releases, or auto-publish GitHub Releases.
- Do not let GitHub Actions artifacts, console output, or chat state become maintainer truth.

### Task 1: Freeze Maintainer Report Contract

**Files:**
- Create: `lib/nexus/maintainer-loop.ts`
- Test: `test/nexus/maintainer-loop.test.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  buildMaintainerLoopReport,
  renderMaintainerLoopMarkdown,
  validateMaintainerLoopReport,
  type MaintainerLoopReport,
} from '../../lib/nexus/maintainer-loop';

describe('nexus maintainer loop contract', () => {
  test('freezes the maintainer report shape', () => {
    const report: MaintainerLoopReport = {
      schema_version: 1,
      generated_at: '2026-04-10T12:00:00.000Z',
      status: 'action_required',
      next_action: 'review_refresh_candidate',
      summary: '1 upstream refresh candidate needs maintainer review.',
      issues: ['pm-skills refresh candidate pending review'],
      recommendations: ['Review upstream-notes/refresh-candidates/pm-skills.md'],
      upstreams: {
        pending_refresh_candidates: ['pm-skills'],
        behind_upstreams: ['gsd'],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'ready',
      },
    };

    expect(validateMaintainerLoopReport(report)).toEqual(report);
  });

  test('prefers refresh-candidate review before refreshing behind upstreams', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: ['pm-skills'],
        behind_upstreams: ['gsd'],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'ready',
      },
      local_release_drift: false,
      published_release_missing: false,
    });

    expect(report.status).toBe('action_required');
    expect(report.next_action).toBe('review_refresh_candidate');
  });

  test('blocks when published release smoke is failing', () => {
    const report = buildMaintainerLoopReport({
      generatedAt: '2026-04-10T12:00:00.000Z',
      upstreams: {
        pending_refresh_candidates: [],
        behind_upstreams: [],
      },
      release: {
        current_version: '1.0.1',
        current_tag: 'v1.0.1',
        preflight_status: 'ready',
        remote_smoke_status: 'blocked',
      },
      local_release_drift: false,
      published_release_missing: false,
    });

    expect(report.status).toBe('blocked');
    expect(report.next_action).toBe('repair_published_release');
    expect(renderMaintainerLoopMarkdown(report)).toContain('# Nexus Maintainer Status');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/maintainer-loop.test.ts`
Expected: FAIL with module-not-found or missing export errors for `lib/nexus/maintainer-loop.ts`.

- [ ] **Step 3: Write the minimal report contract and resolution logic**

```ts
export const MAINTAINER_LOOP_STATUSES = ['ready', 'action_required', 'blocked'] as const;
export const MAINTAINER_NEXT_ACTIONS = [
  'none',
  'review_refresh_candidate',
  'refresh_upstream',
  'prepare_release',
  'publish_release',
  'repair_published_release',
] as const;

export interface MaintainerLoopReport {
  schema_version: 1;
  generated_at: string;
  status: 'ready' | 'action_required' | 'blocked';
  next_action: typeof MAINTAINER_NEXT_ACTIONS[number];
  summary: string;
  issues: string[];
  recommendations: string[];
  upstreams: {
    pending_refresh_candidates: string[];
    behind_upstreams: string[];
  };
  release: {
    current_version: string;
    current_tag: string;
    preflight_status: 'ready' | 'blocked';
    remote_smoke_status: 'ready' | 'blocked' | 'unknown';
  };
}

export function buildMaintainerLoopReport(input: {
  generatedAt: string;
  upstreams: MaintainerLoopReport['upstreams'];
  release: MaintainerLoopReport['release'];
  local_release_drift: boolean;
  published_release_missing: boolean;
}): MaintainerLoopReport {
  if (input.release.remote_smoke_status === 'blocked') {
    return {
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'blocked',
      next_action: 'repair_published_release',
      summary: 'Published release verification is blocked.',
      issues: ['Published release smoke failed.'],
      recommendations: ['Run ./bin/nexus-release-smoke and repair the published release mismatch.'],
      upstreams: input.upstreams,
      release: input.release,
    };
  }

  if (input.upstreams.pending_refresh_candidates.length > 0) {
    return {
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'action_required',
      next_action: 'review_refresh_candidate',
      summary: `${input.upstreams.pending_refresh_candidates.length} upstream refresh candidate needs maintainer review.`,
      issues: input.upstreams.pending_refresh_candidates.map(name => `${name} refresh candidate pending review`),
      recommendations: input.upstreams.pending_refresh_candidates.map(name => `Review upstream-notes/refresh-candidates/${name}.md`),
      upstreams: input.upstreams,
      release: input.release,
    };
  }

  return {
    schema_version: 1,
    generated_at: input.generatedAt,
    status: 'ready',
    next_action: 'none',
    summary: 'No maintainer action is currently required.',
    issues: [],
    recommendations: [],
    upstreams: input.upstreams,
    release: input.release,
  };
}
```

- [ ] **Step 4: Run the new contract tests**

Run: `bun test test/nexus/maintainer-loop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/maintainer-loop.ts test/nexus/maintainer-loop.test.ts
git commit -m "feat: add Nexus maintainer loop contract"
```

### Task 2: Add Nexus Maintainer Check CLI And Repo-Visible Report Writeback

**Files:**
- Create: `bin/nexus-maintainer-check`
- Modify: `package.json`
- Test: `test/nexus/maintainer-check-cli.test.ts`

- [ ] **Step 1: Write the failing CLI tests**

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-maintainer-check');

describe('nexus-maintainer-check', () => {
  test('writes maintainer-status.json and maintainer-status.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-maintainer-check-'));
    mkdirSync(join(root, 'upstream-notes'), { recursive: true });
    writeFileSync(join(root, 'VERSION'), '1.0.1\n');
    writeFileSync(join(root, 'release.json'), '{\"schema_version\":1,\"product\":\"nexus\",\"version\":\"1.0.1\",\"tag\":\"v1.0.1\",\"channel\":\"stable\",\"published_at\":\"2026-04-10T00:00:00Z\",\"release_notes_path\":\"docs/releases/2026-04-10-nexus-v1.0.1.md\",\"bundle\":{\"type\":\"tar.gz\",\"url\":\"https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.1.tar.gz\"},\"compatibility\":{\"upgrade_from_min_version\":\"1.0.0\",\"requires_setup\":true}}\n');
    writeFileSync(join(root, 'package.json'), '{\"version\":\"1.0.1\"}\n');
    mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
    writeFileSync(join(root, 'docs', 'releases', '2026-04-10-nexus-v1.0.1.md'), '# Nexus v1.0.1\n');
    writeFileSync(join(root, 'upstream-notes', 'upstream-lock.json'), JSON.stringify({
      schema_version: 1,
      updated_at: '2026-04-10T12:00:00.000Z',
      upstreams: [],
    }, null, 2));

    const result = Bun.spawnSync([SCRIPT], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        NEXUS_GIT_STATUS_LINES: '',
        NEXUS_EXISTING_TAGS: '',
        NEXUS_REMOTE_RELEASE_MODE: 'skip',
      },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(join(root, 'upstream-notes', 'maintainer-status.json'), 'utf8')).schema_version).toBe(1);
    expect(readFileSync(join(root, 'upstream-notes', 'maintainer-status.md'), 'utf8')).toContain('# Nexus Maintainer Status');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/maintainer-check-cli.test.ts`
Expected: FAIL with missing script or missing output files.

- [ ] **Step 3: Add the thin CLI and script entrypoint**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NEXUS_DIR="${NEXUS_DIR:-$SCRIPT_ROOT}"

CORE_JS="$(cat <<'EOF'
const fs = await import('fs');
const { join } = await import('path');
const maintainerLoop = await import(process.env.NEXUS_MAINTAINER_LOOP_PATH);
const upstreamMaintenance = await import(process.env.NEXUS_UPSTREAM_MAINTENANCE_PATH);
const releasePublish = await import(process.env.NEXUS_RELEASE_PUBLISH_PATH);

const root = process.env.NEXUS_DIR;
const generatedAt = new Date().toISOString();
const lock = upstreamMaintenance.parseUpstreamMaintenanceLock(fs.readFileSync(join(root, 'upstream-notes/upstream-lock.json'), 'utf8'));
const preflight = releasePublish.buildReleasePreflightReport({
  rootDir: root,
  gitStatusLines: (process.env.NEXUS_GIT_STATUS_LINES ?? '').split('\n').filter(Boolean),
  existingTags: (process.env.NEXUS_EXISTING_TAGS ?? '').split('\n').filter(Boolean),
});

const report = maintainerLoop.buildMaintainerLoopReport({
  generatedAt,
  upstreams: maintainerLoop.summarizeUpstreamMaintenance(lock),
  release: maintainerLoop.buildMaintainerReleaseState(root, preflight, 'unknown'),
  local_release_drift: false,
  published_release_missing: false,
});

fs.writeFileSync(join(root, 'upstream-notes', 'maintainer-status.json'), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(join(root, 'upstream-notes', 'maintainer-status.md'), maintainerLoop.renderMaintainerLoopMarkdown(report));
console.log(`${report.status.toUpperCase()} ${report.next_action}`);
process.exit(report.status === 'ready' ? 0 : 1);
EOF
)"
```

- [ ] **Step 4: Run the focused CLI tests**

Run: `bun test test/nexus/maintainer-check-cli.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-maintainer-check package.json test/nexus/maintainer-check-cli.test.ts
git commit -m "feat: add Nexus maintainer check CLI"
```

### Task 3: Integrate Release Drift, Publish Readiness, And Published-Release Repair Logic

**Files:**
- Modify: `lib/nexus/maintainer-loop.ts`
- Modify: `bin/nexus-maintainer-check`
- Test: `test/nexus/maintainer-loop.test.ts`
- Test: `test/nexus/maintainer-check-cli.test.ts`

- [ ] **Step 1: Extend the failing tests for ordered next-action resolution**

```ts
test('recommends refresh_upstream when no candidate is pending and an upstream is behind', () => {
  const report = buildMaintainerLoopReport({
    generatedAt: '2026-04-10T12:00:00.000Z',
    upstreams: {
      pending_refresh_candidates: [],
      behind_upstreams: ['gsd'],
    },
    release: {
      current_version: '1.0.1',
      current_tag: 'v1.0.1',
      preflight_status: 'ready',
      remote_smoke_status: 'ready',
    },
    local_release_drift: false,
    published_release_missing: false,
  });

  expect(report.status).toBe('action_required');
  expect(report.next_action).toBe('refresh_upstream');
});

test('recommends publish_release when local release is ready but the published release is missing', () => {
  const report = buildMaintainerLoopReport({
    generatedAt: '2026-04-10T12:00:00.000Z',
    upstreams: {
      pending_refresh_candidates: [],
      behind_upstreams: [],
    },
    release: {
      current_version: '1.0.2',
      current_tag: 'v1.0.2',
      preflight_status: 'ready',
      remote_smoke_status: 'unknown',
    },
    local_release_drift: true,
    published_release_missing: true,
  });

  expect(report.status).toBe('action_required');
  expect(report.next_action).toBe('publish_release');
});
```

- [ ] **Step 2: Run the tests to verify the new paths fail**

Run: `bun test test/nexus/maintainer-loop.test.ts test/nexus/maintainer-check-cli.test.ts`
Expected: FAIL because `buildMaintainerLoopReport()` still collapses these cases to `ready`.

- [ ] **Step 3: Add ordered next-action resolution and local drift inputs**

```ts
if (input.upstreams.behind_upstreams.length > 0) {
  return {
    schema_version: 1,
    generated_at: input.generatedAt,
    status: 'action_required',
    next_action: 'refresh_upstream',
    summary: `${input.upstreams.behind_upstreams.length} upstream snapshot is behind the pinned Nexus import.`,
    issues: input.upstreams.behind_upstreams.map(name => `${name} is behind the pinned imported snapshot`),
    recommendations: ['Run bun run upstream:refresh -- <name> for the reviewed upstream.'],
    upstreams: input.upstreams,
    release: input.release,
  };
}

if (input.local_release_drift && input.release.preflight_status === 'ready' && input.published_release_missing) {
  return {
    schema_version: 1,
    generated_at: input.generatedAt,
    status: 'action_required',
    next_action: 'publish_release',
    summary: 'A release-ready Nexus version is not published yet.',
    issues: ['Local release markers are ready, but the matching published release is missing.'],
    recommendations: ['Publish the Git tag and GitHub Release after re-running ./bin/nexus-release-preflight.'],
    upstreams: input.upstreams,
    release: input.release,
  };
}
```

- [ ] **Step 4: Teach the CLI to gather git diff and remote publish state**

Run:

```bash
git diff --name-only "$(jq -r '.tag' release.json)"..HEAD -- \
  lib/nexus \
  bin \
  .agents \
  scripts \
  docs/releases
```

Expected: Non-empty output means `local_release_drift = true`.

Implementation snippet:

```ts
const driftPaths = [
  'lib/nexus',
  'bin',
  '.agents',
  'scripts',
  'docs/releases',
];

const localReleaseDrift = readGitDiffNames(expectedTag, driftPaths).length > 0;
const remoteState = await resolveRemoteReleaseState({
  rootDir: root,
  releaseRepo: process.env.NEXUS_RELEASE_REPO ?? 'LaPaGaYo/nexus',
  mode: process.env.NEXUS_REMOTE_RELEASE_MODE ?? 'live',
});
```

- [ ] **Step 5: Run the expanded tests**

Run: `bun test test/nexus/maintainer-loop.test.ts test/nexus/maintainer-check-cli.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/maintainer-loop.ts bin/nexus-maintainer-check test/nexus/maintainer-loop.test.ts test/nexus/maintainer-check-cli.test.ts
git commit -m "feat: resolve Nexus maintainer next actions"
```

### Task 4: Update Maintainer Runbooks And Add A Schedule-Friendly Workflow

**Files:**
- Modify: `docs/superpowers/runbooks/upstream-refresh.md`
- Modify: `docs/superpowers/runbooks/nexus-release-publish.md`
- Create: `.github/workflows/maintainer-loop.yml`
- Test: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Write the failing doc/workflow regression**

```ts
test('documents the unified Nexus maintainer loop and keeps GitHub workflow non-authoritative', () => {
  const upstreamRunbook = readFileSync('docs/superpowers/runbooks/upstream-refresh.md', 'utf8');
  const releaseRunbook = readFileSync('docs/superpowers/runbooks/nexus-release-publish.md', 'utf8');
  const workflow = readFileSync('.github/workflows/maintainer-loop.yml', 'utf8');

  expect(upstreamRunbook).toContain('nexus-maintainer-check');
  expect(releaseRunbook).toContain('nexus-maintainer-check');
  expect(workflow).toContain('workflow_dispatch');
  expect(workflow).toContain('schedule:');
  expect(workflow).toContain('does not define repository truth');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/product-surface.test.ts`
Expected: FAIL because the maintainer loop workflow and updated runbook references do not exist yet.

- [ ] **Step 3: Update the runbooks and add the workflow**

```yaml
name: Maintainer Loop
on:
  schedule:
    - cron: '0 7 * * 1'
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run upstream:check
      - run: bun run maintainer:check
      - name: Upload maintainer report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: maintainer-status
          path: |
            upstream-notes/maintainer-status.json
            upstream-notes/maintainer-status.md
```

Runbook excerpt:

```md
Run `bun run maintainer:check` after `bun run upstream:check` and before a release publish decision.

Treat `upstream-notes/maintainer-status.json` as the machine-readable maintainer report and `upstream-notes/maintainer-status.md` as the human-readable summary. GitHub workflow logs and uploaded artifacts are notification surfaces only and do not define repository truth.
```

- [ ] **Step 4: Run the doc/workflow regression**

Run: `bun test test/nexus/product-surface.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/runbooks/upstream-refresh.md docs/superpowers/runbooks/nexus-release-publish.md .github/workflows/maintainer-loop.yml test/nexus/product-surface.test.ts
git commit -m "docs: add Nexus maintainer loop workflow"
```

### Task 5: Full Regression And Closeout

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-10-nexus-maintainer-automation-loop-closeout.md`

- [ ] **Step 1: Run the milestone regression suite**

Run:

```bash
bun test test/nexus/maintainer-loop.test.ts test/nexus/maintainer-check-cli.test.ts test/nexus/upstream-check.test.ts test/nexus/release-publish.test.ts test/nexus/release-remote.test.ts test/nexus/product-surface.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the repository contract checks**

Run:

```bash
bun run gen:skill-docs --host codex
git diff --check
```

Expected: Both commands succeed cleanly.

- [ ] **Step 3: Write the closeout artifact**

```md
# Nexus Maintainer Automation Loop Closeout

Date: 2026-04-10
Status: `completed`
Plan: `docs/superpowers/plans/2026-04-10-nexus-maintainer-automation-loop.md`

## Outcome

Nexus now has one maintainer-only report and one recommended next action for upstream freshness, refresh review, release readiness, and published release repair.

## Verification Evidence

- `bun test ...`
- `bun run gen:skill-docs --host codex`
- `git diff --check`

## Deferred Work

- multi-channel public release support beyond `stable`
- compatibility-bridge cleanup after downstream readers move off legacy fields
- any future automation that creates PRs or release drafts automatically
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-10-nexus-maintainer-automation-loop-closeout.md
git commit -m "docs: close out Nexus maintainer automation loop"
```

## Self-Review

- Spec coverage:
  - Maintainer-only unified report: covered by Tasks 1-3.
  - Repo-visible machine-readable plus Markdown outputs: covered by Task 2.
  - Upstream freshness + refresh candidate + release readiness + published release repair: covered by Tasks 1-3.
  - Schedule-friendly notification path without creating a second truth source: covered by Task 4.
  - Deferred boundaries for multi-channel and compatibility cleanup: locked in the scope section and repeated in Task 5 closeout.
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” placeholders remain in tasks.
  - Every task names exact files, tests, and commands.
- Type consistency:
  - The plan uses one report type `MaintainerLoopReport`, one CLI `nexus-maintainer-check`, one JSON artifact `upstream-notes/maintainer-status.json`, and one Markdown artifact `upstream-notes/maintainer-status.md` throughout.

Plan complete and saved to `docs/superpowers/plans/2026-04-10-nexus-maintainer-automation-loop.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
