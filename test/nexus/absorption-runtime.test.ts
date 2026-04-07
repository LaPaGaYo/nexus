import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { startLedger } from '../../lib/nexus/ledger';
import { createDefaultCcbAdapter } from '../../lib/nexus/adapters/ccb';
import { createDefaultGsdAdapter } from '../../lib/nexus/adapters/gsd';
import { createDefaultPmAdapter } from '../../lib/nexus/adapters/pm';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';
import { createDefaultSuperpowersAdapter } from '../../lib/nexus/adapters/superpowers';

describe('nexus absorbed runtime', () => {
  test('pm adapter reports absorbed capability ids for discover and frame', async () => {
    const adapter = createDefaultPmAdapter();
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
    expect(discover.traceability?.source_map).toContain('upstream/pm-skills/commands/discover.md');
    expect(frame.traceability?.nexus_stage_pack).toBe('nexus-frame-pack');
    expect(frame.traceability?.absorbed_capability).toBe('pm-frame');
    expect(frame.traceability?.source_map).toContain('upstream/pm-skills/commands/write-prd.md');
  });

  test('gsd adapter reports absorbed capability ids for plan and closeout', async () => {
    const adapter = createDefaultGsdAdapter();
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
    expect(plan.traceability?.source_map).toContain('upstream/gsd/commands/gsd/plan-phase.md');
    expect(closeout.traceability?.nexus_stage_pack).toBe('nexus-closeout-pack');
    expect(closeout.traceability?.absorbed_capability).toBe('gsd-closeout');
    expect(closeout.traceability?.source_map).toContain('upstream/gsd/commands/gsd/complete-milestone.md');
  });

  test('superpowers and ccb adapters report absorbed capability ids without activating reserved seams', async () => {
    const superpowers = createDefaultSuperpowersAdapter();
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
    expect(discipline.traceability?.source_map).toContain('upstream/superpowers/skills/test-driven-development/SKILL.md');
    expect(routing.traceability?.nexus_stage_pack).toBe('nexus-handoff-pack');
    expect(routing.traceability?.absorbed_capability).toBe('ccb-routing');
    expect(routing.traceability?.source_map).toContain('upstream/claude-code-bridge/lib/providers.py');
    expect(execution.traceability?.nexus_stage_pack).toBe('nexus-build-pack');
    expect(execution.traceability?.absorbed_capability).toBe('ccb-execution');
    expect(execution.traceability?.source_map).toContain('upstream/claude-code-bridge/lib/codex_comm.py');
    expect(registry.review.superpowers).toBe('reserved_future');
    expect(registry.review.ccb).toBe('reserved_future');
    expect(registry.ship.superpowers).toBe('reserved_future');
  });
});
