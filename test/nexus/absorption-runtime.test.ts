import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { startLedger } from '../../lib/nexus/ledger';
import { createDefaultCcbAdapter } from '../../lib/nexus/adapters/ccb';
import { createDefaultPlanningAdapter } from '../../lib/nexus/adapters/planning';
import { createDefaultDiscoveryAdapter } from '../../lib/nexus/adapters/discovery';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';
import { createDefaultExecutionAdapter } from '../../lib/nexus/adapters/execution';
import { createQaStagePack, createReviewStagePack, createShipStagePack } from '../../lib/nexus/stage-packs';

describe('nexus absorbed runtime', () => {
  test.skip('upstream source-map content assertions are retired during Track D-D2 Phase 2.1', () => {
    // Provenance remains covered by absorption-source-map.test.ts until absorption is deleted in Phase 2.4.
  });

  test('pm adapter reports absorbed capability ids for discover and frame', async () => {
    const adapter = createDefaultDiscoveryAdapter();
    const ledger = startLedger('run-test', 'discover');

    const discover = await adapter.discover({
      cwd: process.cwd(),
      command: 'discover',
      stage: 'discover',
      run_id: 'run-test',
      ledger,
      manifest: CANONICAL_MANIFEST.discover,
      predecessor_artifacts: [],
      requested_route: null,
    });
    const frame = await adapter.frame({
      cwd: process.cwd(),
      command: 'frame',
      stage: 'frame',
      run_id: 'run-test',
      ledger: { ...ledger, current_command: 'frame', current_stage: 'frame' },
      manifest: CANONICAL_MANIFEST.frame,
      predecessor_artifacts: [],
      requested_route: null,
    });

    expect(discover.traceability?.nexus_stage_pack).toBe('nexus-discover-pack');
    expect(discover.traceability?.absorbed_capability).toBe('pm-discover');
    expect(frame.traceability?.nexus_stage_pack).toBe('nexus-frame-pack');
    expect(frame.traceability?.absorbed_capability).toBe('pm-frame');
  });

  test('gsd adapter reports absorbed capability ids for plan and closeout', async () => {
    const adapter = createDefaultPlanningAdapter();
    const ledger = startLedger('run-test', 'plan');

    const plan = await adapter.plan({
      cwd: process.cwd(),
      command: 'plan',
      stage: 'plan',
      run_id: 'run-test',
      ledger,
      manifest: CANONICAL_MANIFEST.plan,
      predecessor_artifacts: [],
      requested_route: null,
    });
    const closeout = await adapter.closeout({
      cwd: process.cwd(),
      command: 'closeout',
      stage: 'closeout',
      run_id: 'run-test',
      ledger: { ...ledger, current_command: 'closeout', current_stage: 'closeout' },
      manifest: CANONICAL_MANIFEST.closeout,
      predecessor_artifacts: [],
      requested_route: null,
    });

    expect(plan.traceability?.nexus_stage_pack).toBe('nexus-plan-pack');
    expect(plan.traceability?.absorbed_capability).toBe('gsd-plan');
    expect(closeout.traceability?.nexus_stage_pack).toBe('nexus-closeout-pack');
    expect(closeout.traceability?.absorbed_capability).toBe('gsd-closeout');
  });

  test('superpowers and ccb adapters report absorbed capability ids while the governed tail seams stay active', async () => {
    const superpowers = createDefaultExecutionAdapter();
    const ccb = createDefaultCcbAdapter();
    const registry = getDefaultAdapterRegistry();
    const ledger = startLedger('run-test', 'handoff');
    const requestedRoute = {
      command: 'build' as const,
      governed: true,
      planner: 'claude+pm-gsd',
      generator: 'codex-via-ccb',
      evaluator_a: 'codex-via-ccb',
      evaluator_b: 'gemini-via-ccb',
      synthesizer: 'claude',
      substrate: 'superpowers-core',
      fallback_policy: 'disabled' as const,
    };

    const discipline = await superpowers.build_discipline({
      cwd: process.cwd(),
      command: 'build',
      stage: 'build',
      run_id: 'run-test',
      ledger: { ...ledger, current_command: 'build', current_stage: 'build' },
      manifest: CANONICAL_MANIFEST.build,
      predecessor_artifacts: [],
      requested_route: requestedRoute,
    });
    const routing = await ccb.resolve_route({
      cwd: process.cwd(),
      command: 'handoff',
      stage: 'handoff',
      run_id: 'run-test',
      ledger,
      manifest: CANONICAL_MANIFEST.handoff,
      predecessor_artifacts: [],
      requested_route: requestedRoute,
    });
    const execution = await ccb.execute_generator({
      cwd: process.cwd(),
      command: 'build',
      stage: 'build',
      run_id: 'run-test',
      ledger: { ...ledger, current_command: 'build', current_stage: 'build' },
      manifest: CANONICAL_MANIFEST.build,
      predecessor_artifacts: [],
      requested_route: requestedRoute,
    });

    expect(discipline.traceability?.nexus_stage_pack).toBe('nexus-build-pack');
    expect(discipline.traceability?.absorbed_capability).toBe('superpowers-build-discipline');
    expect(routing.traceability?.nexus_stage_pack).toBe('nexus-handoff-pack');
    expect(routing.traceability?.absorbed_capability).toBe('ccb-routing');
    expect(execution.traceability?.nexus_stage_pack).toBe('nexus-build-pack');
    expect(execution.traceability?.absorbed_capability).toBe('ccb-execution');
    expect(registry.review.execution).toBe('active');
    expect(registry.review.ccb).toBe('active');
    expect(registry.qa.ccb).toBe('active');
    expect(registry.ship.execution).toBe('active');
    expect(registry.ship.local).toBe('active');
  });

  test('review qa and ship stage packs expose absorbed capability traceability', () => {
    const review = createReviewStagePack();
    const qa = createQaStagePack();
    const ship = createShipStagePack();

    expect(review.id).toBe('nexus-review-pack');
    expect(review.disciplineTraceability().absorbed_capability).toBe('superpowers-review-discipline');
    expect(review.auditTraceability('codex').absorbed_capability).toBe('ccb-review-codex');
    expect(review.auditTraceability('gemini').absorbed_capability).toBe('ccb-review-gemini');

    expect(qa.id).toBe('nexus-qa-pack');
    expect(qa.validationTraceability().absorbed_capability).toBe('ccb-qa');

    expect(ship.id).toBe('nexus-ship-pack');
    expect(ship.disciplineTraceability().absorbed_capability).toBe('superpowers-ship-discipline');
  });
});
