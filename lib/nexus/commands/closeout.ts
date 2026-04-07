import { readFileSync } from 'fs';
import { join } from 'path';
import { CANONICAL_MANIFEST } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
import {
  archiveAuditWorkspace,
  archiveExists,
  assertArchiveConsistency,
  assertCloseoutHistory,
  assertQaReadyForCloseout,
  assertReviewReadyForCloseout,
  assertSameRunId,
  assertShipReadyForCloseout,
  gateRequiresArchive,
} from '../governance';
import { readLedger } from '../ledger';
import { buildGsdTraceabilityPayloads, normalizeGsdCloseout } from '../normalizers/gsd';
import { applyNormalizationPlan } from '../normalizers';
import { readStageStatus } from '../status';
import { assertLegalTransition } from '../transitions';
import type { GsdCloseoutRaw } from '../adapters/gsd';
import type { ArtifactPointer, ConflictRecord, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

export async function runCloseout(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const reviewStatusPath = stageStatusPath('review');
  const qaStatusPath = stageStatusPath('qa');
  const shipStatusPath = stageStatusPath('ship');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);
  const qaStatus = readStageStatus(qaStatusPath, ctx.cwd);
  const shipStatus = readStageStatus(shipStatusPath, ctx.cwd);

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before closeout');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  if (qaStatus) {
    assertSameRunId(ledger.run_id, qaStatus.run_id, 'qa status');
  }
  if (shipStatus) {
    assertSameRunId(ledger.run_id, shipStatus.run_id, 'ship status');
  }
  assertLegalTransition(ledger.current_stage, 'closeout');
  assertCloseoutHistory(ledger, { qaRecorded: Boolean(qaStatus), shipRecorded: Boolean(shipStatus) });
  assertReviewReadyForCloseout(reviewStatus, ctx.cwd);
  assertQaReadyForCloseout(qaStatus);
  assertShipReadyForCloseout(shipStatus);

  const metaPath = '.planning/audits/current/meta.json';
  const gateDecisionPath = '.planning/audits/current/gate-decision.md';
  const meta = JSON.parse(readFileSync(join(ctx.cwd, metaPath), 'utf8')) as {
    run_id: string;
    implementation_route?: string;
    implementation_substrate?: string;
    implementation?: {
      requested_route?: {
        generator?: string | null;
        substrate?: string | null;
      };
      actual_route?: {
        route?: string | null;
        substrate?: string | null;
      } | null;
    };
  };
  const gateDecisionMarkdown = readFileSync(join(ctx.cwd, gateDecisionPath), 'utf8');

  assertSameRunId(ledger.run_id, meta.run_id, 'reviewed provenance');

  const reviewedGenerator = meta.implementation?.requested_route?.generator ?? meta.implementation_route;
  const reviewedSubstrate = meta.implementation?.requested_route?.substrate ?? meta.implementation_substrate;

  if (reviewedGenerator !== ledger.route_intent.generator) {
    throw new Error('Reviewed provenance route does not match ledger route intent');
  }

  if (reviewedSubstrate !== ledger.route_intent.substrate) {
    throw new Error('Reviewed provenance substrate does not match ledger route intent');
  }

  if (
    meta.implementation?.actual_route
    && (
      meta.implementation.actual_route.route !== reviewedGenerator
      || meta.implementation.actual_route.substrate !== reviewedSubstrate
    )
  ) {
    throw new Error('Reviewed actual route does not match reviewed requested route');
  }

  const archiveRequired = gateRequiresArchive(gateDecisionMarkdown);
  if (archiveRequired && archiveExists(ledger.run_id, ctx.cwd)) {
    assertArchiveConsistency(ledger.run_id, {
      ...reviewStatus,
      archive_required: true,
    }, ctx.cwd);
  }
  const archivePath = archiveRequired ? archiveAuditWorkspace(ledger.run_id, ctx.cwd) : null;
  assertArchiveConsistency(ledger.run_id, {
    ...reviewStatus,
    archive_required: archiveRequired,
  }, ctx.cwd);
  const startedAt = ctx.clock();
  const closeoutRecordPath = '.planning/current/closeout/CLOSEOUT-RECORD.md';
  const closeoutStatusPath = stageStatusPath('closeout');
  const manifest = CANONICAL_MANIFEST.closeout;
  const result = await ctx.adapters.gsd.closeout({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'closeout',
    stage: 'closeout',
    ledger,
    manifest,
    predecessor_artifacts: [
      artifactPointerFor(reviewStatusPath),
      ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
      ...(shipStatus ? [artifactPointerFor(shipStatusPath)] : []),
      artifactPointerFor(metaPath),
    ],
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.gsd.closeout>> & { raw_output: GsdCloseoutRaw };

  if (result.outcome !== 'success') {
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'closeout',
      state: result.outcome === 'refused' ? 'refused' : 'blocked',
      decision: result.outcome === 'refused' ? 'refused' : 'closeout_recorded',
      ready: false,
      inputs: [
        artifactPointerFor(reviewStatusPath),
        ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
        ...(shipStatus ? [artifactPointerFor(shipStatusPath)] : []),
        artifactPointerFor(metaPath),
      ],
      outputs: [artifactPointerFor(closeoutStatusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [result.outcome === 'refused' ? 'GSD closeout refused' : 'GSD closeout blocked'],
      archive_required: archiveRequired,
      archive_state: archiveRequired ? 'archived' : 'not_required',
      provenance_consistent: true,
    };
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'closeout',
      statusPath: closeoutStatusPath,
      canonicalWrites: [],
      traceWrites: buildGsdTraceabilityPayloads(
        'closeout',
        ledger.run_id,
        [reviewStatusPath, ...(qaStatus ? [qaStatusPath] : []), ...(shipStatus ? [shipStatusPath] : []), metaPath],
        { adapter: 'gsd', stage: 'closeout', archive_path: archivePath },
        result,
        {
          outcome: result.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: {
        ...ledger,
        status: result.outcome === 'refused' ? 'refused' : 'blocked',
        current_command: 'closeout',
        current_stage: 'closeout',
        allowed_next_stages: [],
        command_history: [...ledger.command_history, { command: 'closeout', at: startedAt, via: ctx.via }],
      },
    });
    throw new Error(result.outcome === 'refused' ? 'GSD closeout refused' : 'GSD closeout blocked');
  }

  try {
    const normalized = normalizeGsdCloseout(result);
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'closeout',
      state: result.raw_output.merge_ready ? 'completed' : 'blocked',
      decision: 'closeout_recorded',
      ready: result.raw_output.merge_ready,
      inputs: [
        artifactPointerFor(reviewStatusPath),
        ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
        ...(shipStatus ? [artifactPointerFor(shipStatusPath)] : []),
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
    const nextLedger = {
      ...ledger,
      status: result.raw_output.merge_ready ? 'completed' : 'blocked',
      previous_stage: (shipStatus ? 'ship' : qaStatus ? 'qa' : 'review') as 'review' | 'qa' | 'ship',
      current_command: 'closeout' as const,
      current_stage: 'closeout' as const,
      allowed_next_stages: [],
      command_history: [...ledger.command_history, { command: 'closeout', at: startedAt, via: ctx.via }],
      artifact_index: {
        ...ledger.artifact_index,
        [closeoutRecordPath]: artifactPointerFor(closeoutRecordPath),
        [closeoutStatusPath]: artifactPointerFor(closeoutStatusPath),
      },
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'closeout',
      statusPath: closeoutStatusPath,
      canonicalWrites: normalized.canonicalWrites,
      traceWrites: buildGsdTraceabilityPayloads(
        'closeout',
        ledger.run_id,
        [reviewStatusPath, ...(qaStatus ? [qaStatusPath] : []), ...(shipStatus ? [shipStatusPath] : []), metaPath],
        { adapter: 'gsd', stage: 'closeout', archive_path: archivePath },
        result,
        {
          outcome: 'success',
          canonical_paths: normalized.canonicalWrites.map((write) => write.path),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger,
    });

    return { command: 'closeout', status };
  } catch (error) {
    const conflict: ConflictRecord = {
      stage: 'closeout',
      adapter: 'gsd',
      kind: 'backend_conflict',
      message: error instanceof Error ? error.message : String(error),
      canonical_paths: [closeoutRecordPath, closeoutStatusPath],
      trace_paths: [
        '.planning/current/closeout/adapter-request.json',
        '.planning/current/closeout/adapter-output.json',
        '.planning/current/closeout/normalization.json',
      ],
    };
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'closeout',
      state: 'blocked',
      decision: 'closeout_recorded',
      ready: false,
      inputs: [
        artifactPointerFor(reviewStatusPath),
        ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
        ...(shipStatus ? [artifactPointerFor(shipStatusPath)] : []),
        artifactPointerFor(metaPath),
      ],
      outputs: [artifactPointerFor(closeoutStatusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: ['Canonical writeback failed'],
      archive_required: archiveRequired,
      archive_state: archiveRequired ? 'archived' : 'not_required',
      provenance_consistent: true,
    };
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'closeout',
      statusPath: closeoutStatusPath,
      canonicalWrites: [],
      traceWrites: buildGsdTraceabilityPayloads(
        'closeout',
        ledger.run_id,
        [reviewStatusPath, ...(qaStatus ? [qaStatusPath] : []), ...(shipStatus ? [shipStatusPath] : []), metaPath],
        { adapter: 'gsd', stage: 'closeout', archive_path: archivePath },
        result,
        {
          outcome: 'blocked',
          error: error instanceof Error ? error.message : String(error),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: {
        ...ledger,
        status: 'blocked',
        current_command: 'closeout',
        current_stage: 'closeout',
        allowed_next_stages: [],
        command_history: [...ledger.command_history, { command: 'closeout', at: startedAt, via: ctx.via }],
      },
      conflicts: [conflict],
    });
    throw error;
  }
}
