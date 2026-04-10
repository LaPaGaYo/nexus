import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  getJustUpgradedPath,
  getLastCheckPath,
  getLegacyJustUpgradedPath,
  getLegacySnoozePath,
  getSnoozePath,
  parseLegacyJustUpgradedMarker,
  parseLegacySnoozeMarker,
  readJustUpgradedUpdateState,
  readLastCheckUpdateState,
  readLegacyJustUpgradedMarker,
  readLegacySnoozeMarker,
  readSnoozeUpdateState,
  validateJustUpgradedUpdateState,
  validateLastCheckUpdateState,
  validateSnoozeUpdateState,
  writeJustUpgradedUpdateState,
  writeLastCheckUpdateState,
  writeSnoozeUpdateState,
} from '../../lib/nexus/update-state';

describe('nexus update-state contract', () => {
  test('reads and writes structured host update-state JSON at the host root', () => {
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

  test('bridges legacy plaintext markers into parsed update-state inputs', () => {
    const stateRoot = mkdtempSync(join(tmpdir(), 'nexus-update-state-legacy-'));

    try {
      const marker = '0.9.9';
      const snoozedEpoch = 1712620800;
      const snoozeMarker = `1.0.1 2 ${snoozedEpoch}`;

      expect(parseLegacyJustUpgradedMarker(marker)).toEqual({ from_version: '0.9.9' });
      expect(parseLegacySnoozeMarker(snoozeMarker)).toEqual({
        candidate_version: '1.0.1',
        snooze_level: 2,
        snoozed_epoch: snoozedEpoch,
      });

      writeFileSync(getLegacyJustUpgradedPath(stateRoot), `${marker}\n`);
      writeFileSync(getLegacySnoozePath(stateRoot), `${snoozeMarker}\n`);

      expect(readLegacyJustUpgradedMarker(stateRoot)).toEqual({ from_version: '0.9.9' });
      expect(readLegacySnoozeMarker(stateRoot)).toEqual({
        candidate_version: '1.0.1',
        snooze_level: 2,
        snoozed_epoch: snoozedEpoch,
      });
    } finally {
      rmSync(stateRoot, { recursive: true, force: true });
    }
  });
});
