import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  RELEASE_CHANNELS,
  RESERVED_RELEASE_CHANNELS,
  assertReleaseManifest,
  getReleaseNotesPath,
} from '../../lib/nexus/release-contract';
import type { ReleaseManifest } from '../../lib/nexus/release-contract';
import {
  assertUpdateStateStatus,
  getJustUpgradedPath,
  getLastCheckPath,
  getSnoozePath,
  readJustUpgradedUpdateState,
  readLastCheckUpdateState,
  readSnoozeUpdateState,
  UPDATE_STATE_STATUSES,
  validateJustUpgradedUpdateState,
  validateLastCheckUpdateState,
  validateSnoozeUpdateState,
  writeJustUpgradedUpdateState,
  writeLastCheckUpdateState,
  writeSnoozeUpdateState,
} from '../../lib/nexus/update-state';

const VERSION = readFileSync('VERSION', 'utf8').trim();

describe('nexus release contract', () => {
  test('freezes the current release manifest schema', () => {
    const manifest = JSON.parse(readFileSync('release.json', 'utf8')) as ReleaseManifest;

    expect(() => assertReleaseManifest(manifest)).not.toThrow();
    expect(manifest.schema_version).toBe(1);
    expect(manifest.product).toBe('nexus');
    expect(RELEASE_CHANNELS).toEqual(['stable']);
    expect(RESERVED_RELEASE_CHANNELS).toEqual(['candidate', 'nightly']);
  });

  test('keeps the current release version tag and release notes aligned', () => {
    const manifest = JSON.parse(readFileSync('release.json', 'utf8')) as ReleaseManifest;

    expect(VERSION).toBe('1.0.21');
    expect(manifest.version).toBe(VERSION);
    expect(manifest.tag).toBe(`v${VERSION}`);
    expect(manifest.release_notes_path).toBe('docs/releases/2026-04-13-nexus-v1.0.21.md');
    expect(manifest.release_notes_path).toBe(getReleaseNotesPath('2026-04-13', VERSION));
  });

  test('accepts only documented update-state statuses', () => {
    expect(UPDATE_STATE_STATUSES).toEqual([
      'up_to_date',
      'upgrade_available',
      'snoozed',
      'disabled',
      'error',
      'invalid_remote',
    ]);

    for (const status of UPDATE_STATE_STATUSES) {
      expect(() => assertUpdateStateStatus(status)).not.toThrow();
    }

    expect(() => assertUpdateStateStatus('pending')).toThrow(/update-state status/i);
  });

  test('reads, writes, and validates host update-state files', () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'nexus-update-state-'));

    try {
      const lastCheck = {
        schema_version: 1 as const,
        status: 'upgrade_available' as const,
        checked_at: '2026-04-09T00:00:00Z',
        release_channel: 'stable' as const,
        local_version: '1.0.0',
        local_tag: 'v1.0.0',
        candidate_version: '1.0.1',
        candidate_tag: 'v1.0.1',
        source: {
          kind: 'github_release' as const,
          repo: 'LaPaGaYo/nexus',
        },
      };
      const snooze = {
        schema_version: 1 as const,
        release_channel: 'stable' as const,
        candidate_version: '1.0.1',
        candidate_tag: 'v1.0.1',
        snooze_level: 2,
        snoozed_at: '2026-04-09T00:00:00Z',
        expires_at: '2026-04-11T00:00:00Z',
      };
      const justUpgraded = {
        schema_version: 1 as const,
        from_version: '1.0.0',
        from_tag: 'v1.0.0',
        to_version: '1.0.1',
        to_tag: 'v1.0.1',
        release_channel: 'stable' as const,
        completed_at: '2026-04-09T00:00:00Z',
      };

      writeLastCheckUpdateState(lastCheck, homeDir);
      writeSnoozeUpdateState(snooze, homeDir);
      writeJustUpgradedUpdateState(justUpgraded, homeDir);

      expect(validateLastCheckUpdateState(JSON.parse(readFileSync(getLastCheckPath(homeDir), 'utf8')))).toEqual(lastCheck);
      expect(validateSnoozeUpdateState(JSON.parse(readFileSync(getSnoozePath(homeDir), 'utf8')))).toEqual(snooze);
      expect(validateJustUpgradedUpdateState(JSON.parse(readFileSync(getJustUpgradedPath(homeDir), 'utf8')))).toEqual(
        justUpgraded,
      );
      expect(readLastCheckUpdateState(homeDir)).toEqual(lastCheck);
      expect(readSnoozeUpdateState(homeDir)).toEqual(snooze);
      expect(readJustUpgradedUpdateState(homeDir)).toEqual(justUpgraded);
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  test('rejects half-populated candidate fields in last-check state', () => {
    expect(() =>
      validateLastCheckUpdateState({
        schema_version: 1,
        status: 'upgrade_available',
        checked_at: '2026-04-09T00:00:00Z',
        release_channel: 'stable',
        local_version: '1.0.0',
        local_tag: 'v1.0.0',
        candidate_version: '1.0.1',
        candidate_tag: null,
        source: {
          kind: 'github_release',
          repo: 'LaPaGaYo/nexus',
        },
      }),
    ).toThrow(/candidate_version and candidate_tag/i);
  });
});
