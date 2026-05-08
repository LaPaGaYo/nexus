import { describe, expect, test, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildCompletionAdvisorWrite } from '../../../lib/nexus/completion-advisor/writer';
import { runTelemetryCommand } from '../../../lib/nexus/commands/telemetry';
import { readTelemetryLog, resolveTelemetryLogPath } from '../../../lib/nexus/telemetry';
import type { CompletionAdvisorRecord } from '../../../lib/nexus/contracts/types';

const tmpDirs: string[] = [];

function makeTmpHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-telemetry-int-'));
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

function fakeAdvisorRecord(stage: 'build' | 'review' | 'ship'): CompletionAdvisorRecord {
  return {
    schema_version: 1,
    run_id: `run-${stage}-${Date.now()}`,
    stage,
    generated_at: new Date().toISOString(),
    stage_outcome: 'ready',
    interaction_mode: 'summary_only',
    summary: 'test',
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
}

describe('telemetry integration — chokepoint at writer.ts', () => {
  test('buildCompletionAdvisorWrite emits stage_advisor_recorded + stage_re_entered events when telemetry enabled', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'fake-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    const record = fakeAdvisorRecord('build');
    buildCompletionAdvisorWrite(record, { cwd, home, externalSkills: [], installedSkills: [] });

    const result = readTelemetryLog({ slug: 'fake-project', home });
    // Each advisor write now emits 2 events: stage_advisor_recorded (chokepoint)
    // + stage_re_entered (Phase H Iron Law re-entry detection).
    expect(result.events).toHaveLength(2);
    const advisorEvent = result.events.find((e) => e.kind === 'stage_advisor_recorded');
    expect(advisorEvent?.stage).toBe('build');
    if (advisorEvent?.kind === 'stage_advisor_recorded') {
      expect(advisorEvent.stage_outcome).toBe('ready');
      expect(advisorEvent.requires_user_choice).toBe(false);
    }
    const reentryEvent = result.events.find((e) => e.kind === 'stage_re_entered');
    expect(reentryEvent?.stage).toBe('build');
    if (reentryEvent?.kind === 'stage_re_entered') {
      // First write — no prior status.json on disk, so is_re_entry is false
      expect(reentryEvent.is_re_entry).toBe(false);
    }
  });

  test('buildCompletionAdvisorWrite is silent when telemetry disabled', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'fake-project');
    fs.mkdirSync(cwd, { recursive: true });
    delete process.env.NEXUS_TELEMETRY;

    const record = fakeAdvisorRecord('review');
    buildCompletionAdvisorWrite(record, { cwd, home, externalSkills: [], installedSkills: [] });

    const result = readTelemetryLog({ slug: 'fake-project', home });
    expect(result.events).toHaveLength(0);
    expect(fs.existsSync(resolveTelemetryLogPath({ slug: 'fake-project', home }))).toBe(false);
  });

  test('multiple stage writes accumulate in the same log', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'fake-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    for (const stage of ['build', 'review', 'ship'] as const) {
      buildCompletionAdvisorWrite(fakeAdvisorRecord(stage), { cwd, home, externalSkills: [], installedSkills: [] });
    }

    const result = readTelemetryLog({ slug: 'fake-project', home });
    // 3 stages × 2 events per write (advisor + re-entry) = 6 events
    expect(result.events).toHaveLength(6);
    const advisorEvents = result.events.filter((e) => e.kind === 'stage_advisor_recorded');
    expect(advisorEvents.map((e) => e.stage).sort()).toEqual(['build', 'review', 'ship']);
  });
});

describe('telemetry CLI — runTelemetryCommand', () => {
  test('reports empty log when nothing tracked', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'empty-project');
    fs.mkdirSync(cwd, { recursive: true });

    const result = runTelemetryCommand({ cwd, home });
    expect(result.summary.total).toBe(0);
    expect(result.text).toContain('No telemetry events recorded');
    expect(result.enabled).toBe(false);
  });

  test('reports summary with counts by stage and kind', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'tracked-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';
    for (const stage of ['build', 'build', 'review'] as const) {
      buildCompletionAdvisorWrite(fakeAdvisorRecord(stage), { cwd, home, externalSkills: [], installedSkills: [] });
    }

    const result = runTelemetryCommand({ cwd, home });
    // 3 writes × 2 events each = 6 total
    expect(result.summary.total).toBe(6);
    expect(result.summary.by_stage).toEqual({ build: 4, review: 2 });
    expect(result.text).toContain('Events: 6');
    expect(result.text).toContain('/build');
    expect(result.text).toContain('/review');
  });

  test('filters events by stage', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'filter-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';
    for (const stage of ['build', 'review', 'ship'] as const) {
      buildCompletionAdvisorWrite(fakeAdvisorRecord(stage), { cwd, home, externalSkills: [], installedSkills: [] });
    }

    const result = runTelemetryCommand({ cwd, home, stage: 'build' });
    // 1 stage × 2 events = 2
    expect(result.events).toHaveLength(2);
    expect(result.events.every((e) => e.stage === 'build')).toBe(true);
  });

  test('filters events by kind', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'kind-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';
    buildCompletionAdvisorWrite(fakeAdvisorRecord('build'), { cwd, home, externalSkills: [], installedSkills: [] });

    const result = runTelemetryCommand({ cwd, home, kind: 'stage_advisor_recorded' });
    // 1 write produces 1 advisor event + 1 re-entry event; filter on kind
    // returns just the advisor event.
    expect(result.events).toHaveLength(1);
    const reentryFiltered = runTelemetryCommand({ cwd, home, kind: 'stage_re_entered' });
    expect(reentryFiltered.events).toHaveLength(1);
    const filteredOut = runTelemetryCommand({ cwd, home, kind: 'ship_branch_outcome_chosen' });
    expect(filteredOut.events).toHaveLength(0);
  });

  test('reports enabled status correctly', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'flag-project');
    fs.mkdirSync(cwd, { recursive: true });

    delete process.env.NEXUS_TELEMETRY;
    expect(runTelemetryCommand({ cwd, home }).enabled).toBe(false);

    process.env.NEXUS_TELEMETRY = '1';
    expect(runTelemetryCommand({ cwd, home }).enabled).toBe(true);
  });
});
