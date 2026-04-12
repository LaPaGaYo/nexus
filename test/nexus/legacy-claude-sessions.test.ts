import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-clean-claude-sessions');

describe('nexus stale Claude session cleanup', () => {
  test('status reports stale sessions only when obsolete Nexus prompts appear in non-latest transcripts', () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-legacy-claude-sessions-'));

    try {
      const projectsDir = join(home, '.claude', 'projects', 'demo-project');
      mkdirSync(projectsDir, { recursive: true });

      const stalePath = join(projectsDir, 'older.jsonl');
      const latestPath = join(projectsDir, 'latest.jsonl');
      writeFileSync(stalePath, 'Nexus is ready on main branch, solo mode, proactive routing on.\n');
      writeFileSync(latestPath, 'fresh session\n');

      const oldDate = new Date(Date.now() - 10_000);
      const newDate = new Date();
      utimesSync(stalePath, oldDate, oldDate);
      utimesSync(latestPath, newDate, newDate);

      const result = Bun.spawnSync([SCRIPT, 'status'], {
        env: {
          ...process.env,
          HOME: home,
          NEXUS_CLEAN_CLAUDE_SESSIONS_MIN_AGE_SECONDS: '1',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(result.exitCode).toBe(1);
      expect(result.stdout.toString()).toContain('stale_present');
      expect(result.stdout.toString()).toContain(stalePath);
      expect(result.stdout.toString()).not.toContain(latestPath);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  test('apply removes obsolete Nexus transcripts but preserves latest and nested subagent transcripts', () => {
    const home = mkdtempSync(join(tmpdir(), 'nexus-legacy-claude-sessions-'));

    try {
      const projectDir = join(home, '.claude', 'projects', 'demo-project');
      const nestedDir = join(projectDir, 'subagents');
      mkdirSync(nestedDir, { recursive: true });

      const stalePath = join(projectDir, 'older.jsonl');
      const latestPath = join(projectDir, 'latest.jsonl');
      const nestedPath = join(nestedDir, 'agent.jsonl');

      writeFileSync(stalePath, 'Help Nexus get better!\nWhich telemetry level would you like\n');
      writeFileSync(latestPath, 'current transcript\n');
      writeFileSync(nestedPath, 'Help Nexus get better!\n');

      const oldDate = new Date(Date.now() - 10_000);
      const newDate = new Date();
      utimesSync(stalePath, oldDate, oldDate);
      utimesSync(latestPath, newDate, newDate);
      utimesSync(nestedPath, oldDate, oldDate);

      const result = Bun.spawnSync([SCRIPT, 'apply'], {
        env: {
          ...process.env,
          HOME: home,
          NEXUS_CLEAN_CLAUDE_SESSIONS_MIN_AGE_SECONDS: '1',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain(stalePath);
      expect(() => readFileSync(latestPath, 'utf8')).not.toThrow();
      expect(() => readFileSync(nestedPath, 'utf8')).not.toThrow();
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
