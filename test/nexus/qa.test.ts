import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus qa', () => {
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
});
