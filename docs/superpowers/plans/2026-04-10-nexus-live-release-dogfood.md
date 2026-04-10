# Nexus Live Release Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real post-`v1.0.0` Nexus release with Nexus-owned maintainer preflight and remote smoke checks, then prove that users can discover and consume that release through the published upgrade path.

**Architecture:** Keep Nexus as the only contract owner for release publication and upgrade truth. Add maintainer-only validation helpers under `lib/nexus/` plus thin `bin/` entrypoints for local preflight and remote smoke verification, then bump the published release artifacts to `v1.0.1` only after those checks pass. Persist release evidence in repo-visible release notes and closeout artifacts instead of treating GitHub UI state or chat memory as the source of truth.

**Tech Stack:** Bun, TypeScript modules in `lib/nexus/`, Bash entrypoints in `bin/`, `gh` CLI for release metadata access, Git tags, GitHub Releases, repo-visible docs under `docs/releases/` and `docs/superpowers/`.

---

## File Structure

- Create: `lib/nexus/release-publish.ts`
  - Maintainer-only local release preflight contract.
  - Reads `VERSION`, `package.json`, `release.json`, and target release notes.
  - Validates version alignment, tag shape, release notes path shape, bundle URL shape, and local git preconditions.
- Create: `lib/nexus/release-remote.ts`
  - Maintainer-only remote release smoke contract.
  - Reads GitHub release metadata through `gh`, validates tag/release alignment, compares remote release body to the local release notes file, and verifies that tagged `release.json` can be fetched and parsed.
- Create: `bin/nexus-release-preflight`
  - Thin maintainer helper over `lib/nexus/release-publish.ts`.
  - Emits a compact machine-readable summary plus a human-readable verdict.
- Create: `bin/nexus-release-smoke`
  - Thin maintainer helper over `lib/nexus/release-remote.ts`.
  - Verifies that the published tag and GitHub Release expose the expected release contract.
- Create: `test/nexus/release-publish.test.ts`
  - Locks the local preflight contract and all refusal cases.
- Create: `test/nexus/release-remote.test.ts`
  - Locks the remote smoke contract using stubbed `gh`/HTTP fixtures rather than live network calls.
- Modify: `docs/superpowers/runbooks/nexus-release-publish.md`
  - Upgrade from a prose-only runbook to an executable maintainer workflow that names the exact preflight/smoke commands.
- Create: `docs/releases/2026-04-10-nexus-v1.0.1.md`
  - Canonical repo-visible release notes for the next real release.
- Modify: `release.json`
  - Bump to `1.0.1`, move `tag`, `published_at`, and `release_notes_path` to the new release.
- Modify: `VERSION`
  - Bump from `1.0.0` to `1.0.1`.
- Modify: `package.json`
  - Keep `version` aligned with `VERSION` and `release.json.version`.
- Create: `docs/superpowers/closeouts/2026-04-10-nexus-live-release-dogfood-closeout.md`
  - Record the local preflight, remote smoke, publish evidence, and follow-up state for the milestone.

## Task 1: Freeze The Local Release Preflight Contract

**Files:**
- Create: `test/nexus/release-publish.test.ts`
- Create: `lib/nexus/release-publish.ts`

