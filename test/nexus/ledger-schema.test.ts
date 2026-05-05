import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { stageStatusPath } from '../../lib/nexus/artifacts';
import { buildCompletionAdvisorWrite } from '../../lib/nexus/completion-advisor/writer';
import { readLedger, startLedger, writeLedger } from '../../lib/nexus/ledger';
import { readStageStatus, writeStageStatus } from '../../lib/nexus/status';
import {
  NEXUS_LEDGER_SCHEMA_VERSION,
  type CompletionAdvisorRecord,
  type StageStatus,
} from '../../lib/nexus/types';

function fixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'nexus-ledger-schema-'));
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const absolutePath = join(root, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, JSON.stringify(value, null, 2) + '\n');
}

function readJson(root: string, relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8')) as Record<string, unknown>;
}

function readyStatus(): StageStatus {
  return {
    run_id: 'run-1',
    stage: 'review',
    state: 'completed',
    decision: 'audit_recorded',
    ready: true,
    inputs: [],
    outputs: [],
    started_at: '2026-05-05T00:00:00.000Z',
    completed_at: '2026-05-05T00:00:00.000Z',
    errors: [],
  };
}

function completionAdvisor(): CompletionAdvisorRecord {
  return {
    schema_version: NEXUS_LEDGER_SCHEMA_VERSION,
    run_id: 'run-1',
    stage: 'review',
    generated_at: '2026-05-05T00:00:00.000Z',
    stage_outcome: 'ready',
    interaction_mode: 'summary_only',
    summary: 'Review is complete.',
    requires_user_choice: false,
    choice_reason: null,
    default_action_id: null,
    primary_next_actions: [],
    alternative_next_actions: [],
    recommended_side_skills: [],
    recommended_external_skills: [],
    stop_action: null,
    project_setup_gaps: [],
    hidden_compat_aliases: [],
    hidden_utility_skills: [],
    suppressed_surfaces: [],
  };
}

describe('ledger schema versioning', () => {
  test('canonical writers stamp schema_version first', () => {
    const root = fixtureRoot();

    writeLedger(startLedger('run-1', 'review'), root);
    const ledger = readJson(root, '.planning/nexus/current-run.json');
    expect(Object.keys(ledger)[0]).toBe('schema_version');
    expect(ledger.schema_version).toBe(NEXUS_LEDGER_SCHEMA_VERSION);

    writeStageStatus(stageStatusPath('review'), readyStatus(), root);
    const status = readJson(root, stageStatusPath('review'));
    expect(Object.keys(status)[0]).toBe('schema_version');
    expect(status.schema_version).toBe(NEXUS_LEDGER_SCHEMA_VERSION);

    const advisorWrite = buildCompletionAdvisorWrite(completionAdvisor(), {
      cwd: root,
      externalSkills: [],
      verificationMatrix: null,
    });
    const advisor = JSON.parse(advisorWrite.content) as Record<string, unknown>;
    expect(Object.keys(advisor)[0]).toBe('schema_version');
    expect(advisor.schema_version).toBe(NEXUS_LEDGER_SCHEMA_VERSION);
  });

  test('readers tolerate legacy artifacts without schema_version', () => {
    const root = fixtureRoot();
    const { schema_version: _ledgerVersion, ...legacyLedger } = startLedger('run-1', 'review');
    const { schema_version: _statusVersion, ...legacyStatus } = readyStatus();

    writeJson(root, '.planning/nexus/current-run.json', legacyLedger);
    writeJson(root, stageStatusPath('review'), legacyStatus);

    expect(readLedger(root)?.run_id).toBe('run-1');
    expect(readStageStatus(stageStatusPath('review'), root)?.run_id).toBe('run-1');
  });

  test('readers warn but tolerate unknown schema_version values', () => {
    const root = fixtureRoot();
    writeJson(root, '.planning/nexus/current-run.json', {
      ...startLedger('run-1', 'review'),
      schema_version: 99,
    });

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (message?: unknown): void => {
      warnings.push(String(message));
    };

    try {
      expect(readLedger(root)?.run_id).toBe('run-1');
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings.some((line) => line.includes('schema_version=99'))).toBe(true);
  });
});
