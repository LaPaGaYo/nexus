import { CANONICAL_MANIFEST } from '../command-manifest';
import { qaReportPath, stageStatusPath } from '../artifacts';
import { assertReviewReadyForCloseout, assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildQaTraceabilityPayloads,
  requestedAndActualRouteMatch,
  requestedQaRouteFromLedger,
} from '../normalizers/ccb';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { CcbExecuteQaRaw } from '../adapters/ccb';
import type { ArtifactPointer, ConflictRecord, RunLedger, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function nextLedger(
  ledger: RunLedger,
  status: RunLedger['status'],
  at: string,
  via: string | null,
): RunLedger {
  return {
    ...ledger,
    status,
    previous_stage: 'review',
    current_command: 'qa',
    current_stage: 'qa',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('qa') : [],
    command_history: [...ledger.command_history, { command: 'qa', at, via }],
  };
}

function blockedQaStatus(
  runId: string,
  startedAt: string,
  inputs: ArtifactPointer[],
  requestedRoute: StageStatus['requested_route'],
  actualRoute: StageStatus['actual_route'],
  error: string,
  state: 'blocked' | 'refused' = 'blocked',
): StageStatus {
  return {
    run_id: runId,
    stage: 'qa',
    state,
    decision: state === 'refused' ? 'refused' : 'qa_recorded',
    ready: false,
    inputs,
    outputs: [artifactPointerFor(stageStatusPath('qa'))],
    started_at: startedAt,
    completed_at: startedAt,
    errors: [error],
    requested_route: requestedRoute,
    actual_route: actualRoute,
    findings_count: 0,
  };
}

export async function runQa(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const reviewStatusPath = stageStatusPath('review');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before QA');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  assertLegalTransition(ledger.current_stage, 'qa');
  assertReviewReadyForCloseout(reviewStatus, ctx.cwd);

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.qa;
  const statusPath = stageStatusPath('qa');
  const reportPath = qaReportPath();
  const predecessorArtifacts = [artifactPointerFor(reviewStatusPath)];
  const requestedRoute = requestedQaRouteFromLedger(ledger);
  const result = await ctx.adapters.ccb.execute_qa({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'qa',
    stage: 'qa',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.ccb.execute_qa>> & { raw_output: CcbExecuteQaRaw };

  if (result.outcome !== 'success') {
    const message = result.outcome === 'refused'
      ? 'CCB QA validation refused'
      : 'CCB QA validation blocked';
    const status = blockedQaStatus(
      ledger.run_id,
      startedAt,
      predecessorArtifacts,
      requestedRoute,
      result.actual_route,
      message,
      result.outcome === 'refused' ? 'refused' : 'blocked',
    );
    const conflict: ConflictRecord = {
      stage: 'qa',
      adapter: 'ccb',
      kind: 'backend_conflict',
      message,
      canonical_paths: [statusPath],
      trace_paths: [
        '.planning/current/qa/adapter-request.json',
        '.planning/current/qa/adapter-output.json',
        '.planning/current/qa/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'qa',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildQaTraceabilityPayloads(
        ledger.run_id,
        [reviewStatusPath],
        requestedRoute,
        result,
        {
          outcome: result.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledger, result.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  if (!requestedAndActualRouteMatch(requestedRoute, result.actual_route)) {
    const message = 'Requested and actual QA route diverged';
    const status = blockedQaStatus(
      ledger.run_id,
      startedAt,
      predecessorArtifacts,
      requestedRoute,
      result.actual_route,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'qa',
      adapter: 'ccb',
      kind: 'route_mismatch',
      message,
      canonical_paths: [statusPath],
      trace_paths: [
        '.planning/current/qa/adapter-request.json',
        '.planning/current/qa/adapter-output.json',
        '.planning/current/qa/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'qa',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildQaTraceabilityPayloads(
        ledger.run_id,
        [reviewStatusPath],
        requestedRoute,
        result,
        {
          outcome: 'blocked',
          error: message,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledger, 'blocked', startedAt, ctx.via),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const reportMarkdown = result.raw_output.report_markdown?.trim();
  if (!reportMarkdown) {
    const message = 'QA report markdown is empty';
    const status = blockedQaStatus(
      ledger.run_id,
      startedAt,
      predecessorArtifacts,
      requestedRoute,
      result.actual_route,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'qa',
      adapter: 'ccb',
      kind: 'backend_conflict',
      message,
      canonical_paths: [statusPath],
      trace_paths: [
        '.planning/current/qa/adapter-request.json',
        '.planning/current/qa/adapter-output.json',
        '.planning/current/qa/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'qa',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildQaTraceabilityPayloads(
        ledger.run_id,
        [reviewStatusPath],
        requestedRoute,
        result,
        {
          outcome: 'blocked',
          error: message,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledger, 'blocked', startedAt, ctx.via),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const ready = result.raw_output.ready;
  const findings = result.raw_output.findings ?? [];
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'qa',
    state: 'completed',
    decision: 'qa_recorded',
    ready,
    inputs: predecessorArtifacts,
    outputs: [artifactPointerFor(reportPath), artifactPointerFor(statusPath)],
    started_at: startedAt,
    completed_at: startedAt,
    errors: ready ? [] : findings,
    requested_route: requestedRoute,
    actual_route: result.actual_route,
    findings_count: findings.length,
  };
  const next = nextLedger(ledger, ready ? 'active' : 'blocked', startedAt, ctx.via);
  next.artifact_index = {
    ...next.artifact_index,
    [reportPath]: artifactPointerFor(reportPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'qa',
    statusPath,
    canonicalWrites: [
      { path: reportPath, content: `${reportMarkdown}\n` },
    ],
    traceWrites: buildQaTraceabilityPayloads(
      ledger.run_id,
      [reviewStatusPath],
      requestedRoute,
      result,
      {
        outcome: 'success',
        canonical_paths: [reportPath],
        findings_count: findings.length,
        status: { state: status.state, decision: status.decision, ready: status.ready },
      },
    ),
    status,
    ledger: next,
  });

  return { command: 'qa', status };
}
