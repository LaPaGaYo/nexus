import { writeFileSync } from 'fs';
import { describe, expect, test } from 'bun:test';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import { createRuntimeLocalAdapter, localTraceability } from '../../lib/nexus/adapters/local';
import { getStagePackSourceMap } from '../../lib/nexus/stage-packs';
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

const LOCAL_AGENT_TEAM_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'claude' as const,
  provider_topology: 'agent_team' as const,
  requested_execution_path: 'claude-local-agent_team',
};

const CODEX_LOCAL_SUBAGENT_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'codex' as const,
  provider_topology: 'subagents' as const,
  requested_execution_path: 'codex-local-subagents',
};

const CODEX_LOCAL_MULTI_SESSION_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'codex' as const,
  provider_topology: 'multi_session' as const,
  requested_execution_path: 'codex-local-multi_session',
};

const CODEX_LOCAL_AGENT_TEAM_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'codex' as const,
  provider_topology: 'agent_team' as const,
  requested_execution_path: 'codex-local-agent_team',
};

const GEMINI_LOCAL_SUBAGENT_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'gemini' as const,
  provider_topology: 'subagents' as const,
  requested_execution_path: 'gemini-local-subagents',
};

const LOCAL_TRACEABILITY_PACK_CASES = [
  { absorbedCapability: 'local-provider-routing', nexusStagePack: 'nexus-handoff-pack' },
  { absorbedCapability: 'local-provider-execution', nexusStagePack: 'nexus-build-pack' },
  { absorbedCapability: 'local-provider-review-a', nexusStagePack: 'nexus-review-pack' },
  { absorbedCapability: 'local-provider-review-b', nexusStagePack: 'nexus-review-pack' },
  { absorbedCapability: 'local-provider-qa', nexusStagePack: 'nexus-qa-pack' },
  { absorbedCapability: 'local-provider-ship-personas', nexusStagePack: 'nexus-ship-pack' },
] as const;

