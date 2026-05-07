import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  INSTALL_KINDS,
  INSTALL_SCOPES,
  assertInstallMetadata,
  getInstallMetadataPath,
  readInstallMetadata,
  validateInstallMetadata,
  writeInstallMetadata,
  type InstallMetadata,
} from '../../../lib/nexus/io/install-metadata';

describe('nexus install metadata contract', () => {
  test('freezes the managed install metadata shape', () => {
    const metadata: InstallMetadata = {
      schema_version: 1,
      product: 'nexus',
      install_kind: 'managed_release',
      install_scope: 'global',
      release_channel: 'stable',
      installed_version: '1.0.0',
      installed_tag: 'v1.0.0',
      install_source: {
        kind: 'github_release',
        repo: 'LaPaGaYo/nexus',
        bundle_url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.0.tar.gz',
      },
      last_upgrade_at: '2026-04-08T00:00:00Z',
      migrated_from: null,
    };

    expect(() => assertInstallMetadata(metadata)).not.toThrow();
    expect(INSTALL_KINDS).toEqual([
      'managed_release',
      'managed_vendored',
      'legacy_git',
      'legacy_vendored',
      'source_checkout',
    ]);
    expect(INSTALL_SCOPES).toEqual(['global', 'project']);
  });

  test('reads, writes, and validates install metadata on disk', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'nexus-install-metadata-'));

    try {
      const metadata: InstallMetadata = {
        schema_version: 1,
        product: 'nexus',
        install_kind: 'managed_release',
        install_scope: 'global',
        release_channel: 'stable',
        installed_version: '1.0.0',
        installed_tag: 'v1.0.0',
        install_source: {
          kind: 'github_release',
          repo: 'LaPaGaYo/nexus',
          bundle_url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.0.tar.gz',
        },
        last_upgrade_at: '2026-04-08T00:00:00Z',
        migrated_from: {
          install_kind: 'legacy_git',
          installed_version: '1.0.0',
        },
      };

      writeInstallMetadata(metadata, cwd);

      const disk = readFileSync(getInstallMetadataPath(cwd), 'utf8');
      const parsed = JSON.parse(disk) as unknown;
      expect(validateInstallMetadata(parsed)).toEqual(metadata);
      expect(readInstallMetadata(cwd)).toEqual(metadata);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('rejects unsupported install metadata fields', () => {
    expect(() =>
      validateInstallMetadata({
        schema_version: 1,
        product: 'nexus',
        install_kind: 'managed_release',
        install_scope: 'local',
        release_channel: 'stable',
        installed_version: '1.0.0',
        installed_tag: 'v1.0.0',
        install_source: {
          kind: 'github_release',
          repo: 'LaPaGaYo/nexus',
          bundle_url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.0.tar.gz',
        },
        last_upgrade_at: '2026-04-08T00:00:00Z',
        migrated_from: null,
      } as InstallMetadata),
    ).toThrow(/install_scope/i);
  });
});
