#!/usr/bin/env bun

import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  applyUpstreamCheckResults,
  alignUpstreamLockWithContract,
  buildUpstreamCheckResultFromRecord,
  parseUpstreamMaintenanceLock,
  renderUpstreamCheckStatus,
  serializeUpstreamMaintenanceLock,
  upstreamNotesPath,
} from '../lib/nexus/upstream-maintenance';
import { tmpdir } from 'os';

const DEFAULT_ROOT = join(import.meta.dir, '..');
const ROOT = process.env.UPSTREAM_CHECK_ROOT ? join(process.env.UPSTREAM_CHECK_ROOT) : DEFAULT_ROOT;
const LOCK_TARGET = upstreamNotesPath('upstream-lock.json');
const STATUS_TARGET = upstreamNotesPath('update-status.md');
const LOCK_PATH = join(ROOT, LOCK_TARGET);

function git(args: string[], cwd: string): { ok: true; stdout: string } | { ok: false; error: string } {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    const error = result.stderr.trim() || result.stdout.trim() || `git ${args.join(' ')} failed`;
    return { ok: false, error };
  }

  return { ok: true, stdout: result.stdout };
}

function resolveRemoteHead(repoUrl: string): { headRef: string | null; latestCommit: string | null; error: string | null } {
  const remoteResult = git(['ls-remote', '--symref', repoUrl, 'HEAD'], ROOT);
  if (!remoteResult.ok) {
    return { headRef: null, latestCommit: null, error: remoteResult.error };
  }

  const lines = remoteResult.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const symrefLine = lines.find((line) => line.startsWith('ref: '));
  const headRef = symrefLine ? symrefLine.split(/\s+/)[1] ?? null : null;
  const headCommitLine = lines.find((line) => /^[0-9a-f]{40}\s+HEAD$/i.test(line));
  const latestCommit = headCommitLine ? headCommitLine.split(/\s+/)[0] ?? null : null;

  if (!headRef || !latestCommit || !/^[0-9a-f]{40}$/i.test(latestCommit)) {
    return { headRef: null, latestCommit: null, error: `Unable to resolve remote HEAD for ${repoUrl}` };
  }

  return { headRef, latestCommit, error: null };
}

function computeBehindCount(repoUrl: string, pinnedCommit: string, headRef: string): number | null {
  const tempDir = mkdtempSync(join(tmpdir(), 'nexus-upstream-'));
  try {
    const initResult = git(['init', '--quiet'], tempDir);
    if (!initResult.ok) return null;

    const addRemoteResult = git(['remote', 'add', 'origin', repoUrl], tempDir);
    if (!addRemoteResult.ok) return null;

    const fetchResult = git(['fetch', '--quiet', '--no-tags', 'origin', headRef], tempDir);
    if (!fetchResult.ok) return null;

    const verifyPinned = git(['cat-file', '-e', `${pinnedCommit}^{commit}`], tempDir);
    if (!verifyPinned.ok) {
      return null;
    }

    const countResult = git(['rev-list', '--count', `${pinnedCommit}..FETCH_HEAD`], tempDir);
    if (!countResult.ok) {
      return null;
    }

    const parsed = Number.parseInt(countResult.stdout.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function ensureWriteTargetsAreClean(root: string, paths: string[]): void {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    throw new Error(stderr || stdout || `git status --porcelain -- ${paths.join(' ')} failed`);
  }

  const dirtyEntries = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (dirtyEntries.length > 0) {
    throw new Error(
      `Cannot run upstream:check because one or more maintenance metadata targets have local tracked or untracked changes: ${paths.join(', ')}`,
    );
  }
}

function writeRepoFile(relativePath: string, content: string): void {
  const absolutePath = join(ROOT, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function main(): void {
  const checkedAt = new Date().toISOString();
  ensureWriteTargetsAreClean(ROOT, [LOCK_TARGET, STATUS_TARGET]);
  const lock = parseUpstreamMaintenanceLock(readFileSync(LOCK_PATH, 'utf8'));
  const alignedEntries = alignUpstreamLockWithContract(lock);
  const results = alignedEntries.map(({ definition, record }) => {
    const remote = resolveRemoteHead(definition.repo_url);
    if (remote.error || !remote.headRef || !remote.latestCommit) {
      return buildUpstreamCheckResultFromRecord(
        {
          name: definition.name,
          repo_url: definition.repo_url,
          pinned_commit: record.pinned_commit,
          active_absorbed_capabilities: definition.active_absorbed_capabilities,
        },
        null,
        null,
        remote.error,
      );
    }

    const behindCount = computeBehindCount(definition.repo_url, record.pinned_commit, remote.headRef);
    return buildUpstreamCheckResultFromRecord(
      {
        name: definition.name,
        repo_url: definition.repo_url,
        pinned_commit: record.pinned_commit,
        active_absorbed_capabilities: definition.active_absorbed_capabilities,
      },
      remote.latestCommit,
      behindCount,
    );
  });

  const updatedLock = applyUpstreamCheckResults(lock, results, checkedAt);
  writeRepoFile(LOCK_TARGET, serializeUpstreamMaintenanceLock(updatedLock));
  writeRepoFile(STATUS_TARGET, renderUpstreamCheckStatus(updatedLock, results, checkedAt));

  const summary = results
    .map((result) => {
      const latest = result.latest_checked_commit ?? 'unavailable';
      const behind = result.behind_count === null ? 'unknown' : String(result.behind_count);
      return `${result.name}: pinned ${result.pinned_commit}, latest ${latest}, behind ${behind}, triage ${result.triage_recommendation}`;
    })
    .join('\n');

  console.log(summary);
}

if (import.meta.main) {
  main();
}
