import { writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';
import { resolveInvocation } from '../../lib/nexus/commands';

describe('nexus ship', () => {
  test('blocks design-bearing runs without design verification', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: touchup ship gate\n',
              prd_markdown: '# PRD\n\nSuccess criteria: touchup ship gate\n',
              design_intent: {
                impact: 'touchup',
                affected_surfaces: ['apps/web/src/app/page.tsx'],
                design_system_source: 'design_md',
                contract_required: false,
                verification_required: true,
              },
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-frame-pack',
              absorbed_capability: 'pm-frame',
              source_map: ['upstream/pm-skills/commands/write-prd.md'],
            },
          }),
        },
        gsd: {
          plan: async () => ({
            adapter_id: 'gsd',
            outcome: 'success',
            raw_output: {
              execution_readiness_packet: '# Execution Readiness Packet\n\nReady\n',
              sprint_contract: '# Sprint Contract\n\nTouchup\n',
              ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-plan-pack',
              absorbed_capability: 'gsd-plan',
              source_map: ['upstream/gsd/commands/gsd/plan-phase.md'],
            },
          }),
        },
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
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

      await run('discover');
      await run('frame', adapters);
      await run('plan', adapters);
      await run('handoff');
      await run('build');
      await run('review');

      await expect(run('ship', adapters)).rejects.toThrow(
        'Design-bearing runs require QA design verification before ship',
      );
    });
  });

  test('does not block when review and QA provenance are non-design', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      const frameAdapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: material ship gate fallback check\n',
              prd_markdown: '# PRD\n\nSuccess criteria: material ship gate fallback check\n',
              design_intent: {
                impact: 'material',
                affected_surfaces: ['apps/web/src/app/page.tsx'],
                design_system_source: 'design_md',
                contract_required: true,
                verification_required: true,
              },
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-frame-pack',
              absorbed_capability: 'pm-frame',
              source_map: ['upstream/pm-skills/commands/write-prd.md'],
            },
          }),
        },
        gsd: {
          plan: async () => ({
            adapter_id: 'gsd',
            outcome: 'success',
            raw_output: {
              execution_readiness_packet: '# Execution Readiness Packet\n\nReady\n',
              sprint_contract: '# Sprint Contract\n\nMaterial\n',
              design_contract: '# Design Contract\n\nMaterial UI constraints\n',
              ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-plan-pack',
              absorbed_capability: 'gsd-plan',
              source_map: ['upstream/gsd/commands/gsd/plan-phase.md'],
            },
          }),
        },
      });

      await run('discover');
      await run('frame', frameAdapters);
      await run('plan', frameAdapters);
      await run('handoff');
      await run('build');
      await run('review');

      const reviewStatusPath = join(cwd, '.planning/current/review/status.json');
      const reviewStatus = await run.readJson('.planning/current/review/status.json');
      reviewStatus.design_impact = 'none';
      reviewStatus.design_contract_path = null;
      reviewStatus.design_verified = null;
      writeFileSync(reviewStatusPath, JSON.stringify(reviewStatus, null, 2) + '\n');

      const qaAdapters = makeFakeAdapters({
        ccb: {
          execute_qa: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              report_markdown: '# QA Report\n\nResult: pass\n',
              ready: true,
              findings: [],
              receipt: 'qa-pass',
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
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
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

      await run('qa', qaAdapters);
      await run('ship', qaAdapters);

      expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
        stage: 'ship',
        state: 'completed',
        ready: true,
        design_impact: 'none',
        design_contract_path: null,
        design_verified: null,
      });
      expect(await run.readJson('.planning/current/ship/checklist.json')).toMatchObject({
        design_impact: 'none',
        design_contract_path: null,
        design_verified: null,
      });
    });
  });

  test('creates a pull request record when merge is ready and no PR exists yet', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const commands: string[] = [];
      let prViewCount = 0;
      const adapters = makeFakeAdapters({
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
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

      const invocation = resolveInvocation('ship');
      await invocation.handler({
        cwd,
        clock: () => new Date().toISOString(),
        via: invocation.via,
        adapters,
        execution: {
          mode: 'governed_ccb',
          primary_provider: 'codex',
          provider_topology: 'multi_session',
          requested_execution_path: 'codex-via-ccb',
        },
        run_command: async (spec) => {
          commands.push(spec.argv.join(' '));

          if (spec.argv[0] === 'git' && spec.argv[1] === 'branch') {
            return { exitCode: 0, stdout: 'feature/phase-2-auth\n', stderr: '' };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'pr' && spec.argv[2] === 'view') {
            prViewCount += 1;
            if (prViewCount === 1) {
              return { exitCode: 1, stdout: '', stderr: 'no pull requests found for branch "feature/phase-2-auth"\n' };
            }

            return {
              exitCode: 0,
              stdout: JSON.stringify({
                number: 123,
                url: 'https://github.com/LaPaGaYo/project-tracker/pull/123',
                state: 'OPEN',
                headRefName: 'feature/phase-2-auth',
                baseRefName: 'main',
              }),
              stderr: '',
            };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'repo' && spec.argv[2] === 'view') {
            return { exitCode: 0, stdout: 'main\n', stderr: '' };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'pr' && spec.argv[2] === 'create') {
            return {
              exitCode: 0,
              stdout: 'https://github.com/LaPaGaYo/project-tracker/pull/123\n',
              stderr: '',
            };
          }

          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      expect(await run.readJson('.planning/current/ship/pull-request.json')).toMatchObject({
        status: 'created',
        provider: 'github',
        number: 123,
        url: 'https://github.com/LaPaGaYo/project-tracker/pull/123',
        head_branch: 'feature/phase-2-auth',
        base_branch: 'main',
      });
      expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
        stage: 'ship',
        ready: true,
        pull_request: {
          status: 'created',
          number: 123,
        },
      });
      expect(commands).toEqual([
        'git branch --show-current',
        'gh pr view --json number,url,state,headRefName,baseRefName',
        'gh repo view --json defaultBranchRef -q .defaultBranchRef.name',
        'gh pr create --base main --head feature/phase-2-auth --fill',
        'gh pr view --json number,url,state,headRefName,baseRefName',
      ]);
    });
  });

  test('reuses an existing pull request record when the current branch already has one', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const commands: string[] = [];
      const adapters = makeFakeAdapters({
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
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

      const invocation = resolveInvocation('ship');
      await invocation.handler({
        cwd,
        clock: () => new Date().toISOString(),
        via: invocation.via,
        adapters,
        execution: {
          mode: 'governed_ccb',
          primary_provider: 'codex',
          provider_topology: 'multi_session',
          requested_execution_path: 'codex-via-ccb',
        },
        run_command: async (spec) => {
          commands.push(spec.argv.join(' '));

          if (spec.argv[0] === 'git' && spec.argv[1] === 'branch') {
            return { exitCode: 0, stdout: 'feature/phase-2-auth\n', stderr: '' };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'pr' && spec.argv[2] === 'view') {
            return {
              exitCode: 0,
              stdout: JSON.stringify({
                number: 123,
                url: 'https://github.com/LaPaGaYo/project-tracker/pull/123',
                state: 'OPEN',
                headRefName: 'feature/phase-2-auth',
                baseRefName: 'main',
              }),
              stderr: '',
            };
          }

          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      expect(await run.readJson('.planning/current/ship/pull-request.json')).toMatchObject({
        status: 'reused',
        provider: 'github',
        number: 123,
        url: 'https://github.com/LaPaGaYo/project-tracker/pull/123',
        head_branch: 'feature/phase-2-auth',
        base_branch: 'main',
      });
      expect(commands).toEqual([
        'git branch --show-current',
        'gh pr view --json number,url,state,headRefName,baseRefName',
      ]);
    });
  });

  test('does not reuse closed or merged pull requests', async () => {
    for (const state of ['CLOSED', 'MERGED'] as const) {
      await runInTempRepo(async ({ cwd, run }) => {
        await run('plan');
        await run('handoff');
        await run('build');
        await run('review');

        const commands: string[] = [];
        let prViewCount = 0;
        const adapters = makeFakeAdapters({
          superpowers: {
            ship_discipline: async () => ({
              adapter_id: 'superpowers',
              outcome: 'success',
              raw_output: {
                release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
                checklist: {
                  review_complete: true,
                  qa_ready: true,
                  merge_ready: true,
                },
                merge_ready: true,
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

        const invocation = resolveInvocation('ship');
        await invocation.handler({
          cwd,
          clock: () => new Date().toISOString(),
          via: invocation.via,
          adapters,
          execution: {
            mode: 'governed_ccb',
            primary_provider: 'codex',
            provider_topology: 'multi_session',
            requested_execution_path: 'codex-via-ccb',
          },
          run_command: async (spec) => {
            commands.push(spec.argv.join(' '));

            if (spec.argv[0] === 'git' && spec.argv[1] === 'branch') {
              return { exitCode: 0, stdout: 'feature/phase-2-auth\n', stderr: '' };
            }

            if (spec.argv[0] === 'gh' && spec.argv[1] === 'pr' && spec.argv[2] === 'view') {
              prViewCount += 1;
              if (prViewCount === 1) {
                return {
                  exitCode: 0,
                  stdout: JSON.stringify({
                    number: 456,
                    url: `https://github.com/LaPaGaYo/project-tracker/pull/456-${state.toLowerCase()}`,
                    state,
                    headRefName: 'feature/phase-2-auth',
                    baseRefName: 'main',
                  }),
                  stderr: '',
                };
              }

              return {
                exitCode: 0,
                stdout: JSON.stringify({
                  number: 789,
                  url: 'https://github.com/LaPaGaYo/project-tracker/pull/789',
                  state: 'OPEN',
                  headRefName: 'feature/phase-2-auth',
                  baseRefName: 'main',
                }),
                stderr: '',
              };
            }

            if (spec.argv[0] === 'gh' && spec.argv[1] === 'repo' && spec.argv[2] === 'view') {
              return { exitCode: 0, stdout: 'main\n', stderr: '' };
            }

            if (spec.argv[0] === 'gh' && spec.argv[1] === 'pr' && spec.argv[2] === 'create') {
              return {
                exitCode: 0,
                stdout: 'https://github.com/LaPaGaYo/project-tracker/pull/789\n',
                stderr: '',
              };
            }

            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          },
        });

        expect(await run.readJson('.planning/current/ship/pull-request.json')).toMatchObject({
          status: 'created',
          provider: 'github',
          number: 789,
          url: 'https://github.com/LaPaGaYo/project-tracker/pull/789',
          head_branch: 'feature/phase-2-auth',
          base_branch: 'main',
        });
        expect(commands).toEqual([
          'git branch --show-current',
          'gh pr view --json number,url,state,headRefName,baseRefName',
          'gh repo view --json defaultBranchRef -q .defaultBranchRef.name',
          'gh pr create --base main --head feature/phase-2-auth --fill',
          'gh pr view --json number,url,state,headRefName,baseRefName',
        ]);
      });
    }
  });

  test('records unavailable pull request metadata without blocking ship when GitHub CLI handoff cannot run', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const adapters = makeFakeAdapters({
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
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

      const invocation = resolveInvocation('ship');
      await invocation.handler({
        cwd,
        clock: () => new Date().toISOString(),
        via: invocation.via,
        adapters,
        execution: {
          mode: 'governed_ccb',
          primary_provider: 'codex',
          provider_topology: 'multi_session',
          requested_execution_path: 'codex-via-ccb',
        },
        run_command: async (spec) => {
          if (spec.argv[0] === 'git' && spec.argv[1] === 'branch') {
            return { exitCode: 0, stdout: 'feature/phase-2-auth\n', stderr: '' };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'pr' && spec.argv[2] === 'view') {
            return { exitCode: 1, stdout: '', stderr: 'gh: authentication required\n' };
          }

          if (spec.argv[0] === 'gh' && spec.argv[1] === 'repo' && spec.argv[2] === 'view') {
            return { exitCode: 1, stdout: '', stderr: 'gh: authentication required\n' };
          }

          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
        stage: 'ship',
        state: 'completed',
        ready: true,
        pull_request: {
          status: 'unavailable',
          provider: 'github',
        },
      });
      expect(await run.readJson('.planning/current/ship/pull-request.json')).toMatchObject({
        status: 'unavailable',
        provider: 'github',
        head_branch: 'feature/phase-2-auth',
      });
      expect(await run.readJson('.planning/current/ship/pull-request.json')).toHaveProperty('reason');
    });
  });

  test('writes release gate artifacts when merge is ready', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const calls: string[] = [];
      const adapters = makeFakeAdapters({
        superpowers: {
          ship_discipline: async () => {
            calls.push('ship');
            return {
              adapter_id: 'superpowers',
              outcome: 'success',
              raw_output: {
                release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
                checklist: {
                  review_complete: true,
                  qa_ready: true,
                  merge_ready: true,
                },
                merge_ready: true,
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
            };
          },
        },
      });

      await run('ship', adapters);

      expect(calls).toEqual(['ship']);
      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain('merge ready');
      expect(await run.readJson('.planning/current/ship/checklist.json')).toMatchObject({
        review_complete: true,
        qa_ready: true,
        merge_ready: true,
        design_impact: 'none',
        design_contract_path: null,
        design_verified: null,
      });
      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain(
        'Design verification',
      );
      expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
        stage: 'ship',
        state: 'completed',
        decision: 'ship_recorded',
        ready: true,
      });
      expect(await run.readJson('.planning/current/ship/adapter-output.json')).toMatchObject({
        adapter_id: 'superpowers',
        outcome: 'success',
        traceability: {
          nexus_stage_pack: 'nexus-ship-pack',
          absorbed_capability: 'superpowers-ship-discipline',
        },
      });
    });
  });

  test('default ship gate record carries Nexus-owned absorbed ship guidance', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('ship');

      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain(
        'Nexus-owned ship guidance for governed release gating and explicit merge readiness.',
      );
      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain(
        'require completed review artifacts',
      );
      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain(
        'Ship content starts only after completed review and optional ready QA.',
      );
    });
  });

  test('blocks ship without completed review', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      await expect(run('ship')).rejects.toThrow('Review must be completed before ship');
    });
  });

  test('blocks ship when QA exists and is not ready', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const qaAdapters = makeFakeAdapters({
        ccb: {
          execute_qa: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              report_markdown: '# QA Report\n\nResult: fail\n\n- Checkout flow is broken\n',
              ready: false,
              findings: ['Checkout flow is broken'],
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

      await run('qa', qaAdapters);
      await expect(run('ship')).rejects.toThrow('QA must be ready before ship');
    });
  });

  test('records a conservative blocked release gate when merge is not ready', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const adapters = makeFakeAdapters({
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

      await run('ship', adapters);

      expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
        stage: 'ship',
        state: 'completed',
        decision: 'ship_recorded',
        ready: false,
      });
      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain('blocked');
      expect(await run.readJson('.planning/current/ship/checklist.json')).toMatchObject({
        merge_ready: false,
      });
    });
  });

  test('blocks ship when the run ledger is noncanonical', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = await run.readJson('.planning/nexus/current-run.json');
      ledger.command_history[ledger.command_history.length - 1] = {
        ...ledger.command_history[ledger.command_history.length - 1],
        gate_decision: 'pass',
      };
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('ship')).rejects.toThrow('Run ledger is not canonical before ship');
    });
  });

  test('blocks ship when governed tail-stage ledger is missing run-level route check', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = await run.readJson('.planning/nexus/current-run.json');
      delete ledger.route_check;
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('ship')).rejects.toThrow('Run ledger is not canonical before ship');
    });
  });
});
