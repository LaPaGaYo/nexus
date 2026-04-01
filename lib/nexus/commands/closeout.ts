import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stageStatusPath } from '../artifacts';
import {
  archiveAuditWorkspace,
  assertExpectedHistory,
  assertReviewReadyForCloseout,
  assertSameRunId,
  gateRequiresArchive,
} from '../governance';
import { readLedger, writeLedger } from '../ledger';
import { readStageStatus, writeStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { ArtifactPointer, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function writeRepoFile(cwd: string, relativePath: string, content: string): void {
  writeFileSync(join(cwd, relativePath), content);
}

export async function runCloseout(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const reviewStatusPath = stageStatusPath('review');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before closeout');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  assertLegalTransition(ledger.current_stage, 'closeout');
  assertExpectedHistory(ledger, ['plan', 'handoff', 'build', 'review']);
  assertReviewReadyForCloseout(reviewStatus, ctx.cwd);

  const metaPath = '.planning/audits/current/meta.json';
  const gateDecisionPath = '.planning/audits/current/gate-decision.md';
  const meta = JSON.parse(readFileSync(join(ctx.cwd, metaPath), 'utf8')) as {
    run_id: string;
    implementation_route?: string;
    implementation_substrate?: string;
  };
  const gateDecisionMarkdown = readFileSync(join(ctx.cwd, gateDecisionPath), 'utf8');

  assertSameRunId(ledger.run_id, meta.run_id, 'reviewed provenance');

  if (meta.implementation_route !== ledger.route_intent.generator) {
    throw new Error('Reviewed provenance route does not match ledger route intent');
  }

  if (meta.implementation_substrate !== ledger.route_intent.substrate) {
    throw new Error('Reviewed provenance substrate does not match ledger route intent');
  }

  const archiveRequired = gateRequiresArchive(gateDecisionMarkdown);
  const archivePath = archiveRequired ? archiveAuditWorkspace(ledger.run_id, ctx.cwd) : null;
  const startedAt = ctx.clock();
  const closeoutDir = join(ctx.cwd, '.planning', 'current', 'closeout');
  const closeoutRecordPath = '.planning/current/closeout/CLOSEOUT-RECORD.md';
  const closeoutStatusPath = stageStatusPath('closeout');

  mkdirSync(closeoutDir, { recursive: true });
  writeRepoFile(
    ctx.cwd,
    closeoutRecordPath,
    `# Closeout Record\n\nRun: ${ledger.run_id}\n\nArchive required: ${archiveRequired}\n\nArchive: ${archivePath ?? 'not_required'}\n`,
  );

  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'closeout',
    state: 'completed',
    decision: 'closeout_recorded',
    ready: true,
    inputs: [
      artifactPointerFor(reviewStatusPath),
      artifactPointerFor(metaPath),
    ],
    outputs: [
      artifactPointerFor(closeoutRecordPath),
      artifactPointerFor(closeoutStatusPath),
    ],
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
    archive_required: archiveRequired,
    archive_state: archiveRequired ? 'archived' : 'not_required',
    provenance_consistent: true,
  };

  ledger.status = 'completed';
  ledger.previous_stage = 'review';
  ledger.current_command = 'closeout';
  ledger.current_stage = 'closeout';
  ledger.allowed_next_stages = getAllowedNextStages('closeout');
  ledger.command_history = [
    ...ledger.command_history,
    { command: 'closeout', at: startedAt, via: ctx.via },
  ];
  ledger.artifact_index = {
    ...ledger.artifact_index,
    [closeoutRecordPath]: artifactPointerFor(closeoutRecordPath),
    [closeoutStatusPath]: artifactPointerFor(closeoutStatusPath),
  };

  writeStageStatus(closeoutStatusPath, status, ctx.cwd);
  writeLedger(ledger, ctx.cwd);

  return { command: 'closeout', status };
}
