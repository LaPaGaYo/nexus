import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import { createBuildStagePack } from '../../lib/nexus/stage-packs/build';
import { createHandoffStagePack } from '../../lib/nexus/stage-packs/handoff';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../lib/nexus/adapters/types';
import type { ExecutionSelection } from '../../lib/nexus/execution-topology';
import { resolveInvocation } from '../../lib/nexus/commands/index';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

type TempGitRepoRun = {
  run: (command: string, adapters?: NexusAdapters, execution?: ExecutionSelection) => Promise<void>;
  readJson: (path: string) => any;
  writeJson: (path: string, value: unknown) => void;
  cwd: string;
};

function createTempGitRepo(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-build-routing-'));
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

function createLinkedWorktree(
  repoRoot: string,
  worktreeRoot: '.nexus-worktrees' | '.worktrees',
  name = 'implement',
  branch = 'feature/implement',
): string {
  const base = join(repoRoot, worktreeRoot);
  mkdirSync(base, { recursive: true });
  spawnSync('git', ['branch', branch], { cwd: repoRoot, stdio: 'pipe' });
  const worktreePath = join(base, name);
  const result = spawnSync('git', ['worktree', 'add', worktreePath, branch], {
    cwd: repoRoot,
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.toString() || result.stdout.toString() || 'failed to create linked worktree');
  }

  return worktreePath;
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
      writeJson: (path: string, value: unknown) => {
        mkdirSync(dirname(join(cwd, path)), { recursive: true });
        writeFileSync(join(cwd, path), JSON.stringify(value, null, 2) + '\n');
      },
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('nexus build routing', () => {
  test('build and handoff stage packs stay Nexus-owned internal units', () => {
    const handoffPack = createHandoffStagePack();
    const buildPack = createBuildStagePack();

    expect(handoffPack.id).toBe('nexus-handoff-pack');
    expect(handoffPack.stage).toBe('handoff');
    expect(handoffPack.source_binding.absorbed_capabilities).toContain('ccb-routing');

    expect(buildPack.id).toBe('nexus-build-pack');
    expect(buildPack.stage).toBe('build');
    expect(buildPack.source_binding.absorbed_capabilities).toContain('superpowers-build-discipline');
    expect(buildPack.source_binding.absorbed_capabilities).toContain('ccb-execution');
  });

  test('records route availability and explicit Nexus approval as separate fields', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              available: true,
              provider: 'codex',
              providers: ['codex', 'gemini'],
              mounted: ['codex', 'gemini'],
              provider_checks: [
                {
                  provider: 'codex',
                  ping_command: 'ccb-ping codex',
                  ping_output: '✅ codex connection OK (Session healthy)',
                },
                {
                  provider: 'gemini',
                  ping_command: 'ccb-ping gemini',
                  ping_output: '✅ gemini connection OK (Session healthy)',
                },
              ],
            },
            requested_route: null,
            actual_route: {
              provider: 'codex',
              route: 'codex-via-ccb',
              substrate: 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/handoff/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-handoff-pack',
              absorbed_capability: 'ccb-routing',
              source_map: ['upstream/claude-code-bridge/lib/providers.py'],
            },
          }),
        },
      });

      await run('plan');
      await run('handoff', adapters);

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        requested_route: {
          command: 'build',
          governed: true,
          generator: 'codex-via-ccb',
          substrate: 'superpowers-core',
          fallback_policy: 'disabled',
        },
        route_validation: {
          transport: 'ccb',
          available: true,
          approved: true,
          reason: 'Nexus approved the requested governed route',
          mounted_providers: ['codex', 'gemini'],
          provider_checks: [
            {
              provider: 'codex',
              available: true,
              mounted: true,
              reason: 'CCB codex route check passed',
            },
            {
              provider: 'gemini',
              available: true,
              mounted: true,
              reason: 'CCB gemini route check passed',
            },
          ],
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'handoff',
        route_check: {
          checked_at: expect.any(String),
          requested_route: {
            command: 'build',
            governed: true,
            generator: 'codex-via-ccb',
            evaluator_b: 'gemini-via-ccb',
            substrate: 'superpowers-core',
            fallback_policy: 'disabled',
          },
          route_validation: {
            transport: 'ccb',
            available: true,
            approved: true,
            reason: 'Nexus approved the requested governed route',
            mounted_providers: ['codex', 'gemini'],
            provider_checks: [
              {
                provider: 'codex',
                available: true,
                mounted: true,
                reason: 'CCB codex route check passed',
              },
              {
                provider: 'gemini',
                available: true,
                mounted: true,
                reason: 'CCB gemini route check passed',
              },
            ],
          },
        },
      });
      expect(await run.readJson('.planning/current/handoff/adapter-output.json')).toMatchObject({
        adapter_id: 'ccb',
        traceability: {
          nexus_stage_pack: 'nexus-handoff-pack',
          absorbed_capability: 'ccb-routing',
        },
      });
    });
  });

  test('blocks handoff when CCB reports the requested route unavailable', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              available: false,
              provider: 'codex',
              providers: ['codex', 'gemini'],
              mounted: ['codex'],
              provider_checks: [
                {
                  provider: 'codex',
                  ping_command: 'ccb-ping codex',
                  ping_output: '✅ codex connection OK (Session healthy)',
                },
                {
                  provider: 'gemini',
                  ping_command: 'ccb-ping gemini',
                  ping_output: '✅ gemini connection OK (Session healthy)',
                },
              ],
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await expect(run('handoff', adapters)).rejects.toThrow('Governed route is not approved by Nexus');

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        state: 'blocked',
        ready: false,
        route_validation: {
          transport: 'ccb',
          available: false,
          approved: false,
          reason: 'CCB reported the requested route unavailable',
          mounted_providers: ['codex'],
          provider_checks: [
            {
              provider: 'codex',
              available: true,
              mounted: true,
              reason: 'CCB codex route check passed',
            },
            {
              provider: 'gemini',
              available: false,
              mounted: false,
              reason: 'CCB mounted providers do not include gemini',
            },
          ],
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'handoff',
        allowed_next_stages: ['handoff'],
        route_check: {
          checked_at: expect.any(String),
          requested_route: {
            command: 'build',
            governed: true,
            generator: 'codex-via-ccb',
            evaluator_b: 'gemini-via-ccb',
            substrate: 'superpowers-core',
            fallback_policy: 'disabled',
          },
          route_validation: {
            transport: 'ccb',
            available: false,
            approved: false,
            reason: 'CCB reported the requested route unavailable',
            mounted_providers: ['codex'],
            provider_checks: [
              {
                provider: 'codex',
                available: true,
                mounted: true,
                reason: 'CCB codex route check passed',
              },
              {
                provider: 'gemini',
                available: false,
                mounted: false,
                reason: 'CCB mounted providers do not include gemini',
              },
            ],
          },
        },
      });
      expect(await run.readJson('.planning/current/conflicts/handoff-ccb.json')).toMatchObject({
        stage: 'handoff',
        adapter: 'ccb',
        kind: 'backend_conflict',
      });
    });
  });

  test('allows retrying handoff directly after a blocked governed route check', async () => {
    await runInTempRepo(async ({ run }) => {
      let attempts = 0;
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async () => {
            attempts += 1;

            if (attempts === 1) {
              return {
                adapter_id: 'ccb',
                outcome: 'success',
                raw_output: {
                  available: false,
                  provider: 'codex',
                  providers: ['codex', 'gemini'],
                  mounted: ['codex'],
                  provider_checks: [
                    {
                      provider: 'codex',
                      ping_command: 'ccb-ping codex',
                      ping_output: '✅ codex connection OK (Session healthy)',
                    },
                    {
                      provider: 'gemini',
                      ping_command: 'ccb-ping gemini',
                      ping_output: '❌ gemini unavailable',
                    },
                  ],
                },
                requested_route: null,
                actual_route: null,
                notices: [],
                conflict_candidates: [],
              };
            }

            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                available: true,
                provider: 'codex',
                providers: ['codex', 'gemini'],
                mounted: ['codex', 'gemini'],
                provider_checks: [
                  {
                    provider: 'codex',
                    ping_command: 'ccb-ping codex',
                    ping_output: '✅ codex connection OK (Session healthy)',
                  },
                  {
                    provider: 'gemini',
                    ping_command: 'ccb-ping gemini',
                    ping_output: '✅ gemini connection OK (Session healthy)',
                  },
                ],
              },
              requested_route: null,
              actual_route: null,
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('plan');
      await expect(run('handoff', adapters)).rejects.toThrow('Governed route is not approved by Nexus');

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'handoff',
        current_command: 'handoff',
        allowed_next_stages: ['handoff'],
      });

      await run('handoff', adapters);

      expect(attempts).toBe(2);
      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        state: 'completed',
        ready: true,
        route_validation: {
          transport: 'ccb',
          available: true,
          approved: true,
          mounted_providers: ['codex', 'gemini'],
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'active',
        current_stage: 'handoff',
        current_command: 'handoff',
        allowed_next_stages: ['handoff', 'build'],
        command_history: [
          expect.objectContaining({ command: 'plan' }),
          expect.objectContaining({ command: 'handoff', via: null }),
          expect.objectContaining({ command: 'handoff', via: 'refresh' }),
        ],
      });
    });
  });

  test('fresh handoff ignores prior-run handoff workspace artifacts', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson, writeJson }) => {
      const staleWorktreePath = createLinkedWorktree(cwd, '.worktrees');
      const seen: Array<{ workspace: unknown; ledgerWorkspace: unknown; ledgerSessionRoot: unknown }> = [];
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => {
            seen.push({
              workspace: ctx.workspace,
              ledgerWorkspace: ctx.ledger.execution.workspace,
              ledgerSessionRoot: ctx.ledger.execution.session_root,
            });

            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                available: true,
                provider: 'codex',
                providers: ['codex', 'gemini'],
                mounted: ['codex', 'gemini'],
                provider_checks: [
                  {
                    provider: 'codex',
                    ping_command: 'ccb-ping codex',
                    ping_output: '✅ codex connection OK (Session healthy)',
                  },
                  {
                    provider: 'gemini',
                    ping_command: 'ccb-ping gemini',
                    ping_output: '✅ gemini connection OK (Session healthy)',
                  },
                ],
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'codex',
                route: 'codex-via-ccb',
                substrate: 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/handoff/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('discover');
      await run('frame');
      await run('plan');

      writeJson('.planning/current/handoff/status.json', {
        run_id: 'run-stale',
        stage: 'handoff',
        state: 'completed',
        decision: 'route_recorded',
        ready: true,
        workspace: {
          path: realpathSync.native(staleWorktreePath),
          kind: 'worktree',
          branch: 'feature/implement',
          source: 'existing:legacy_worktree',
        },
        session_root: {
          path: realpathSync.native(cwd),
          kind: 'repo_root',
          source: 'ccb_root',
        },
        requested_route: {
          command: 'build',
          governed: true,
          execution_mode: 'governed_ccb',
          primary_provider: 'codex',
          provider_topology: 'multi_session',
          planner: 'claude+pm-gsd',
          generator: 'codex-via-ccb',
          evaluator_a: 'codex-via-ccb',
          evaluator_b: 'gemini-via-ccb',
          synthesizer: 'claude',
          substrate: 'superpowers-core',
          transport: 'ccb',
          fallback_policy: 'disabled',
        },
      });

      await run('handoff', adapters);

      const ledger = readJson('.planning/nexus/current-run.json');
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({
        workspace: ledger.execution.workspace,
        ledgerWorkspace: ledger.execution.workspace,
        ledgerSessionRoot: ledger.execution.session_root,
      });
      expect((seen[0]?.workspace as { path: string }).path).not.toBe(realpathSync.native(staleWorktreePath));
      expect((seen[0]?.workspace as { path: string }).path).toContain(`${realpathSync.native(cwd)}/.nexus-worktrees/`);
    });
  });

  test('records requested and actual route separately on successful build', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      expect(await run.readJson('.planning/current/build/build-request.json')).toMatchObject({
        requested_route: {
          command: 'build',
          governed: true,
          generator: 'codex-via-ccb',
          substrate: 'superpowers-core',
          fallback_policy: 'disabled',
        },
      });
      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        requested_route: {
          command: 'build',
          generator: 'codex-via-ccb',
        },
        actual_route: {
          provider: 'codex',
          route: 'codex-via-ccb',
          substrate: 'superpowers-core',
          transport: 'ccb',
          receipt_path: '.planning/current/build/adapter-output.json',
        },
      });
    });
  });

  test('build prefers the ledger run workspace over a conflicting handoff status workspace', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson, writeJson }) => {
      const staleWorktreePath = createLinkedWorktree(cwd, '.worktrees');
      const seen: Array<{ stage: string; workspace: unknown; ledgerWorkspace: unknown }> = [];
      const adapters = makeFakeAdapters({
        superpowers: {
          build_discipline: async (ctx) => {
            seen.push({
              stage: 'discipline',
              workspace: ctx.workspace,
              ledgerWorkspace: ctx.ledger.execution.workspace,
            });
            return {
              adapter_id: 'superpowers',
              outcome: 'success',
              raw_output: { verification_summary: 'ok' },
              requested_route: null,
              actual_route: null,
              notices: [],
              conflict_candidates: [],
            };
          },
        },
        ccb: {
          execute_generator: async (ctx) => {
            seen.push({
              stage: 'generator',
              workspace: ctx.workspace,
              ledgerWorkspace: ctx.ledger.execution.workspace,
            });
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                receipt: 'ccb-build',
                summary_markdown: '# Build Execution Summary\n\n- Status: completed\n- Actions: Implemented bounded build.\n- Files touched: README.md\n- Verification: ok\n',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'codex',
                route: 'codex-via-ccb',
                substrate: 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/build/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');

      const ledgerWorkspace = readJson('.planning/nexus/current-run.json').execution.workspace;
      const handoffStatus = readJson('.planning/current/handoff/status.json');
      writeJson('.planning/current/handoff/status.json', {
        ...handoffStatus,
        workspace: {
          path: realpathSync.native(staleWorktreePath),
          kind: 'worktree',
          branch: 'feature/implement',
          source: 'existing:legacy_worktree',
        },
      });

      await run('build', adapters);

      expect(seen).toEqual([
        { stage: 'discipline', workspace: ledgerWorkspace, ledgerWorkspace },
        { stage: 'generator', workspace: ledgerWorkspace, ledgerWorkspace },
      ]);
    });
  });

  test('blocks build when requested and actual route diverge', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          execute_generator: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: { receipt: 'ccb-1' },
            requested_route: {
              command: 'build',
              governed: true,
              planner: 'claude+pm-gsd',
              generator: 'codex-via-ccb',
              evaluator_a: 'codex-via-ccb',
              evaluator_b: 'gemini-via-ccb',
              synthesizer: 'claude',
              substrate: 'superpowers-core',
              fallback_policy: 'disabled',
            },
            actual_route: {
              provider: 'claude',
              route: 'local-claude',
              substrate: 'local-agent',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await expect(run('build', adapters)).rejects.toThrow('Requested and actual route diverged');

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'blocked',
        ready: false,
        requested_route: {
          command: 'build',
          generator: 'codex-via-ccb',
        },
        actual_route: {
          provider: 'claude',
          route: 'local-claude',
        },
      });
      expect(await run.readJson('.planning/current/conflicts/build-ccb.json')).toMatchObject({
        stage: 'build',
        adapter: 'ccb',
        kind: 'route_mismatch',
      });
    });
  });

  test('blocks build locally when governed handoff is missing per-provider verification', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      let dispatched = false;
      const adapters = makeFakeAdapters({
        ccb: {
          execute_generator: async () => {
            dispatched = true;
            throw new Error('build dispatch should not run when handoff contract is stale');
          },
        },
      });

      await run('plan');
      await run('handoff');

      const handoffStatusPath = join(cwd, '.planning/current/handoff/status.json');
      const legacyHandoffStatus = await run.readJson('.planning/current/handoff/status.json');
      writeFileSync(
        handoffStatusPath,
        JSON.stringify(
          {
            ...legacyHandoffStatus,
            route_validation: {
              transport: 'ccb',
              available: true,
              approved: true,
              reason: 'Legacy flat route validation',
            },
          },
          null,
          2,
        ) + '\n',
      );

      await expect(run('build', adapters)).rejects.toThrow(
        'Governed handoff contract does not record verification for required provider(s): codex, gemini. Rerun /handoff with the current Nexus version before /build.',
      );

      expect(dispatched).toBe(false);
      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'blocked',
        ready: false,
        errors: [
          'Governed handoff contract does not record verification for required provider(s): codex, gemini. Rerun /handoff with the current Nexus version before /build.',
        ],
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'handoff',
        current_command: 'handoff',
        allowed_next_stages: ['handoff'],
      });
    });
  });

  test('blocks build when generator reports a blocked build summary', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          execute_generator: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              receipt: 'ccb-build-codex-1',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: blocked',
                '- Actions: The governed contract is inconsistent with the current checkout.',
                '- Files touched: none',
                '- Verification: Fresh reads of the handoff packet show the build cannot proceed as-is.',
              ].join('\n'),
            },
            requested_route: {
              command: 'build',
              governed: true,
              planner: 'claude+pm-gsd',
              generator: 'codex-via-ccb',
              evaluator_a: 'codex-via-ccb',
              evaluator_b: 'gemini-via-ccb',
              synthesizer: 'claude',
              substrate: 'superpowers-core',
              fallback_policy: 'disabled',
            },
            actual_route: {
              provider: 'codex',
              route: 'codex-via-ccb',
              substrate: 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await expect(run('build', adapters)).rejects.toThrow(
        'Generator reported blocked build contract: The governed contract is inconsistent with the current checkout.',
      );

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'blocked',
        ready: false,
        errors: ['Generator reported blocked build contract: The governed contract is inconsistent with the current checkout.'],
      });
    });
  });

  test('blocks build when generator treats existing build-stage artifacts as completion evidence', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          execute_generator: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              receipt: 'ccb-build-codex-2',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: completed',
                '- Actions: `.planning/current/build/status.json` already marks the stage `build_recorded`, so no repository changes are required.',
                '- Files touched: none',
                '- Verification: Confirmed `.planning/current/build/build-result.md` and `.planning/nexus/current-run.json` already show a recorded build outcome.',
              ].join('\n'),
            },
            requested_route: {
              command: 'build',
              governed: true,
              planner: 'claude+pm-gsd',
              generator: 'codex-via-ccb',
              evaluator_a: 'codex-via-ccb',
              evaluator_b: 'gemini-via-ccb',
              synthesizer: 'claude',
              substrate: 'superpowers-core',
              fallback_policy: 'disabled',
            },
            actual_route: {
              provider: 'codex',
              route: 'codex-via-ccb',
              substrate: 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await expect(run('build', adapters)).rejects.toThrow(
        'Generator build summary relied on existing build-stage artifacts instead of predecessor artifacts or repository implementation state',
      );

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'blocked',
        ready: false,
        errors: ['Generator build summary relied on existing build-stage artifacts instead of predecessor artifacts or repository implementation state'],
      });
    });
  });

  test('allows a failing review gate to route back into build for a governed fix cycle', async () => {
    await runInTempRepo(async ({ run }) => {
      const reviewAdapters = makeFakeAdapters({
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
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Remove the old Vue files before Phase 2.\n',
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
          execute_generator: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              receipt: 'ccb-build-fix-cycle',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: completed',
                '- Actions: Applied the bounded fix items from the failing review gate.',
                '- Files touched: src/, packages/db/drizzle/',
                '- Verification: Verified the fix cycle changed repository implementation state instead of reusing prior build artifacts.',
              ].join('\n'),
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.generator ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await run('build');
      await run('review', reviewAdapters);
      await run('build', reviewAdapters);

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'completed',
        ready: true,
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: ['Remove the old Vue files before Phase 2.'],
          advisory_policy: 'out_of_scope_advisory',
        },
        actual_route: {
          provider: 'codex',
          route: 'codex-via-ccb',
        },
      });
      expect(await run.readJson('.planning/current/build/build-request.json')).toMatchObject({
        requested_route: {
          command: 'build',
          generator: 'codex-via-ccb',
          evaluator_b: 'gemini-via-ccb',
        },
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: ['Remove the old Vue files before Phase 2.'],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'build',
        previous_stage: 'review',
        command_history: [
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          {
            command: 'build',
            at: expect.any(String),
            via: 'fix-cycle',
          },
        ],
      });
    });
  });

  test('keeps the review stage active when a fix-cycle build finds a stale governed handoff contract, and allows handoff refresh', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      const reviewAdapters = makeFakeAdapters({
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
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Fix cycle is still outstanding.\n',
              receipt: 'codex-review-fail',
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
              markdown: '# Gemini Audit\n\nResult: fail\n\nFindings:\n- Fix cycle is still outstanding.\n',
              receipt: 'gemini-review-fail',
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
          resolve_route: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              available: true,
              provider: 'codex',
              providers: ['codex', 'gemini'],
              mounted: ['codex', 'gemini'],
              provider_checks: [
                {
                  provider: 'codex',
                  ping_command: 'ccb-ping codex',
                  ping_output: '✅ codex connection OK (Session healthy)',
                },
                {
                  provider: 'gemini',
                  ping_command: 'ccb-ping gemini',
                  ping_output: '✅ gemini connection OK (Session healthy)',
                },
              ],
            },
            requested_route: null,
            actual_route: {
              provider: 'codex',
              route: 'codex-via-ccb',
              substrate: 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/handoff/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_generator: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              receipt: 'ccb-build-after-refresh',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: completed',
                '- Actions: Applied the fix cycle after refreshing the governed handoff contract.',
                '- Files touched: packages/db/drizzle/, src/',
                '- Verification: Verified provider checks were refreshed before dispatch.',
              ].join('\n'),
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.generator ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await run('build');
      await run('review', reviewAdapters);

      const handoffStatusPath = join(cwd, '.planning/current/handoff/status.json');
      const legacyHandoffStatus = await run.readJson('.planning/current/handoff/status.json');
      writeFileSync(
        handoffStatusPath,
        JSON.stringify(
          {
            ...legacyHandoffStatus,
            route_validation: {
              transport: 'ccb',
              available: true,
              approved: true,
              reason: 'Legacy flat route validation',
            },
          },
          null,
          2,
        ) + '\n',
      );

      await expect(run('build', reviewAdapters)).rejects.toThrow(
        'Governed handoff contract does not record verification for required provider(s): codex, gemini. Rerun /handoff with the current Nexus version before /build.',
      );

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'review',
        current_command: 'review',
        allowed_next_stages: ['handoff'],
      });

      await run('handoff', reviewAdapters);
      await run('build', reviewAdapters);

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        ready: true,
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: ['Fix cycle is still outstanding.'],
          advisory_policy: 'out_of_scope_advisory',
        },
        route_validation: {
          transport: 'ccb',
          provider_checks: [
            {
              provider: 'codex',
              available: true,
              mounted: true,
            },
            {
              provider: 'gemini',
              available: true,
              mounted: true,
            },
          ],
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        route_check: {
          checked_at: expect.any(String),
          requested_route: {
            command: 'build',
            generator: 'codex-via-ccb',
            evaluator_b: 'gemini-via-ccb',
            substrate: 'superpowers-core',
            fallback_policy: 'disabled',
          },
          route_validation: {
            transport: 'ccb',
            available: true,
            approved: true,
            reason: 'Nexus approved the requested governed route',
            mounted_providers: ['codex', 'gemini'],
            provider_checks: [
              {
                provider: 'codex',
                available: true,
                mounted: true,
                reason: 'CCB codex route check passed',
              },
              {
                provider: 'gemini',
                available: true,
                mounted: true,
                reason: 'CCB gemini route check passed',
              },
            ],
          },
        },
        command_history: [
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          {
            command: 'handoff',
            at: expect.any(String),
            via: 'refresh',
          },
          {
            command: 'build',
            at: expect.any(String),
            via: 'fix-cycle',
          },
        ],
      });
      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'completed',
        ready: true,
      });
    });
  });
});
