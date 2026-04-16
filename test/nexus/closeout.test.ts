import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../lib/nexus/adapters/types';
import type { ExecutionSelection } from '../../lib/nexus/execution-topology';
import { resolveInvocation } from '../../lib/nexus/commands/index';
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

      await expect(run('closeout')).rejects.toThrow('Illegal Nexus transition history');
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
        superpowers: {
          review_discipline: async () => ({
            adapter_id: 'superpowers',
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
        superpowers: {
          review_discipline: async () => ({
            adapter_id: 'superpowers',
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
              source_map: ['upstream/claude-code-bridge/lib/gemini_comm.py'],
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
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
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
              source_map: ['upstream/superpowers/skills/finishing-a-development-branch/SKILL.md'],
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

      await expect(run('closeout')).rejects.toThrow('Illegal Nexus transition history');
    });
  });

  test('normalizes a GSD closeout result only after Nexus closeout gates pass', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const adapters = makeFakeAdapters({
        gsd: {
          closeout: async () => ({
            adapter_id: 'gsd',
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
              source_map: ['upstream/gsd/commands/gsd/complete-milestone.md'],
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
        adapter_id: 'gsd',
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
        gsd: {
          closeout: async () => ({
            adapter_id: 'gsd',
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
              source_map: ['upstream/gsd/commands/gsd/complete-milestone.md'],
            },
          }),
        },
      });

      await expect(run('closeout', adapters)).rejects.toThrow('Missing archived audit artifact: meta.json');
    });
  });
});
