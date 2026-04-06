import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { startLedger } from '../../lib/nexus/ledger';
import { createDefaultGsdAdapter } from '../../lib/nexus/adapters/gsd';
import { createDefaultPmAdapter } from '../../lib/nexus/adapters/pm';

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

    expect(discover.traceability?.absorbed_capability).toBe('pm-discover');
    expect(discover.traceability?.source_map).toContain('upstream/pm-skills/commands/discover.md');
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

    expect(plan.traceability?.absorbed_capability).toBe('gsd-plan');
    expect(plan.traceability?.source_map).toContain('upstream/gsd/commands/gsd/plan-phase.md');
    expect(closeout.traceability?.absorbed_capability).toBe('gsd-closeout');
    expect(closeout.traceability?.source_map).toContain('upstream/gsd/commands/gsd/complete-milestone.md');
  });
});
