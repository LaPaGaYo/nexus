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

const LOCAL_SUBAGENT_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'claude' as const,
  provider_topology: 'subagents' as const,
  requested_execution_path: 'claude-local-subagents',
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
      expect((await run.readJson('.planning/current/build/adapter-output.json')).transport.raw_output.summary_markdown).toContain(
        'Nexus-owned build guidance for disciplined implementation under governed routing.',
      );
      expect((await run.readJson('.planning/current/build/adapter-output.json')).transport.raw_output.summary_markdown).not.toContain(
        'placeholder',
      );

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

  test('runs the thin slice end-to-end with claude local subagents and records subagent topology explicitly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', undefined, LOCAL_SUBAGENT_EXECUTION);
      await run('build', undefined, LOCAL_SUBAGENT_EXECUTION);
      await run('review', undefined, LOCAL_SUBAGENT_EXECUTION);
      await run('qa', undefined, LOCAL_SUBAGENT_EXECUTION);
      await run('ship', undefined, LOCAL_SUBAGENT_EXECUTION);
      await run('closeout', undefined, LOCAL_SUBAGENT_EXECUTION);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'closeout',
        status: 'completed',
        execution: {
          mode: 'local_provider',
          primary_provider: 'claude',
          provider_topology: 'subagents',
          requested_path: 'claude-local-subagents',
          actual_path: 'claude-local-subagents',
        },
      });

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        provider_topology: 'subagents',
        requested_execution_path: 'claude-local-subagents',
        requested_route: {
          transport: 'local',
          generator: 'claude-local-subagents',
          evaluator_a: 'claude-local-subagents-audit-a',
          evaluator_b: 'claude-local-subagents-audit-b',
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
        provider_topology: 'subagents',
        requested_execution_path: 'claude-local-subagents',
        actual_execution_path: 'claude-local-subagents',
        requested_route: {
          transport: 'local',
          generator: 'claude-local-subagents',
        },
        actual_route: {
          provider: 'claude',
          route: 'claude-local-subagents',
          transport: 'local',
        },
      });

      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        provider_topology: 'subagents',
        implementation: {
          requested_route: {
            transport: 'local',
            generator: 'claude-local-subagents',
          },
          actual_route: {
            provider: 'claude',
            route: 'claude-local-subagents',
            transport: 'local',
          },
        },
      });

      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        execution_mode: 'local_provider',
        provider_topology: 'subagents',
        ready: true,
        actual_route: {
          provider: 'claude',
          route: 'claude-local-subagents-qa',
          transport: 'local',
        },
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
          reason: 'claude not found',
        },
        errors: ['claude not found'],
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

  test('blocks handoff when local subagents are selected for a non-claude provider', async () => {
    await runInTempRepo(async ({ run }) => {
      const reservedExecution = {
        mode: 'local_provider' as const,
        primary_provider: 'codex' as const,
        provider_topology: 'subagents' as const,
        requested_execution_path: 'codex-local-subagents',
      };

      await run('plan', undefined, reservedExecution);
      await expect(run('handoff', undefined, reservedExecution)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'subagents',
        state: 'blocked',
        decision: 'route_recorded',
        ready: false,
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'local_provider topology subagents is only active for claude',
        },
        errors: ['local_provider topology subagents is only active for claude'],
      });
    });
  });

  test('blocks handoff when a reserved local multi_session topology is configured', async () => {
    await runInTempRepo(async ({ run }) => {
      const reservedExecution = {
        mode: 'local_provider' as const,
        primary_provider: 'claude' as const,
        provider_topology: 'multi_session' as const,
        requested_execution_path: 'claude-local-multi_session',
      };

      await run('plan', undefined, reservedExecution);
      await expect(run('handoff', undefined, reservedExecution)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        provider_topology: 'multi_session',
        state: 'blocked',
        decision: 'route_recorded',
        ready: false,
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'local_provider topology multi_session is reserved and not yet active',
        },
        errors: ['local_provider topology multi_session is reserved and not yet active'],
      });

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'handoff',
        status: 'blocked',
        execution: {
          mode: 'local_provider',
          primary_provider: 'claude',
          provider_topology: 'multi_session',
          requested_path: 'claude-local-multi_session',
          actual_path: null,
        },
      });
    });
  });

  test('uses claude agent mode for local subagent execution at runtime', async () => {
    await runInTempRepo(async ({ run }) => {
      const calls: Array<{ argv: string[]; stdin_text?: string }> = [];
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        now: () => '2026-04-11T00:00:00.000Z',
        runCommand: async (spec) => {
          calls.push({ argv: spec.argv, stdin_text: spec.stdin_text });

          if (spec.argv[0] === 'which') {
            return {
              exit_code: 0,
              stdout: '/Users/henry/.local/bin/claude\n',
              stderr: '',
            };
          }

          if (spec.argv[0] === 'claude' && spec.argv.includes('--help')) {
            return {
              exit_code: 0,
              stdout: 'Usage: claude [options]\n  --agent <agent>\n  --agents <json>\n',
              stderr: '',
            };
          }

          const agentIndex = spec.argv.indexOf('--agent');
          const agent = agentIndex >= 0 ? spec.argv[agentIndex + 1] : null;

          switch (agent) {
            case 'nexus_builder':
              return {
                exit_code: 0,
                stdout: '# Build Execution Summary\n\n- Status: completed\n- Actions: applied local subagent build\n- Files touched: README.md\n- Verification: pending verifier\n',
                stderr: '',
              };
            case 'nexus_verifier':
              return {
                exit_code: 0,
                stdout: '- Verification: verifier checked the resulting repo state\n',
                stderr: '',
              };
            case 'nexus_audit_a':
              return {
                exit_code: 0,
                stdout: '# Local Audit A\n\nResult: pass\n\nFindings:\n- none\n',
                stderr: '',
              };
            case 'nexus_audit_b':
              return {
                exit_code: 0,
                stdout: '# Local Audit B\n\nResult: pass\n\nFindings:\n- none\n',
                stderr: '',
              };
            case 'nexus_qa':
              return {
                exit_code: 0,
                stdout: JSON.stringify({
                  ready: true,
                  findings: [],
                  report_markdown: '# QA Report\n\nResult: pass\n',
                }),
                stderr: '',
              };
            default:
              throw new Error(`unexpected agent invocation: ${spec.argv.join(' ')}`);
          }
        },
      });

      await run('plan', adapters, LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', adapters, LOCAL_SUBAGENT_EXECUTION);
      await run('build', adapters, LOCAL_SUBAGENT_EXECUTION);
      await run('review', adapters, LOCAL_SUBAGENT_EXECUTION);
      await run('qa', adapters, LOCAL_SUBAGENT_EXECUTION);

      expect(calls.map((call) => call.argv.join(' '))).toEqual([
        'which claude',
        'claude --help',
        expect.stringContaining('--agent nexus_builder'),
        expect.stringContaining('--agent nexus_verifier'),
        expect.stringContaining('--agent nexus_audit_a'),
        expect.stringContaining('--agent nexus_audit_b'),
        expect.stringContaining('--agent nexus_qa'),
      ]);

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        execution_mode: 'local_provider',
        provider_topology: 'subagents',
        actual_route: {
          provider: 'claude',
          route: 'claude-local-subagents',
          transport: 'local',
        },
      });
    });
  });
});
