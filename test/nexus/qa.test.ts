import { writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus qa', () => {
  test('writes design verification for touchup runs', async () => {
    await runInTempRepo(async ({ run }) => {
      const frameAdapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: touchup UI work\n',
              prd_markdown: '# PRD\n\nSuccess criteria: touchup UI work\n',
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
      });

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
      });

      await run('discover');
      await run('frame', frameAdapters);
      await run('plan', frameAdapters);
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa', qaAdapters);

      expect(await run.readFile('.planning/current/qa/design-verification.md')).toContain('Design impact: touchup');
      expect(await run.readFile('.planning/current/qa/design-verification.md')).toContain('Result: verified');
      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        state: 'completed',
        decision: 'qa_recorded',
        ready: true,
        design_impact: 'touchup',
        design_contract_path: null,
        design_verified: true,
      });
    });
  });

  test('clears stale design verification when review provenance becomes non-design', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      const frameAdapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: material UI work\n',
              prd_markdown: '# PRD\n\nSuccess criteria: material UI work\n',
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
      });

      await run('discover');
      await run('frame', frameAdapters);
      await run('plan', frameAdapters);
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa', qaAdapters);

      expect(await run.readFile('.planning/current/qa/design-verification.md')).toContain('Design impact: material');

      const reviewStatusPath = join(cwd, '.planning/current/review/status.json');
      const reviewStatus = await run.readJson('.planning/current/review/status.json');
      reviewStatus.design_impact = 'none';
      reviewStatus.design_contract_path = null;
      reviewStatus.design_verified = null;
      writeFileSync(reviewStatusPath, JSON.stringify(reviewStatus, null, 2) + '\n');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = await run.readJson('.planning/nexus/current-run.json');
      ledger.current_command = 'review';
      ledger.current_stage = 'review';
      ledger.previous_stage = 'build';
      ledger.allowed_next_stages = ['qa'];
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await run('qa', qaAdapters);

      await expect(run.readFile('.planning/current/qa/design-verification.md')).rejects.toThrow();
      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        design_impact: 'none',
        design_contract_path: null,
        design_verified: null,
      });
      const updatedLedger = await run.readJson('.planning/nexus/current-run.json');
      expect(updatedLedger.artifact_index).not.toHaveProperty('.planning/current/qa/design-verification.md');
    });
  });

  test('writes qa report and explicit provider route when validation passes', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const calls: string[] = [];
      const adapters = makeFakeAdapters({
        ccb: {
          execute_qa: async (ctx) => {
            calls.push('qa');
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                report_markdown: '# QA Report\n\nResult: pass\n',
                ready: true,
                findings: ['Homepage loads with HTTP 200'],
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
            };
          },
        },
      });

      await run('qa', adapters);

      expect(calls).toEqual(['qa']);
      expect(await run.readFile('.planning/current/qa/qa-report.md')).toContain('Result: pass');
      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        state: 'completed',
        decision: 'qa_recorded',
        ready: true,
        verification_count: 1,
        defect_count: 0,
        requested_route: {
          command: 'qa',
          generator: 'gemini-via-ccb',
          substrate: 'superpowers-core',
        },
        actual_route: {
          provider: 'gemini',
          route: 'gemini-via-ccb',
          substrate: 'superpowers-core',
          transport: 'ccb',
        },
      });
      expect(await run.readJson('.planning/current/qa/adapter-output.json')).toMatchObject({
        adapter_id: 'ccb',
        outcome: 'success',
        traceability: {
          nexus_stage_pack: 'nexus-qa-pack',
          absorbed_capability: 'ccb-qa',
        },
      });
    });
  });

  test('default qa report carries Nexus-owned absorbed qa guidance', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');

      expect(await run.readFile('.planning/current/qa/qa-report.md')).toContain(
        'Nexus-owned QA guidance for governed validation scope beyond code review.',
      );
      expect(await run.readFile('.planning/current/qa/qa-report.md')).toContain(
        'define governed validation scope after completed review',
      );
      expect(await run.readFile('.planning/current/qa/qa-report.md')).toContain(
        'QA content starts only after completed review.',
      );
    });
  });

  test('records qa as not ready when validation finds defects', async () => {
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

      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        state: 'completed',
        decision: 'qa_recorded',
        ready: false,
        verification_count: 0,
        defect_count: 1,
      });
      expect(await run.readFile('.planning/current/qa/qa-report.md')).toContain('Login form is broken');
    });
  });

  test('blocks qa when requested and actual validation route diverge', async () => {
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
              report_markdown: '# QA Report\n\nResult: pass\n',
              ready: true,
              findings: [],
              receipt: 'qa-pass',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: 'codex-via-ccb',
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

      await expect(run('qa', adapters)).rejects.toThrow('Requested and actual QA route diverged');

      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        state: 'blocked',
        ready: false,
      });
      expect(await run.readJson('.planning/current/conflicts/qa-ccb.json')).toMatchObject({
        stage: 'qa',
        adapter: 'ccb',
        kind: 'route_mismatch',
        message: 'Requested and actual QA route diverged',
      });
    });
  });

  test('blocks qa when the run ledger is noncanonical', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = await run.readJson('.planning/nexus/current-run.json');
      ledger.command_history[ledger.command_history.length - 1] = {
        ...ledger.command_history[ledger.command_history.length - 1],
        gate_decision: 'fail',
      };
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('qa')).rejects.toThrow('Run ledger is not canonical before QA');
    });
  });
});
