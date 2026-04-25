import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  executePreparedReleasePublication,
  type ReleasePublicationCommandResult,
  type ReleasePublicationCommandSpec,
} from '../../lib/nexus/release-publication';

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeAlignedReleaseFixture(root: string) {
  mkdirSync(join(root, 'docs', 'releases'), { recursive: true });
  writeFileSync(join(root, 'VERSION'), '1.0.31\n');
  writeJson(join(root, 'package.json'), { version: '1.0.31' });
  writeJson(join(root, 'release.json'), {
    schema_version: 1,
    product: 'nexus',
    version: '1.0.31',
    tag: 'v1.0.31',
    channel: 'stable',
    published_at: '2026-04-16T00:00:00Z',
    release_notes_path: 'docs/releases/2026-04-16-nexus-v1.0.31.md',
    bundle: {
      type: 'tar.gz',
      url: 'https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.0.31.tar.gz',
    },
    compatibility: {
      upgrade_from_min_version: '1.0.0',
      requires_setup: true,
    },
  });
  writeFileSync(join(root, 'docs', 'releases', '2026-04-16-nexus-v1.0.31.md'), '# Nexus v1.0.31\n');
}

describe('nexus release publication', () => {
  test('blocks before publishing when skill docs freshness generates diffs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-release-publication-'));
    const calls: ReleasePublicationCommandSpec[] = [];

    try {
      writeAlignedReleaseFixture(root);

      const statuses = [' M closeout/SKILL.md\n'];
      const result = await executePreparedReleasePublication({
        rootDir: root,
        releaseRepo: 'LaPaGaYo/nexus',
        gitStatusLines: [],
        existingTags: ['v1.0.30'],
        runCommand: async (spec) => {
          calls.push(spec);

          if (spec.argv[0] === 'git' && spec.argv[1] === 'branch') {
            return { exitCode: 0, stdout: 'main\n', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'status') {
            return { exitCode: 0, stdout: statuses.shift() ?? '', stderr: '' };
          }

          if (spec.argv[0] === 'bun' && spec.argv[1] === 'run') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }

          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      expect(result.status).toBe('blocked');
      expect(result.issues).toContain('Generated skill docs are stale; run the skill doc generators and commit the results before publishing.');
      expect(calls.map((call) => call.argv.join(' '))).toEqual([
        'git branch --show-current',
        'bun run gen:skill-docs',
        'bun run gen:skill-docs --host codex',
        'bun run gen:skill-docs --host factory',
        'git status --short',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('publishes a prepared release and pushes a post-release maintainer refresh commit', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-release-publication-'));
    const calls: ReleasePublicationCommandSpec[] = [];

    try {
      writeAlignedReleaseFixture(root);

      const maintainerStatuses = ['', ' M upstream-notes/maintainer-status.json\n M upstream-notes/maintainer-status.md\n'];
      const result = await executePreparedReleasePublication({
        rootDir: root,
        releaseRepo: 'LaPaGaYo/nexus',
        gitStatusLines: [],
        existingTags: ['v1.0.30'],
        runCommand: async (spec) => {
          calls.push(spec);

          if (spec.argv[0] === 'git' && spec.argv[1] === 'branch') {
            return { exitCode: 0, stdout: 'main\n', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'status') {
            return { exitCode: 0, stdout: maintainerStatuses.shift() ?? '', stderr: '' };
          }

          if (spec.argv[0] === 'bun' && spec.argv[1] === 'run' && spec.argv[2] === 'gen:skill-docs') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'push' && spec.argv[2] === 'origin' && spec.argv[3] === 'main') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'tag') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'push' && spec.argv[2] === 'origin' && spec.argv[3] === 'v1.0.31') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'release' && spec.argv[2] === 'create') {
            return { exitCode: 0, stdout: 'https://github.com/LaPaGaYo/nexus/releases/tag/v1.0.31\n', stderr: '' };
          }

          if (spec.argv[0] === './bin/nexus-release-smoke') {
            return { exitCode: 0, stdout: 'READY 1.0.31 v1.0.31\n', stderr: '' };
          }

          if (spec.argv[0] === 'bun' && spec.argv[1] === 'run' && spec.argv[2] === 'maintainer:check') {
            if (!spec.env?.NEXUS_EXISTING_TAGS?.split('\n').includes('v1.0.31')) {
              return {
                exitCode: 1,
                stdout: 'BLOCKED 1.0.31 v1.0.31\n- tag v1.0.31 is not visible to maintainer check\n',
                stderr: 'stale tag snapshot\n',
              };
            }
            return { exitCode: 0, stdout: 'READY none\n', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'add') {
            return { exitCode: 0, stdout: '', stderr: '' };
          }

          if (spec.argv[0] === 'git' && spec.argv[1] === 'commit') {
            return { exitCode: 0, stdout: '[main abc1234] chore: refresh maintainer status after v1.0.31\n', stderr: '' };
          }

          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      expect(result.status).toBe('published');
      expect(result.version).toBe('1.0.31');
      expect(result.tag).toBe('v1.0.31');
      expect(result.post_publish_refresh_commit).toBe(true);
      expect(calls.find((call) => call.argv.join(' ') === 'bun run maintainer:check')?.env).toMatchObject({
        NEXUS_EXISTING_TAGS: 'v1.0.30\nv1.0.31',
        NEXUS_GIT_STATUS_LINES: '',
        NEXUS_REMOTE_RELEASE_MODE: 'live',
      });
      expect(calls.map((call) => call.argv.join(' '))).toEqual([
        'git branch --show-current',
        'bun run gen:skill-docs',
        'bun run gen:skill-docs --host codex',
        'bun run gen:skill-docs --host factory',
        'git status --short',
        'git push origin main',
        'git tag v1.0.31',
        'git push origin v1.0.31',
        'gh release create v1.0.31 --repo LaPaGaYo/nexus --title Nexus v1.0.31 --notes-file docs/releases/2026-04-16-nexus-v1.0.31.md',
        './bin/nexus-release-smoke',
        'bun run maintainer:check',
        'git status --short -- upstream-notes/maintainer-status.json upstream-notes/maintainer-status.md',
        'git add upstream-notes/maintainer-status.json upstream-notes/maintainer-status.md',
        'git commit -m chore: refresh maintainer status after v1.0.31',
        'git push origin main',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
