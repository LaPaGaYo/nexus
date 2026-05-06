import { describe, expect, test, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildTelemetryEvent,
  emitTelemetryEventForCwd,
  readTelemetryLog,
  type ReviewAdvisoryDispatchedEvent,
  type ShipReadinessGateVerdictEvent,
  type StageReEnteredEvent,
} from '../../lib/nexus/telemetry';

/**
 * Phase H Iron Law emit point tests. These verify the SCHEMA + emit
 * machinery for the 3 mechanically-detectable Iron Law events. Wiring
 * into the actual command runtimes (review.ts, ship.ts, writer.ts) is
 * exercised by the integration tests in telemetry-integration.test.ts
 * and (for review/ship) any e2e test runs.
 */

const tmpDirs: string[] = [];
function makeTmpHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-iron-law-evt-'));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
  delete process.env.NEXUS_TELEMETRY;
});

describe('review_advisory_dispatched event', () => {
  test('roundtrips through storage with all 3 disposition values', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'p');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    for (const disposition of ['fix_before_qa', 'continue_to_qa', 'defer_to_follow_on'] as const) {
      emitTelemetryEventForCwd(
        buildTelemetryEvent<ReviewAdvisoryDispatchedEvent>({
          run_id: `run-${disposition}`,
          kind: 'review_advisory_dispatched',
          stage: 'review',
          advisory_disposition: disposition,
        }),
        cwd,
        home,
      );
    }

    const result = readTelemetryLog({ slug: 'p', home });
    expect(result.events).toHaveLength(3);
    const dispositions = result.events
      .filter((e) => e.kind === 'review_advisory_dispatched')
      .map((e) => (e as ReviewAdvisoryDispatchedEvent).advisory_disposition)
      .sort();
    expect(dispositions).toEqual(['continue_to_qa', 'defer_to_follow_on', 'fix_before_qa']);
  });
});

describe('ship_readiness_gate_verdict event', () => {
  test('captures merge_ready true (Law 1 5-check pass)', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'p');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    emitTelemetryEventForCwd(
      buildTelemetryEvent<ShipReadinessGateVerdictEvent>({
        run_id: 'r1',
        kind: 'ship_readiness_gate_verdict',
        stage: 'ship',
        merge_ready: true,
      }),
      cwd,
      home,
    );

    const result = readTelemetryLog({ slug: 'p', home });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.kind).toBe('ship_readiness_gate_verdict');
    if (result.events[0]?.kind === 'ship_readiness_gate_verdict') {
      expect(result.events[0].merge_ready).toBe(true);
    }
  });

  test('captures merge_ready false (Law 2 refusal)', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'p');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    emitTelemetryEventForCwd(
      buildTelemetryEvent<ShipReadinessGateVerdictEvent>({
        run_id: 'r1',
        kind: 'ship_readiness_gate_verdict',
        stage: 'ship',
        merge_ready: false,
      }),
      cwd,
      home,
    );

    const result = readTelemetryLog({ slug: 'p', home });
    expect(result.events).toHaveLength(1);
    if (result.events[0]?.kind === 'ship_readiness_gate_verdict') {
      expect(result.events[0].merge_ready).toBe(false);
    }
  });
});

describe('stage_re_entered event', () => {
  test('schema accepts is_re_entry true (Iron Law Law 2 re-entry signal)', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'p');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    emitTelemetryEventForCwd(
      buildTelemetryEvent<StageReEnteredEvent>({
        run_id: 'r1',
        kind: 'stage_re_entered',
        stage: 'build',
        is_re_entry: true,
      }),
      cwd,
      home,
    );

    const result = readTelemetryLog({ slug: 'p', home });
    expect(result.events).toHaveLength(1);
    if (result.events[0]?.kind === 'stage_re_entered') {
      expect(result.events[0].is_re_entry).toBe(true);
      expect(result.events[0].stage).toBe('build');
    }
  });

  test('schema accepts is_re_entry false (first stage entry)', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'p');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    emitTelemetryEventForCwd(
      buildTelemetryEvent<StageReEnteredEvent>({
        run_id: 'r1',
        kind: 'stage_re_entered',
        stage: 'review',
        is_re_entry: false,
      }),
      cwd,
      home,
    );

    const result = readTelemetryLog({ slug: 'p', home });
    expect(result.events).toHaveLength(1);
    if (result.events[0]?.kind === 'stage_re_entered') {
      expect(result.events[0].is_re_entry).toBe(false);
    }
  });
});

