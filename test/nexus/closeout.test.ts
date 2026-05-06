import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import {
  archivedCurrentArtifactPath,
  closeoutDocumentationSyncPath,
  closeoutFollowOnSummaryJsonPath,
  closeoutFollowOnSummaryMarkdownPath,
  closeoutLearningsJsonPath,
  closeoutLearningsMarkdownPath,
  qaPerfVerificationPath,
  qaLearningCandidatesPath,
  reviewLearningCandidatesPath,
  shipCanaryStatusPath,
  shipDeployResultPath,
  shipLearningCandidatesPath,
} from '../../lib/nexus/artifacts';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import {
  collectRunLearnings,
  renderRunLearningsMarkdown,
} from '../../lib/nexus/learnings';
import type { NexusAdapters } from '../../lib/nexus/adapters/types';
import type { ExecutionSelection } from '../../lib/nexus/execution-topology';
import { resolveInvocation } from '../../lib/nexus/commands/index';
import { diagnoseCloseoutHistory } from '../../lib/nexus/governance';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

type TempGitRepoRun = {
  run: (command: string, adapters?: NexusAdapters, execution?: ExecutionSelection) => Promise<void>;
  readJson: (path: string) => any;
  cwd: string;
};

function createTempGitRepo(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-closeout-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });
  mkdirSync(join(cwd, '.ccb'), { recursive: true });
  writeFileSync(join(cwd, 'README.md'), '# temp repo\n');
  spawnSync('git', ['init', '-b', 'main'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['add', 'README.md'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd, stdio: 'pipe' });
  return cwd;
}

