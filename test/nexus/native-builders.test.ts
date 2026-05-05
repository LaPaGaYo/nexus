import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { startLedger } from '../../lib/nexus/ledger';
import {
  buildCloseoutRecord,
  buildExecutionReadinessPacket,
  buildExecutionSummary,
  buildGeneratorExecution,
  buildPmDecisionBrief,
  buildPmDiscoverIdeaBrief,
  buildPmPrd,
  buildQaReport,
  buildReleaseGateRecord,
  buildReviewAuditMarkdown,
  buildReviewDisciplineSummary,
  buildSprintContract,
  buildVerificationSummary,
} from '../../lib/nexus/stage-packs/native-builders';
import type { NexusAdapterContext } from '../../lib/nexus/adapters/types';
import type { RequestedRouteRecord } from '../../lib/nexus/types';

const requestedRoute: RequestedRouteRecord = {
  command: 'build',
  governed: true,
  execution_mode: 'governed_ccb',
  primary_provider: 'codex',
  provider_topology: 'multi_session',
  planner: 'claude+pm-gsd',
  generator: 'codex-via-ccb',
  evaluator_a: 'codex-via-ccb',
  evaluator_b: 'gemini-via-ccb',
  synthesizer: 'claude',
  substrate: 'superpowers-core',
  transport: 'ccb',
  fallback_policy: 'disabled',
};

function adapterContext(route: RequestedRouteRecord | null = requestedRoute): NexusAdapterContext {
  return {
    cwd: process.cwd(),
    run_id: 'run-native-builders',
    command: 'build',
    stage: 'build',
    ledger: startLedger('run-native-builders', 'build'),
    manifest: CANONICAL_MANIFEST.build,
    predecessor_artifacts: [],
    requested_route: route,
  };
}

describe('native stage-pack builders', () => {
  test.each([
    ['buildPmDiscoverIdeaBrief', () => buildPmDiscoverIdeaBrief(adapterContext()), '# Idea Brief'],
    ['buildPmDecisionBrief', () => buildPmDecisionBrief(adapterContext()), '# Decision Brief'],
    ['buildPmPrd', () => buildPmPrd(adapterContext()), '# PRD'],
    ['buildExecutionReadinessPacket', () => buildExecutionReadinessPacket(adapterContext()), '# Execution Readiness Packet'],
    ['buildSprintContract', () => buildSprintContract(adapterContext()), '# Sprint Contract'],
    ['buildCloseoutRecord', () => buildCloseoutRecord(adapterContext()), '# Closeout Record'],
    [
      'buildExecutionSummary',
      () => buildExecutionSummary(adapterContext(), { actions: 'patched runtime path', verification: 'unit smoke' }),
      '# Build Execution Summary',
    ],
    ['buildReviewAuditMarkdown', () => buildReviewAuditMarkdown('codex'), '# Codex Audit'],
    ['buildQaReport', () => buildQaReport(adapterContext(), true, []), '# QA Report'],
    ['buildReleaseGateRecord', () => buildReleaseGateRecord(adapterContext(), true), '# Release Gate Record'],
  ])('%s produces non-empty markdown with the expected heading', (_name, build, expectedHeading) => {
    const markdown = build();

    expect(markdown.length).toBeGreaterThan(100);
    expect(markdown).toContain(expectedHeading);
  });

  test.each([
    ['buildVerificationSummary', () => buildVerificationSummary(adapterContext())],
    ['buildReviewDisciplineSummary', () => buildReviewDisciplineSummary(adapterContext())],
  ])('%s produces non-empty stage guidance', (_name, build) => {
    const summary = build();

    expect(summary.length).toBeGreaterThan(100);
    expect(summary).toContain('Nexus-owned');
  });

  test('buildGeneratorExecution records explicit provider attribution', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];

    console.warn = (message?: unknown): void => {
      warnings.push(String(message));
    };

    try {
      expect(buildGeneratorExecution(adapterContext()).actual_route.provider).toBe('codex');
      expect(buildGeneratorExecution(adapterContext({
        ...requestedRoute,
        generator: ' Codex-via-ccb ',
      })).actual_route.provider).toBe('codex');
      expect(warnings).toEqual([]);
      expect(buildGeneratorExecution(adapterContext({
        ...requestedRoute,
        generator: 'openai-via-ccb',
      })).actual_route.provider).toBe('unknown');
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toEqual([
      "native-builder: unknown generator 'openai-via-ccb' classified as 'unknown'",
    ]);
  });

  test('buildGeneratorExecution preserves null requested-route fallback attribution', () => {
    expect(buildGeneratorExecution(adapterContext()).actual_route.provider).toBe('codex');
    expect(buildGeneratorExecution(adapterContext({
      ...requestedRoute,
      generator: null,
    })).actual_route.provider).toBe('codex');
  });
});