- [ ] **Step 1: Write the failing tests for local release preflight**

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildReleasePreflightReport,
  validateReleasePreflightReport,
} from '../../lib/nexus/release-publish';

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('nexus release publish contract', () => {
  test('accepts aligned local release markers', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-release-preflight-'));

    try {
      mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
      writeFileSync(join(root, 'VERSION'), '1.0.1\n');
      writeJson(join(root, 'package.json'), { version: '1.0.1' });
      writeJson(join(root, 'release.json'), {
        schema_version: 1,
        product: 'nexus',
        version: '1.0.1',
        tag: 'v1.0.1',
        channel: 'stable',
        published_at: '2026-04-10T00:00:00Z',
        release_notes_path: 'docs/releases/2026-04-10-nexus-v1.0.1.md',
        bundle: {
          type: 'tar.gz',
          url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.1.tar.gz',
        },
        compatibility: {
          upgrade_from_min_version: '1.0.0',
          requires_setup: true,
        },
      });
      writeFileSync(join(root, 'docs', 'releases', '2026-04-10-nexus-v1.0.1.md'), '# Nexus v1.0.1\n');

      const report = buildReleasePreflightReport({
        rootDir: root,
        gitStatusLines: [],
        existingTags: ['v1.0.0'],
      });

      expect(validateReleasePreflightReport(report).status).toBe('ready');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks mismatched version markers, missing notes, or reused tags', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-release-preflight-'));

    try {
      mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
      writeFileSync(join(root, 'VERSION'), '1.0.1\n');
      writeJson(join(root, 'package.json'), { version: '1.0.0' });
      writeJson(join(root, 'release.json'), {
        schema_version: 1,
        product: 'nexus',
        version: '1.0.1',
        tag: 'v1.0.1',
        channel: 'stable',
        published_at: '2026-04-10T00:00:00Z',
        release_notes_path: 'docs/releases/2026-04-10-nexus-v1.0.1.md',
        bundle: {
          type: 'tar.gz',
          url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.1.tar.gz',
        },
        compatibility: {
          upgrade_from_min_version: '1.0.0',
          requires_setup: true,
        },
      });

      const report = buildReleasePreflightReport({
        rootDir: root,
        gitStatusLines: [' M README.md'],
        existingTags: ['v1.0.1'],
      });

      expect(report.status).toBe('blocked');
      expect(report.issues).toEqual([
        expect.stringMatching(/package\.json/i),
        expect.stringMatching(/release notes/i),
        expect.stringMatching(/dirty worktree/i),
        expect.stringMatching(/already exists/i),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run: `bun test test/nexus/release-publish.test.ts`
Expected: FAIL because `lib/nexus/release-publish.ts` does not exist yet.

- [ ] **Step 3: Implement the local preflight contract**

```ts
// lib/nexus/release-publish.ts
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { assertReleaseManifest, getReleaseTag } from './release-contract';

export interface ReleasePreflightReport {
  schema_version: 1;
  status: 'ready' | 'blocked';
  version: string;
  tag: string;
  release_notes_path: string;
  issues: string[];
}

export function validateReleasePreflightReport(report: ReleasePreflightReport): ReleasePreflightReport {
  if (report.schema_version !== 1) throw new Error('release preflight schema_version must be 1');
  if (report.status !== 'ready' && report.status !== 'blocked') throw new Error('invalid preflight status');
  if (!Array.isArray(report.issues)) throw new Error('issues must be an array');
  return report;
}

export function buildReleasePreflightReport(input: {
  rootDir?: string;
  gitStatusLines: string[];
  existingTags: string[];
}): ReleasePreflightReport {
  const rootDir = input.rootDir ?? process.cwd();
  const version = readFileSync(join(rootDir, 'VERSION'), 'utf8').trim();
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) as { version: string };
  const manifest = JSON.parse(readFileSync(join(rootDir, 'release.json'), 'utf8'));
  assertReleaseManifest(manifest);

  const issues: string[] = [];
  const expectedTag = getReleaseTag(version);

  if (pkg.version !== version) issues.push(`package.json version ${pkg.version} does not match VERSION ${version}`);
  if (manifest.version !== version) issues.push(`release.json version ${manifest.version} does not match VERSION ${version}`);
  if (manifest.tag !== expectedTag) issues.push(`release.json tag ${manifest.tag} does not match ${expectedTag}`);
  if (!existsSync(join(rootDir, manifest.release_notes_path))) issues.push(`release notes missing at ${manifest.release_notes_path}`);
  if (input.gitStatusLines.length > 0) issues.push('dirty worktree blocks release publication');
  if (input.existingTags.includes(expectedTag)) issues.push(`tag ${expectedTag} already exists`);

  return validateReleasePreflightReport({
    schema_version: 1,
    status: issues.length === 0 ? 'ready' : 'blocked',
    version,
    tag: expectedTag,
    release_notes_path: manifest.release_notes_path,
    issues,
  });
}
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `bun test test/nexus/release-publish.test.ts`
Expected: PASS with the new ready/blocked cases green.

- [ ] **Step 5: Commit**

```bash
git add test/nexus/release-publish.test.ts lib/nexus/release-publish.ts
git commit -m "feat: add Nexus release preflight contract"
```

## Task 2: Add The Maintainer Preflight CLI

**Files:**
- Create: `bin/nexus-release-preflight`
- Modify: `test/nexus/release-publish.test.ts`

- [ ] **Step 1: Add a failing CLI test for the local preflight wrapper**

```ts
test('nexus-release-preflight prints READY for aligned release artifacts', () => {
  const result = Bun.spawnSync(['bin/nexus-release-preflight'], {
    cwd: fixtureRoot,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      NEXUS_DIR: fixtureRoot,
      NEXUS_GIT_STATUS_LINES: '',
      NEXUS_EXISTING_TAGS: 'v1.0.0',
    },
  });

  expect(result.exitCode).toBe(0);
  expect(result.stdout.toString()).toContain('READY v1.0.1');
});
```

- [ ] **Step 2: Run the targeted tests and confirm the wrapper test fails**

Run: `bun test test/nexus/release-publish.test.ts`
Expected: FAIL because `bin/nexus-release-preflight` does not exist yet.

- [ ] **Step 3: Implement the thin Bash wrapper**

```bash
#!/usr/bin/env bash
set -euo pipefail

NEXUS_DIR="${NEXUS_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
_GIT_STATUS_LINES="${NEXUS_GIT_STATUS_LINES:-$(git -C "$NEXUS_DIR" status --short || true)}"
_EXISTING_TAGS="${NEXUS_EXISTING_TAGS:-$(git -C "$NEXUS_DIR" tag --list)}"

bun -e '
  const publish = await import(process.env.NEXUS_RELEASE_PUBLISH_PATH);
  const gitStatusLines = (process.env.NEXUS_GIT_STATUS_LINES ?? "").split("\n").filter(Boolean);
  const existingTags = (process.env.NEXUS_EXISTING_TAGS ?? "").split("\n").filter(Boolean);
  const report = publish.buildReleasePreflightReport({ rootDir: process.env.NEXUS_DIR, gitStatusLines, existingTags });
  if (report.status === "ready") {
    console.log(`READY ${report.version} ${report.tag}`);
    process.exit(0);
  }
  console.log(`BLOCKED ${report.version} ${report.tag}`);
  for (const issue of report.issues) console.log(`- ${issue}`);
  process.exit(1);
' \
  NEXUS_DIR="$NEXUS_DIR" \
  NEXUS_GIT_STATUS_LINES="$_GIT_STATUS_LINES" \
  NEXUS_EXISTING_TAGS="$_EXISTING_TAGS" \
  NEXUS_RELEASE_PUBLISH_PATH="$NEXUS_DIR/lib/nexus/release-publish.ts"
```

- [ ] **Step 4: Re-run the CLI-focused tests**

Run: `bun test test/nexus/release-publish.test.ts`
Expected: PASS with both library and wrapper coverage green.

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-release-preflight test/nexus/release-publish.test.ts
git commit -m "feat: add Nexus release preflight command"
```

## Task 3: Freeze And Implement Remote Release Smoke Validation

**Files:**
- Create: `test/nexus/release-remote.test.ts`
- Create: `lib/nexus/release-remote.ts`
- Create: `bin/nexus-release-smoke`

- [ ] **Step 1: Write the failing tests for remote release smoke validation**

```ts
import { describe, expect, test } from 'bun:test';
import {
  buildRemoteReleaseSmokeReport,
  validateRemoteReleaseSmokeReport,
} from '../../lib/nexus/release-remote';

describe('nexus remote release smoke', () => {
  test('accepts a published release whose gh metadata and tagged release.json agree', async () => {
    const report = await buildRemoteReleaseSmokeReport({
      expectedTag: 'v1.0.1',
      expectedVersion: '1.0.1',
      expectedNotesBody: '# Nexus v1.0.1\n',
      ghReleaseJson: JSON.stringify({
        tagName: 'v1.0.1',
        name: 'Nexus v1.0.1',
        body: '# Nexus v1.0.1\n',
        publishedAt: '2026-04-10T00:00:00Z',
        url: 'https://github.com/LaPaGaYo/nexus/releases/tag/v1.0.1',
      }),
      releaseManifestText: JSON.stringify({
        schema_version: 1,
        product: 'nexus',
        version: '1.0.1',
        tag: 'v1.0.1',
        channel: 'stable',
        published_at: '2026-04-10T00:00:00Z',
        release_notes_path: 'docs/releases/2026-04-10-nexus-v1.0.1.md',
        bundle: { type: 'tar.gz', url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.1.tar.gz' },
        compatibility: { upgrade_from_min_version: '1.0.0', requires_setup: true },
      }),
    });

    expect(validateRemoteReleaseSmokeReport(report).status).toBe('ready');
  });

  test('blocks mismatched release body, tag drift, or invalid remote manifest', async () => {
    const report = await buildRemoteReleaseSmokeReport({
      expectedTag: 'v1.0.1',
      expectedVersion: '1.0.1',
      expectedNotesBody: '# Nexus v1.0.1\n',
      ghReleaseJson: JSON.stringify({
        tagName: 'v1.0.0',
        name: 'Nexus v1.0.0',
        body: 'wrong body',
        publishedAt: '2026-04-09T00:00:00Z',
        url: 'https://github.com/LaPaGaYo/nexus/releases/tag/v1.0.0',
      }),
      releaseManifestText: '{"product":"wrong"}',
    });

    expect(report.status).toBe('blocked');
    expect(report.issues).toEqual([
      expect.stringMatching(/tag/i),
      expect.stringMatching(/release notes/i),
      expect.stringMatching(/release manifest/i),
    ]);
  });
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run: `bun test test/nexus/release-remote.test.ts`
Expected: FAIL because `lib/nexus/release-remote.ts` does not exist yet.

- [ ] **Step 3: Implement the remote smoke library and wrapper**

```ts
// lib/nexus/release-remote.ts
import { assertReleaseManifest } from './release-contract';

export interface RemoteReleaseSmokeReport {
  schema_version: 1;
  status: 'ready' | 'blocked';
  tag: string;
  version: string;
  issues: string[];
}

export function validateRemoteReleaseSmokeReport(report: RemoteReleaseSmokeReport): RemoteReleaseSmokeReport {
  if (report.schema_version !== 1) throw new Error('remote release smoke schema_version must be 1');
  if (report.status !== 'ready' && report.status !== 'blocked') throw new Error('invalid remote smoke status');
  return report;
}

export async function buildRemoteReleaseSmokeReport(input: {
  expectedTag: string;
  expectedVersion: string;
  expectedNotesBody: string;
  ghReleaseJson: string;
  releaseManifestText: string;
}): Promise<RemoteReleaseSmokeReport> {
  const ghRelease = JSON.parse(input.ghReleaseJson) as { tagName: string; body: string };
  const issues: string[] = [];

  if (ghRelease.tagName !== input.expectedTag) issues.push(`GitHub Release tag ${ghRelease.tagName} does not match ${input.expectedTag}`);
  if (ghRelease.body.trim() !== input.expectedNotesBody.trim()) issues.push('GitHub Release body does not match local release notes');

  try {
    const manifest = JSON.parse(input.releaseManifestText);
    assertReleaseManifest(manifest);
    if (manifest.tag !== input.expectedTag) issues.push(`release manifest tag ${manifest.tag} does not match ${input.expectedTag}`);
    if (manifest.version !== input.expectedVersion) issues.push(`release manifest version ${manifest.version} does not match ${input.expectedVersion}`);
  } catch (error) {
    issues.push(`release manifest invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  return validateRemoteReleaseSmokeReport({
    schema_version: 1,
    status: issues.length === 0 ? 'ready' : 'blocked',
    tag: input.expectedTag,
    version: input.expectedVersion,
    issues,
  });
}
```

```bash
#!/usr/bin/env bash
set -euo pipefail

NEXUS_DIR="${NEXUS_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
VERSION="$(cat "$NEXUS_DIR/VERSION" | tr -d '[:space:]')"
TAG="v$VERSION"
RELEASE_JSON_URL="https://raw.githubusercontent.com/LaPaGaYo/nexus/$TAG/release.json"
NOTES_PATH="$NEXUS_DIR/$(jq -r .release_notes_path "$NEXUS_DIR/release.json")"

_GH_JSON="$(gh release view "$TAG" --repo LaPaGaYo/nexus --json tagName,body,publishedAt,url,name)"
_REMOTE_RELEASE_JSON="$(curl -fsSL "$RELEASE_JSON_URL")"

bun -e '
  const fs = await import("fs");
  const smoke = await import(process.env.NEXUS_RELEASE_REMOTE_PATH);
  const report = await smoke.buildRemoteReleaseSmokeReport({
    expectedTag: process.env.NEXUS_EXPECTED_TAG,
    expectedVersion: process.env.NEXUS_EXPECTED_VERSION,
    expectedNotesBody: fs.readFileSync(process.env.NEXUS_NOTES_PATH, "utf8"),
    ghReleaseJson: process.env.NEXUS_GH_RELEASE_JSON,
    releaseManifestText: process.env.NEXUS_REMOTE_RELEASE_JSON,
  });
  if (report.status === "ready") {
    console.log(`READY ${report.version} ${report.tag}`);
    process.exit(0);
  }
  console.log(`BLOCKED ${report.version} ${report.tag}`);
  for (const issue of report.issues) console.log(`- ${issue}`);
  process.exit(1);
' \
  NEXUS_RELEASE_REMOTE_PATH="$NEXUS_DIR/lib/nexus/release-remote.ts" \
  NEXUS_EXPECTED_TAG="$TAG" \
  NEXUS_EXPECTED_VERSION="$VERSION" \
  NEXUS_NOTES_PATH="$NOTES_PATH" \
  NEXUS_GH_RELEASE_JSON="$_GH_JSON" \
  NEXUS_REMOTE_RELEASE_JSON="$_REMOTE_RELEASE_JSON"
```

- [ ] **Step 4: Re-run the remote smoke tests**

Run: `bun test test/nexus/release-remote.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add test/nexus/release-remote.test.ts lib/nexus/release-remote.ts bin/nexus-release-smoke
git commit -m "feat: add Nexus remote release smoke checks"
```

## Task 4: Cut The Next Real Release Artifacts

**Files:**
- Modify: `VERSION`
- Modify: `package.json`
- Modify: `release.json`
- Create: `docs/releases/2026-04-10-nexus-v1.0.1.md`

- [ ] **Step 1: Write the release-contract regression first**

```ts
test('keeps the current release version tag and release notes aligned', () => {
  const manifest = JSON.parse(readFileSync('release.json', 'utf8'));

  expect(manifest.version).toBe('1.0.1');
  expect(manifest.tag).toBe('v1.0.1');
  expect(manifest.release_notes_path).toBe('docs/releases/2026-04-10-nexus-v1.0.1.md');
});
```

- [ ] **Step 2: Run the release-contract test and confirm it fails on the old version**

Run: `bun test test/nexus/release-contract.test.ts`
Expected: FAIL because the repo still says `1.0.0`.

- [ ] **Step 3: Bump the release artifacts and add the new release notes**

```json
// release.json
{
  "schema_version": 1,
  "product": "nexus",
  "version": "1.0.1",
  "tag": "v1.0.1",
  "channel": "stable",
  "published_at": "2026-04-10T00:00:00Z",
  "release_notes_path": "docs/releases/2026-04-10-nexus-v1.0.1.md",
  "bundle": {
    "type": "tar.gz",
    "url": "https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.1.tar.gz"
  },
  "compatibility": {
    "upgrade_from_min_version": "1.0.0",
    "requires_setup": true
  }
}
```

```md
# Nexus v1.0.1

Date: 2026-04-10
Tag: `v1.0.1`
Status: `ready_to_publish`

## Summary

This release turns the release-based upgrade model into a maintainer-grade published flow.

## What Ships

- release-based `nexus-update-check` with managed install metadata fallback
- `nexus-upgrade-install` for published release bundles
- maintainer preflight and remote smoke validation commands
- conservative legacy migration and vendored sync behavior

## Verification

- `bun test test/nexus/*.test.ts`
- `bun test browse/test/nexus-update-check.test.ts`
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
- `bun run gen:skill-docs --host codex`
```

- [ ] **Step 4: Re-run the release contract checks**

Run: `bun test test/nexus/release-contract.test.ts test/nexus/release-publish.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add VERSION package.json release.json docs/releases/2026-04-10-nexus-v1.0.1.md test/nexus/release-contract.test.ts
git commit -m "chore: prepare Nexus v1.0.1 release artifacts"
```

## Task 5: Wire The Maintainer Workflow And Record Closeout Evidence

**Files:**
- Modify: `docs/superpowers/runbooks/nexus-release-publish.md`
- Create: `docs/superpowers/closeouts/2026-04-10-nexus-live-release-dogfood-closeout.md`

- [ ] **Step 1: Update the runbook to require the new helpers**

```md
## Maintainer Gate

Run these before creating the tag:
- `bun test test/nexus/release-publish.test.ts test/nexus/release-remote.test.ts`
- `./bin/nexus-release-preflight`

Run this immediately after the GitHub Release is published:
- `./bin/nexus-release-smoke`

Do not treat the release as complete until both commands report `READY`.
```

- [ ] **Step 2: Add the milestone closeout with explicit publish evidence**

```md
# Nexus Live Release Dogfood Closeout

Date: 2026-04-10
Status: `completed`
Plan: `docs/superpowers/plans/2026-04-10-nexus-live-release-dogfood.md`

## Outcome

Nexus now has a maintainer-grade local preflight and remote release smoke loop for published upgrades.

## Evidence

- local preflight verdict from `./bin/nexus-release-preflight`
- remote smoke verdict from `./bin/nexus-release-smoke`
- pushed tag: `v1.0.1`
- published GitHub Release URL
```

- [ ] **Step 3: Run the doc-focused regression checks**

Run: `bun test test/nexus/release-publish.test.ts test/nexus/release-remote.test.ts test/nexus/release-contract.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/runbooks/nexus-release-publish.md docs/superpowers/closeouts/2026-04-10-nexus-live-release-dogfood-closeout.md
git commit -m "docs: add Nexus live release dogfood workflow"
```

## Task 6: Final Gate And Publish Execution

**Files:**
- Modify: `docs/releases/2026-04-10-nexus-v1.0.1.md`
- Modify: `docs/superpowers/closeouts/2026-04-10-nexus-live-release-dogfood-closeout.md`

- [ ] **Step 1: Run the full milestone gate**

Run:

```bash
bun test test/nexus/*.test.ts
bun test browse/test/nexus-update-check.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
bun run gen:skill-docs --host codex
git diff --check
./bin/nexus-release-preflight
```

Expected:
- all Bun test commands pass
- `gen:skill-docs` succeeds
- `git diff --check` is clean
- `nexus-release-preflight` prints `READY 1.0.1 v1.0.1`

- [ ] **Step 2: Publish the release**

Run:

```bash
git tag v1.0.1
git push origin main
git push origin v1.0.1
gh release create v1.0.1 --repo LaPaGaYo/nexus --title "Nexus v1.0.1" --notes-file docs/releases/2026-04-10-nexus-v1.0.1.md
```

Expected:
- tag push succeeds
- GitHub Release is created from the new tag

- [ ] **Step 3: Run live remote smoke after publication**

Run:

```bash
./bin/nexus-release-smoke
```

Expected:
- `READY 1.0.1 v1.0.1`

- [ ] **Step 4: Mark release notes and closeout as released**

```md
Status: `released`
```

Add the real GitHub Release URL and the final smoke output summary to the closeout file.

- [ ] **Step 5: Commit the post-publish evidence**

```bash
git add docs/releases/2026-04-10-nexus-v1.0.1.md docs/superpowers/closeouts/2026-04-10-nexus-live-release-dogfood-closeout.md
git commit -m "docs: close out Nexus v1.0.1 live release dogfood"
```

## Self-Review

### Spec coverage

- Real published-release validation is covered by Task 3 and Task 6.
- Maintainer preflight and release closure are covered by Task 1, Task 2, and Task 5.
- Repo-visible release truth (`VERSION`, `package.json`, `release.json`, release notes, closeout) is covered by Task 4, Task 5, and Task 6.
- The user-facing upgrade path stays release-based and managed-install-driven; this is exercised indirectly by Task 4 and Task 6 rather than by adding a new parallel upgrade contract.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each task names concrete files, commands, and expected outputs.
- Release publication is explicit and not hidden behind generic prose.

### Type consistency

- Local preflight uses `ReleasePreflightReport` with `status: 'ready' | 'blocked'`.
- Remote smoke uses `RemoteReleaseSmokeReport` with the same ready/blocked verdict model.
- The target release is consistently `1.0.1` / `v1.0.1` across tests, artifacts, and publish commands.
