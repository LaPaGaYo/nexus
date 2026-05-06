import { describe, expect, test, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildCompletionAdvisorWrite } from '../../lib/nexus/completion-advisor/writer';
import { runTelemetryCommand } from '../../lib/nexus/commands/telemetry';
import { readTelemetryLog, resolveTelemetryLogPath } from '../../lib/nexus/telemetry';
import type { CompletionAdvisorRecord } from '../../lib/nexus/types';

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
  test('buildCompletionAdvisorWrite emits a stage_advisor_recorded event when telemetry enabled', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'fake-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';

    const record = fakeAdvisorRecord('build');
    buildCompletionAdvisorWrite(record, { cwd, home, externalSkills: [], installedSkills: [] });

    const result = readTelemetryLog({ slug: 'fake-project', home });
    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    expect(event?.kind).toBe('stage_advisor_recorded');
    expect(event?.stage).toBe('build');
    if (event?.kind === 'stage_advisor_recorded') {
      expect(event.stage_outcome).toBe('ready');
      expect(event.requires_user_choice).toBe(false);
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
    expect(result.events).toHaveLength(3);
    expect(result.events.map((e) => e.stage).sort()).toEqual(['build', 'review', 'ship']);
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
    expect(result.summary.total).toBe(3);
    expect(result.summary.by_stage).toEqual({ build: 2, review: 1 });
    expect(result.text).toContain('Events: 3');
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
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.stage).toBe('build');
  });

  test('filters events by kind', () => {
    const home = makeTmpHome();
    const cwd = path.join(home, 'kind-project');
    fs.mkdirSync(cwd, { recursive: true });
    process.env.NEXUS_TELEMETRY = '1';
    buildCompletionAdvisorWrite(fakeAdvisorRecord('build'), { cwd, home, externalSkills: [], installedSkills: [] });

    const result = runTelemetryCommand({ cwd, home, kind: 'stage_advisor_recorded' });
    expect(result.events).toHaveLength(1);
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
