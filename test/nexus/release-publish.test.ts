import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  buildReleasePreflightReport,
  validateReleasePreflightReport,
  type ReleasePreflightReport,
} from '../../lib/nexus/release-publish';

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe('nexus release publish contract', () => {
  test('freezes the local release preflight report shape', () => {
    const report: ReleasePreflightReport = {
      schema_version: 1,
      status: 'ready',
      version: '1.0.1',
      tag: 'v1.0.1',
      release_notes_path: 'docs/releases/2026-04-10-nexus-v1.0.1.md',
      issues: [],
    };

    expect(validateReleasePreflightReport(report)).toEqual(report);
  });

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

      expect(validateReleasePreflightReport(report)).toEqual({
        schema_version: 1,
        status: 'ready',
        version: '1.0.1',
        tag: 'v1.0.1',
        release_notes_path: 'docs/releases/2026-04-10-nexus-v1.0.1.md',
        issues: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks mismatched version markers, malformed release paths, dirty worktrees, and reused tags', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-release-preflight-'));

    try {
      mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
      writeFileSync(join(root, 'VERSION'), '1.0.1\n');
      writeJson(join(root, 'package.json'), { version: '1.0.0' });
      writeJson(join(root, 'release.json'), {
        schema_version: 1,
        product: 'nexus',
        version: '1.0.1',
        tag: 'v1.0.9',
        channel: 'stable',
        published_at: '2026-04-10T00:00:00Z',
        release_notes_path: 'docs/releases/2026-04-08-nexus-v1.0.1.md',
        bundle: {
          type: 'tar.gz',
          url: 'https://example.com/nexus-v1.0.1.tar.gz',
        },
        compatibility: {
          upgrade_from_min_version: '1.0.0',
          requires_setup: true,
        },
      });
      writeFileSync(join(root, 'docs', 'releases', '2026-04-08-nexus-v1.0.1.md'), '# Wrong release notes path\n');

      const report = buildReleasePreflightReport({
        rootDir: root,
        gitStatusLines: [' M README.md'],
        existingTags: ['v1.0.1'],
      });

      expect(report.status).toBe('blocked');
      expect(report.issues).toEqual([
        expect.stringMatching(/package\.json version/i),
        expect.stringMatching(/release\.json tag/i),
        expect.stringMatching(/release_notes_path/i),
        expect.stringMatching(/bundle\.url/i),
        expect.stringMatching(/dirty worktree/i),
        expect.stringMatching(/already exists/i),
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
