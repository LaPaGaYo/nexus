import { describe, expect, test } from 'bun:test';
import {
  ACTUAL_ROUTE_TRANSPORTS,
  STAGE_DECISIONS,
  PLACEHOLDER_OUTCOME,
  RUN_STATUSES,
  ROUTE_VALIDATION_TRANSPORTS,
  type CanonicalCommandId,
  type ActualRouteRecord,
  type ImplementationProvenanceRecord,
  type RequestedRouteRecord,
  type RouteCheckRecord,
  type RouteValidationRecord,
  type RunLedger,
  type RunStatus,
} from '../../lib/nexus/types';

describe('nexus types', () => {
  test('freezes placeholder outcome model', () => {
    expect(PLACEHOLDER_OUTCOME).toEqual({
      state: 'blocked',
      decision: 'not_implemented',
      ready: false,
    });
  });

  test('freezes the run-level status enum', () => {
    expect(RUN_STATUSES).toEqual(['active', 'blocked', 'completed', 'refused']);
  });

  test('canonical command ids include the full Nexus surface', () => {
    const commands: CanonicalCommandId[] = [
      'discover',
      'frame',
      'plan',
      'handoff',
      'build',
      'review',
      'qa',
      'ship',
      'closeout',
    ];

    expect(commands).toHaveLength(9);
  });

  test('run status stays string-literal typed', () => {
    const status: RunStatus = 'active';
    expect(status).toBe('active');
  });

  test('freezes the Milestone 2 requested route shape', () => {
    const requested: RequestedRouteRecord = {
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

    expect(requested.generator).toBe('codex-via-ccb');
  });

  test('freezes the Milestone 2 actual route shape', () => {
    const actual: ActualRouteRecord = {
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
      receipt_path: '.planning/current/build/adapter-output.json',
    };

    expect(actual.transport).toBe('ccb');
    expect(ACTUAL_ROUTE_TRANSPORTS).toEqual(['ccb', 'local', null]);
  });

  test('locks route validation and implementation provenance records', () => {
    const validation: RouteValidationRecord = {
      transport: 'ccb',
      available: true,
      approved: false,
      reason: 'availability alone does not approve the route',
      mounted_providers: ['codex', 'gemini'],
      provider_checks: [
        {
          provider: 'codex',
          available: true,
          mounted: true,
          reason: 'CCB codex route check passed',
        },
        {
          provider: 'gemini',
          available: true,
          mounted: true,
          reason: 'CCB gemini route check passed',
        },
      ],
    };
    const provenance: ImplementationProvenanceRecord = {
      path: '.planning/current/build/build-result.md',
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
      actual_route: null,
    };

    expect(validation.approved).toBe(false);
    expect(validation.provider_checks?.[1]?.provider).toBe('gemini');
    expect(provenance.path).toContain('build-result.md');
    expect(ROUTE_VALIDATION_TRANSPORTS).toEqual(['ccb', 'local', 'none']);
  });

  test('locks the run-level route check shape to the per-provider governed truth', () => {
    const routeCheck: RouteCheckRecord = {
      checked_at: '2026-04-13T00:00:00.000Z',
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
      route_validation: {
        transport: 'ccb',
        available: true,
        approved: true,
        reason: 'Nexus approved the requested governed route',
        mounted_providers: ['codex', 'gemini'],
        provider_checks: [
          {
            provider: 'codex',
            available: true,
            mounted: true,
            reason: 'CCB codex route check passed',
          },
          {
            provider: 'gemini',
            available: true,
            mounted: true,
            reason: 'CCB gemini route check passed',
          },
        ],
      },
    };

    const ledger: RunLedger = {
      run_id: 'run-1',
      status: 'active',
      current_command: 'handoff',
      current_stage: 'handoff',
      previous_stage: 'plan',
      allowed_next_stages: ['build'],
      command_history: [],
      artifact_index: {},
      execution: {
        mode: 'governed_ccb',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        requested_path: 'codex-via-ccb',
        actual_path: null,
      },
      route_intent: {
        planner: 'claude+pm-gsd',
        generator: 'codex-via-ccb',
        evaluator_a: 'codex-via-ccb',
        evaluator_b: 'gemini-via-ccb',
        synthesizer: 'claude',
        substrate: 'superpowers-core',
        fallback_policy: 'disabled',
      },
      route_check: routeCheck,
    };

    expect(ledger.route_check?.route_validation.provider_checks?.[1]?.provider).toBe('gemini');
    expect(ledger.route_check?.requested_route.generator).toBe('codex-via-ccb');
  });

  test('freezes the governed tail lifecycle decisions', () => {
    expect(STAGE_DECISIONS).toContain('qa_recorded');
    expect(STAGE_DECISIONS).toContain('ship_recorded');
  });
});