describe('writer.ts re-entry detection (integration)', () => {
  test('first write reports is_re_entry: false; second write reports is_re_entry: true', async () => {
    const { buildCompletionAdvisorWrite } = await import('../../lib/nexus/completion-advisor/writer');
    const home = makeTmpHome();
    const cwd = path.join(home, 'reentry-test');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    const baseRecord = {
      schema_version: 1,
      run_id: 'run-r1',
      stage: 'build' as const,
      generated_at: new Date().toISOString(),
      stage_outcome: 'ready' as const,
      interaction_mode: 'summary_only',
      summary: 't',
      requires_user_choice: false,
      choice_reason: null,
      default_action_id: null,
      primary_next_actions: [],
      alternative_next_actions: [],
      recommended_side_skills: [],
      stop_action: null,
      project_setup_gaps: [],
      hidden_compat_aliases: [],
      hidden_utility_skills: [],
      suppressed_surfaces: [],
    };

    // First write: no prior status.json → is_re_entry false
    const firstWrite = buildCompletionAdvisorWrite(baseRecord, { cwd, home, externalSkills: [], installedSkills: [] });
    fs.mkdirSync(path.dirname(path.join(cwd, firstWrite.path)), { recursive: true });
    fs.writeFileSync(path.join(cwd, firstWrite.path), firstWrite.content);

    // Second write with same run_id: is_re_entry true
    buildCompletionAdvisorWrite(baseRecord, { cwd, home, externalSkills: [], installedSkills: [] });

    const result = readTelemetryLog({ slug: 'reentry-test', home });
    const reentryEvents = result.events.filter((e) => e.kind === 'stage_re_entered') as StageReEnteredEvent[];
    expect(reentryEvents).toHaveLength(2);
    expect(reentryEvents[0].is_re_entry).toBe(false);
    expect(reentryEvents[1].is_re_entry).toBe(true);
  });

  test('different run_id at same stage path → not a re-entry', async () => {
    const { buildCompletionAdvisorWrite } = await import('../../lib/nexus/completion-advisor/writer');
    const home = makeTmpHome();
    const cwd = path.join(home, 'different-run');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    // Pre-populate a status.json with a different run_id
    const stageDir = path.join(cwd, '.planning', 'current', 'build');
    fs.mkdirSync(stageDir, { recursive: true });
    fs.writeFileSync(path.join(stageDir, 'completion-advisor.json'), JSON.stringify({ run_id: 'older-run' }));

    const baseRecord = {
      schema_version: 1,
      run_id: 'fresh-run',
      stage: 'build' as const,
      generated_at: new Date().toISOString(),
      stage_outcome: 'ready' as const,
      interaction_mode: 'summary_only',
      summary: 't',
      requires_user_choice: false,
      choice_reason: null,
      default_action_id: null,
      primary_next_actions: [],
      alternative_next_actions: [],
      recommended_side_skills: [],
      stop_action: null,
      project_setup_gaps: [],
      hidden_compat_aliases: [],
      hidden_utility_skills: [],
      suppressed_surfaces: [],
    };

    buildCompletionAdvisorWrite(baseRecord, { cwd, home, externalSkills: [], installedSkills: [] });
    const result = readTelemetryLog({ slug: 'different-run', home });
    const reentryEvent = result.events.find((e) => e.kind === 'stage_re_entered') as StageReEnteredEvent;
    expect(reentryEvent.is_re_entry).toBe(false);
  });
});
