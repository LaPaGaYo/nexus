import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
  qaPerfVerificationPath,
  shipCanaryStatusPath,
  shipDeployResultPath,
} from '../../../lib/nexus/io/artifacts';
import { runInTempRepo } from '../helpers/temp-repo';

const SCRIPT = join(import.meta.dir, '..', '..', '..', 'bin', 'nexus-ledger-doctor');

describe('nexus-ledger-doctor cli', () => {
  test('fix-safe json contract reports fixed paths and returns clean when all issues are repairable', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const stalePaths = [
        qaPerfVerificationPath(),
        shipCanaryStatusPath(),
        shipDeployResultPath(),
      ];

      for (const relativePath of stalePaths) {
        mkdirSync(join(cwd, relativePath, '..'), { recursive: true });
      }

      writeFileSync(join(cwd, qaPerfVerificationPath()), '# stale perf\n');
      writeFileSync(join(cwd, shipCanaryStatusPath()), '{"status":"healthy"}\n');
      writeFileSync(join(cwd, shipDeployResultPath()), '{"deploy_status":"verified"}\n');

      const result = Bun.spawnSync([SCRIPT, '--json', '--fix-safe'], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXUS_DIR: cwd,
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString().trim()).toBe('');

      const parsed = JSON.parse(result.stdout.toString()) as {
        report: { status: string; issues: Array<{ code: string }> };
        fixed_paths: string[];
        fixed_issue_codes: string[];
      };

      expect(parsed.report).toEqual({
        status: 'clean',
        issues: [],
      });
      expect(parsed.fixed_issue_codes).toContain('stale_attached_evidence');
      expect(parsed.fixed_paths).toEqual(expect.arrayContaining(stalePaths));
    });
  });

  test('fix-safe text mode distinguishes fixed issues from remaining action-required issues', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      mkdirSync(join(cwd, qaPerfVerificationPath(), '..'), { recursive: true });
      writeFileSync(join(cwd, qaPerfVerificationPath()), '# stale perf\n');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        command_history: Array<{ command: string; at: string; via: string | null }>;
      };
      ledger.command_history = [
        ledger.command_history[0]!,
        ledger.command_history[1]!,
        ledger.command_history[2]!,
        {
          command: 'build',
          at: '2026-04-18T01:00:00.000Z',
          via: 'fix-cycle',
        },
        ledger.command_history[3]!,
      ];
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      const result = Bun.spawnSync([SCRIPT, '--fix-safe'], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXUS_DIR: cwd,
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr.toString().trim()).toBe('');

      const lines = result.stdout.toString().trim().split('\n');
      expect(lines[0]).toContain('FIXED stale_attached_evidence');
      expect(lines.some((line) => line === 'ACTION_REQUIRED history_mismatch')).toBe(true);
    });
  });

  test('fix-safe text mode reports clean after successful repair', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      mkdirSync(join(cwd, qaPerfVerificationPath(), '..'), { recursive: true });
      writeFileSync(join(cwd, qaPerfVerificationPath()), '# stale perf\n');

      const result = Bun.spawnSync([SCRIPT, '--fix-safe'], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          NEXUS_DIR: cwd,
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr.toString().trim()).toBe('');

      const lines = result.stdout.toString().trim().split('\n');
      expect(lines[0]).toContain('FIXED stale_attached_evidence');
      expect(lines).toContain('CLEAN none');
    });
  });
});
