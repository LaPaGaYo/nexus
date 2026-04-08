import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { createRuntimeCcbAdapter } from '../../lib/nexus/adapters/ccb';
import { startLedger } from '../../lib/nexus/ledger';
import type { NexusAdapterContext } from '../../lib/nexus/adapters/types';
import type { RequestedRouteRecord } from '../../lib/nexus/types';

interface RecordedCommand {
  argv: string[];
  cwd: string;
  env: Record<string, string>;
  stdin_text?: string;
  timeout_ms?: number;
}

const REQUESTED_ROUTE: RequestedRouteRecord = {
  command: 'build',
  governed: true,
  planner: 'claude+pm-gsd',
  generator: 'codex-via-ccb',
  evaluator_a: 'codex-via-ccb',
  evaluator_b: 'gemini-via-ccb',
  synthesizer: 'claude',
  substrate: 'superpowers-core',
  fallback_policy: 'disabled',
};

function buildContext(
  stage: 'handoff' | 'build' | 'review' | 'qa',
  command: 'handoff' | 'build' | 'review' | 'qa',
  requestedRoute: RequestedRouteRecord = REQUESTED_ROUTE,
): NexusAdapterContext {
  return {
    cwd: '/repo/root/.nexus-worktrees/feature',
    run_id: 'run-123',
    command,
    stage,
    ledger: startLedger('run-123', stage),
    manifest: CANONICAL_MANIFEST[command],
    predecessor_artifacts: [{ kind: 'json', path: `.planning/current/${stage}/status.json` }],
    requested_route: requestedRoute,
  };
}

describe('nexus runtime ccb adapter', () => {
  test('verifies governed route availability from the Nexus session root', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        return {
          exit_code: 0,
          stdout: 'Nexus route check ok\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.resolve_route(buildContext('handoff', 'handoff'));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      argv: ['/opt/ccb/bin/ask', 'codex', '--foreground', '--no-wrap', '--timeout', '30'],
      cwd: '/repo/root/.nexus-worktrees/feature',
      env: {
        CCB_CALLER: 'claude',
        CCB_ASKD_AUTOSTART: '1',
        CCB_SESSION_FILE: '/repo/root/.ccb/.codex-session',
      },
    });
    expect(calls[0]?.stdin_text).toContain('route availability check');
    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      available: true,
      provider: 'codex',
    });
    expect(result.actual_route).toMatchObject({
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
    });
  });

  test('dispatches build execution through ask with claude caller semantics', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        return {
          exit_code: 0,
          stdout: '# Build Execution Summary\n\nImplemented the bounded contract.\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_generator(buildContext('build', 'build'));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toEqual([
      '/opt/ccb/bin/ask',
      'codex',
      '--foreground',
      '--no-wrap',
      '--timeout',
      '1800',
    ]);
    expect(calls[0]?.env).toMatchObject({
      CCB_CALLER: 'claude',
      CCB_ASKD_AUTOSTART: '1',
    });
    expect(calls[0]?.stdin_text).toContain('.planning/current/build/status.json');
    expect(calls[0]?.stdin_text).toContain('codex-via-ccb');
    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      receipt: 'ccb-build-codex-2026-04-08T00-00-00.000Z',
      summary_markdown: '# Build Execution Summary\n\nImplemented the bounded contract.',
    });
    expect(result.actual_route).toMatchObject({
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
    });
  });

  test('blocks review audit dispatch when the provider command fails', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        return {
          exit_code: 1,
          stdout: '',
          stderr: '[ERROR] Unified askd daemon not running',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_audit_b(buildContext('review', 'review'));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'gemini', '--foreground']);
    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('Unified askd daemon not running');
    expect(result.conflict_candidates[0]).toMatchObject({
      stage: 'review',
      adapter: 'ccb',
      kind: 'backend_conflict',
    });
  });

  test('blocks qa when CCB returns malformed structured validation output', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
      }),
      runCommand: async () => ({
        exit_code: 0,
        stdout: '# QA Report\n\nThis is not JSON.\n',
        stderr: '',
      }),
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const requestedRoute: RequestedRouteRecord = {
      ...REQUESTED_ROUTE,
      command: 'qa',
      generator: 'gemini-via-ccb',
      evaluator_a: null,
      evaluator_b: null,
      planner: null,
      synthesizer: null,
    };
    const result = await adapter.execute_qa(buildContext('qa', 'qa', requestedRoute));

    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('Malformed QA response');
    expect(result.conflict_candidates[0]).toMatchObject({
      stage: 'qa',
      adapter: 'ccb',
      kind: 'backend_conflict',
    });
  });

  test('extracts the canonical QA JSON object when provider adds trailing prose', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
      }),
      runCommand: async () => ({
        exit_code: 0,
        stdout: [
          '{"ready":true,"findings":[],"report_markdown":"# QA Report\\n\\nResult: pass\\n"}',
          '',
          'I have responded with the requested message and included the mandatory completion marker as instructed.',
        ].join('\n'),
        stderr: '',
      }),
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const requestedRoute: RequestedRouteRecord = {
      ...REQUESTED_ROUTE,
      command: 'qa',
      generator: 'gemini-via-ccb',
      evaluator_a: null,
      evaluator_b: null,
      planner: null,
      synthesizer: null,
    };
    const result = await adapter.execute_qa(buildContext('qa', 'qa', requestedRoute));

    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      ready: true,
      findings: [],
      report_markdown: '# QA Report\n\nResult: pass',
    });
  });
});
