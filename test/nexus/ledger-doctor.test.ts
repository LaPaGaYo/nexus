import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, test } from 'bun:test';
import {
  closeoutDocumentationSyncPath,
  qaPerfVerificationPath,
  shipCanaryStatusPath,
  shipDeployResultPath,
} from '../../lib/nexus/artifacts';
import { applySafeLedgerDoctorFix, buildLedgerDoctorReport } from '../../lib/nexus/ledger-doctor';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus ledger doctor', () => {
  test('reports clean for a canonical completed review history', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      expect(buildLedgerDoctorReport(cwd)).toEqual({
        status: 'clean',
        issues: [],
      });
    });
  });

  test('reports a noncanonical closeout history mismatch at review tail', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

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
          at: '2026-04-16T01:00:00.000Z',
          via: 'fix-cycle',
        },
        ledger.command_history[3]!,
      ];
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      expect(buildLedgerDoctorReport(cwd)).toMatchObject({
        status: 'action_required',
        issues: [
          {
            code: 'history_mismatch',
            message: 'Illegal Nexus transition history: expected review after build at positions 3 -> 4, got build',
            evidence: ['.planning/nexus/current-run.json'],
          },
        ],
      });
    });
  });

  test('does not flag a legal fix-cycle build while the run is still in build', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const reviewStatusPath = join(cwd, '.planning/current/review/status.json');
      const reviewStatus = JSON.parse(readFileSync(reviewStatusPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(reviewStatusPath, JSON.stringify({
        ...reviewStatus,
        state: 'completed',
        decision: 'audit_recorded',
        gate_decision: 'fail',
        ready: false,
      }, null, 2) + '\n');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(ledgerPath, JSON.stringify({
        ...ledger,
        current_command: 'build',
        current_stage: 'build',
        previous_stage: 'review',
        allowed_next_stages: ['review'],
        command_history: [
          ...(ledger.command_history as Array<{ command: string; at: string; via: string | null }>),
          {
            command: 'build',
            at: '2026-04-16T01:05:00.000Z',
            via: 'fix-cycle',
          },
        ],
      }, null, 2) + '\n');

      expect(buildLedgerDoctorReport(cwd)).toEqual({
        status: 'clean',
        issues: [],
      });
    });
  });

  test('reports stale current audits when review is blocked but audit files remain', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const reviewStatusPath = join(cwd, '.planning/current/review/status.json');
      const reviewStatus = JSON.parse(readFileSync(reviewStatusPath, 'utf8')) as Record<string, unknown>;
      writeFileSync(reviewStatusPath, JSON.stringify({
        ...reviewStatus,
        state: 'blocked',
        decision: 'none',
        review_complete: false,
        audit_set_complete: false,
        provenance_consistent: false,
        gate_decision: 'blocked',
      }, null, 2) + '\n');

      expect(buildLedgerDoctorReport(cwd)).toMatchObject({
        status: 'action_required',
        issues: [
          {
            code: 'stale_current_audits',
            message: 'Current audit artifacts exist but the review status is not a completed canonical audit record.',
          },
        ],
      });

      const staleIssue = buildLedgerDoctorReport(cwd).issues.find((issue) => issue.code === 'stale_current_audits');
      expect(staleIssue?.evidence).toEqual(expect.arrayContaining([
        '.planning/current/review/status.json',
        '.planning/audits/current/codex.md',
        '.planning/audits/current/gemini.md',
        '.planning/audits/current/synthesis.md',
        '.planning/audits/current/gate-decision.md',
        '.planning/audits/current/meta.json',
      ]));
    });
  });

  test('reports and safely clears stale attached evidence without mutating command history', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const staleEvidence = [
        {
          path: qaPerfVerificationPath(),
          content: '# Perf Verification\n\n- stale\n',
        },
        {
          path: shipCanaryStatusPath(),
          content: JSON.stringify({ status: 'healthy' }, null, 2) + '\n',
        },
        {
          path: shipDeployResultPath(),
          content: JSON.stringify({ deploy_status: 'verified' }, null, 2) + '\n',
        },
        {
          path: closeoutDocumentationSyncPath(),
          content: '# Documentation Sync\n\n- stale\n',
        },
      ];

      for (const entry of staleEvidence) {
        mkdirSync(dirname(join(cwd, entry.path)), { recursive: true });
        writeFileSync(join(cwd, entry.path), entry.content);
      }

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        command_history: Array<{ command: string; at: string; via: string | null }>;
        artifact_index: Record<string, unknown>;
      };
      const originalHistory = structuredClone(ledger.command_history);
      ledger.artifact_index = {
        ...ledger.artifact_index,
        [qaPerfVerificationPath()]: { kind: 'markdown', path: qaPerfVerificationPath() },
        [shipCanaryStatusPath()]: { kind: 'json', path: shipCanaryStatusPath() },
        [shipDeployResultPath()]: { kind: 'json', path: shipDeployResultPath() },
        [closeoutDocumentationSyncPath()]: { kind: 'markdown', path: closeoutDocumentationSyncPath() },
      };
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      expect(buildLedgerDoctorReport(cwd)).toMatchObject({
        status: 'action_required',
        issues: [
          expect.objectContaining({
            code: 'stale_attached_evidence',
          }),
        ],
      });

      const fix = applySafeLedgerDoctorFix(cwd);
      expect(fix.fixed_issue_codes).toContain('stale_attached_evidence');
      expect(fix.fixed_paths).toEqual(expect.arrayContaining([
        qaPerfVerificationPath(),
        shipCanaryStatusPath(),
        shipDeployResultPath(),
        closeoutDocumentationSyncPath(),
      ]));
      expect(buildLedgerDoctorReport(cwd)).toEqual({
        status: 'clean',
        issues: [],
      });

      for (const entry of staleEvidence) {
        expect(existsSync(join(cwd, entry.path))).toBe(false);
      }

      const nextLedger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        command_history: Array<{ command: string; at: string; via: string | null }>;
        artifact_index: Record<string, unknown>;
      };
      expect(nextLedger.command_history).toEqual(originalHistory);
      expect(nextLedger.artifact_index[qaPerfVerificationPath()]).toBeUndefined();
      expect(nextLedger.artifact_index[shipCanaryStatusPath()]).toBeUndefined();
      expect(nextLedger.artifact_index[shipDeployResultPath()]).toBeUndefined();
      expect(nextLedger.artifact_index[closeoutDocumentationSyncPath()]).toBeUndefined();
    });
  });
});
