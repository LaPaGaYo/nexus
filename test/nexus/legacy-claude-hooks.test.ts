import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-clean-claude-hooks');

describe('nexus legacy Claude hook cleanup', () => {
  test('status reports legacy hooks when GSD hook commands are still configured', () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-legacy-claude-hooks-'));

    try {
      const claudeDir = join(home, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      writeFileSync(
        join(claudeDir, 'settings.json'),
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  hooks: [{ type: 'command', command: 'node "/Users/test/.claude/hooks/gsd-check-update.js"' }],
                },
              ],
              PostToolUse: [
                {
                  hooks: [{ type: 'command', command: 'node "/Users/test/.claude/hooks/gsd-context-monitor.js"' }],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      const result = Bun.spawnSync([SCRIPT, 'status'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString().trim()).toBe('legacy_present');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test('apply removes legacy GSD hooks and preserves unrelated Claude settings', () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-legacy-claude-hooks-'));

    try {
      const claudeDir = join(home, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      const settingsPath = join(claudeDir, 'settings.json');
      const settingsLocalPath = join(claudeDir, 'settings.local.json');

      writeFileSync(
        settingsPath,
        JSON.stringify(
          {
            env: {
              KEEP_ME: '1',
            },
            hooks: {
              SessionStart: [
                {
                  hooks: [
                    { type: 'command', command: 'node "/Users/test/.claude/hooks/gsd-check-update.js"' },
                    { type: 'command', command: 'echo "keep-session-start"' },
                  ],
                },
              ],
              PostToolUse: [
                {
                  hooks: [
                    { type: 'command', command: 'node "/Users/test/.claude/hooks/gsd-context-monitor.js"' },
                    { type: 'command', command: 'echo "keep-post-tool"' },
                  ],
                },
              ],
            },
            statusLine: {
              type: 'command',
              command: 'node "/Users/test/.claude/hooks/gsd-statusline.js"',
            },
          },
          null,
          2,
        ),
      );

      writeFileSync(
        settingsLocalPath,
        JSON.stringify(
          {
            hooks: {
              SessionStart: [
                {
                  hooks: [{ type: 'command', command: 'node "/Users/test/.claude/hooks/gsd-check-update.js"' }],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      const result = Bun.spawnSync([SCRIPT, 'apply'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain(settingsPath);
      expect(result.stdout.toString()).toContain(settingsLocalPath);

      const settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
      expect(settings.env).toEqual({ KEEP_ME: '1' });
      expect(JSON.stringify(settings)).not.toContain('gsd-check-update.js');
      expect(JSON.stringify(settings)).not.toContain('gsd-context-monitor.js');
      expect(JSON.stringify(settings)).not.toContain('gsd-statusline.js');
      expect((settings.statusLine as Record<string, unknown> | undefined)).toBeUndefined();

      const hooks = settings.hooks as Record<string, Array<{ hooks: Array<{ command: string }> }>>;
      expect(hooks.SessionStart[0]?.hooks[0]?.command).toBe('echo "keep-session-start"');
      expect(hooks.PostToolUse[0]?.hooks[0]?.command).toBe('echo "keep-post-tool"');

      const settingsLocal = JSON.parse(readFileSync(settingsLocalPath, 'utf8')) as Record<string, unknown>;
      expect((settingsLocal.hooks as Record<string, unknown> | undefined)).toBeUndefined();

      const after = Bun.spawnSync([SCRIPT, 'status'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(after.exitCode).toBe(0);
      expect(after.stdout.toString().trim()).toBe('clean');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
