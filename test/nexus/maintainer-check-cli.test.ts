import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createInitialUpstreamLock, serializeUpstreamMaintenanceLock } from '../../lib/nexus/upstream-maintenance';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-maintainer-check');

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('nexus-maintainer-check', () => {
  test('writes maintainer-status.json and maintainer-status.md', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-maintainer-check-'));

    try {
      mkdirSync(join(root, 'upstream-notes'), { recursive: true });
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
      writeFileSync(
        join(root, 'upstream-notes', 'upstream-lock.json'),
        serializeUpstreamMaintenanceLock(createInitialUpstreamLock('2026-04-10T12:00:00.000Z')),
      );

      const result = Bun.spawnSync([SCRIPT], {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXUS_DIR: root,
          NEXUS_GIT_STATUS_LINES: '',
          NEXUS_EXISTING_TAGS: '',
          NEXUS_REMOTE_RELEASE_MODE: 'skip',
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString().trim()).toBe('READY none');
      expect(result.stderr.toString().trim()).toBe('');

      const report = JSON.parse(readFileSync(join(root, 'upstream-notes', 'maintainer-status.json'), 'utf8')) as {
        schema_version: number;
        status: string;
      };
      expect(report.schema_version).toBe(1);
      expect(report.status).toBe('ready');
      expect(readFileSync(join(root, 'upstream-notes', 'maintainer-status.md'), 'utf8')).toContain(
        '# Nexus Maintainer Status',
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reports publish_release when release drift exists and the matching published release is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-maintainer-check-'));

    try {
      mkdirSync(join(root, 'upstream-notes'), { recursive: true });
      mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
      writeFileSync(join(root, 'VERSION'), '1.0.2\n');
      writeJson(join(root, 'package.json'), { version: '1.0.2' });
      writeJson(join(root, 'release.json'), {
        schema_version: 1,
        product: 'nexus',
        version: '1.0.2',
        tag: 'v1.0.2',
        channel: 'stable',
        published_at: '2026-04-10T00:00:00Z',
        release_notes_path: 'docs/releases/2026-04-10-nexus-v1.0.2.md',
        bundle: {
          type: 'tar.gz',
          url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.2.tar.gz',
        },
        compatibility: {
          upgrade_from_min_version: '1.0.1',
          requires_setup: true,
        },
      });
      writeFileSync(join(root, 'docs', 'releases', '2026-04-10-nexus-v1.0.2.md'), '# Nexus v1.0.2\n');
      writeFileSync(
        join(root, 'upstream-notes', 'upstream-lock.json'),
        serializeUpstreamMaintenanceLock(createInitialUpstreamLock('2026-04-10T12:00:00.000Z')),
      );

      const result = Bun.spawnSync([SCRIPT], {
        cwd: root,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXUS_DIR: root,
          NEXUS_GIT_STATUS_LINES: '',
          NEXUS_EXISTING_TAGS: '',
          NEXUS_RELEASE_DIFF_NAMES: 'lib/nexus/maintainer-loop.ts',
          NEXUS_REMOTE_RELEASE_MODE: 'missing',
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString().trim()).toBe('ACTION_REQUIRED publish_release');
      expect(result.stderr.toString().trim()).toBe('');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
