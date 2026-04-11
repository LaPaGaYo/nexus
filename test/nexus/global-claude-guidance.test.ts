import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-global-claude');

describe('nexus global CLAUDE.md guidance', () => {
  test('status reports missing until the Nexus section is installed', () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-global-claude-'));

    try {
      mkdirSync(join(home, '.claude'), { recursive: true });
      writeFileSync(join(home, '.claude', 'CLAUDE.md'), '# Existing Claude Rules\n');

      const before = Bun.spawnSync([SCRIPT, 'status'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(before.exitCode).toBe(1);
      expect(before.stdout.toString().trim()).toBe('missing');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test('apply appends a Nexus-managed section and keeps the file idempotent', () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-global-claude-'));

    try {
      mkdirSync(join(home, '.claude'), { recursive: true });
      const target = join(home, '.claude', 'CLAUDE.md');
      writeFileSync(target, '# Existing Claude Rules\n\nKeep my custom section.\n');

      const first = Bun.spawnSync([SCRIPT, 'apply'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(first.exitCode).toBe(0);
      expect(first.stdout.toString().trim()).toBe(target);

      const once = readFileSync(target, 'utf8');
      expect(once).toContain('# Existing Claude Rules');
      expect(once).toContain('Keep my custom section.');
      expect(once).toContain('## Nexus Global Routing');
      expect(once).toContain('cross-project Nexus defaults only');
      expect(once).toContain('/discover');
      expect(once).toContain('/closeout');
      expect(once).toContain('/browse');
      expect(once).toContain('mcp__claude-in-chrome__*');
      expect(once).toContain('repo-visible instructions and artifacts as the source of truth');

      const second = Bun.spawnSync([SCRIPT, 'apply'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(second.exitCode).toBe(0);
      expect(readFileSync(target, 'utf8')).toBe(once);

      const after = Bun.spawnSync([SCRIPT, 'status'], {
        env: {
          ...process.env,
          HOME: home,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(after.exitCode).toBe(0);
      expect(after.stdout.toString().trim()).toBe('present');
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
