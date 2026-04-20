import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import { buildBuildExecutionPrompt } from '../../lib/nexus/adapters/prompt-contracts';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { createBuildStagePack } from '../../lib/nexus/stage-packs/build';
import { createHandoffStagePack } from '../../lib/nexus/stage-packs/handoff';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../lib/nexus/adapters/types';
import type { ExecutionSelection } from '../../lib/nexus/execution-topology';
import { resolveInvocation } from '../../lib/nexus/commands/index';
import { allocateFreshRunWorkspace } from '../../lib/nexus/workspace-substrate';
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

function attachOriginRemote(repoRoot: string): string {
  const remoteRoot = mkdtempSync(join(tmpdir(), 'nexus-build-routing-remote-'));
  spawnSync('git', ['init', '--bare', remoteRoot], { stdio: 'pipe' });
  spawnSync('git', ['-C', remoteRoot, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { stdio: 'pipe' });
  spawnSync('git', ['remote', 'add', 'origin', remoteRoot], { cwd: repoRoot, stdio: 'pipe' });
  spawnSync('git', ['push', '-u', 'origin', 'main'], { cwd: repoRoot, stdio: 'pipe' });
  spawnSync('git', ['remote', 'set-head', 'origin', '-a'], { cwd: repoRoot, stdio: 'pipe' });
  return remoteRoot;
}

function pushCommitToRemote(
  remoteRoot: string,
  relativePath: string,
  content: string,
  message: string,
): void {
  const cloneRoot = mkdtempSync(join(tmpdir(), 'nexus-build-routing-remote-clone-'));
  const cloneResult = spawnSync('git', ['clone', remoteRoot, cloneRoot], { stdio: 'pipe' });
  if (cloneResult.status !== 0) {
    throw new Error(cloneResult.stderr.toString() || cloneResult.stdout.toString() || 'failed to clone remote');
  }

  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: cloneRoot, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: cloneRoot, stdio: 'pipe' });
  writeFileSync(join(cloneRoot, relativePath), content);
  spawnSync('git', ['add', relativePath], { cwd: cloneRoot, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', message], { cwd: cloneRoot, stdio: 'pipe' });
  spawnSync('git', ['push', 'origin', 'main'], { cwd: cloneRoot, stdio: 'pipe' });
  rmSync(cloneRoot, { recursive: true, force: true });
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

  test('handoff resyncs repo-root plan artifacts into the run workspace before governed route validation', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => {
            const workspacePlan = readFileSync(
              join(ctx.workspace!.path, '.planning/current/plan/execution-readiness-packet.md'),
              'utf8',
            );
            expect(workspacePlan).toContain('updated phase contract from repo root');

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

      const ledger = readJson('.planning/nexus/current-run.json');
      const workspacePath = realpathSync.native(join(cwd, '.nexus-worktrees', ledger.run_id));
      writeFileSync(
        join(cwd, '.planning/current/plan/execution-readiness-packet.md'),
        '# Execution Readiness Packet\n\nupdated phase contract from repo root\n',
      );
      writeFileSync(
        join(workspacePath, '.planning/current/plan/execution-readiness-packet.md'),
        '# Execution Readiness Packet\n\nstale worktree contract\n',
      );

      await run('handoff', adapters);

      expect(readFileSync(join(workspacePath, '.planning/current/plan/execution-readiness-packet.md'), 'utf8')).toContain(
        'updated phase contract from repo root',
      );
    });
  });

  test('handoff refreshes a stale fresh-run workspace from the remote default branch before route validation', async () => {
    await runInTempGitRepo(async ({ cwd, run }) => {
      const remoteRoot = attachOriginRemote(cwd);
      const workspace = allocateFreshRunWorkspace(cwd, 'run-2026-04-19T08-27-58-235Z');

      pushCommitToRemote(remoteRoot, 'README.md', '# updated remote baseline\n', 'remote update');

      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => {
            const workspaceReadme = readFileSync(join(ctx.workspace!.path, 'README.md'), 'utf8');
            expect(workspaceReadme).toContain('updated remote baseline');

            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                available: true,
                provider: 'codex',
                providers: ['codex', 'gemini'],
                mounted: ['codex', 'gemini'],
                provider_checks: [
                  { provider: 'codex', ping_command: 'ccb-ping codex', ping_output: 'ok' },
                  { provider: 'gemini', ping_command: 'ccb-ping gemini', ping_output: 'ok' },
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

      await run('plan');
      await run('handoff', adapters);

      expect(readFileSync(join(workspace.path, 'README.md'), 'utf8')).toContain('updated remote baseline');
    });
  });

  test('build passes the governed handoff and plan contract artifacts to discipline and generator', async () => {
    await runInTempRepo(async ({ run }) => {
      const seen: string[][] = [];
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => ({
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
          }),
          execute_generator: async (ctx) => {
            seen.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                receipt: 'ccb-build-codex-contract-scope',
                summary_markdown: '# Build Execution Summary\n\n- Status: completed\n- Actions: implemented the current execution packet\n- Files touched: apps/web\n- Verification: verified the current execution packet\n',
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
        superpowers: {
          build_discipline: async (ctx) => {
            seen.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'superpowers',
              outcome: 'success',
              raw_output: { verification_summary: 'verified current execution packet' },
              requested_route: null,
              actual_route: null,
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('plan');
      await run('handoff', adapters);
      await run('build', adapters);

      expect(seen).toHaveLength(2);
      for (const paths of seen) {
        expect(paths).toEqual(expect.arrayContaining([
          '.planning/current/handoff/status.json',
          '.planning/current/handoff/governed-handoff.md',
          '.planning/current/plan/execution-readiness-packet.md',
          '.planning/current/plan/sprint-contract.md',
          '.planning/current/plan/verification-matrix.json',
        ]));
      }
    });
  });

  test('build refreshes a stale fresh-run workspace from the remote default branch after handoff', async () => {
    await runInTempGitRepo(async ({ cwd, run }) => {
      const remoteRoot = attachOriginRemote(cwd);
      const workspace = allocateFreshRunWorkspace(cwd, 'run-2026-04-19T08-27-58-236Z');

      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              available: true,
              provider: 'codex',
              providers: ['codex', 'gemini'],
              mounted: ['codex', 'gemini'],
              provider_checks: [
                { provider: 'codex', ping_command: 'ccb-ping codex', ping_output: 'ok' },
                { provider: 'gemini', ping_command: 'ccb-ping gemini', ping_output: 'ok' },
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
          }),
          execute_generator: async (ctx) => {
            const workspaceReadme = readFileSync(join(ctx.workspace!.path, 'README.md'), 'utf8');
            expect(workspaceReadme).toContain('updated remote baseline after handoff');

            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                receipt: 'ccb-build-refreshed-workspace',
                summary_markdown: '# Build Execution Summary\n\n- Status: completed\n- Actions: refreshed the fresh-run workspace before implementation\n- Files touched: README.md\n- Verification: ok\n',
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
        superpowers: {
          build_discipline: async (ctx) => {
            const workspaceReadme = readFileSync(join(ctx.workspace!.path, 'README.md'), 'utf8');
            expect(workspaceReadme).toContain('updated remote baseline after handoff');

            return {
              adapter_id: 'superpowers',
              outcome: 'success',
              raw_output: { verification_summary: 'refreshed workspace before build' },
              requested_route: null,
              actual_route: null,
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('plan');
      await run('handoff', adapters);

      pushCommitToRemote(remoteRoot, 'README.md', '# updated remote baseline after handoff\n', 'remote update after handoff');

      await run('build', adapters);

      expect(readFileSync(join(workspace.path, 'README.md'), 'utf8')).toContain('updated remote baseline after handoff');
    });
  });

  test('handoff and build include the approved design contract as predecessor provenance when present', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      const seenHandoff: string[][] = [];
      const seenBuild: string[][] = [];
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => {
            seenHandoff.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                available: true,
                provider: 'codex',
                providers: ['codex', 'gemini'],
                mounted: ['codex', 'gemini'],
                provider_checks: [
                  { provider: 'codex', ping_command: 'ccb-ping codex', ping_output: 'ok' },
                  { provider: 'gemini', ping_command: 'ccb-ping gemini', ping_output: 'ok' },
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
          execute_generator: async (ctx) => {
            seenBuild.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                receipt: 'ccb-build-design-contract',
                summary_markdown: '# Build Execution Summary\n\n- Status: completed\n- Actions: implemented the approved design-bearing execution packet\n- Files touched: apps/web\n- Verification: verified the design-bearing execution packet\n',
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
        superpowers: {
          build_discipline: async (ctx) => {
            seenBuild.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'superpowers',
              outcome: 'success',
              raw_output: { verification_summary: 'verified design-bearing execution packet' },
              requested_route: null,
              actual_route: null,
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('plan');

      writeFileSync(
        join(cwd, '.planning/current/plan/design-contract.md'),
        '# Design Contract\n\nApproved material UI contract\n',
      );
      writeFileSync(
        join(cwd, '.planning/current/plan/status.json'),
        JSON.stringify(
          {
            ...(await run.readJson('.planning/current/plan/status.json')),
            design_impact: 'material',
            design_contract_required: true,
            design_contract_path: '.planning/current/plan/design-contract.md',
            design_verified: false,
          },
          null,
          2,
        ) + '\n',
      );

      await run('handoff', adapters);
      await run('build', adapters);

      expect(seenHandoff).toHaveLength(1);
      expect(seenHandoff[0]).toEqual(expect.arrayContaining([
        '.planning/current/plan/status.json',
        '.planning/current/plan/verification-matrix.json',
        '.planning/current/plan/design-contract.md',
      ]));
      expect(seenBuild).toHaveLength(2);
      for (const paths of seenBuild) {
        expect(paths).toEqual(expect.arrayContaining([
          '.planning/current/handoff/status.json',
          '.planning/current/handoff/governed-handoff.md',
          '.planning/current/plan/execution-readiness-packet.md',
          '.planning/current/plan/sprint-contract.md',
          '.planning/current/plan/verification-matrix.json',
          '.planning/current/plan/design-contract.md',
        ]));
      }
    });
  });

  test('build prompt marks material runs with approved design contract as design-bearing', () => {
    const prompt = buildBuildExecutionPrompt(
      {
        cwd: '/repo',
        workspace: null,
        run_id: 'run-1',
        command: 'build',
        stage: 'build',
        ledger: {
          run_id: 'run-1',
          continuation_mode: 'phase',
          status: 'active',
          current_command: 'build',
          current_stage: 'build',
          previous_stage: 'handoff',
          allowed_next_stages: ['review'],
          command_history: [],
          artifact_index: {},
          execution: {
            mode: 'governed_ccb',
            primary_provider: 'codex',
            provider_topology: 'multi_session',
            requested_path: 'codex-via-ccb',
            actual_path: null,
          },
          route_intent: {
            planner: 'claude+pm-gsd',
            generator: 'codex-via-ccb',
            evaluator_a: 'codex-via-ccb',
            evaluator_b: 'gemini-via-ccb',
            synthesizer: 'claude',
            substrate: 'superpowers-core',
            fallback_policy: 'disabled',
          },
        },
        manifest: CANONICAL_MANIFEST.build,
        predecessor_artifacts: [
          { kind: 'json', path: '.planning/current/handoff/status.json' },
          { kind: 'markdown', path: '.planning/current/handoff/governed-handoff.md' },
          { kind: 'markdown', path: '.planning/current/plan/execution-readiness-packet.md' },
          { kind: 'markdown', path: '.planning/current/plan/sprint-contract.md' },
          { kind: 'markdown', path: '.planning/current/plan/design-contract.md' },
        ],
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
        review_scope: {
          mode: 'full_acceptance',
          source_stage: 'plan',
          blocking_items: [],
          advisory_policy: 'out_of_scope_advisory',
        },
      },
      'Nexus governed stage',
    );

    expect(prompt).toContain('This is a design-bearing run.');
    expect(prompt).toContain('Approved design contract: .planning/current/plan/design-contract.md');
    expect(prompt).toContain('Treat the approved design contract as part of the bounded implementation contract, not optional reference material.');
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

  test('allows build when the generator summary explicitly says stale stage artifacts were ignored', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async (ctx) => ({
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
          }),
          execute_generator: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              receipt: 'ccb-build-codex-ignore-stale-stage-outputs',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: completed',
                '- Actions: Ignored stale `.planning/current/build/*` and `.planning/nexus/current-run.json` as instructed, then implemented and verified the current execution packet from predecessor artifacts.',
                '- Files touched: apps/web, packages/shared',
                '- Verification: Fresh acceptance passed after ignoring stale `.planning/current/build/*` and `.planning/nexus/current-run.json`.',
              ].join('\n'),
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
          }),
        },
        superpowers: {
          build_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: { verification_summary: 'verified current execution packet' },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan');
      await run('handoff', adapters);
      await run('build', adapters);

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'completed',
        ready: true,
        errors: [],
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

  test('rejects fix-cycle build when review status is not a completed failing review', async () => {
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
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Fix the webhook signature verification.\n',
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
      await run('review', reviewAdapters);

      const corruptedReviewStatus = await run.readJson('.planning/current/review/status.json');
      writeFileSync(
        join(cwd, '.planning/current/review/status.json'),
        JSON.stringify(
          {
            ...corruptedReviewStatus,
            state: 'blocked',
            ready: false,
            review_complete: false,
            audit_set_complete: false,
            provenance_consistent: false,
            gate_decision: 'fail',
          },
          null,
          2,
        ) + '\n',
      );

      await expect(run('build')).rejects.toThrow('Fix-cycle /build is only valid after a completed failing review gate');
    });
  });

  test('allows advisory-scoped build when review passed with advisories and the user chooses fix_before_qa', async () => {
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
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- Identifier column should be clickable.\n',
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
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- Build warning about multiple lockfiles.\n',
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
              receipt: 'ccb-build-advisory-fix',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: completed',
                '- Actions: Applied the bounded advisory fixes before QA.',
                '- Files touched: apps/web/src/components/list-view.tsx, apps/web/next.config.ts',
                '- Verification: Verified the advisory fixes against the current execution packet.',
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

      await expect(run('build', reviewAdapters)).rejects.toThrow(/Review advisories require an explicit fix decision before build/i);

      await run('build', reviewAdapters, undefined, { reviewAdvisoryDispositionOverride: 'fix_before_qa' });

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'completed',
        ready: true,
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: [
            'Identifier column should be clickable.',
            'Build warning about multiple lockfiles.',
          ],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/current/review/advisory-disposition.json')).toMatchObject({
        selected: 'fix_before_qa',
      });
    });
  });

  test('allows fix-cycle build from a completed failing QA gate', async () => {
    await runInTempRepo(async ({ run }) => {
      const qaAdapters = makeFakeAdapters({
        ccb: {
          execute_qa: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              report_markdown: '# QA Report\n\nResult: fail\n\nFindings:\n- Login form is broken\n',
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

      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa', qaAdapters);
      await run('build');

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'completed',
        ready: true,
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'qa',
          blocking_items: ['Login form is broken'],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/current/build/build-request.json')).toMatchObject({
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'qa',
          blocking_items: ['Login form is broken'],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'build',
        previous_stage: 'qa',
        command_history: expect.arrayContaining([
          expect.objectContaining({
            command: 'build',
            via: 'fix-cycle',
          }),
        ]),
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
