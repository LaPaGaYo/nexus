import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus build routing', () => {
  test('records route availability and explicit Nexus approval as separate fields', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        ccb: {
          resolve_route: async () => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: { available: true, provider: 'codex' },
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
            raw_output: { available: false, provider: 'codex' },
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
        },
      });
      expect(await run.readJson('.planning/current/conflicts/handoff-ccb.json')).toMatchObject({
        stage: 'handoff',
        adapter: 'ccb',
        kind: 'backend_conflict',
      });
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
});
