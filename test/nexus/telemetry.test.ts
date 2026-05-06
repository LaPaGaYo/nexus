import { describe, expect, test, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  NEXUS_TELEMETRY_SCHEMA_VERSION,
  appendTelemetryEvent,
  buildTelemetryEvent,
  emitTelemetryEvent,
  emitTelemetryEventForCwd,
  isTelemetryEnabled,
  projectSlugFromCwd,
  readTelemetryLog,
  resolveTelemetryLogPath,
  summarizeTelemetry,
  type StageAdvisorRecordedEvent,
  type ShipBranchOutcomeChosenEvent,
  type TelemetryEvent,
} from '../../lib/nexus/telemetry';

const tmpDirs: string[] = [];

function makeTmpHome(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-telemetry-test-'));
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

describe('telemetry — Phase H', () => {
  describe('isTelemetryEnabled', () => {
    test('false by default', () => {
      expect(isTelemetryEnabled({})).toBe(false);
    });
    test('false on NEXUS_TELEMETRY=0', () => {
      expect(isTelemetryEnabled({ NEXUS_TELEMETRY: '0' })).toBe(false);
    });
    test('true on NEXUS_TELEMETRY=1', () => {
      expect(isTelemetryEnabled({ NEXUS_TELEMETRY: '1' })).toBe(true);
    });
    test('false on NEXUS_TELEMETRY=true (only literal "1" enables)', () => {
      expect(isTelemetryEnabled({ NEXUS_TELEMETRY: 'true' })).toBe(false);
    });
  });

  describe('projectSlugFromCwd', () => {
    test('uses basename of resolved path', () => {
      expect(projectSlugFromCwd('/foo/bar/my-project')).toBe('my-project');
      expect(projectSlugFromCwd('/foo/bar/')).toBe('bar');
    });
    test('falls back to "unknown" for empty/root paths', () => {
      // Root paths return empty basename; slug should fall back gracefully
      const slug = projectSlugFromCwd('/');
      expect(slug.length).toBeGreaterThan(0);
    });
  });

  describe('resolveTelemetryLogPath', () => {
    test('builds expected path under home', () => {
      const home = '/home/test';
      const result = resolveTelemetryLogPath({ slug: 'my-project', home });
      expect(result).toBe('/home/test/.nexus/telemetry/my-project/events.jsonl');
    });
  });

  describe('buildTelemetryEvent', () => {
    test('auto-fills schema_version + ts', () => {
      const event = buildTelemetryEvent<StageAdvisorRecordedEvent>({
        run_id: 'r1',
        kind: 'stage_advisor_recorded',
        stage: 'build',
        stage_outcome: 'ready',
        interaction_mode: 'summary_only',
        requires_user_choice: false,
        recommended_skills_count: 0,
        primary_action_count: 1,
      });
      expect(event.schema_version).toBe(NEXUS_TELEMETRY_SCHEMA_VERSION);
      expect(typeof event.ts).toBe('string');
      expect(event.ts.length).toBeGreaterThan(0);
    });
    test('respects explicit ts override', () => {
      const event = buildTelemetryEvent<ShipBranchOutcomeChosenEvent>({
        ts: '2026-01-01T00:00:00.000Z',
        run_id: 'r1',
        kind: 'ship_branch_outcome_chosen',
        stage: 'ship',
        outcome: 'merge',
      });
      expect(event.ts).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('appendTelemetryEvent + readTelemetryLog roundtrip', () => {
    test('writes and reads a single event', () => {
      const home = makeTmpHome();
      const event = buildTelemetryEvent<StageAdvisorRecordedEvent>({
        run_id: 'r1',
        kind: 'stage_advisor_recorded',
        stage: 'build',
        stage_outcome: 'ready',
        interaction_mode: 'summary_only',
        requires_user_choice: false,
        recommended_skills_count: 2,
        primary_action_count: 1,
      });
      appendTelemetryEvent(event, { slug: 'p', home });

      const result = readTelemetryLog({ slug: 'p', home });
      expect(result.events).toHaveLength(1);
      expect(result.parsed).toBe(1);
      expect(result.skipped).toBe(0);
      const e = result.events[0];
      if (e?.kind === 'stage_advisor_recorded') {
        expect(e.stage).toBe('build');
        expect(e.recommended_skills_count).toBe(2);
      }
    });

    test('appends multiple events preserving order', () => {
      const home = makeTmpHome();
      for (let i = 0; i < 5; i++) {
        appendTelemetryEvent(
          buildTelemetryEvent<StageAdvisorRecordedEvent>({
            run_id: `r${i}`,
            kind: 'stage_advisor_recorded',
            stage: 'build',
            stage_outcome: 'ready',
            interaction_mode: 'summary_only',
            requires_user_choice: false,
            recommended_skills_count: 0,
            primary_action_count: 1,
          }),
          { slug: 'p', home },
        );
      }
      const result = readTelemetryLog({ slug: 'p', home });
      expect(result.events).toHaveLength(5);
      expect(result.events.map((e) => e.run_id)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
    });

    test('returns empty result when log does not exist', () => {
      const home = makeTmpHome();
      const result = readTelemetryLog({ slug: 'never-written', home });
      expect(result.events).toEqual([]);
      expect(result.total_lines).toBe(0);
    });

    test('skips invalid lines but continues parsing valid ones', () => {
      const home = makeTmpHome();
      const dir = path.dirname(resolveTelemetryLogPath({ slug: 'p', home }));
      fs.mkdirSync(dir, { recursive: true });
      const validEvent = buildTelemetryEvent<StageAdvisorRecordedEvent>({
        run_id: 'r1',
        kind: 'stage_advisor_recorded',
        stage: 'build',
        stage_outcome: 'ready',
        interaction_mode: 'summary_only',
        requires_user_choice: false,
        recommended_skills_count: 0,
        primary_action_count: 1,
      });
      const file = path.join(dir, 'events.jsonl');
      fs.writeFileSync(file, [
        JSON.stringify(validEvent),
        '{not valid json',
        JSON.stringify({ ...validEvent, schema_version: 99 }), // unsupported version
        JSON.stringify({ kind: 'malformed' }), // missing required fields
        JSON.stringify(validEvent),
      ].join('\n'));

      const result = readTelemetryLog({ slug: 'p', home });
      expect(result.parsed).toBe(2);
      expect(result.skipped).toBe(3);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('emitTelemetryEvent (env-gated)', () => {
    test('no-op when NEXUS_TELEMETRY unset', () => {
      const home = makeTmpHome();
      delete process.env.NEXUS_TELEMETRY;
      emitTelemetryEvent(
        buildTelemetryEvent<StageAdvisorRecordedEvent>({
          run_id: 'r1',
          kind: 'stage_advisor_recorded',
          stage: 'build',
          stage_outcome: 'ready',
          interaction_mode: 'summary_only',
          requires_user_choice: false,
          recommended_skills_count: 0,
          primary_action_count: 1,
        }),
        { slug: 'p', home },
      );
      const result = readTelemetryLog({ slug: 'p', home });
      expect(result.events).toHaveLength(0);
    });

    test('writes when NEXUS_TELEMETRY=1', () => {
      const home = makeTmpHome();
      process.env.NEXUS_TELEMETRY = '1';
      emitTelemetryEvent(
        buildTelemetryEvent<StageAdvisorRecordedEvent>({
          run_id: 'r1',
          kind: 'stage_advisor_recorded',
          stage: 'review',
          stage_outcome: 'ready',
          interaction_mode: 'summary_only',
          requires_user_choice: false,
          recommended_skills_count: 0,
          primary_action_count: 1,
        }),
        { slug: 'p', home },
      );
      const result = readTelemetryLog({ slug: 'p', home });
      expect(result.events).toHaveLength(1);
    });

    test('fails non-fatally on disk errors', () => {
      // Pass an invalid (read-only) home directory location
      // Writing to a path under a non-existent / unwriteable parent should
      // not throw — telemetry must never break the stage write.
      process.env.NEXUS_TELEMETRY = '1';
      expect(() => {
        emitTelemetryEvent(
          buildTelemetryEvent<StageAdvisorRecordedEvent>({
            run_id: 'r1',
            kind: 'stage_advisor_recorded',
            stage: 'build',
            stage_outcome: 'ready',
            interaction_mode: 'summary_only',
            requires_user_choice: false,
            recommended_skills_count: 0,
            primary_action_count: 1,
          }),
          { slug: 'p', home: '/proc/nonexistent/forbidden' },
        );
      }).not.toThrow();
    });
  });

  describe('emitTelemetryEventForCwd', () => {
    test('derives slug from cwd', () => {
      const home = makeTmpHome();
      process.env.NEXUS_TELEMETRY = '1';
      emitTelemetryEventForCwd(
        buildTelemetryEvent<StageAdvisorRecordedEvent>({
          run_id: 'r1',
          kind: 'stage_advisor_recorded',
          stage: 'build',
          stage_outcome: 'ready',
          interaction_mode: 'summary_only',
          requires_user_choice: false,
          recommended_skills_count: 0,
          primary_action_count: 1,
        }),
        '/some/path/nexus-test',
        home,
      );
      const expected = resolveTelemetryLogPath({ slug: 'nexus-test', home });
      expect(fs.existsSync(expected)).toBe(true);
    });
  });

  describe('summarizeTelemetry', () => {
    test('aggregates counts by stage, kind, outcome', () => {
      const events: TelemetryEvent[] = [
        buildTelemetryEvent<StageAdvisorRecordedEvent>({
          run_id: 'r1',
          kind: 'stage_advisor_recorded',
          stage: 'build',
          stage_outcome: 'ready',
          interaction_mode: 'summary_only',
          requires_user_choice: false,
          recommended_skills_count: 0,
          primary_action_count: 1,
        }),
        buildTelemetryEvent<StageAdvisorRecordedEvent>({
          run_id: 'r1',
          kind: 'stage_advisor_recorded',
          stage: 'review',
          stage_outcome: 'ready_with_advisories',
          interaction_mode: 'summary_only',
          requires_user_choice: true,
          recommended_skills_count: 2,
          primary_action_count: 3,
        }),
        buildTelemetryEvent<ShipBranchOutcomeChosenEvent>({
          run_id: 'r2',
          kind: 'ship_branch_outcome_chosen',
          stage: 'ship',
          outcome: 'merge',
        }),
      ];
      const summary = summarizeTelemetry(events);
      expect(summary.total).toBe(3);
      expect(summary.by_stage).toEqual({ build: 1, review: 1, ship: 1 });
      expect(summary.by_kind).toEqual({
        stage_advisor_recorded: 2,
        ship_branch_outcome_chosen: 1,
      });
      expect(summary.by_outcome.ready).toBe(1);
      expect(summary.by_outcome.ready_with_advisories).toBe(1);
      expect(summary.unique_runs).toBe(2);
    });

    test('returns null timestamps for empty event list', () => {
      const summary = summarizeTelemetry([]);
      expect(summary.first_ts).toBeNull();
      expect(summary.last_ts).toBeNull();
      expect(summary.unique_runs).toBe(0);
    });
  });
});
