import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildRemoteReleaseSmokeReport,
  validateRemoteReleaseSmokeReport,
  type RemoteReleaseSmokeReport,
} from '../../../lib/nexus/release/remote';

const SCRIPT = join(import.meta.dir, '..', '..', '..', 'bin', 'nexus-release-smoke');

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeAlignedReleaseFixture(root: string) {
  mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
  writeFileSync(join(root, 'VERSION'), '1.0.1\n');
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
}

describe('nexus remote release smoke', () => {
  test('freezes the remote release smoke report shape', () => {
    const report: RemoteReleaseSmokeReport = {
      schema_version: 1,
      status: 'ready',
      tag: 'v1.0.1',
      version: '1.0.1',
      issues: [],
    };

    expect(validateRemoteReleaseSmokeReport(report)).toEqual(report);
  });

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
        bundle: {
          type: 'tar.gz',
          url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.1.tar.gz',
        },
        compatibility: {
          upgrade_from_min_version: '1.0.0',
          requires_setup: true,
        },
      }),
    });

    expect(validateRemoteReleaseSmokeReport(report)).toEqual({
      schema_version: 1,
      status: 'ready',
      tag: 'v1.0.1',
      version: '1.0.1',
      issues: [],
    });
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

  test('nexus-release-smoke prints READY when the published release matches the local contract', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-release-smoke-cli-'));

    try {
      writeAlignedReleaseFixture(root);

      const result = Bun.spawnSync([SCRIPT], {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXUS_DIR: root,
          NEXUS_GH_RELEASE_JSON: JSON.stringify({
            tagName: 'v1.0.1',
            name: 'Nexus v1.0.1',
            body: '# Nexus v1.0.1\n',
            publishedAt: '2026-04-10T00:00:00Z',
            url: 'https://github.com/LaPaGaYo/nexus/releases/tag/v1.0.1',
          }),
          NEXUS_REMOTE_RELEASE_JSON: JSON.stringify({
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
          }),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString().trim()).toBe('READY 1.0.1 v1.0.1');
      expect(result.stderr.toString().trim()).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
