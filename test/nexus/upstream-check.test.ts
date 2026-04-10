import { describe, expect, test } from 'bun:test';
import {
  alignUpstreamLockWithContract,
  applyUpstreamCheckResults,
  buildUpstreamCheckResultFromRecord,
  createInitialUpstreamLock,
  renderUpstreamCheckStatus,
  resolveUpstreamTriageRecommendation,
  serializeUpstreamMaintenanceLock,
} from '../../lib/nexus/upstream-maintenance';

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
      pinned_commit: 'caf337508fe9c84f4d1a0edb423b76b83f256e91',
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

  test('known latest commits with unknown ancestry stay defer-style and avoid green status', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'pm-skills' as const,
      repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
      pinned_commit: '4aa4196c14873b84f5af7316e7f66328cb6dee4c',
      active_absorbed_capabilities: ['pm-discover', 'pm-frame'] as const,
    };
    const latestCommit = '4aa4196c14873b84f5af7316e7f66328cb6dee4c';
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

  test('missing remote results defer triage and render unknown freshness values', () => {
    const checkedAt = '2026-04-10T12:00:00.000Z';
    const upstream = {
      name: 'superpowers' as const,
      repo_url: 'https://github.com/obra/superpowers.git',
      pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
      active_absorbed_capabilities: [
        'superpowers-build-discipline',
        'superpowers-build-verification',
        'superpowers-review-discipline',
        'superpowers-ship-discipline',
      ] as const,
    };
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');
    const result = buildUpstreamCheckResultFromRecord(upstream, null, null, 'network unavailable');
    const updatedLock = applyUpstreamCheckResults(lock, [result], checkedAt);
    const status = renderUpstreamCheckStatus(updatedLock, [result], checkedAt);

    expect(result.triage_recommendation).toBe('defer');

    const updatedRecord = updatedLock.upstreams.find((record) => record.name === upstream.name);
    expect(updatedRecord).toMatchObject({
      last_checked_commit: null,
      last_checked_at: checkedAt,
      behind_count: null,
    });

    expect(result.remote_error).toBe('network unavailable');
    expect(status).toContain(`| ${upstream.name} | \`${upstream.pinned_commit}\` | unknown | unknown |`);
    expect(status).toContain('`defer`');
  });
});
