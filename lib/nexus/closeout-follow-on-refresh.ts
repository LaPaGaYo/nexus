import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  closeoutDocumentationSyncPath,
  closeoutFollowOnSummaryJsonPath,
  closeoutFollowOnSummaryMarkdownPath,
  closeoutNextRunBootstrapJsonPath,
  closeoutNextRunMarkdownPath,
  qaPerfVerificationPath,
  shipCanaryStatusPath,
  shipDeployResultPath,
  stageStatusPath,
} from './artifacts';
import { buildFollowOnEvidenceSummary, renderFollowOnEvidenceMarkdown } from './follow-on-evidence';
import { readLedger, writeLedger } from './ledger';
import { buildNextRunBootstrap, renderNextRunBootstrapMarkdown } from './run-bootstrap';
import { readStageStatus } from './status';
import type { ArtifactPointer, RunLedger } from './types';

const CLOSEOUT_RECORD_PATH = '.planning/current/closeout/CLOSEOUT-RECORD.md';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function attachedEvidencePathIfPresent(cwd: string, path: string): string | null {
  return existsSync(join(cwd, path)) ? path : null;
}

function renderAttachedEvidenceBlock(input: {
  perfVerificationPath: string | null;
  canaryEvidencePath: string | null;
  deployResultPath: string | null;
  documentationSyncPath: string | null;
}): string {
  if (
    !input.perfVerificationPath
    && !input.canaryEvidencePath
    && !input.deployResultPath
    && !input.documentationSyncPath
  ) {
    return '';
  }

  return [
    '',
    '## Attached Evidence',
    '',
    `- QA perf verification: ${input.perfVerificationPath ?? 'none'}`,
    `- Ship canary evidence: ${input.canaryEvidencePath ?? 'none'}`,
    `- Deploy result evidence: ${input.deployResultPath ?? 'none'}`,
    `- Documentation sync evidence: ${input.documentationSyncPath ?? 'none'}`,
    '',
  ].join('\n');
}

function refreshCloseoutRecord(
  cwd: string,
  evidence: {
    perfVerificationPath: string | null;
    canaryEvidencePath: string | null;
    deployResultPath: string | null;
    documentationSyncPath: string | null;
  },
): boolean {
  const absolutePath = join(cwd, CLOSEOUT_RECORD_PATH);
  if (!existsSync(absolutePath)) {
    return false;
  }

  const baseContent = readFileSync(absolutePath, 'utf8').replace(/\n## Attached Evidence[\s\S]*$/m, '').trimEnd();
  const nextContent = `${baseContent}${renderAttachedEvidenceBlock(evidence)}\n`;
  if (readFileSync(absolutePath, 'utf8') === nextContent) {
    return false;
  }
  writeFileSync(absolutePath, nextContent);
  return true;
}

function refreshArtifactIndex(ledger: RunLedger): RunLedger {
  const nextArtifactIndex = { ...ledger.artifact_index };
  nextArtifactIndex[CLOSEOUT_RECORD_PATH] = artifactPointerFor(CLOSEOUT_RECORD_PATH);
  nextArtifactIndex[closeoutFollowOnSummaryMarkdownPath()] = artifactPointerFor(closeoutFollowOnSummaryMarkdownPath());
  nextArtifactIndex[closeoutFollowOnSummaryJsonPath()] = artifactPointerFor(closeoutFollowOnSummaryJsonPath());
  nextArtifactIndex[closeoutNextRunMarkdownPath()] = artifactPointerFor(closeoutNextRunMarkdownPath());
  nextArtifactIndex[closeoutNextRunBootstrapJsonPath()] = artifactPointerFor(closeoutNextRunBootstrapJsonPath());

  return {
    ...ledger,
    artifact_index: nextArtifactIndex,
  };
}

export interface RefreshCloseoutFollowOnResult {
  status: 'updated' | 'skipped';
  reason: 'refreshed' | 'no_active_closeout' | 'missing_review_status';
  written_paths: string[];
}

export function refreshCurrentCloseoutFollowOnArtifacts(cwd: string): RefreshCloseoutFollowOnResult {
  const ledger = readLedger(cwd);
  const closeoutStatus = readStageStatus(stageStatusPath('closeout'), cwd);

  if (!ledger || !closeoutStatus || closeoutStatus.run_id !== ledger.run_id || closeoutStatus.stage !== 'closeout') {
    return {
      status: 'skipped',
      reason: 'no_active_closeout',
      written_paths: [],
    };
  }

  const reviewStatus = readStageStatus(stageStatusPath('review'), cwd);
  if (!reviewStatus || reviewStatus.run_id !== ledger.run_id) {
    return {
      status: 'skipped',
      reason: 'missing_review_status',
      written_paths: [],
    };
  }

  const qaStatus = readStageStatus(stageStatusPath('qa'), cwd);
  const shipStatus = readStageStatus(stageStatusPath('ship'), cwd);
  const perfVerificationPath = attachedEvidencePathIfPresent(cwd, qaPerfVerificationPath());
  const canaryEvidencePath = attachedEvidencePathIfPresent(cwd, shipCanaryStatusPath());
  const deployResultPath = attachedEvidencePathIfPresent(cwd, shipDeployResultPath());
  const documentationSyncPath = attachedEvidencePathIfPresent(cwd, closeoutDocumentationSyncPath());
  const refreshedAt = new Date().toISOString();
  const qaStatusForRun = qaStatus && qaStatus.run_id === ledger.run_id ? qaStatus : null;
  const shipStatusForRun = shipStatus && shipStatus.run_id === ledger.run_id ? shipStatus : null;

  const followOnSummary = buildFollowOnEvidenceSummary({
    cwd,
    runId: ledger.run_id,
    generatedAt: refreshedAt,
    perfVerificationPath,
    canaryEvidencePath,
    deployResultPath,
    documentationSyncPath,
  });
  const bootstrap = buildNextRunBootstrap({
    ledger,
    reviewStatus,
    qaStatus: qaStatusForRun,
    shipStatus: shipStatusForRun,
    generatedAt: refreshedAt,
    followOnSummaryRecorded: true,
    canaryEvidencePath,
    documentationSyncPath,
  });

  const writes: Array<{ path: string; content: string }> = [
    {
      path: closeoutFollowOnSummaryMarkdownPath(),
      content: renderFollowOnEvidenceMarkdown(followOnSummary),
    },
    {
      path: closeoutFollowOnSummaryJsonPath(),
      content: JSON.stringify(followOnSummary, null, 2) + '\n',
    },
    {
      path: closeoutNextRunMarkdownPath(),
      content: renderNextRunBootstrapMarkdown(bootstrap),
    },
    {
      path: closeoutNextRunBootstrapJsonPath(),
      content: JSON.stringify(bootstrap, null, 2) + '\n',
    },
  ];

  const writtenPaths: string[] = [];
  for (const write of writes) {
    const absolutePath = join(cwd, write.path);
    const previousContent = existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null;
    if (previousContent !== write.content) {
      writeFileSync(absolutePath, write.content);
      writtenPaths.push(write.path);
    }
  }

  if (refreshCloseoutRecord(cwd, {
    perfVerificationPath,
    canaryEvidencePath,
    deployResultPath,
    documentationSyncPath,
  })) {
    writtenPaths.push(CLOSEOUT_RECORD_PATH);
  }

  const nextLedger = refreshArtifactIndex(ledger);
  if (JSON.stringify(nextLedger.artifact_index) !== JSON.stringify(ledger.artifact_index)) {
    writeLedger(nextLedger, cwd);
  }

  return {
    status: 'updated',
    reason: 'refreshed',
    written_paths: writtenPaths,
  };
}
