import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus ship', () => {
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
      });
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
});
