import { describe, expect, test } from 'bun:test';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import { createRuntimeLocalAdapter } from '../../lib/nexus/adapters/local';
import { runInTempRepo } from './helpers/temp-repo';

const LOCAL_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'claude' as const,
  provider_topology: 'single_agent' as const,
  requested_execution_path: 'claude-local-single_agent',
};

describe('nexus local_provider mode', () => {
  test('runs the thin slice end-to-end without CCB and records local provenance explicitly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, LOCAL_EXECUTION);
      await run('handoff', undefined, LOCAL_EXECUTION);
      await run('build', undefined, LOCAL_EXECUTION);
      await run('review', undefined, LOCAL_EXECUTION);
      await run('qa', undefined, LOCAL_EXECUTION);
      await run('ship', undefined, LOCAL_EXECUTION);
      await run('closeout', undefined, LOCAL_EXECUTION);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'closeout',
        status: 'completed',
        execution: {
          mode: 'local_provider',
          primary_provider: 'claude',
          provider_topology: 'single_agent',
          requested_path: 'claude-local-single_agent',
          actual_path: 'claude-local-single_agent',
        },
      });

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        provider_topology: 'single_agent',
        requested_execution_path: 'claude-local-single_agent',
        requested_route: {
          transport: 'local',
          generator: 'claude-local-single_agent',
          evaluator_a: 'claude-local-single_agent-audit-a',
          evaluator_b: 'claude-local-single_agent-audit-b',
        },
        route_validation: {
          transport: 'local',
          available: true,
          approved: true,
        },
      });

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        execution_mode: 'local_provider',
        requested_execution_path: 'claude-local-single_agent',
        actual_execution_path: 'claude-local-single_agent',
        requested_route: {
          transport: 'local',
          generator: 'claude-local-single_agent',
        },
        actual_route: {
          provider: 'claude',
          route: 'claude-local-single_agent',
          transport: 'local',
        },
      });

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        execution_mode: 'local_provider',
        review_complete: true,
        audit_set_complete: true,
        provenance_consistent: true,
      });

      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        provider_topology: 'single_agent',
        implementation: {
          requested_route: {
            transport: 'local',
            generator: 'claude-local-single_agent',
          },
          actual_route: {
            provider: 'claude',
            route: 'claude-local-single_agent',
            transport: 'local',
          },
        },
        audits: {
          codex: {
            provider: 'claude',
            requested_route: {
              transport: 'local',
              route: 'claude-local-single_agent-audit-a',
            },
            actual_route: {
              provider: 'claude',
              route: 'claude-local-single_agent-audit-a',
              transport: 'local',
            },
          },
          gemini: {
            provider: 'claude',
            requested_route: {
              transport: 'local',
              route: 'claude-local-single_agent-audit-b',
            },
            actual_route: {
              provider: 'claude',
              route: 'claude-local-single_agent-audit-b',
              transport: 'local',
            },
          },
        },
      });

      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        execution_mode: 'local_provider',
        ready: true,
        actual_route: {
          provider: 'claude',
          route: 'claude-local-single_agent-qa',
          transport: 'local',
        },
      });

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        execution_mode: 'local_provider',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('blocks handoff when local_provider mode is selected but the provider CLI is unavailable', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        runCommand: async () => ({
          exit_code: 1,
          stdout: '',
          stderr: 'claude not found',
        }),
      });

      await run('plan', adapters, LOCAL_EXECUTION);
      await expect(run('handoff', adapters, LOCAL_EXECUTION)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        state: 'blocked',
        decision: 'route_recorded',
        ready: false,
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'Local provider route validation blocked the requested route',
        },
        errors: ['Local provider route validation blocked the requested route'],
      });

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'handoff',
        status: 'blocked',
        execution: {
          mode: 'local_provider',
          primary_provider: 'claude',
          provider_topology: 'single_agent',
          requested_path: 'claude-local-single_agent',
          actual_path: null,
        },
      });
    });
  });
});
