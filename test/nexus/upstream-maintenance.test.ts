import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import {
  UPSTREAM_ABSORPTION_DECISIONS,
  UPSTREAM_BOOTSTRAP_STATES,
  UPSTREAM_MAINTENANCE_UPSTREAMS,
  UPSTREAM_NAMES,
  UPSTREAM_REFRESH_STATUSES,
  createInitialUpstreamLock,
  getUpstreamImportedPath,
  getUpstreamInventoryPath,
  getUpstreamPinnedCommit,
  getUpstreamRepoUrl,
} from '../../lib/nexus/upstream-maintenance';

describe('nexus upstream maintenance contract', () => {
  test('exports the four frozen upstreams with helper paths', () => {
    expect(UPSTREAM_NAMES).toEqual(['pm-skills', 'gsd', 'superpowers', 'claude-code-bridge']);
    expect(UPSTREAM_REFRESH_STATUSES).toEqual(['unchecked', 'up_to_date', 'behind', 'refresh_candidate']);
    expect(UPSTREAM_ABSORPTION_DECISIONS).toEqual(['ignore', 'defer', 'absorb_partial', 'absorb_full', 'reject']);
    expect(UPSTREAM_BOOTSTRAP_STATES).toEqual(['bootstrap', 'checked']);
    expect(UPSTREAM_MAINTENANCE_UPSTREAMS).toHaveLength(4);

    for (const upstream of UPSTREAM_MAINTENANCE_UPSTREAMS) {
      expect(getUpstreamRepoUrl(upstream.name)).toBe(upstream.repo_url);
      expect(getUpstreamPinnedCommit(upstream.name)).toBe(upstream.pinned_commit);
      expect(getUpstreamImportedPath(upstream.name)).toBe(upstream.imported_path);
      expect(getUpstreamInventoryPath(upstream.name)).toBe(upstream.inventory_path);
    }
  });

  test('creates a lock snapshot that keeps upstreams as source material only', () => {
    const lock = createInitialUpstreamLock('2026-04-09T00:00:00.000Z');

    expect(lock.schema_version).toBe(1);
    expect(lock.updated_at).toBe('2026-04-09T00:00:00.000Z');
    expect(lock.upstreams).toHaveLength(4);

    for (const record of lock.upstreams) {
      expect(record.bootstrap_state).toBe('bootstrap');
      expect(record.last_checked_commit).toBeNull();
      expect(record.last_checked_at).toBeNull();
      expect(record.behind_count).toBeNull();
      expect(record.refresh_status).toBe('unchecked');
      expect(record.last_absorption_decision).toBeNull();
      expect(record.last_refresh_candidate_at).toBeNull();
      expect(record.notes.toLowerCase()).toContain('bootstrap snapshot only');
      expect(record.notes).toContain('non-authoritative');
      expect(record.notes).not.toMatch(/runtime truth/i);
      expect(Object.values(record).join(' ')).not.toMatch(/runtime truth/i);
    }
  });

  test('the checked-in lock file mirrors the frozen contract and avoids runtime-truth claims', () => {
    const lock = JSON.parse(readFileSync('upstream-notes/upstream-lock.json', 'utf8')) as ReturnType<
      typeof createInitialUpstreamLock
    >;

    expect(lock.schema_version).toBe(1);
    expect(lock.upstreams).toHaveLength(4);

    const byName = new Map(lock.upstreams.map((record) => [record.name, record]));

    for (const definition of UPSTREAM_MAINTENANCE_UPSTREAMS) {
      const record = byName.get(definition.name);

      expect(record).toBeDefined();
      expect(record).toMatchObject({
        name: definition.name,
        repo_url: definition.repo_url,
        imported_path: definition.imported_path,
        pinned_commit: definition.pinned_commit,
        bootstrap_state: 'bootstrap',
        refresh_status: 'unchecked',
        last_checked_commit: null,
        last_checked_at: null,
        behind_count: null,
        last_refresh_candidate_at: null,
        last_absorption_decision: null,
      });
      expect(record?.active_absorbed_capabilities).toEqual([...definition.active_absorbed_capabilities]);
      expect(record?.notes.toLowerCase()).toContain('bootstrap snapshot only');
      expect(record?.notes).toContain('non-authoritative');
      expect(Object.values(record).join(' ')).not.toMatch(/runtime truth/i);
    }
  });

  test('the checked-in lock and update-status file agree on bootstrap state and unknown check values', () => {
    const lock = JSON.parse(readFileSync('upstream-notes/upstream-lock.json', 'utf8')) as ReturnType<
      typeof createInitialUpstreamLock
    >;
    const status = readFileSync('upstream-notes/update-status.md', 'utf8');

    expect(status).toContain('No upstream checks have run yet.');
    expect(status).toContain('Bootstrap Snapshot');

    for (const record of lock.upstreams) {
      expect(status).toContain(`| ${record.name} | bootstrap | unchecked | unknown | unknown | unknown | unknown |`);
      expect(record.bootstrap_state).toBe('bootstrap');
      expect(record.last_checked_commit).toBeNull();
      expect(record.last_checked_at).toBeNull();
      expect(record.behind_count).toBeNull();
      expect(record.last_absorption_decision).toBeNull();
    }
  });
});
