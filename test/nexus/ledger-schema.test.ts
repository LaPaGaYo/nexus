import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import {
  archivedCloseoutRootFor,
  archivedRunLedgerPath,
  stageCompletionAdvisorPath,
  stageStatusPath,
} from '../../lib/nexus/artifacts';
import { resolveCliCompletionContext } from '../../lib/nexus/cli-advisor';
import { buildCompletionAdvisorWrite } from '../../lib/nexus/completion-advisor/writer';
import { archiveCompletedRunLedger, readLedger, startLedger, writeLedger } from '../../lib/nexus/ledger';
import { warnOnUnexpectedLedgerSchemaVersion } from '../../lib/nexus/ledger-schema';
import {
  buildReviewMetaWrite,
  CURRENT_REVIEW_META_PATH,
  readCurrentReviewMeta,
} from '../../lib/nexus/review-meta';
import { readStageStatus, writeStageStatus } from '../../lib/nexus/status';
import {
  NEXUS_LEDGER_SCHEMA_VERSION,
  type CompletionAdvisorRecord,
  type ReviewMetaRecord,
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

function completedCloseoutStatus(): StageStatus {
  return {
    ...readyStatus(),
    stage: 'closeout',
    decision: 'closeout_recorded',
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

function reviewMeta(): ReviewMetaRecord {
  const requestedRoute = {
    command: 'review' as const,
    governed: true,
    execution_mode: 'governed_ccb' as const,
    primary_provider: 'codex' as const,
    provider_topology: 'multi_session' as const,
    planner: 'claude+pm-gsd',
    generator: 'codex-via-ccb',
    evaluator_a: 'codex-via-ccb',
    evaluator_b: 'gemini-via-ccb',
    synthesizer: 'claude',
    substrate: 'superpowers-core',
    transport: 'ccb' as const,
    fallback_policy: 'disabled' as const,
  };

  return {
    schema_version: NEXUS_LEDGER_SCHEMA_VERSION,
    run_id: 'run-1',
    review_attempt_id: 'review-attempt-1',
    implementation_provider: 'codex',
    implementation_path: '.planning/current/build/build-result.md',
    implementation_route: 'codex-via-ccb',
    implementation_substrate: 'superpowers-core',
    implementation: {
      path: '.planning/current/build/build-result.md',
      requested_route: requestedRoute,
      actual_route: null,
    },
    audits: {
      codex: {
        provider: 'codex',
        path: '.planning/audits/current/codex.md',
        requested_route: {
          provider: 'codex',
          route: 'codex-via-ccb',
          substrate: 'superpowers-core',
          transport: 'ccb',
        },
        actual_route: null,
      },
      gemini: {
        provider: 'gemini',
        path: '.planning/audits/current/gemini.md',
        requested_route: {
          provider: 'gemini',
          route: 'gemini-via-ccb',
          substrate: 'superpowers-core',
          transport: 'ccb',
        },
        actual_route: null,
      },
    },
    review_discipline: {
      adapter: 'superpowers',
      summary: 'Review discipline completed.',
    },
    codex_audit: {
      provider: 'codex',
      path: '.planning/audits/current/codex.md',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
    },
    gemini_audit: {
      provider: 'gemini',
      path: '.planning/audits/current/gemini.md',
      route: 'gemini-via-ccb',
      substrate: 'superpowers-core',
    },
    pm_skill: 'frame',
    execution_skill_chain: ['plan', 'handoff', 'build', 'review'],
    lifecycle_stage: 'review',
    handoff_from: 'build',
    handoff_to: 'qa',
  };
}

const CANONICAL_VERSIONED_WRITERS: Array<{
  name: string;
  readWrittenRecord: (root: string) => Record<string, unknown>;
}> = [
  {
    name: 'writeLedger',
    readWrittenRecord: (root) => {
      writeLedger(startLedger('run-1', 'review'), root);
      return readJson(root, '.planning/nexus/current-run.json');
    },
  },
  {
    name: 'writeStageStatus',
    readWrittenRecord: (root) => {
      writeStageStatus(stageStatusPath('review'), readyStatus(), root);
      return readJson(root, stageStatusPath('review'));
    },
  },
  {
    name: 'buildCompletionAdvisorWrite',
    readWrittenRecord: (root) => {
      const advisorWrite = buildCompletionAdvisorWrite(completionAdvisor(), {
        cwd: root,
        externalSkills: [],
        verificationMatrix: null,
      });
      return JSON.parse(advisorWrite.content) as Record<string, unknown>;
    },
  },
  {
    name: 'archiveCompletedRunLedger',
    readWrittenRecord: (root) => {
      archiveCompletedRunLedger(startLedger('run-1', 'closeout'), root);
      return readJson(root, archivedRunLedgerPath('run-1'));
    },
  },
  {
    name: 'archiveCompletedRunLedger closeout status',
    readWrittenRecord: (root) => {
      writeJson(root, stageStatusPath('closeout'), completedCloseoutStatus());
      archiveCompletedRunLedger(startLedger('run-1', 'closeout'), root);
      return readJson(root, `${archivedCloseoutRootFor('run-1')}/status.json`);
    },
  },
  {
    name: 'buildReviewMetaWrite',
    readWrittenRecord: () => JSON.parse(buildReviewMetaWrite(reviewMeta()).content) as Record<string, unknown>,
  },
];

const UNKNOWN_VERSION_READERS: Array<{
  name: string;
  artifactPath: string;
  writeUnknownVersionArtifact: (root: string) => void;
  readRunId: (root: string) => string | null | undefined;
}> = [
  {
    name: 'readLedger',
    artifactPath: '.planning/nexus/current-run.json',
    writeUnknownVersionArtifact: (root) => {
      writeJson(root, '.planning/nexus/current-run.json', {
        ...startLedger('run-1', 'review'),
        schema_version: 99,
      });
    },
    readRunId: (root) => readLedger(root)?.run_id,
  },
  {
    name: 'readStageStatus',
    artifactPath: stageStatusPath('review'),
    writeUnknownVersionArtifact: (root) => {
      writeJson(root, stageStatusPath('review'), {
        ...readyStatus(),
        schema_version: 99,
      });
    },
    readRunId: (root) => readStageStatus(stageStatusPath('review'), root)?.run_id,
  },
  {
    name: 'readCompletionAdvisor',
    artifactPath: stageCompletionAdvisorPath('review'),
    writeUnknownVersionArtifact: (root) => {
      writeJson(root, stageCompletionAdvisorPath('review'), {
        ...completionAdvisor(),
        schema_version: 99,
      });
    },
    readRunId: (root) => resolveCliCompletionContext(root, 'review').advisor?.run_id,
  },
  {
    name: 'readCurrentReviewMeta',
    artifactPath: CURRENT_REVIEW_META_PATH,
    writeUnknownVersionArtifact: (root) => {
      writeJson(root, CURRENT_REVIEW_META_PATH, {
        ...reviewMeta(),
        schema_version: 99,
      });
    },
    readRunId: (root) => readCurrentReviewMeta(root)?.run_id,
  },
];

function captureWarnings(fn: () => void): string[] {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message?: unknown): void => {
    warnings.push(String(message));
  };

  try {
    fn();
  } finally {
    console.warn = originalWarn;
  }

  return warnings;
}

describe('ledger schema versioning', () => {
  test.each(CANONICAL_VERSIONED_WRITERS)('canonical writer $name stamps schema_version first', ({ readWrittenRecord }) => {
    const root = fixtureRoot();
    const record = readWrittenRecord(root);

    expect(Object.keys(record)[0]).toBe('schema_version');
    expect(record.schema_version).toBe(NEXUS_LEDGER_SCHEMA_VERSION);
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

  test.each(UNKNOWN_VERSION_READERS)('$name warns but tolerates unknown schema_version values', ({
    artifactPath,
    writeUnknownVersionArtifact,
    readRunId,
  }) => {
    const root = fixtureRoot();
    writeUnknownVersionArtifact(root);

    const warnings = captureWarnings(() => {
      expect(readRunId(root)).toBe('run-1');
    });

    expect(warnings.some((line) => line.includes(artifactPath))).toBe(true);
    expect(warnings.some((line) => line.includes('schema_version=99'))).toBe(true);
  });

  test('schema warnings are memoized by artifact label', () => {
    const artifactPath = '.planning/test/memoized-ledger-schema-warning.json';

    const warnings = captureWarnings(() => {
      warnOnUnexpectedLedgerSchemaVersion({ schema_version: 99 }, artifactPath);
      warnOnUnexpectedLedgerSchemaVersion({ schema_version: 99 }, artifactPath);
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(artifactPath);
  });
});
