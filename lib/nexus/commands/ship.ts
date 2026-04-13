import { CANONICAL_MANIFEST } from '../command-manifest';
import { shipChecklistPath, shipReleaseGateRecordPath, stageStatusPath } from '../artifacts';
import { executionFieldsFromLedger, withExecutionWorkspace } from '../execution-topology';
import { assertCanonicalTailLedger, assertQaReadyForCloseout, assertReviewReadyForCloseout, assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import { buildShipStageTraceabilityPayloads } from '../normalizers/superpowers';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import { resolveExecutionWorkspace } from '../workspace-substrate';
import type { SuperpowersShipDisciplineRaw } from '../adapters/superpowers';
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
  previousStage: 'review' | 'qa',
  status: RunLedger['status'],
  at: string,
  via: string | null,
): RunLedger {
  return {
    ...ledger,
    status,
    previous_stage: previousStage,
    current_command: 'ship',
    current_stage: 'ship',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('ship') : [],
    command_history: [...ledger.command_history, { command: 'ship', at, via }],
  };
}

function blockedShipStatus(
  ledger: RunLedger,
  startedAt: string,
  inputs: ArtifactPointer[],
  error: string,
  state: 'blocked' | 'refused' = 'blocked',
): StageStatus {
  return {
    run_id: ledger.run_id,
    stage: 'ship',
    ...executionFieldsFromLedger(ledger),
    state,
    decision: state === 'refused' ? 'refused' : 'ship_recorded',
    ready: false,
    inputs,
    outputs: [artifactPointerFor(stageStatusPath('ship'))],
    started_at: startedAt,
    completed_at: startedAt,
    errors: [error],
  };
}

export async function runShip(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const reviewStatusPath = stageStatusPath('review');
  const qaStatusPath = stageStatusPath('qa');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);
  const qaStatus = readStageStatus(qaStatusPath, ctx.cwd);

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before ship');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  if (qaStatus) {
    assertSameRunId(ledger.run_id, qaStatus.run_id, 'qa status');
  }
  assertCanonicalTailLedger(ledger, 'ship');
  assertLegalTransition(ledger.current_stage, 'ship');
  try {
    assertReviewReadyForCloseout(reviewStatus, ctx.cwd);
  } catch {
    throw new Error('Review must be completed before ship');
  }

  if (qaStatus) {
    try {
      assertQaReadyForCloseout(qaStatus);
    } catch {
      throw new Error('QA must be ready before ship');
    }
  }

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.ship;
  const workspace = resolveExecutionWorkspace(
    ctx.cwd,
    ledger.execution.workspace ?? qaStatus?.workspace ?? reviewStatus.workspace ?? null,
  );
  const ledgerWithWorkspace = withExecutionWorkspace(ledger, workspace);
  const releaseGateRecordPath = shipReleaseGateRecordPath();
  const checklistPath = shipChecklistPath();
  const statusPath = stageStatusPath('ship');
  const predecessorArtifacts = [
    artifactPointerFor(reviewStatusPath),
    ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
  ];
  const result = await ctx.adapters.superpowers.ship_discipline({
    cwd: ctx.cwd,
    workspace,
    run_id: ledger.run_id,
    command: 'ship',
    stage: 'ship',
    ledger: ledgerWithWorkspace,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.superpowers.ship_discipline>> & {
    raw_output: SuperpowersShipDisciplineRaw;
  };

  const previousStage = qaStatus ? 'qa' : 'review';

  if (result.outcome !== 'success') {
    const message = result.outcome === 'refused'
      ? 'Superpowers ship discipline refused ship'
      : 'Superpowers ship discipline blocked ship';
    const status = blockedShipStatus(
      ledgerWithWorkspace,
      startedAt,
      predecessorArtifacts,
      message,
      result.outcome === 'refused' ? 'refused' : 'blocked',
    );
    const conflict: ConflictRecord = {
      stage: 'ship',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [statusPath],
      trace_paths: [
        '.planning/current/ship/adapter-request.json',
        '.planning/current/ship/adapter-output.json',
        '.planning/current/ship/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'ship',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildShipStageTraceabilityPayloads(
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        workspace,
        result,
        {
          outcome: result.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(
        ledgerWithWorkspace,
        previousStage,
        result.outcome === 'refused' ? 'refused' : 'blocked',
        startedAt,
        ctx.via,
      ),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  if (!result.raw_output.release_gate_record?.trim()) {
    const message = 'Release gate record is empty';
    const status = blockedShipStatus(ledgerWithWorkspace, startedAt, predecessorArtifacts, message);
    const conflict: ConflictRecord = {
      stage: 'ship',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [statusPath],
      trace_paths: [
        '.planning/current/ship/adapter-request.json',
        '.planning/current/ship/adapter-output.json',
        '.planning/current/ship/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'ship',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildShipStageTraceabilityPayloads(
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        workspace,
        result,
        {
          outcome: 'blocked',
          error: message,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledgerWithWorkspace, previousStage, 'blocked', startedAt, ctx.via),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const checklist = result.raw_output.checklist;
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'ship',
    ...executionFieldsFromLedger(ledgerWithWorkspace),
    state: 'completed',
    decision: 'ship_recorded',
    ready: result.raw_output.merge_ready,
    inputs: predecessorArtifacts,
    outputs: [
      artifactPointerFor(releaseGateRecordPath),
      artifactPointerFor(checklistPath),
      artifactPointerFor(statusPath),
    ],
    started_at: startedAt,
    completed_at: startedAt,
    errors: result.raw_output.merge_ready ? [] : ['Release gate remains blocked'],
    workspace,
  };
  const next = nextLedger(ledgerWithWorkspace, previousStage, result.raw_output.merge_ready ? 'active' : 'blocked', startedAt, ctx.via);
  next.artifact_index = {
    ...next.artifact_index,
    [releaseGateRecordPath]: artifactPointerFor(releaseGateRecordPath),
    [checklistPath]: artifactPointerFor(checklistPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'ship',
    statusPath,
    canonicalWrites: [
      { path: releaseGateRecordPath, content: result.raw_output.release_gate_record },
      { path: checklistPath, content: JSON.stringify(checklist, null, 2) + '\n' },
    ],
    traceWrites: buildShipStageTraceabilityPayloads(
      ledger.run_id,
      predecessorArtifacts.map((artifact) => artifact.path),
      workspace,
      result,
      {
        outcome: 'success',
        canonical_paths: [releaseGateRecordPath, checklistPath],
        status: { state: status.state, decision: status.decision, ready: status.ready },
      },
    ),
    status,
    ledger: next,
  });

  return { command: 'ship', status };
}