describe('nexus local_provider mode', () => {
  test.each(LOCAL_TRACEABILITY_PACK_CASES)(
    'local traceability maps $absorbedCapability to $nexusStagePack',
    ({ absorbedCapability, nexusStagePack }) => {
      expect(localTraceability(absorbedCapability)).toMatchObject({
        nexus_stage_pack: nexusStagePack,
        absorbed_capability: absorbedCapability,
        source_map: getStagePackSourceMap(nexusStagePack),
      });
    });

  test('local traceability rejects unknown local capabilities instead of falling through', () => {
    expect(() => localTraceability('local-provider-unknown')).toThrow(
      "localTraceability: unknown absorbedCapability 'local-provider-unknown' - add it to LOCAL_ABSORBED_CAPABILITY_TO_PACK",
    );
  });

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
      expect(await run.readJson('.planning/current/handoff/adapter-output.json')).toMatchObject({
        traceability: {
          nexus_stage_pack: 'nexus-handoff-pack',
          absorbed_capability: 'local-provider-routing',
          source_map: getStagePackSourceMap('nexus-handoff-pack'),
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
      expect(await run.readJson('.planning/current/ship/normalization.json')).toMatchObject({
        local_ship_persona_result: {
          traceability: {
            nexus_stage_pack: 'nexus-ship-pack',
            absorbed_capability: 'local-provider-ship-personas',
            source_map: getStagePackSourceMap('nexus-ship-pack'),
          },
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

  test('runs the thin slice end-to-end with claude local agent_team and records topology explicitly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, LOCAL_AGENT_TEAM_EXECUTION);
      await run('handoff', undefined, LOCAL_AGENT_TEAM_EXECUTION);
      await run('build', undefined, LOCAL_AGENT_TEAM_EXECUTION);
      await run('review', undefined, LOCAL_AGENT_TEAM_EXECUTION);
      await run('qa', undefined, LOCAL_AGENT_TEAM_EXECUTION);
      await run('ship', undefined, LOCAL_AGENT_TEAM_EXECUTION);
      await run('closeout', undefined, LOCAL_AGENT_TEAM_EXECUTION);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'closeout',
        status: 'completed',
        execution: {
          mode: 'local_provider',
          primary_provider: 'claude',
          provider_topology: 'agent_team',
          requested_path: 'claude-local-agent_team',
          actual_path: 'claude-local-agent_team',
        },
      });

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'claude',
        provider_topology: 'agent_team',
        requested_execution_path: 'claude-local-agent_team',
        requested_route: {
          transport: 'local',
          generator: 'claude-local-agent_team',
          evaluator_a: 'claude-local-agent_team-audit-a',
          evaluator_b: 'claude-local-agent_team-audit-b',
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
        provider_topology: 'agent_team',
        requested_execution_path: 'claude-local-agent_team',
        actual_execution_path: 'claude-local-agent_team',
        actual_route: {
          provider: 'claude',
          route: 'claude-local-agent_team',
          transport: 'local',
        },
      });

      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        execution_mode: 'local_provider',
        provider_topology: 'agent_team',
        ready: true,
        actual_route: {
          provider: 'claude',
          route: 'claude-local-agent_team-qa',
          transport: 'local',
        },
      });
    });
  });

  test('runs the thin slice end-to-end with codex local subagents and records subagent topology explicitly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('build', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('review', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('qa', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('ship', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('closeout', undefined, CODEX_LOCAL_SUBAGENT_EXECUTION);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'closeout',
        status: 'completed',
        execution: {
          mode: 'local_provider',
          primary_provider: 'codex',
          provider_topology: 'subagents',
          requested_path: 'codex-local-subagents',
          actual_path: 'codex-local-subagents',
        },
      });

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'subagents',
        requested_execution_path: 'codex-local-subagents',
        requested_route: {
          transport: 'local',
          generator: 'codex-local-subagents',
          evaluator_a: 'codex-local-subagents-audit-a',
          evaluator_b: 'codex-local-subagents-audit-b',
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
        requested_execution_path: 'codex-local-subagents',
        actual_execution_path: 'codex-local-subagents',
        requested_route: {
          transport: 'local',
          generator: 'codex-local-subagents',
        },
        actual_route: {
          provider: 'codex',
          route: 'codex-local-subagents',
          transport: 'local',
        },
      });

      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'subagents',
        implementation: {
          requested_route: {
            transport: 'local',
            generator: 'codex-local-subagents',
          },
          actual_route: {
            provider: 'codex',
            route: 'codex-local-subagents',
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
          provider: 'codex',
          route: 'codex-local-subagents-qa',
          transport: 'local',
        },
      });
    });
  });

  test('runs the thin slice end-to-end with codex local multi_session and records topology explicitly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('handoff', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('build', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('review', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('qa', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('ship', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('closeout', undefined, CODEX_LOCAL_MULTI_SESSION_EXECUTION);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'closeout',
        status: 'completed',
        execution: {
          mode: 'local_provider',
          primary_provider: 'codex',
          provider_topology: 'multi_session',
          requested_path: 'codex-local-multi_session',
          actual_path: 'codex-local-multi_session',
        },
      });

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        requested_execution_path: 'codex-local-multi_session',
        requested_route: {
          transport: 'local',
          generator: 'codex-local-multi_session',
          evaluator_a: 'codex-local-multi_session-audit-a',
          evaluator_b: 'codex-local-multi_session-audit-b',
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
        provider_topology: 'multi_session',
        requested_execution_path: 'codex-local-multi_session',
        actual_execution_path: 'codex-local-multi_session',
        actual_route: {
          provider: 'codex',
          route: 'codex-local-multi_session',
          transport: 'local',
        },
      });
    });
  });

  test('runs the thin slice end-to-end with gemini local subagents and records subagent topology explicitly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('build', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('review', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('qa', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('ship', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('closeout', undefined, GEMINI_LOCAL_SUBAGENT_EXECUTION);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'closeout',
        status: 'completed',
        execution: {
          mode: 'local_provider',
          primary_provider: 'gemini',
          provider_topology: 'subagents',
          requested_path: 'gemini-local-subagents',
          actual_path: 'gemini-local-subagents',
        },
      });

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'gemini',
        provider_topology: 'subagents',
        requested_execution_path: 'gemini-local-subagents',
        requested_route: {
          transport: 'local',
          generator: 'gemini-local-subagents',
          evaluator_a: 'gemini-local-subagents-audit-a',
          evaluator_b: 'gemini-local-subagents-audit-b',
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
        requested_execution_path: 'gemini-local-subagents',
        actual_execution_path: 'gemini-local-subagents',
        actual_route: {
          provider: 'gemini',
          route: 'gemini-local-subagents',
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

  test('blocks handoff when codex local subagents are selected but codex CLI is unavailable', async () => {
    await runInTempRepo(async ({ run }) => {
      const calls: string[] = [];
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        runCommand: async (spec) => {
          calls.push(spec.argv.join(' '));
          if (spec.argv[0] === 'which') {
            return {
              exit_code: 1,
              stdout: '',
              stderr: 'codex not found',
            };
          }
          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      await run('plan', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await expect(run('handoff', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(calls).toEqual(['which codex']);
      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'subagents',
        state: 'blocked',
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'codex not found',
        },
        errors: ['codex not found'],
      });
    });
  });

  test('blocks handoff when codex local subagents lack exec stdin support', async () => {
    await runInTempRepo(async ({ run }) => {
      const calls: string[] = [];
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        runCommand: async (spec) => {
          calls.push(spec.argv.join(' '));
          if (spec.argv[0] === 'which') {
            return {
              exit_code: 0,
              stdout: '/Users/henry/.local/bin/codex\n',
              stderr: '',
            };
          }
          if (spec.argv[0] === 'codex' && spec.argv.includes('--help')) {
            return {
              exit_code: 0,
              stdout: 'Usage: codex [OPTIONS] [PROMPT]\nDescription: Run `codex exec -` to pipe stdin.\nCommands:\n  review\n  resume\n',
              stderr: '',
            };
          }
          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      await run('plan', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await expect(run('handoff', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(calls).toEqual(['which codex', 'codex --help']);
      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'subagents',
        state: 'blocked',
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'codex CLI does not support exec - for local_provider subagents',
        },
        errors: ['codex CLI does not support exec - for local_provider subagents'],
      });
    });
  });

  test('blocks handoff when gemini local subagents are selected but gemini CLI is unavailable', async () => {
    await runInTempRepo(async ({ run }) => {
      const calls: string[] = [];
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        runCommand: async (spec) => {
          calls.push(spec.argv.join(' '));
          if (spec.argv[0] === 'which') {
            return {
              exit_code: 1,
              stdout: '',
              stderr: 'gemini not found',
            };
          }
          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      await run('plan', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await expect(run('handoff', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(calls).toEqual(['which gemini']);
      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'gemini',
        provider_topology: 'subagents',
        state: 'blocked',
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'gemini not found',
        },
        errors: ['gemini not found'],
      });
    });
  });

  test('blocks handoff when gemini local subagents lack prompt and yolo support', async () => {
    await runInTempRepo(async ({ run }) => {
      const calls: string[] = [];
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        runCommand: async (spec) => {
          calls.push(spec.argv.join(' '));
          if (spec.argv[0] === 'which') {
            return {
              exit_code: 0,
              stdout: '/Users/henry/.local/bin/gemini\n',
              stderr: '',
            };
          }
          if (spec.argv[0] === 'gemini' && spec.argv.includes('--help')) {
            return {
              exit_code: 0,
              stdout: 'Usage: gemini [OPTIONS]\n  --profile <name>\n  --proxy <url>\n  --output-format <format>\n  --yolo\n',
              stderr: '',
            };
          }
          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      await run('plan', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await expect(run('handoff', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(calls).toEqual(['which gemini', 'gemini --help']);
      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'gemini',
        provider_topology: 'subagents',
        state: 'blocked',
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'gemini CLI does not support -p and --yolo for local_provider subagents',
        },
        errors: ['gemini CLI does not support -p and --yolo for local_provider subagents'],
      });
    });
  });

  test('blocks handoff when local multi_session is selected for claude', async () => {
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
          reason: 'local_provider topology multi_session is only active for codex',
        },
        errors: ['local_provider topology multi_session is only active for codex'],
      });
    });
  });

  test('blocks handoff when local agent_team is selected for codex', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan', undefined, CODEX_LOCAL_AGENT_TEAM_EXECUTION);
      await expect(run('handoff', undefined, CODEX_LOCAL_AGENT_TEAM_EXECUTION)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'agent_team',
        state: 'blocked',
        decision: 'route_recorded',
        ready: false,
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'local_provider topology agent_team is only active for claude',
        },
        errors: ['local_provider topology agent_team is only active for claude'],
      });
    });
  });

  test('blocks handoff when claude local agent_team is selected but claude is too old', async () => {
    const previousAgentTeamsEnv = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';

    try {
      await runInTempRepo(async ({ run }) => {
        const adapters = getDefaultNexusAdapters();
        adapters.local = createRuntimeLocalAdapter({
          runCommand: async (spec) => {
            if (spec.argv[0] === 'which') {
              return {
                exit_code: 0,
                stdout: '/Users/henry/.local/bin/claude\n',
                stderr: '',
              };
            }
            if (spec.argv[0] === 'claude' && spec.argv.includes('--version')) {
              return {
                exit_code: 0,
                stdout: '2.1.31 (Claude Code)\n',
                stderr: '',
              };
            }
            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          },
        });

        await run('plan', adapters, LOCAL_AGENT_TEAM_EXECUTION);
        await expect(run('handoff', adapters, LOCAL_AGENT_TEAM_EXECUTION)).rejects.toThrow(
          'Local provider route is not approved by Nexus',
        );

        expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
          stage: 'handoff',
          execution_mode: 'local_provider',
          primary_provider: 'claude',
          provider_topology: 'agent_team',
          state: 'blocked',
          route_validation: {
            available: false,
            approved: false,
            reason: 'Claude Code agent teams require claude >= 2.1.32',
          },
        });
      });
    } finally {
      if (typeof previousAgentTeamsEnv === 'undefined') {
        delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      } else {
        process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = previousAgentTeamsEnv;
      }
    }
  });

  test('blocks handoff when local multi_session is selected for gemini', async () => {
    await runInTempRepo(async ({ run }) => {
      const reservedExecution = {
        mode: 'local_provider' as const,
        primary_provider: 'gemini' as const,
        provider_topology: 'multi_session' as const,
        requested_execution_path: 'gemini-local-multi_session',
      };

      await run('plan', undefined, reservedExecution);
      await expect(run('handoff', undefined, reservedExecution)).rejects.toThrow(
        'Local provider route is not approved by Nexus',
      );

      expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
        stage: 'handoff',
        execution_mode: 'local_provider',
        primary_provider: 'gemini',
        provider_topology: 'multi_session',
        state: 'blocked',
        decision: 'route_recorded',
        ready: false,
        route_validation: {
          transport: 'local',
          available: false,
          approved: false,
          reason: 'local_provider topology multi_session is only active for codex',
        },
        errors: ['local_provider topology multi_session is only active for codex'],
      });

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'handoff',
        status: 'blocked',
        execution: {
          mode: 'local_provider',
          primary_provider: 'gemini',
          provider_topology: 'multi_session',
          requested_path: 'gemini-local-multi_session',
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
            case 'nexus_review_code':
            case 'nexus_review_test':
            case 'nexus_review_security':
            case 'nexus_review_design':
              return {
                exit_code: 0,
                stdout: `# Local Review Persona: ${agent.replace('nexus_review_', '')}\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n`,
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
        expect.stringContaining('--agent nexus_review_code'),
        expect.stringContaining('--agent nexus_review_test'),
        expect.stringContaining('--agent nexus_review_security'),
        expect.stringContaining('--agent nexus_review_design'),
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

  test('ignores malformed optional QA learning candidates without blocking a valid local QA result', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        now: () => '2026-04-11T00:00:00.000Z',
        runCommand: async (spec) => {
          if (spec.argv[0] === 'which') {
            return {
              exit_code: 0,
              stdout: '/Users/henry/.local/bin/claude\n',
              stderr: '',
            };
          }

          if (spec.argv[0] !== 'claude') {
            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          }

          const prompt = spec.stdin_text ?? '';
          if (prompt.includes('Execute the bounded Nexus /build contract')) {
            return {
              exit_code: 0,
              stdout: '# Build Execution Summary\n\n- Status: completed\n- Actions: applied local build\n- Files touched: README.md\n- Verification: checked current repo state\n',
              stderr: '',
            };
          }
          if (prompt.includes('local Nexus /review audit pass A')) {
            return {
              exit_code: 0,
              stdout: '# Local Audit A\n\nResult: pass\n\nFindings:\n- none\n',
              stderr: '',
            };
          }
          if (prompt.includes('local Nexus /review audit pass B')) {
            return {
              exit_code: 0,
              stdout: '# Local Audit B\n\nResult: pass\n\nFindings:\n- none\n',
              stderr: '',
            };
          }
          if (prompt.includes('Perform Nexus /qa validation')) {
            return {
              exit_code: 0,
              stdout: JSON.stringify({
                ready: true,
                findings: [],
                advisories: ['sample non-blocking note'],
                report_markdown: '# QA Report\n\nResult: pass\n\n507 passed, 2 skipped.\n',
                learning_candidates: [
                  {
                    title: 'Fork QA discipline',
                    category: 'qa',
                    context: 'Malformed ancillary learning candidates should not discard QA evidence.',
                    rule: 'Ignore invalid optional learning candidates and keep the core QA verdict.',
                    applies_to: ['local_provider'],
                  },
                ],
              }),
              stderr: '',
            };
          }

          throw new Error(`unexpected prompt: ${prompt}`);
        },
      });

      await run('plan', adapters, LOCAL_EXECUTION);
      await run('handoff', adapters, LOCAL_EXECUTION);
      await run('build', adapters, LOCAL_EXECUTION);
      await run('review', adapters, LOCAL_EXECUTION);
      await run('qa', adapters, LOCAL_EXECUTION);

      expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
        stage: 'qa',
        state: 'completed',
        ready: true,
        learning_candidates_path: null,
        learnings_recorded: false,
        defect_count: 0,
      });
      expect(await run.readFile('.planning/current/qa/qa-report.md')).toContain('507 passed, 2 skipped');
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'qa',
        status: 'active',
        allowed_next_stages: ['ship', 'closeout'],
      });
    });
  });

  test('uses claude agent-team mode for local execution at runtime', async () => {
    const previousAgentTeamsEnv = process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
    process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1';

    try {
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

            if (spec.argv[0] === 'claude' && spec.argv.includes('--version')) {
              return {
                exit_code: 0,
                stdout: '2.1.119 (Claude Code)\n',
                stderr: '',
              };
            }

            if (spec.argv[0] !== 'claude' || !spec.argv.includes('--teammate-mode')) {
              throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
            }

            const prompt = spec.stdin_text ?? '';
            if (prompt.includes('Nexus /build stage')) {
              return {
                exit_code: 0,
                stdout: '# Build Execution Summary\n\n- Status: completed\n- Actions: applied local agent-team build\n- Files touched: README.md\n- Verification: agent team verifier checked the resulting repo state\n',
                stderr: '',
              };
            }
            if (prompt.includes('audit slot A')) {
              return {
                exit_code: 0,
                stdout: '# Local Persona Audit A\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n\nPersona evidence:\n- code/test team passed\n',
                stderr: '',
              };
            }
            if (prompt.includes('audit slot B')) {
              return {
                exit_code: 0,
                stdout: '# Local Persona Audit B\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n\nPersona evidence:\n- security/design team passed\n',
                stderr: '',
              };
            }
            if (prompt.includes('Nexus /qa validation')) {
              return {
                exit_code: 0,
                stdout: JSON.stringify({
                  ready: true,
                  findings: [],
                  advisories: [],
                  report_markdown: '# QA Report\n\nResult: pass\n',
                }),
                stderr: '',
              };
            }
            if (prompt.includes('Nexus /ship release gate')) {
              return {
                exit_code: 0,
                stdout: '# Local Agent Team Ship Release Gate\n\nResult: pass\nMerge ready: yes\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            }

            throw new Error(`unexpected agent-team prompt: ${prompt}`);
          },
        });

        await run('plan', adapters, LOCAL_AGENT_TEAM_EXECUTION);
        await run('handoff', adapters, LOCAL_AGENT_TEAM_EXECUTION);
        await run('build', adapters, LOCAL_AGENT_TEAM_EXECUTION);
        await run('review', adapters, LOCAL_AGENT_TEAM_EXECUTION);
        await run('qa', adapters, LOCAL_AGENT_TEAM_EXECUTION);
        await run('ship', adapters, LOCAL_AGENT_TEAM_EXECUTION);

        expect(calls.map((call) => call.argv.join(' '))).toEqual([
          'which claude',
          'claude --version',
          expect.stringContaining('--teammate-mode in-process'),
          expect.stringContaining('--teammate-mode in-process'),
          expect.stringContaining('--teammate-mode in-process'),
          expect.stringContaining('--teammate-mode in-process'),
          expect.stringContaining('--teammate-mode in-process'),
        ]);

        expect(calls[2]?.stdin_text).toContain('Create a Claude Code agent team for this Nexus /build stage.');
        expect(calls[3]?.stdin_text).toContain('audit slot A');
        expect(calls[4]?.stdin_text).toContain('audit slot B');
        expect(calls[5]?.stdin_text).toContain('Nexus /qa validation');
        expect(calls[6]?.stdin_text).toContain('release / QA / security / docs-deploy gates');

        expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
          execution_mode: 'local_provider',
          provider_topology: 'agent_team',
          route_validation: {
            available: true,
            approved: true,
          },
        });

        expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
          execution_mode: 'local_provider',
          provider_topology: 'agent_team',
          actual_route: {
            provider: 'claude',
            route: 'claude-local-agent_team',
            transport: 'local',
          },
        });
        expect((await run.readJson('.planning/current/build/adapter-output.json')).transport.raw_output.dispatch_command).toContain(
          '--teammate-mode in-process',
        );

        expect(await run.readFile('.planning/audits/current/codex.md')).toContain('# Local Persona Audit A');
        expect(await run.readFile('.planning/audits/current/gemini.md')).toContain('# Local Persona Audit B');
        expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
          execution_mode: 'local_provider',
          provider_topology: 'agent_team',
          gate_decision: 'pass',
          ready: true,
        });

        expect(await run.readJson('.planning/current/qa/status.json')).toMatchObject({
          execution_mode: 'local_provider',
          provider_topology: 'agent_team',
          ready: true,
        });

        expect(await run.readFile('.planning/current/ship/persona-gates/release.md')).toContain(
          '# Local Agent Team Ship Release Gate',
        );
        expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
          execution_mode: 'local_provider',
          provider_topology: 'agent_team',
          ready: true,
          local_persona_ship: {
            enabled: true,
            roles: ['release', 'qa', 'security', 'docs_deploy'],
          },
        });
      });
    } finally {
      if (typeof previousAgentTeamsEnv === 'undefined') {
        delete process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      } else {
        process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = previousAgentTeamsEnv;
      }
    }
  });

  test('persists local review persona fan-out evidence for claude subagents', async () => {
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
            case 'nexus_review_code':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Code\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_review_test':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Test\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_review_security':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Security\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_review_design':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Design\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
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

      expect(calls.map((call) => call.argv.join(' '))).toEqual([
        'which claude',
        'claude --help',
        expect.stringContaining('--agent nexus_builder'),
        expect.stringContaining('--agent nexus_verifier'),
        expect.stringContaining('--agent nexus_review_code'),
        expect.stringContaining('--agent nexus_review_test'),
        expect.stringContaining('--agent nexus_review_security'),
        expect.stringContaining('--agent nexus_review_design'),
      ]);

      expect(await run.readFile('.planning/current/review/persona-audits/code.md')).toContain(
        '# Local Review Persona: Code',
      );
      expect(await run.readFile('.planning/current/review/persona-audits/test.md')).toContain(
        '# Local Review Persona: Test',
      );
      expect(await run.readFile('.planning/current/review/persona-audits/security.md')).toContain(
        '# Local Review Persona: Security',
      );
      expect(await run.readFile('.planning/current/review/persona-audits/design.md')).toContain(
        '# Local Review Persona: Design',
      );

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        execution_mode: 'local_provider',
        provider_topology: 'subagents',
        local_persona_review: {
          enabled: true,
          roles: ['code', 'test', 'security', 'design'],
          artifact_paths: [
            '.planning/current/review/persona-audits/code.md',
            '.planning/current/review/persona-audits/test.md',
            '.planning/current/review/persona-audits/security.md',
            '.planning/current/review/persona-audits/design.md',
          ],
        },
      });

      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        local_persona_review: {
          enabled: true,
          roles: ['code', 'test', 'security', 'design'],
        },
      });

      const synthesis = await run.readFile('.planning/audits/current/synthesis.md');
      expect(synthesis).toContain('Local audit A (code/test) result: pass');
      expect(synthesis).toContain('Local audit B (security/design) result: pass');
      expect(synthesis).not.toContain('Codex audit result');
      expect(synthesis).not.toContain('Gemini audit result');
    });
  });

  test('uses local ship personas as a release gate for claude subagents', async () => {
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
            case 'nexus_review_code':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Code\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_review_test':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Test\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_review_security':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Security\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_review_design':
              return {
                exit_code: 0,
                stdout: '# Local Review Persona: Design\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
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
            case 'nexus_ship_release':
              return {
                exit_code: 0,
                stdout: '# Local Ship Persona: Release\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_ship_qa':
              return {
                exit_code: 0,
                stdout: '# Local Ship Persona: QA\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_ship_security':
              return {
                exit_code: 0,
                stdout: '# Local Ship Persona: Security\n\nResult: fail\n\nFindings:\n- Release is blocked by an unresolved secret exposure risk.\n\nAdvisories:\n- none\n',
                stderr: '',
              };
            case 'nexus_ship_docs_deploy':
              return {
                exit_code: 0,
                stdout: '# Local Ship Persona: Docs/Deploy\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
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
      await run('ship', adapters, LOCAL_SUBAGENT_EXECUTION);

      expect(calls.map((call) => call.argv.join(' '))).toEqual([
        'which claude',
        'claude --help',
        expect.stringContaining('--agent nexus_builder'),
        expect.stringContaining('--agent nexus_verifier'),
        expect.stringContaining('--agent nexus_review_code'),
        expect.stringContaining('--agent nexus_review_test'),
        expect.stringContaining('--agent nexus_review_security'),
        expect.stringContaining('--agent nexus_review_design'),
        expect.stringContaining('--agent nexus_qa'),
        expect.stringContaining('--agent nexus_ship_release'),
        expect.stringContaining('--agent nexus_ship_qa'),
        expect.stringContaining('--agent nexus_ship_security'),
        expect.stringContaining('--agent nexus_ship_docs_deploy'),
      ]);

      expect(await run.readFile('.planning/current/ship/persona-gates/release.md')).toContain(
        '# Local Ship Persona: Release',
      );
      expect(await run.readFile('.planning/current/ship/persona-gates/qa.md')).toContain(
        '# Local Ship Persona: QA',
      );
      expect(await run.readFile('.planning/current/ship/persona-gates/security.md')).toContain(
        'Result: fail',
      );
      expect(await run.readFile('.planning/current/ship/persona-gates/docs-deploy.md')).toContain(
        '# Local Ship Persona: Docs/Deploy',
      );
      expect(await run.readFile('.planning/current/ship/release-gate-record.md')).toContain(
        '# Local Ship Persona Release Gate',
      );

      expect(await run.readJson('.planning/current/ship/status.json')).toMatchObject({
        execution_mode: 'local_provider',
        provider_topology: 'subagents',
        ready: false,
        errors: ['Local ship persona release gate failed'],
        local_persona_ship: {
          enabled: true,
          roles: ['release', 'qa', 'security', 'docs_deploy'],
          artifact_paths: [
            '.planning/current/ship/persona-gates/release.md',
            '.planning/current/ship/persona-gates/qa.md',
            '.planning/current/ship/persona-gates/security.md',
            '.planning/current/ship/persona-gates/docs-deploy.md',
          ],
          gate_affecting_roles: ['release', 'qa', 'security', 'docs_deploy'],
          advisory_only_roles: [],
        },
      });

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'ship',
        status: 'blocked',
      });
    });
  });

  test('uses codex role-specific passes for local subagent execution at runtime', async () => {
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
              stdout: '/Users/henry/.local/bin/codex\n',
              stderr: '',
            };
          }

          if (spec.argv[0] === 'codex' && spec.argv.includes('--help')) {
            return {
              exit_code: 0,
              stdout: 'Usage: codex [OPTIONS] [PROMPT]\nCommands:\n  exec -\n  review\n  resume\n',
              stderr: '',
            };
          }

          if (spec.argv[0] !== 'codex') {
            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          }

          const outputFlag = spec.argv.indexOf('--output-last-message');
          const outputPath = outputFlag >= 0 ? spec.argv[outputFlag + 1] : null;
          if (!outputPath) {
            throw new Error(`missing --output-last-message: ${spec.argv.join(' ')}`);
          }

          const prompt = spec.stdin_text ?? '';
          let payload = '';
          if (prompt.includes('nexus_builder')) {
            payload = '# Build Execution Summary\n\n- Status: completed\n- Actions: applied codex local subagent build\n- Files touched: README.md\n- Verification: pending verifier\n';
          } else if (prompt.includes('nexus_verifier')) {
            payload = '- Verification: verifier checked the resulting repo state\n';
          } else if (prompt.includes('nexus_review_code')) {
            payload = '# Local Review Persona: Code\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_review_test')) {
            payload = '# Local Review Persona: Test\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_review_security')) {
            payload = '# Local Review Persona: Security\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_review_design')) {
            payload = '# Local Review Persona: Design\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_qa')) {
            payload = JSON.stringify({
              ready: true,
              findings: [],
              report_markdown: '# QA Report\n\nResult: pass\n',
            });
          } else {
            throw new Error(`unexpected codex prompt: ${prompt}`);
          }

          writeFileSync(outputPath, payload, 'utf8');
          return {
            exit_code: 0,
            stdout: '',
            stderr: '',
          };
        },
      });

      await run('plan', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('build', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('review', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);
      await run('qa', adapters, CODEX_LOCAL_SUBAGENT_EXECUTION);

      expect(calls.map((call) => call.argv[0])).toEqual([
        'which',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
      ]);
      expect(calls[1]?.argv.join(' ')).toContain('codex --help');
      expect(calls.slice(2).every((call) => call.argv.includes('exec'))).toBe(true);
      expect(calls.slice(2).every((call) => call.argv.includes('--output-last-message'))).toBe(true);
      expect(calls[2]?.stdin_text).toContain('nexus_builder');
      expect(calls[3]?.stdin_text).toContain('nexus_verifier');
      expect(calls[4]?.stdin_text).toContain('nexus_review_code');
      expect(calls[5]?.stdin_text).toContain('nexus_review_test');
      expect(calls[6]?.stdin_text).toContain('nexus_review_security');
      expect(calls[7]?.stdin_text).toContain('nexus_review_design');
      expect(calls[8]?.stdin_text).toContain('nexus_qa');

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'subagents',
        actual_route: {
          provider: 'codex',
          route: 'codex-local-subagents',
          transport: 'local',
        },
      });
    });
  });

  test('accepts codex and gemini subagent support flags emitted on stderr', async () => {
    const cases = [
      {
        provider: 'codex',
        execution: CODEX_LOCAL_SUBAGENT_EXECUTION,
        helpStdout: '',
        helpStderr: 'Usage: codex [OPTIONS] [PROMPT]\nCommands:\n  exec -\n  review\n  resume\n',
        expectedOutput: 'exec -',
      },
      {
        provider: 'gemini',
        execution: GEMINI_LOCAL_SUBAGENT_EXECUTION,
        helpStdout: '',
        helpStderr: 'Usage: gemini [OPTIONS]\n  -p, --prompt <prompt>\n  --output-format <format>\n  --yolo\n',
        expectedOutput: '--yolo',
      },
    ] as const;

    for (const testCase of cases) {
      await runInTempRepo(async ({ run }) => {
        const adapters = getDefaultNexusAdapters();
        adapters.local = createRuntimeLocalAdapter({
          runCommand: async (spec) => {
            if (spec.argv[0] === 'which') {
              return {
                exit_code: 0,
                stdout: `/Users/henry/.local/bin/${testCase.provider}\n`,
                stderr: '',
              };
            }

            if (spec.argv[0] === testCase.provider && spec.argv.includes('--help')) {
              return {
                exit_code: 0,
                stdout: testCase.helpStdout,
                stderr: testCase.helpStderr,
              };
            }

            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          },
        });

        await run('plan', adapters, testCase.execution);
        await run('handoff', adapters, testCase.execution);

        expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
          route_validation: {
            available: true,
            approved: true,
          },
        });
        expect(await run.readJson('.planning/current/handoff/adapter-output.json')).toMatchObject({
          raw_output: {
            verification_commands: [
              `which ${testCase.provider}`,
              `${testCase.provider} --help`,
            ],
            verification_output: expect.stringContaining(testCase.expectedOutput),
          },
        });
      });
    }
  });

  test('blocks codex and gemini subagents when help exits non-zero even with supported flags in stdout', async () => {
    const cases = [
      {
        provider: 'codex',
        execution: CODEX_LOCAL_SUBAGENT_EXECUTION,
        helpStdout: 'Usage: codex [OPTIONS] [PROMPT]\nCommands:\n  exec -\n  review\n  resume\n',
        expectedOutput: 'exec -',
      },
      {
        provider: 'gemini',
        execution: GEMINI_LOCAL_SUBAGENT_EXECUTION,
        helpStdout: 'Usage: gemini [OPTIONS]\n  -p, --prompt <prompt>\n  --output-format <format>\n  --yolo\n',
        expectedOutput: '--yolo',
      },
    ] as const;

    for (const testCase of cases) {
      await runInTempRepo(async ({ run }) => {
        const adapters = getDefaultNexusAdapters();
        adapters.local = createRuntimeLocalAdapter({
          runCommand: async (spec) => {
            if (spec.argv[0] === 'which') {
              return {
                exit_code: 0,
                stdout: `/Users/henry/.local/bin/${testCase.provider}\n`,
                stderr: '',
              };
            }

            if (spec.argv[0] === testCase.provider && spec.argv.includes('--help')) {
              return {
                exit_code: 1,
                stdout: testCase.helpStdout,
                stderr: 'help failed',
              };
            }

            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          },
        });

        await run('plan', adapters, testCase.execution);
        await expect(run('handoff', adapters, testCase.execution)).rejects.toThrow(
          'Local provider route is not approved by Nexus',
        );

        expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
          route_validation: {
            available: false,
            approved: false,
          },
        });
        expect(await run.readJson('.planning/current/handoff/adapter-output.json')).toMatchObject({
          raw_output: {
            verification_commands: [
              `which ${testCase.provider}`,
              `${testCase.provider} --help`,
            ],
            verification_output: expect.stringContaining(testCase.expectedOutput),
          },
        });
      });
    }
  });

  test('uses codex role-specific passes for local multi_session execution at runtime', async () => {
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
              stdout: '/Users/henry/.local/bin/codex\n',
              stderr: '',
            };
          }

          if (spec.argv[0] === 'codex' && spec.argv.includes('--help')) {
            return {
              exit_code: 0,
              stdout: 'Usage: codex [OPTIONS] [PROMPT]\nCommands:\n  exec\n  review\n  resume\n  fork\n',
              stderr: '',
            };
          }

          if (spec.argv[0] !== 'codex') {
            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          }

          const outputFlag = spec.argv.indexOf('--output-last-message');
          const outputPath = outputFlag >= 0 ? spec.argv[outputFlag + 1] : null;
          if (!outputPath) {
            throw new Error(`missing --output-last-message: ${spec.argv.join(' ')}`);
          }

          const prompt = spec.stdin_text ?? '';
          let payload = '';
          if (prompt.includes('nexus_builder')) {
            payload = '# Build Execution Summary\n\n- Status: completed\n- Actions: applied codex local multi-session build\n- Files touched: README.md\n- Verification: pending verifier\n';
          } else if (prompt.includes('nexus_verifier')) {
            payload = '- Verification: verifier checked the resulting repo state\n';
          } else if (prompt.includes('nexus_review_code')) {
            payload = '# Local Review Persona: Code\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_review_test')) {
            payload = '# Local Review Persona: Test\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_review_security')) {
            payload = '# Local Review Persona: Security\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_review_design')) {
            payload = '# Local Review Persona: Design\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n';
          } else if (prompt.includes('nexus_qa')) {
            payload = JSON.stringify({
              ready: true,
              findings: [],
              report_markdown: '# QA Report\n\nResult: pass\n',
            });
          } else {
            throw new Error(`unexpected codex prompt: ${prompt}`);
          }

          writeFileSync(outputPath, payload, 'utf8');
          return {
            exit_code: 0,
            stdout: '',
            stderr: '',
          };
        },
      });

      await run('plan', adapters, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('handoff', adapters, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('build', adapters, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('review', adapters, CODEX_LOCAL_MULTI_SESSION_EXECUTION);
      await run('qa', adapters, CODEX_LOCAL_MULTI_SESSION_EXECUTION);

      expect(calls.map((call) => call.argv[0])).toEqual([
        'which',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
        'codex',
      ]);
      expect(calls[1]?.argv.join(' ')).toContain('codex --help');
      expect(calls.slice(2).every((call) => call.argv.includes('exec'))).toBe(true);
      expect(calls[2]?.stdin_text).toContain('nexus_builder');
      expect(calls[3]?.stdin_text).toContain('nexus_verifier');
      expect(calls[4]?.stdin_text).toContain('nexus_review_code');
      expect(calls[5]?.stdin_text).toContain('nexus_review_test');
      expect(calls[6]?.stdin_text).toContain('nexus_review_security');
      expect(calls[7]?.stdin_text).toContain('nexus_review_design');
      expect(calls[8]?.stdin_text).toContain('nexus_qa');

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        execution_mode: 'local_provider',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        actual_route: {
          provider: 'codex',
          route: 'codex-local-multi_session',
          transport: 'local',
        },
      });
    });
  });

  test('uses gemini role-specific passes for local subagent execution at runtime', async () => {
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
              stdout: '/Users/henry/.local/bin/gemini\n',
              stderr: '',
            };
          }

          if (spec.argv[0] === 'gemini' && spec.argv.includes('--help')) {
            return {
              exit_code: 0,
              stdout: 'Usage: gemini [OPTIONS]\n  -p <prompt>\n  --output-format <format>\n  --yolo\n',
              stderr: '',
            };
          }

          if (spec.argv[0] !== 'gemini') {
            throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
          }

          const promptIndex = spec.argv.indexOf('-p');
          const prompt = promptIndex >= 0 ? spec.argv[promptIndex + 1] ?? '' : '';

          if (prompt.includes('nexus_builder')) {
            return {
              exit_code: 0,
              stdout: '# Build Execution Summary\n\n- Status: completed\n- Actions: applied gemini local subagent build\n- Files touched: README.md\n- Verification: pending verifier\n',
              stderr: '',
            };
          }
          if (prompt.includes('nexus_verifier')) {
            return {
              exit_code: 0,
              stdout: '- Verification: verifier checked the resulting repo state\n',
              stderr: '',
            };
          }
          if (prompt.includes('nexus_review_code')) {
            return {
              exit_code: 0,
              stdout: '# Local Review Persona: Code\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
              stderr: '',
            };
          }
          if (prompt.includes('nexus_review_test')) {
            return {
              exit_code: 0,
              stdout: '# Local Review Persona: Test\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
              stderr: '',
            };
          }
          if (prompt.includes('nexus_review_security')) {
            return {
              exit_code: 0,
              stdout: '# Local Review Persona: Security\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
              stderr: '',
            };
          }
          if (prompt.includes('nexus_review_design')) {
            return {
              exit_code: 0,
              stdout: '# Local Review Persona: Design\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
              stderr: '',
            };
          }
          if (prompt.includes('nexus_qa')) {
            return {
              exit_code: 0,
              stdout: JSON.stringify({
                ready: true,
                findings: [],
                report_markdown: '# QA Report\n\nResult: pass\n',
              }),
              stderr: '',
            };
          }
          throw new Error(`unexpected gemini prompt: ${prompt}`);
        },
      });

      await run('plan', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('build', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('review', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);
      await run('qa', adapters, GEMINI_LOCAL_SUBAGENT_EXECUTION);

      expect(calls.map((call) => call.argv[0])).toEqual([
        'which',
        'gemini',
        'gemini',
        'gemini',
        'gemini',
        'gemini',
        'gemini',
        'gemini',
        'gemini',
      ]);
      expect(calls[1]?.argv.join(' ')).toContain('gemini --help');
      expect(calls.slice(2).every((call) => call.argv.includes('-p'))).toBe(true);
      expect(calls[2]?.argv.join(' ')).toContain('nexus_builder');
      expect(calls[3]?.argv.join(' ')).toContain('nexus_verifier');
      expect(calls[4]?.argv.join(' ')).toContain('nexus_review_code');
      expect(calls[5]?.argv.join(' ')).toContain('nexus_review_test');
      expect(calls[6]?.argv.join(' ')).toContain('nexus_review_security');
      expect(calls[7]?.argv.join(' ')).toContain('nexus_review_design');
      expect(calls[8]?.argv.join(' ')).toContain('nexus_qa');

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        execution_mode: 'local_provider',
        primary_provider: 'gemini',
        provider_topology: 'subagents',
        actual_route: {
          provider: 'gemini',
          route: 'gemini-local-subagents',
          transport: 'local',
        },
      });
    });
  });

  test('blocks build when a claude local subagent exits non-zero even if it prints markdown', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = getDefaultNexusAdapters();
      adapters.local = createRuntimeLocalAdapter({
        runCommand: async (spec) => {
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
          if (agent === 'nexus_builder') {
            return {
              exit_code: 1,
              stdout: '# Build Execution Summary\n\n- Status: completed\n- Actions: printed markdown before failing\n- Files touched: README.md\n- Verification: pending verifier\n',
              stderr: 'builder failed',
            };
          }

          throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
        },
      });

      await run('plan', adapters, LOCAL_SUBAGENT_EXECUTION);
      await run('handoff', adapters, LOCAL_SUBAGENT_EXECUTION);
      await expect(run('build', adapters, LOCAL_SUBAGENT_EXECUTION)).rejects.toThrow(
        'Local provider generator execution blocked',
      );

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        execution_mode: 'local_provider',
        provider_topology: 'subagents',
        state: 'blocked',
        ready: false,
        actual_route: null,
        errors: ['Local provider generator execution blocked'],
      });
      expect(await run.readJson('.planning/current/build/adapter-output.json')).toMatchObject({
        transport: {
          adapter_id: 'local',
          outcome: 'blocked',
          notices: ['claude subagent nexus_builder failed: builder failed'],
        },
      });
    });
  });
});
