import { CANONICAL_MANIFEST } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
import { assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildBuildResultMarkdown,
  requestedAndActualRouteMatch,
  requestedBuildRouteFromLedger,
} from '../normalizers/ccb';
import { buildBuildStageTraceabilityPayloads, normalizeBuildDiscipline } from '../normalizers/superpowers';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { CcbExecuteGeneratorRaw } from '../adapters/ccb';
import type { SuperpowersBuildDisciplineRaw } from '../adapters/superpowers';
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
    previous_stage: 'handoff',
    current_command: 'build',
    current_stage: 'build',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('build') : [],
    command_history: [...ledger.command_history, { command: 'build', at, via }],
  };
}

export async function runBuild(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const handoffStatusPath = stageStatusPath('handoff');
  const handoffStatus = readStageStatus(handoffStatusPath, ctx.cwd);

  if (!ledger || !handoffStatus?.ready) {
    throw new Error('Handoff must be completed before build');
  }

  assertSameRunId(ledger.run_id, handoffStatus.run_id, 'handoff status');
  assertLegalTransition(ledger.current_stage, 'build');

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.build;
  const buildRequestPath = '.planning/current/build/build-request.json';
  const buildResultPath = '.planning/current/build/build-result.md';
  const statusPath = stageStatusPath('build');
  const requestedRoute = handoffStatus.requested_route ?? requestedBuildRouteFromLedger(ledger);
  const predecessorArtifacts = [artifactPointerFor(handoffStatusPath)];
  const buildRequestWrite = {
    path: buildRequestPath,
    content: JSON.stringify(
      {
        run_id: ledger.run_id,
        requested_route: requestedRoute,
      },
      null,
      2,
    ) + '\n',
  };
  const disciplineResult = await ctx.adapters.superpowers.build_discipline({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'build',
    stage: 'build',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.superpowers.build_discipline>> & {
    raw_output: SuperpowersBuildDisciplineRaw;
  };

  if (disciplineResult.outcome !== 'success') {
    const message = disciplineResult.outcome === 'refused'
      ? 'Superpowers discipline refused build'
      : 'Superpowers discipline blocked build';
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      state: disciplineResult.outcome === 'refused' ? 'refused' : 'blocked',
      decision: disciplineResult.outcome === 'refused' ? 'refused' : 'build_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(buildRequestPath), artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [message],
      requested_route: requestedRoute,
      actual_route: null,
    };
    const next = nextLedger(ledger, disciplineResult.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };
    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [buildRequestPath, statusPath],
      trace_paths: [
        '.planning/current/build/adapter-request.json',
        '.planning/current/build/adapter-output.json',
        '.planning/current/build/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'build',
      statusPath,
      canonicalWrites: [buildRequestWrite],
      traceWrites: buildBuildStageTraceabilityPayloads(
        ledger.run_id,
        [handoffStatusPath],
        requestedRoute,
        disciplineResult,
        null,
        {
          outcome: disciplineResult.outcome,
          discipline_summary: disciplineResult.raw_output?.verification_summary ?? null,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: next,
      conflicts: [conflict, ...disciplineResult.conflict_candidates],
    });

    throw new Error(message);
  }

  let normalizedDiscipline: ReturnType<typeof normalizeBuildDiscipline>;
  try {
    normalizedDiscipline = normalizeBuildDiscipline(disciplineResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      state: 'blocked',
      decision: 'build_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(buildRequestPath), artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [message],
      requested_route: requestedRoute,
      actual_route: null,
    };
    const next = nextLedger(ledger, 'blocked', startedAt, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };
    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [buildRequestPath, statusPath],
      trace_paths: [
        '.planning/current/build/adapter-request.json',
        '.planning/current/build/adapter-output.json',
        '.planning/current/build/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'build',
      statusPath,
      canonicalWrites: [buildRequestWrite],
      traceWrites: buildBuildStageTraceabilityPayloads(
        ledger.run_id,
        [handoffStatusPath],
        requestedRoute,
        disciplineResult,
        null,
        {
          outcome: 'blocked',
          error: message,
          discipline_summary: disciplineResult.raw_output?.verification_summary ?? null,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: next,
      conflicts: [conflict, ...disciplineResult.conflict_candidates],
    });

    throw error;
  }

  const result = await ctx.adapters.ccb.execute_generator({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'build',
    stage: 'build',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.ccb.execute_generator>> & { raw_output: CcbExecuteGeneratorRaw };

  if (result.outcome !== 'success') {
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      state: result.outcome === 'refused' ? 'refused' : 'blocked',
      decision: result.outcome === 'refused' ? 'refused' : 'build_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(buildRequestPath), artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [result.outcome === 'refused' ? 'CCB generator execution refused' : 'CCB generator execution blocked'],
      requested_route: requestedRoute,
      actual_route: result.actual_route,
    };
    const next = nextLedger(ledger, result.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };

    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: 'ccb',
      kind: 'backend_conflict',
      message: result.outcome === 'refused' ? 'CCB generator execution refused' : 'CCB generator execution blocked',
      canonical_paths: [buildRequestPath, statusPath],
      trace_paths: [
        '.planning/current/build/adapter-request.json',
        '.planning/current/build/adapter-output.json',
        '.planning/current/build/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'build',
      statusPath,
      canonicalWrites: [buildRequestWrite],
      traceWrites: buildBuildStageTraceabilityPayloads(
        ledger.run_id,
        [handoffStatusPath],
        requestedRoute,
        disciplineResult,
        result,
        {
          outcome: result.outcome,
          discipline_summary: normalizedDiscipline.verification_summary,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: next,
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(result.outcome === 'refused' ? 'CCB generator execution refused' : 'CCB generator execution blocked');
  }

  const routesMatch = requestedAndActualRouteMatch(requestedRoute, result.actual_route);
  if (!routesMatch) {
    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: 'ccb',
      kind: 'route_mismatch',
      message: 'Requested and actual route diverged',
      canonical_paths: [buildRequestPath, statusPath],
      trace_paths: [
        '.planning/current/build/adapter-request.json',
        '.planning/current/build/adapter-output.json',
        '.planning/current/build/normalization.json',
      ],
    };
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      state: 'blocked',
      decision: 'build_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(buildRequestPath), artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: ['Requested and actual route diverged'],
      requested_route: requestedRoute,
      actual_route: result.actual_route,
    };
    const next = nextLedger(ledger, 'blocked', startedAt, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'build',
      statusPath,
      canonicalWrites: [buildRequestWrite],
      traceWrites: buildBuildStageTraceabilityPayloads(
        ledger.run_id,
        [handoffStatusPath],
        requestedRoute,
        disciplineResult,
        result,
        {
          outcome: 'blocked',
          error: 'Requested and actual route diverged',
          discipline_summary: normalizedDiscipline.verification_summary,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: next,
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error('Requested and actual route diverged');
  }

  const buildResultWrite = {
    path: buildResultPath,
    content: buildBuildResultMarkdown(
      requestedRoute,
      result.actual_route!,
      result.raw_output.receipt,
      normalizedDiscipline.verification_summary,
    ),
  };
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'build',
    state: 'completed',
    decision: 'build_recorded',
    ready: true,
    inputs: predecessorArtifacts,
    outputs: [
      artifactPointerFor(buildRequestPath),
      artifactPointerFor(buildResultPath),
      artifactPointerFor(statusPath),
    ],
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
    requested_route: requestedRoute,
    actual_route: result.actual_route,
  };
  const next = nextLedger(ledger, 'active', startedAt, ctx.via);
  next.artifact_index = {
    ...next.artifact_index,
    [buildRequestPath]: artifactPointerFor(buildRequestPath),
    [buildResultPath]: artifactPointerFor(buildResultPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'build',
    statusPath,
    canonicalWrites: [buildRequestWrite, buildResultWrite],
    traceWrites: buildBuildStageTraceabilityPayloads(
      ledger.run_id,
      [handoffStatusPath],
      requestedRoute,
      disciplineResult,
      result,
      {
        outcome: 'success',
        canonical_paths: [buildRequestPath, buildResultPath],
        discipline_summary: normalizedDiscipline.verification_summary,
        status: { state: status.state, decision: status.decision, ready: status.ready },
      },
    ),
    status,
    ledger: next,
  });

  return { command: 'build', status };
}
