import { describe, expect, test } from 'bun:test';
import { createCloseoutStagePack } from '../../lib/nexus/stage-packs/closeout';
import { createPlanStagePack } from '../../lib/nexus/stage-packs/plan';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus plan -> handoff -> build', () => {
  test('gsd stage packs stay Nexus-owned internal units', () => {
    const planPack = createPlanStagePack();
    const closeoutPack = createCloseoutStagePack();

    expect(planPack.id).toBe('nexus-plan-pack');
    expect(planPack.stage).toBe('plan');
    expect(planPack.source_binding.absorbed_capabilities).toContain('gsd-plan');

    expect(closeoutPack.id).toBe('nexus-closeout-pack');
    expect(closeoutPack.stage).toBe('closeout');
    expect(closeoutPack.source_binding.absorbed_capabilities).toContain('gsd-closeout');
  });

  test('writes ledger, stage statuses, and build request artifacts', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'build',
        status: 'active',
      });

      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'completed',
        decision: 'ready',
      });

      expect(await run.readJson('.planning/current/build/build-request.json')).toMatchObject({
        requested_route: { command: 'build', governed: true },
      });
    });
  });

  test('normalizes a GSD-ready plan into canonical planning artifacts', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        planning: {
          plan: async () => ({
            adapter_id: 'planning',
            outcome: 'success',
            raw_output: {
              execution_readiness_packet: '# Execution Readiness Packet\n\nReady\n',
              sprint_contract: '# Sprint Contract\n\nWave 1\n',
              ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-plan-pack',
              absorbed_capability: 'gsd-plan',
              source_map: ['vendor/upstream/gsd/commands/gsd/plan-phase.md'],
            },
          }),
        },
      });

      await run('plan', adapters);

      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'completed',
        decision: 'ready',
        ready: true,
      });
      expect(await run.readFile('.planning/current/plan/execution-readiness-packet.md')).toContain('Ready');
      expect(await run.readJson('.planning/current/plan/adapter-output.json')).toMatchObject({
        adapter_id: 'planning',
        outcome: 'success',
        traceability: {
          nexus_stage_pack: 'nexus-plan-pack',
          absorbed_capability: 'gsd-plan',
        },
      });
    });
  });

  test('default plan artifacts use Nexus-owned absorbed stage content', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');

      expect(await run.readFile('.planning/current/plan/execution-readiness-packet.md')).toContain(
        'Nexus-owned planning guidance for execution readiness and bounded scope.',
      );
      expect(await run.readFile('.planning/current/plan/execution-readiness-packet.md')).toContain('verify framing inputs');
      expect(await run.readFile('.planning/current/plan/sprint-contract.md')).toContain('produce sprint contract');
      expect(await run.readFile('.planning/current/plan/sprint-contract.md')).toContain(
        'Advance to `/handoff` only after Nexus declares execution ready.',
      );
    });
  });

  test('blocks plan when GSD readiness is false', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        planning: {
          plan: async () => ({
            adapter_id: 'planning',
            outcome: 'success',
            raw_output: {
              execution_readiness_packet: '# Execution Readiness Packet\n\nNot ready\n',
              sprint_contract: '# Sprint Contract\n\nWave blocked\n',
              ready: false,
            },
            requested_route: null,
            actual_route: null,
            notices: ['missing readiness'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('plan', adapters)).rejects.toThrow('Plan is not ready for execution');
      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'blocked',
        decision: 'not_ready',
        ready: false,
      });
    });
  });
});
