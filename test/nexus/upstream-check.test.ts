import { spawnSync } from 'child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { describe, expect, test } from 'bun:test';
import {
  alignUpstreamLockWithContract,
  applyUpstreamCheckResults,
  buildUpstreamCheckResultFromRecord,
  createInitialUpstreamLock,
  getUpstreamPinnedCommit,
  renderUpstreamCheckStatus,
  resolveUpstreamTriageRecommendation,
  serializeUpstreamMaintenanceLock,
} from '../../lib/nexus/upstream-maintenance';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts/upstream-check.ts');
const LOCK_PATH = join(REPO_ROOT, 'vendor/upstream-notes/upstream-lock.json');
const STATUS_PATH = join(REPO_ROOT, 'vendor/upstream-notes/update-status.md');

function git(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  }

  return (result.stdout || '').trim();
}

function prepareCheckWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'nexus-upstream-check-root-'));
  mkdirSync(join(root, 'vendor/upstream-notes'), { recursive: true });
  copyFileSync(LOCK_PATH, join(root, 'vendor/upstream-notes/upstream-lock.json'));
  copyFileSync(STATUS_PATH, join(root, 'vendor/upstream-notes/update-status.md'));
  git(['init', '--quiet'], root);
  git(['config', 'core.filemode', 'true'], root);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'add', '-A'], root);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'commit', '--quiet', '-m', 'baseline'], root);
  return { root };
}

