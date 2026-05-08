import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from '../helpers/fake-adapters';
import { runInTempRepo } from '../helpers/temp-repo';

describe('nexus superpowers build discipline', () => {
  test('records a disciplined build and then executes through the approved route', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        execution: {
          build_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              verification_summary: 'TDD checks passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-build-pack',
              absorbed_capability: 'superpowers-build-discipline',
              source_map: [],
            },
          }),
        },
      });

      await run('plan');
      await run('handoff');
      await run('build', adapters);

      expect(await run.readFile('.planning/current/build/build-result.md')).toContain('TDD checks passed');
      expect(await run.readJson('.planning/current/build/adapter-output.json')).toMatchObject({
        discipline: {
          adapter_id: 'execution',
          traceability: {
            nexus_stage_pack: 'nexus-build-pack',
            absorbed_capability: 'superpowers-build-discipline',
          },
        },
        transport: {
          adapter_id: 'ccb',
          traceability: {
            nexus_stage_pack: 'nexus-build-pack',
            absorbed_capability: 'ccb-execution',
          },
        },
      });
    });
  });

  test('default build result carries Nexus-owned absorbed build discipline guidance', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      expect(await run.readFile('.planning/current/build/build-result.md')).toContain(
        'Nexus-owned build guidance for disciplined implementation under governed routing.',
      );
      expect(await run.readFile('.planning/current/build/build-result.md')).toContain(
        'run build discipline before transport',
      );
      expect(await run.readFile('.planning/current/build/build-result.md')).toContain(
        'Advance to `/review` only after Nexus records a bounded build result with requested and actual route provenance kept distinct.',
      );
      expect((await run.readJson('.planning/current/build/adapter-output.json')).transport.raw_output.summary_markdown).toContain(
        'Nexus-owned build guidance for disciplined implementation under governed routing.',
      );
      expect((await run.readJson('.planning/current/build/adapter-output.json')).transport.raw_output.summary_markdown).toContain(
        'run build discipline before transport',
      );
    });
  });

  test('blocks build when Superpowers discipline fails before generator transport starts', async () => {
    await runInTempRepo(async ({ run }) => {
      let transportCalled = false;
      const adapters = makeFakeAdapters({
        execution: {
          build_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'blocked',
            raw_output: {
              verification_summary: 'tests missing',
            },
            requested_route: null,
            actual_route: null,
            notices: ['missing tests'],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_generator: async () => {
            transportCalled = true;

            return {
              adapter_id: 'ccb',
              outcome: 'success' as const,
              raw_output: { receipt: 'should-not-run' },
              requested_route: null,
              actual_route: {
                provider: 'codex',
                route: 'codex-via-ccb',
                substrate: 'superpowers-core',
                transport: 'ccb' as const,
                receipt_path: '.planning/current/build/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('plan');
      await run('handoff');
      await expect(run('build', adapters)).rejects.toThrow('Superpowers discipline blocked build');
      expect(transportCalled).toBe(false);
      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'blocked',
        ready: false,
      });
      expect(await run.readJson('.planning/current/conflicts/build-superpowers.json')).toMatchObject({
        stage: 'build',
        adapter: 'superpowers',
        kind: 'backend_conflict',
      });
    });
  });
});