async function runInTempGitRepo(
  fn: (ctx: TempGitRepoRun) => Promise<void>,
): Promise<void> {
  const cwd = createTempGitRepo();
  let tick = 0;

  const run = async (
    command: string,
    adapters = getDefaultNexusAdapters(),
    execution: ExecutionSelection = {
      mode: 'governed_ccb',
      primary_provider: 'codex',
      provider_topology: 'multi_session',
      requested_execution_path: 'codex-via-ccb',
    },
  ) => {
    const invocation = resolveInvocation(command);
    const at = new Date(Date.UTC(2026, 3, 13, 12, 0, 0, tick)).toISOString();
    tick += 1;
    await invocation.handler({
      cwd,
      clock: () => at,
      via: invocation.via,
      adapters,
      execution,
      allow_stub_adapters: true,
    });
  };

  try {
    await fn({
      cwd,
      run,
      readJson: (path: string) => JSON.parse(readFileSync(join(cwd, path), 'utf8')),
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('nexus closeout', () => {
  test('collectRunLearnings dedupes by key and type with latest stage winner', () => {
    const record = collectRunLearnings({
      runId: 'run-1',
      generatedAt: '2026-04-16T00:00:00.000Z',
      candidates: [
        {
          path: '.planning/current/review/learning-candidates.json',
          stage: 'review',
          candidates: [
            {
              type: 'pitfall',
              key: 'same-key',
              insight: 'old',
              confidence: 6,
              source: 'observed',
              files: [],
            },
          ],
        },
        {
          path: '.planning/current/qa/learning-candidates.json',
          stage: 'qa',
          candidates: [
            {
              type: 'pitfall',
              key: 'same-key',
              insight: 'new',
              confidence: 8,
              source: 'observed',
              files: [],
            },
          ],
        },
      ],
    });

    expect(record.learnings).toEqual([
      {
        type: 'pitfall',
        key: 'same-key',
        insight: 'new',
        confidence: 8,
        source: 'observed',
        origin_stage: 'qa',
        files: [],
      },
    ]);
  });

  test('renderRunLearningsMarkdown groups learnings by type', () => {
    const markdown = renderRunLearningsMarkdown({
      schema_version: 1,
      run_id: 'run-1',
      generated_at: '2026-04-16T00:00:00.000Z',
      source_candidates: ['.planning/current/review/learning-candidates.json'],
      learnings: [
        {
          type: 'pattern',
          key: 'lock-owner-mutations',
          insight: 'Use database serialization for concurrent owner changes.',
          confidence: 8,
          source: 'observed',
          origin_stage: 'review',
          files: ['apps/web/src/server/workspaces/service.ts'],
        },
        {
          type: 'tool',
          key: 'prefer-bun-test-for-local-iteration',
          insight: 'Run targeted Bun tests during iteration to keep feedback tight.',
          confidence: 7,
          source: 'inferred',
          origin_stage: 'review',
          files: [],
        },
      ],
    });

    expect(markdown).toContain('# Run Learnings');
    expect(markdown).toContain('## Patterns');
    expect(markdown).toContain('## Tools');
    expect(markdown).toContain('lock-owner-mutations');
    expect(markdown).toContain('prefer-bun-test-for-local-iteration');
  });

  test('closeout marks the run workspace retired_pending_cleanup', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const ledger = readJson('.planning/nexus/current-run.json');
      expect(ledger.execution.workspace).toMatchObject({
        path: realpathSync.native(join(cwd, '.nexus-worktrees', ledger.run_id)),
        kind: 'worktree',
        source: 'allocated:fresh_run',
        retirement_state: 'retired_pending_cleanup',
      });
      expect(readJson('.planning/current/closeout/status.json')).toMatchObject({
        run_id: ledger.run_id,
        stage: 'closeout',
        state: 'completed',
        workspace: {
          path: realpathSync.native(join(cwd, '.nexus-worktrees', ledger.run_id)),
          retirement_state: 'retired_pending_cleanup',
        },
      });
    });
  });

  test('archives the current audit set and records closeout status', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const closeout = await run.readJson('.planning/current/closeout/status.json');
      expect(closeout).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        archive_required: true,
        archive_state: 'archived',
      });
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'Nexus-owned closeout guidance for archive verification, provenance consistency, and final readiness.',
      );
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'verify audit completeness',
      );
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'Closeout is the final governed conclusion of the work unit and must remain blocked if archive or provenance checks are inconsistent.',
      );
      expect(await run.readFile('.planning/current/closeout/NEXT-RUN.md')).toContain('Next Run Bootstrap');
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        previous_run_id: closeout.run_id,
        recommended_entrypoint: 'discover',
        recommended_continuation_mode: 'phase',
      });
      expect(readFileSync(join(cwd, '.planning/audits/archive', closeout.run_id, 'meta.json'), 'utf8')).toContain(
        closeout.run_id,
      );
    });
  });

  test('accepts qa fix-cycle history before ship during closeout validation', () => {
    const error = diagnoseCloseoutHistory(
      {
        command_history: [
          { command: 'discover', at: '2026-04-18T00:00:00.000Z', via: null },
          { command: 'frame', at: '2026-04-18T00:00:01.000Z', via: null },
          { command: 'plan', at: '2026-04-18T00:00:02.000Z', via: null },
          { command: 'handoff', at: '2026-04-18T00:00:03.000Z', via: null },
          { command: 'build', at: '2026-04-18T00:00:04.000Z', via: null },
          { command: 'review', at: '2026-04-18T00:00:05.000Z', via: null },
          { command: 'qa', at: '2026-04-18T00:00:06.000Z', via: null },
          { command: 'build', at: '2026-04-18T00:00:07.000Z', via: 'fix-cycle' },
          { command: 'review', at: '2026-04-18T00:00:08.000Z', via: null },
          { command: 'qa', at: '2026-04-18T00:00:09.000Z', via: null },
          { command: 'ship', at: '2026-04-18T00:00:10.000Z', via: null },
        ],
      } as any,
      { qaRecorded: true, shipRecorded: true },
    );

    expect(error).toBeNull();
  });

  test('indexes attached evidence into closeout continuity outputs', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');

      writeFileSync(
        join(cwd, qaPerfVerificationPath()),
        '# Perf Verification\n\n- P95 stayed under budget.\n',
      );
      writeFileSync(join(cwd, shipCanaryStatusPath()), JSON.stringify({
        status: 'healthy',
        summary: 'Canary stayed clean for 10 minutes.',
      }, null, 2) + '\n');
      writeFileSync(join(cwd, shipDeployResultPath()), JSON.stringify({
        source: 'land-and-deploy',
        deploy_status: 'verified',
        verification_status: 'healthy',
        production_url: 'https://example.com',
        summary: 'Deploy verified healthy in production.',
      }, null, 2) + '\n');
      mkdirSync(join(cwd, '.planning/current/closeout'), { recursive: true });
      writeFileSync(
        join(cwd, closeoutDocumentationSyncPath()),
        '# Documentation Sync\n\n- README updated for the shipped flow.\n',
      );

      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        inputs: expect.arrayContaining([
          expect.objectContaining({ path: qaPerfVerificationPath(), kind: 'markdown' }),
          expect.objectContaining({ path: shipCanaryStatusPath(), kind: 'json' }),
          expect.objectContaining({ path: shipDeployResultPath(), kind: 'json' }),
          expect.objectContaining({ path: closeoutDocumentationSyncPath(), kind: 'markdown' }),
        ]),
      });
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'QA perf verification: .planning/current/qa/perf-verification.md',
      );
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'Ship canary evidence: .planning/current/ship/canary-status.json',
      );
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'Deploy result evidence: .planning/current/ship/deploy-result.json',
      );
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'Documentation sync evidence: .planning/current/closeout/documentation-sync.md',
      );
      expect(await run.readJson(closeoutFollowOnSummaryJsonPath())).toMatchObject({
        source_artifacts: [
          qaPerfVerificationPath(),
          shipCanaryStatusPath(),
          shipDeployResultPath(),
          closeoutDocumentationSyncPath(),
        ],
        evidence: {
          qa: { perf_verification_path: qaPerfVerificationPath() },
          ship: {
            canary_status_path: shipCanaryStatusPath(),
            canary_status: 'healthy',
            deploy_result_path: shipDeployResultPath(),
            deploy_status: 'verified',
            verification_status: 'healthy',
            production_url: 'https://example.com',
          },
          closeout: { documentation_sync_path: closeoutDocumentationSyncPath() },
        },
      });
      expect(await run.readFile(closeoutFollowOnSummaryMarkdownPath())).toContain(
        'QA perf verification: .planning/current/qa/perf-verification.md',
      );
      expect(await run.readFile(closeoutFollowOnSummaryMarkdownPath())).toContain(
        'Deploy result: .planning/current/ship/deploy-result.json (verified)',
      );
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        summary: expect.stringContaining('Follow-on evidence summary recorded: yes.'),
      });
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        summary: expect.stringContaining('Ship canary evidence recorded: yes.'),
      });
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        summary: expect.stringContaining('Documentation sync recorded: yes.'),
      });
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        carry_forward_artifacts: expect.arrayContaining([
          expect.objectContaining({
            path: `.planning/archive/runs/${(await run.readJson('.planning/current/closeout/status.json')).run_id}/closeout/FOLLOW-ON-SUMMARY.md`,
          }),
          expect.objectContaining({
            path: `.planning/archive/runs/${(await run.readJson('.planning/current/closeout/status.json')).run_id}/closeout/follow-on-summary.json`,
          }),
        ]),
      });
    });
  });

  test('propagates land-and-deploy re-entry guidance into closeout bootstrap', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');

      writeFileSync(
        join(cwd, qaPerfVerificationPath()),
        '# Perf Verification\n\n- P95 stayed under budget.\n',
      );
      writeFileSync(join(cwd, shipCanaryStatusPath()), JSON.stringify({
        status: 'healthy',
        summary: 'Canary stayed clean for 10 minutes.',
      }, null, 2) + '\n');
      writeFileSync(join(cwd, shipDeployResultPath()), JSON.stringify({
        source: 'land-and-deploy',
        merge_status: 'pending',
        deploy_status: 'failed',
        verification_status: 'skipped',
        failure_kind: 'pre_merge_ci_failed',
        next_action: 'rerun_build_review_qa_ship',
        ship_handoff_current: true,
        ship_handoff_head_sha: 'abc123',
        pull_request_head_sha: 'def456',
        summary: 'Deploy blocked before merge because CI failed.',
      }, null, 2) + '\n');
      mkdirSync(join(cwd, '.planning/current/closeout'), { recursive: true });
      writeFileSync(
        join(cwd, closeoutDocumentationSyncPath()),
        '# Documentation Sync\n\n- README updated for the shipped flow.\n',
      );

      await run('closeout');
      const closeoutStatus = await run.readJson('.planning/current/closeout/status.json');
      const archivedRunId = closeoutStatus.run_id;
      const closeoutRecord = await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md');
      const followOnSummary = await run.readFile(closeoutFollowOnSummaryMarkdownPath());

      expect(closeoutRecord.match(/^## Landing Re-entry$/gm)).toHaveLength(1);
      expect(followOnSummary.match(/^## Landing Re-entry$/gm)).toHaveLength(1);
      expect(closeoutRecord).toContain(
        'Next action: rerun_build_review_qa_ship',
      );
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        landing_reentry: {
          next_action: 'rerun_build_review_qa_ship',
          ship_handoff_current: true,
          failure_kind: 'pre_merge_ci_failed',
        },
        summary: expect.stringContaining('Landing re-entry guidance: next_action=rerun_build_review_qa_ship'),
        carry_forward_artifacts: expect.arrayContaining([
          expect.objectContaining({
            path: `.planning/archive/runs/${archivedRunId}/ship/deploy-result.json`,
          }),
        ]),
      });
    });
  });

  test('archives raw attached QA and ship evidence into the archived run root', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');

      writeFileSync(
        join(cwd, qaPerfVerificationPath()),
        '# Perf Verification\n\n- P95 stayed under budget.\n',
      );
      writeFileSync(join(cwd, shipCanaryStatusPath()), JSON.stringify({
        status: 'healthy',
        summary: 'Canary stayed clean for 10 minutes.',
      }, null, 2) + '\n');
      writeFileSync(join(cwd, shipDeployResultPath()), JSON.stringify({
        source: 'land-and-deploy',
        deploy_status: 'verified',
        summary: 'Deploy verified healthy in production.',
      }, null, 2) + '\n');

      await run('closeout');
      const closeoutStatus = await run.readJson('.planning/current/closeout/status.json');
      const archivedRunId = closeoutStatus.run_id;

      await run('discover');

      expect(await run.readFile(
        archivedCurrentArtifactPath(archivedRunId, qaPerfVerificationPath()),
      )).toContain('P95 stayed under budget.');
      expect(await run.readJson(
        archivedCurrentArtifactPath(archivedRunId, shipCanaryStatusPath()),
      )).toMatchObject({
        status: 'healthy',
      });
      expect(await run.readJson(
        archivedCurrentArtifactPath(archivedRunId, shipDeployResultPath()),
      )).toMatchObject({
        source: 'land-and-deploy',
        deploy_status: 'verified',
      });
    });
  });

  test('aggregates review, qa, and ship learning candidates into closeout learnings', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      const sharedCandidateReview = {
        type: 'pattern' as const,
        key: 'shared-learning',
        insight: 'Review observes the pattern first.',
        confidence: 6,
        source: 'observed' as const,
        files: ['review.ts'],
      };
      const sharedCandidateQa = {
        type: 'pattern' as const,
        key: 'shared-learning',
        insight: 'QA confirms the pattern.',
        confidence: 7,
        source: 'observed' as const,
        files: ['qa.ts'],
      };
      const sharedCandidateShip = {
        type: 'pattern' as const,
        key: 'shared-learning',
        insight: 'Ship wins the final tie-breaker.',
        confidence: 9,
        source: 'observed' as const,
        files: ['ship.ts'],
      };
      const reviewOnlyCandidate = {
        type: 'tool' as const,
        key: 'review-only',
        insight: 'Review adds an extra tool lesson.',
        confidence: 5,
        source: 'inferred' as const,
        files: ['review.ts'],
      };

      const reviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n',
              receipt: 'codex-review-receipt',
              learning_candidates: [sharedCandidateReview, reviewOnlyCandidate],
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      const qaAdapters = makeFakeAdapters({
        ccb: {
          execute_qa: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              ready: true,
              findings: [],
              report_markdown: '# QA Report\n',
              receipt: 'qa-receipt',
              learning_candidates: [sharedCandidateQa],
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.generator ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/qa/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      const shipAdapters = makeFakeAdapters({
        execution: {
          ship_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate\n\nResult: pass\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
              learning_candidates: [sharedCandidateShip],
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await run('build');
      await run('review', reviewAdapters);
      await run('qa', qaAdapters);
      await run('ship', shipAdapters);
      await run('closeout');

      const closeoutStatus = await run.readJson('.planning/current/closeout/status.json');
      const closeoutLearnings = await run.readJson(closeoutLearningsJsonPath());
      const closeoutMarkdown = await run.readFile(closeoutLearningsMarkdownPath());

      expect(closeoutStatus).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        learnings_recorded: true,
      });
      expect(closeoutStatus.outputs).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: closeoutLearningsMarkdownPath() }),
        expect.objectContaining({ path: closeoutLearningsJsonPath() }),
      ]));
      expect(closeoutStatus.inputs).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: reviewLearningCandidatesPath() }),
        expect.objectContaining({ path: qaLearningCandidatesPath() }),
        expect.objectContaining({ path: shipLearningCandidatesPath() }),
      ]));
      expect(closeoutLearnings).toMatchObject({
        run_id: closeoutStatus.run_id,
        source_candidates: [
          reviewLearningCandidatesPath(),
          qaLearningCandidatesPath(),
          shipLearningCandidatesPath(),
        ],
        learnings: [
          {
            type: 'pattern',
            key: 'shared-learning',
            origin_stage: 'ship',
            insight: 'Ship wins the final tie-breaker.',
          },
          {
            type: 'tool',
            key: 'review-only',
            origin_stage: 'review',
          },
        ],
      });
      expect(closeoutMarkdown).toContain('# Run Learnings');
      expect(closeoutMarkdown).toContain('review-only');
      expect(closeoutMarkdown).toContain('shared-learning');
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        artifact_index: expect.objectContaining({
          [closeoutLearningsMarkdownPath()]: {
            kind: 'markdown',
            path: closeoutLearningsMarkdownPath(),
          },
          [closeoutLearningsJsonPath()]: {
            kind: 'json',
            path: closeoutLearningsJsonPath(),
          },
        }),
      });
      expect(existsSync(join(cwd, closeoutLearningsMarkdownPath()))).toBe(true);
      expect(existsSync(join(cwd, closeoutLearningsJsonPath()))).toBe(true);

      const archivedRunId = closeoutStatus.run_id;
      await run('discover');

      expect(await run.readFile(
        join('.planning/archive/runs', archivedRunId, 'closeout', 'LEARNINGS.md'),
      )).toContain('shared-learning');
      expect(await run.readJson(
        join('.planning/archive/runs', archivedRunId, 'closeout', 'learnings.json'),
      )).toMatchObject({
        run_id: archivedRunId,
        learnings: expect.arrayContaining([
          expect.objectContaining({ key: 'shared-learning', origin_stage: 'ship' }),
        ]),
      });
    });
  });

  test('removes stale closeout learning artifacts when no candidates remain', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');

      const staleMarkdownPath = join(cwd, closeoutLearningsMarkdownPath());
      const staleJsonPath = join(cwd, closeoutLearningsJsonPath());
      mkdirSync(join(cwd, '.planning', 'current', 'closeout'), { recursive: true });
      writeFileSync(staleMarkdownPath, '# stale\n');
      writeFileSync(staleJsonPath, '{"stale":true}\n');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        artifact_index: Record<string, { kind: string; path: string }>;
      };
      ledger.artifact_index[closeoutLearningsMarkdownPath()] = {
        kind: 'markdown',
        path: closeoutLearningsMarkdownPath(),
      };
      ledger.artifact_index[closeoutLearningsJsonPath()] = {
        kind: 'json',
        path: closeoutLearningsJsonPath(),
      };
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await run('closeout');

      const closeoutStatus = await run.readJson('.planning/current/closeout/status.json');
      const updatedLedger = await run.readJson('.planning/nexus/current-run.json');

      expect(closeoutStatus).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        learnings_recorded: false,
      });
      expect(closeoutStatus.outputs).toEqual(expect.not.arrayContaining([
        expect.objectContaining({ path: closeoutLearningsMarkdownPath() }),
        expect.objectContaining({ path: closeoutLearningsJsonPath() }),
      ]));
      expect(updatedLedger.artifact_index[closeoutLearningsMarkdownPath()]).toBeUndefined();
      expect(updatedLedger.artifact_index[closeoutLearningsJsonPath()]).toBeUndefined();
      expect(existsSync(staleMarkdownPath)).toBe(false);
      expect(existsSync(staleJsonPath)).toBe(false);
    });
  });

  test('ignores malformed learning candidates when building closeout learnings', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      mkdirSync(join(cwd, '.planning', 'current', 'review'), { recursive: true });
      writeFileSync(
        join(cwd, reviewLearningCandidatesPath()),
        JSON.stringify(
          {
            schema_version: 1,
            run_id: (await run.readJson('.planning/nexus/current-run.json')).run_id,
            stage: 'review',
            generated_at: '2026-04-16T00:00:00.000Z',
            candidates: [
              {
                type: 'pattern',
                key: 'valid-learning',
                insight: 'Only valid candidates should survive.',
                confidence: 8,
                source: 'observed',
                files: ['review.ts'],
              },
              {
                type: 'pattern',
                key: '',
                insight: 42,
                confidence: 'high',
                source: 'observed',
                files: [null],
              },
            ],
          },
          null,
          2,
        ) + '\n',
      );

      await run('closeout');

      expect(await run.readJson(closeoutLearningsJsonPath())).toMatchObject({
        learnings: [
          expect.objectContaining({
            key: 'valid-learning',
            origin_stage: 'review',
          }),
        ],
      });
      expect(await run.readFile(closeoutLearningsMarkdownPath())).toContain('valid-learning');
      expect(await run.readFile(closeoutLearningsMarkdownPath())).not.toContain('undefined');
    });
  });

  test('discover archive replaces stale archived closeout learnings when current closeout has none', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const runId = (await run.readJson('.planning/current/closeout/status.json')).run_id as string;
      const archivedCloseoutRoot = join(cwd, '.planning/archive/runs', runId, 'closeout');
      mkdirSync(archivedCloseoutRoot, { recursive: true });
      writeFileSync(join(archivedCloseoutRoot, 'LEARNINGS.md'), '# stale archived learnings\n');
      writeFileSync(join(archivedCloseoutRoot, 'learnings.json'), '{"stale":true}\n');

      await run('discover');

      expect(existsSync(join(archivedCloseoutRoot, 'LEARNINGS.md'))).toBe(false);
      expect(existsSync(join(archivedCloseoutRoot, 'learnings.json'))).toBe(false);
      expect(existsSync(join(archivedCloseoutRoot, 'status.json'))).toBe(true);
    });
  });

  test('clears stale closeout learnings when the GSD closeout adapter blocks', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const staleMarkdownPath = join(cwd, closeoutLearningsMarkdownPath());
      const staleJsonPath = join(cwd, closeoutLearningsJsonPath());
      mkdirSync(join(cwd, '.planning', 'current', 'closeout'), { recursive: true });
      writeFileSync(staleMarkdownPath, '# stale\n');
      writeFileSync(staleJsonPath, '{"stale":true}\n');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        artifact_index: Record<string, { kind: string; path: string }>;
      };
      ledger.artifact_index[closeoutLearningsMarkdownPath()] = {
        kind: 'markdown',
        path: closeoutLearningsMarkdownPath(),
      };
      ledger.artifact_index[closeoutLearningsJsonPath()] = {
        kind: 'json',
        path: closeoutLearningsJsonPath(),
      };
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      const adapters = makeFakeAdapters({
        planning: {
          closeout: async () => ({
            adapter_id: 'planning',
            outcome: 'blocked',
            raw_output: {
              closeout_record: '# Closeout Record\n\nResult: blocked\n',
              archive_required: true,
              merge_ready: false,
            },
            requested_route: null,
            actual_route: null,
            notices: ['Closeout blocked'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('closeout', adapters)).rejects.toThrow('GSD closeout blocked');
      expect(existsSync(staleMarkdownPath)).toBe(false);
      expect(existsSync(staleJsonPath)).toBe(false);
      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'blocked',
        learnings_recorded: false,
      });
      const updatedLedger = await run.readJson('.planning/nexus/current-run.json');
      expect(updatedLedger.artifact_index[closeoutLearningsMarkdownPath()]).toBeUndefined();
      expect(updatedLedger.artifact_index[closeoutLearningsJsonPath()]).toBeUndefined();
    });
  });

  test('rejects illegal transition history', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        command_history: Array<{ command: string; at: string; via: string | null }>;
      };
      ledger.command_history = ledger.command_history.filter((entry) => entry.command !== 'handoff');
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow(
        'Illegal Nexus transition history: expected plan -> handoff -> build -> review prefix, got plan -> build -> review',
      );
    });
  });

  test('diagnoses consecutive build entries in a fix-cycle history', async () => {
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
          at: new Date(Date.UTC(2026, 3, 13, 12, 0, 0, 999)).toISOString(),
          via: 'fix-cycle',
        },
        ledger.command_history[3]!,
      ];
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow(
        'Illegal Nexus transition history: expected review after build at positions 3 -> 4, got build',
      );
    });
  });

  test('rejects inconsistent reviewed provenance', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const metaPath = join(cwd, '.planning/audits/current/meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        implementation: {
          requested_route: {
            generator: string;
          };
        };
      };
      meta.implementation.requested_route.generator = 'local-claude';
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow('Reviewed provenance route does not match ledger route intent');
    });
  });

  test('prefers nested implementation provenance over flat compatibility fields', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const metaPath = join(cwd, '.planning/audits/current/meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        implementation_route: string;
        implementation_substrate: string;
      };
      meta.implementation_route = 'local-claude';
      meta.implementation_substrate = 'local-agent';
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('keeps working when review writes nested audit provenance', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const metaPath = join(cwd, '.planning/audits/current/meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        audits: {
          codex: {
            provider: string;
            requested_route: { route: string };
            actual_route: { route: string };
          };
          gemini: {
            provider: string;
            requested_route: { route: string };
            actual_route: { route: string };
          };
        };
      };

      expect(meta.audits.codex.provider).toBe('codex');
      expect(meta.audits.codex.requested_route.route).toBe('codex-via-ccb');
      expect(meta.audits.codex.actual_route.route).toBe('codex-via-ccb');
      expect(meta.audits.gemini.provider).toBe('gemini');
      expect(meta.audits.gemini.requested_route.route).toBe('gemini-via-ccb');
      expect(meta.audits.gemini.actual_route.route).toBe('gemini-via-ccb');

      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('allows closeout after a governed fix cycle build and final passing review', async () => {
    await runInTempRepo(async ({ run }) => {
      const failingReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Fix the bounded build output.\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await run('build');
      await run('review', failingReviewAdapters);
      await run('build');
      await run('review');
      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('allows closeout after a review retry without an intervening rebuild', async () => {
    await runInTempRepo(async ({ run }) => {
      const failingReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: fail\n\nFindings:\n- stale audit\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await run('build');
      await run('review', failingReviewAdapters);
      await run('review');
      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('allows closeout after a ready QA stage', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('blocks closeout when QA exists and is not ready', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const adapters = makeFakeAdapters({
        ccb: {
          execute_qa: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              report_markdown: '# QA Report\n\nResult: fail\n\n- Login form is broken\n',
              ready: false,
              findings: ['Login form is broken'],
              receipt: 'qa-fail',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.generator ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/qa/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-qa-pack',
              absorbed_capability: 'ccb-qa',
              source_map: [],
            },
          }),
        },
      });

      await run('qa', adapters);
      await expect(run('closeout')).rejects.toThrow('QA must be ready before closeout');
    });
  });

  test('allows closeout after a ready ship stage', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('ship');
      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('allows closeout after the full discover-to-ship governed lifecycle', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('blocks closeout when ship exists and is not ready', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const shipAdapters = makeFakeAdapters({
        execution: {
          ship_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: blocked\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: false,
              },
              merge_ready: false,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-ship-pack',
              absorbed_capability: 'superpowers-ship-discipline',
              source_map: [],
            },
          }),
        },
      });

      await run('ship', shipAdapters);
      await expect(run('closeout')).rejects.toThrow('Ship must be ready before closeout');
    });
  });

  test('rejects illegal tail-stage history when ship is recorded without its legal predecessor chain', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('ship');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        command_history: Array<{ command: string; at: string; via: string | null }>;
      };
      ledger.command_history = [
        { command: 'plan', at: ledger.command_history[0]!.at, via: null },
        { command: 'handoff', at: ledger.command_history[1]!.at, via: null },
        { command: 'build', at: ledger.command_history[2]!.at, via: null },
        { command: 'ship', at: ledger.command_history.at(-1)!.at, via: null },
      ];
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow(
        'Illegal Nexus transition history: expected review after build at positions 3 -> 4, got ship',
      );
    });
  });

  test('normalizes a GSD closeout result only after Nexus closeout gates pass', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const adapters = makeFakeAdapters({
        planning: {
          closeout: async () => ({
            adapter_id: 'planning',
            outcome: 'success',
            raw_output: {
              closeout_record: '# Closeout Record\n\nResult: merge ready\n',
              archive_required: true,
              merge_ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-closeout-pack',
              absorbed_capability: 'gsd-closeout',
              source_map: [],
            },
          }),
        },
      });

      await run('closeout', adapters);

      const closeout = await run.readJson('.planning/current/closeout/status.json');
      expect(closeout).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        archive_required: true,
        archive_state: 'archived',
        provenance_consistent: true,
      });
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain('merge ready');
      expect(await run.readJson('.planning/current/closeout/adapter-output.json')).toMatchObject({
        adapter_id: 'planning',
        outcome: 'success',
        traceability: {
          nexus_stage_pack: 'nexus-closeout-pack',
          absorbed_capability: 'gsd-closeout',
        },
      });
      expect(readFileSync(join(cwd, '.planning/audits/archive', closeout.run_id, 'meta.json'), 'utf8')).toContain(
        closeout.run_id,
      );
    });
  });

  test('blocks closeout when the archive is required but missing', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const runId = (await run.readJson('.planning/current/review/status.json')).run_id as string;
      const archiveRoot = join(cwd, '.planning/audits/archive', runId);
      mkdirSync(archiveRoot, { recursive: true });
      for (const file of ['codex.md', 'gemini.md', 'synthesis.md', 'gate-decision.md']) {
        writeFileSync(join(archiveRoot, file), '# archived\n');
      }
      const archiveMetaPath = join(cwd, '.planning/audits/archive', runId, 'meta.json');
      writeFileSync(archiveMetaPath, '');

      const adapters = makeFakeAdapters({
        planning: {
          closeout: async () => ({
            adapter_id: 'planning',
            outcome: 'success',
            raw_output: {
              closeout_record: '# Closeout Record\n\nResult: merge ready\n',
              archive_required: true,
              merge_ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-closeout-pack',
              absorbed_capability: 'gsd-closeout',
              source_map: [],
            },
          }),
        },
      });

      await expect(run('closeout', adapters)).rejects.toThrow('Missing archived audit artifact: meta.json');
    });
  });
});