describe('nexus upstream freshness checks', () => {
  test('lock-record checks resolve pinned commits from the lock file, not the code contract', () => {
    const record = {
      name: 'gsd' as const,
      repo_url: 'https://example.com/gsd.git',
      pinned_commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      active_absorbed_capabilities: ['gsd-plan', 'gsd-closeout'] as const,
    };
    const result = buildUpstreamCheckResultFromRecord(record, record.pinned_commit, 0);

    expect(result.pinned_commit).toBe(record.pinned_commit);
    expect(result.latest_checked_commit).toBe(record.pinned_commit);
    expect(result.behind_count).toBe(0);
    expect(result.triage_recommendation).toBe('ignore');
    expect(resolveUpstreamTriageRecommendation(result)).toBe('ignore');
  });

  test('lock rows must match the maintenance contract before checking begins', () => {
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    lock.upstreams[0] = {
      ...lock.upstreams[0],
      repo_url: 'https://example.com/not-allowed.git',
    };

    expect(() => alignUpstreamLockWithContract(lock)).toThrow('repo_url mismatch');
  });

  test('behind upstreams update lock fields and request review', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'gsd' as const,
      repo_url: 'https://github.com/gsd-build/get-shit-done.git',
      pinned_commit: getUpstreamPinnedCommit('gsd'),
      active_absorbed_capabilities: ['gsd-plan', 'gsd-closeout'] as const,
    };
    const latestCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    const result = buildUpstreamCheckResultFromRecord(upstream, latestCommit, 1);
    const updatedLock = applyUpstreamCheckResults(lock, [result], checkedAt);
    const status = renderUpstreamCheckStatus(updatedLock, [result], checkedAt);

    expect(result.triage_recommendation).toBe('review');
    expect(updatedLock.updated_at).toBe(checkedAt);

    const updatedRecord = updatedLock.upstreams.find((record) => record.name === upstream.name);
    expect(updatedRecord).toMatchObject({
      pinned_commit: upstream.pinned_commit,
      last_checked_commit: latestCommit,
      last_checked_at: checkedAt,
      behind_count: 1,
    });

    expect(serializeUpstreamMaintenanceLock(updatedLock)).toContain(`"last_checked_commit": "${latestCommit}"`);
    expect(status).toContain('# Upstream Update Status');
    expect(status).toContain(`| ${upstream.name} | \`${upstream.pinned_commit}\` | \`${latestCommit}\` | 1 |`);
    expect(status).toContain('`review`');
  });

  test('preserves a pending refresh candidate across later checks', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'pm-skills' as const,
      repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
      pinned_commit: getUpstreamPinnedCommit('pm-skills'),
      active_absorbed_capabilities: ['pm-discover', 'pm-frame'] as const,
    };
    const latestCommit = upstream.pinned_commit;
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    lock.upstreams[0] = {
      ...lock.upstreams[0],
      bootstrap_state: 'checked',
      last_checked_commit: upstream.pinned_commit,
      last_checked_at: '2026-04-09T12:00:00.000Z',
      behind_count: 0,
      refresh_status: 'refresh_candidate',
      last_refresh_candidate_at: '2026-04-09T13:00:00.000Z',
    };

    const result = buildUpstreamCheckResultFromRecord(upstream, latestCommit, 0);
    const updatedLock = applyUpstreamCheckResults(lock, [result], checkedAt);
    const status = renderUpstreamCheckStatus(updatedLock, [result], checkedAt);
    const updatedRecord = updatedLock.upstreams.find((record) => record.name === upstream.name);

    expect(updatedRecord).toMatchObject({
      last_checked_commit: latestCommit,
      behind_count: 0,
      refresh_status: 'refresh_candidate',
      last_refresh_candidate_at: '2026-04-09T13:00:00.000Z',
    });
    expect(updatedRecord?.notes).toContain('pending maintainer review');
    expect(status).toContain('## Pending Refresh Candidates');
    expect(status).toContain('`pm-skills` pending maintainer review since `2026-04-09T13:00:00.000Z`');
  });

  test('known latest commits with unknown ancestry stay defer-style and avoid green status', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'pm-skills' as const,
      repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
      pinned_commit: getUpstreamPinnedCommit('pm-skills'),
      active_absorbed_capabilities: ['pm-discover', 'pm-frame'] as const,
    };
    const latestCommit = getUpstreamPinnedCommit('pm-skills');
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    const result = buildUpstreamCheckResultFromRecord(upstream, latestCommit, null);
    const updatedLock = applyUpstreamCheckResults(lock, [result], checkedAt);
    const status = renderUpstreamCheckStatus(updatedLock, [result], checkedAt);

    expect(result.triage_recommendation).toBe('defer');

    const updatedRecord = updatedLock.upstreams.find((record) => record.name === upstream.name);
    expect(updatedRecord).toMatchObject({
      last_checked_commit: latestCommit,
      last_checked_at: checkedAt,
      behind_count: null,
      refresh_status: 'unchecked',
    });

    expect(status).toContain(`| ${upstream.name} | \`${upstream.pinned_commit}\` | \`${latestCommit}\` | unknown |`);
    expect(status).toContain('`defer`');
    expect(status).not.toContain('`ignore`');
    expect(status).not.toContain('`up_to_date`');
  });

  test('new remote heads with unresolved ancestry retain the last verified checked snapshot', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'gsd' as const,
      repo_url: 'https://github.com/gsd-build/get-shit-done.git',
      pinned_commit: getUpstreamPinnedCommit('gsd'),
      active_absorbed_capabilities: ['gsd-plan', 'gsd-closeout'] as const,
    };
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    lock.upstreams[1] = {
      ...lock.upstreams[1],
      bootstrap_state: 'checked',
      last_checked_commit: upstream.pinned_commit,
      last_checked_at: '2026-04-09T12:00:00.000Z',
      behind_count: 0,
      refresh_status: 'up_to_date',
    };

    const newerCommit = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const result = buildUpstreamCheckResultFromRecord(upstream, newerCommit, null);
    const updatedLock = applyUpstreamCheckResults(lock, [result], checkedAt);
    const status = renderUpstreamCheckStatus(updatedLock, [result], checkedAt);
    const updatedRecord = updatedLock.upstreams.find((record) => record.name === upstream.name);

    expect(updatedRecord).toMatchObject({
      last_checked_commit: upstream.pinned_commit,
      last_checked_at: checkedAt,
      behind_count: 0,
      refresh_status: 'up_to_date',
    });
    expect(updatedRecord?.notes).toContain('retained the last known checked snapshot');
    expect(status).toContain(`| ${upstream.name} | \`${upstream.pinned_commit}\` | \`${newerCommit}\` | unknown |`);
    expect(status).toContain('`defer`');
  });

  test('missing remote results preserve the last known checked snapshot while deferring triage', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'superpowers' as const,
      repo_url: 'https://github.com/obra/superpowers.git',
      pinned_commit: getUpstreamPinnedCommit('superpowers'),
      active_absorbed_capabilities: [
        'superpowers-build-discipline',
        'superpowers-build-verification',
        'superpowers-review-discipline',
        'superpowers-ship-discipline',
      ] as const,
    };
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    lock.upstreams[2] = {
      ...lock.upstreams[2],
      bootstrap_state: 'checked',
      last_checked_commit: upstream.pinned_commit,
      last_checked_at: '2026-04-09T12:00:00.000Z',
      behind_count: 0,
      refresh_status: 'up_to_date',
    };
    const result = buildUpstreamCheckResultFromRecord(upstream, null, null, 'network unavailable');
    const updatedLock = applyUpstreamCheckResults(lock, [result], checkedAt);
    const status = renderUpstreamCheckStatus(updatedLock, [result], checkedAt);

    expect(result.triage_recommendation).toBe('defer');

    const updatedRecord = updatedLock.upstreams.find((record) => record.name === upstream.name);
    expect(updatedRecord).toMatchObject({
      last_checked_commit: upstream.pinned_commit,
      last_checked_at: checkedAt,
      behind_count: 0,
      refresh_status: 'up_to_date',
    });

    expect(result.remote_error).toBe('network unavailable');
    expect(updatedRecord?.notes).toContain('retained the last known checked snapshot');
    expect(status).toContain(`| ${upstream.name} | \`${upstream.pinned_commit}\` | unknown | unknown |`);
    expect(status).toContain('`defer`');
  });

  test('CLI check refuses dirty maintenance metadata targets before rewriting them', () => {
    const { root } = prepareCheckWorkspace();
    const statusPath = join(root, 'vendor/upstream-notes/update-status.md');
    const lockPath = join(root, 'vendor/upstream-notes/upstream-lock.json');
    const lockBefore = readFileSync(lockPath, 'utf8');
    writeFileSync(statusPath, `${readFileSync(statusPath, 'utf8')}\nLOCAL EDIT\n`);

    const result = spawnSync('bun', ['run', SCRIPT_PATH], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_CHECK_ROOT: root,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Cannot run upstream:check because one or more maintenance metadata targets have local tracked or untracked changes');
    expect(readFileSync(statusPath, 'utf8')).toContain('LOCAL EDIT');
    expect(readFileSync(lockPath, 'utf8')).toBe(lockBefore);
  });
});
