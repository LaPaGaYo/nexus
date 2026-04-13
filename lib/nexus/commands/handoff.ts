import { CANONICAL_MANIFEST } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
import { executionFieldsFromLedger } from '../execution-topology';
import { assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildCcbTraceabilityPayloads,
  buildGovernedExecutionRoutingMarkdown,
  buildGovernedHandoffMarkdown,
  normalizeHandoffRouteValidation,
  requestedBuildRouteFromLedger,
} from '../normalizers/ccb';
import { fullAcceptanceReviewScope, resolveFixCycleReviewScope } from '../review-scope';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { CcbResolveRouteRaw } from '../adapters/ccb';
import type { LocalResolveRouteRaw } from '../adapters/local';
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
  previousStage: 'plan' | 'handoff' | 'review',
  status: RunLedger['status'],
  at: string,
  via: string | null,
): RunLedger {
  return {
    ...ledger,
    status,
    previous_stage: previousStage,
    current_command: 'handoff',
    current_stage: 'handoff',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('handoff') : [],
    command_history: [...ledger.command_history, { command: 'handoff', at, via }],
  };
}

export async function runHandoff(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const planStatusPath = stageStatusPath('plan');
  const priorHandoffStatusPath = stageStatusPath('handoff');
  const reviewStatusPath = stageStatusPath('review');
  const planStatus = readStageStatus(planStatusPath, ctx.cwd);
  const priorHandoffStatus = readStageStatus(priorHandoffStatusPath, ctx.cwd);
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !planStatus?.ready) {
    throw new Error('Plan must be completed and ready before handoff');
  }

  assertSameRunId(ledger.run_id, planStatus.run_id, 'plan status');
  assertLegalTransition(ledger.current_stage, 'handoff');

  if (ledger.current_stage === 'review') {
    if (!reviewStatus) {
      throw new Error('Review status must exist before refreshing governed handoff from review');
    }

    assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');

    if (reviewStatus.gate_decision !== 'fail') {
      throw new Error('Handoff refresh from review is only valid after a failing review gate');
    }
  }

  if (ledger.current_stage === 'handoff' && priorHandoffStatus) {
    assertSameRunId(ledger.run_id, priorHandoffStatus.run_id, 'handoff status');
  }

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.handoff;
  const reviewScope = ledger.current_stage === 'review'
    ? resolveFixCycleReviewScope(ctx.cwd, reviewStatus)
    : priorHandoffStatus?.review_scope ?? fullAcceptanceReviewScope();
  const requestedRoute = (
    ledger.current_stage === 'review'
      ? reviewStatus?.requested_route
      : ledger.current_stage === 'handoff'
        ? priorHandoffStatus?.requested_route
        : null
  ) ?? requestedBuildRouteFromLedger({
    ...ledger,
    route_intent: {
      planner: ledger.route_intent.planner ?? 'claude+pm-gsd',
      generator: ledger.route_intent.generator,
      evaluator_a: ledger.route_intent.evaluator_a,
      evaluator_b: ledger.route_intent.evaluator_b,
      synthesizer: ledger.route_intent.synthesizer ?? (ledger.execution.mode === 'local_provider'
        ? ledger.execution.primary_provider
        : 'claude'),
      substrate: ledger.route_intent.substrate ?? 'superpowers-core',
      fallback_policy: 'disabled',
    },
  });
  const routingPath = '.planning/current/handoff/governed-execution-routing.md';
  const handoffPath = '.planning/current/handoff/governed-handoff.md';
  const statusPath = stageStatusPath('handoff');
  const routeAdapter = ledger.execution.mode === 'local_provider' ? ctx.adapters.local : ctx.adapters.ccb;
  const result = await routeAdapter.resolve_route({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'handoff',
    stage: 'handoff',
    ledger,
    manifest,
    predecessor_artifacts: ledger.current_stage === 'review'
      ? [artifactPointerFor(planStatusPath), artifactPointerFor(reviewStatusPath)]
      : ledger.current_stage === 'handoff' && priorHandoffStatus
        ? [artifactPointerFor(planStatusPath), artifactPointerFor(priorHandoffStatusPath)]
        : [artifactPointerFor(planStatusPath)],
    requested_route: requestedRoute,
    review_scope: reviewScope,
  }) as Awaited<ReturnType<typeof routeAdapter.resolve_route>> & { raw_output: CcbResolveRouteRaw | LocalResolveRouteRaw };
  const routeValidation = result.outcome === 'success'
    ? normalizeHandoffRouteValidation(requestedRoute, result)
    : {
        route_validation: {
          transport: requestedRoute.transport,
          available: false,
          approved: false,
          reason: result.notices[0]
            ?? (result.outcome === 'refused'
              ? `${requestedRoute.transport === 'local' ? 'Local provider' : 'CCB'} route validation refused the requested route`
              : `${requestedRoute.transport === 'local' ? 'Local provider' : 'CCB'} route validation blocked the requested route`),
        },
        approved: false,
      };

  const canonicalWrites = [
    {
      path: routingPath,
      content: buildGovernedExecutionRoutingMarkdown(requestedRoute, routeValidation.route_validation),
    },
    {
      path: handoffPath,
      content: buildGovernedHandoffMarkdown(requestedRoute, routeValidation.route_validation, reviewScope),
    },
  ];
  const outputs = [
    artifactPointerFor(routingPath),
    artifactPointerFor(handoffPath),
    artifactPointerFor(statusPath),
  ];
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'handoff',
    ...executionFieldsFromLedger(ledger),
    state: result.outcome === 'refused'
      ? 'refused'
      : routeValidation.approved
        ? 'completed'
        : 'blocked',
    decision: result.outcome === 'refused' ? 'refused' : 'route_recorded',
    ready: routeValidation.approved,
    inputs: [artifactPointerFor(planStatusPath)],
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: routeValidation.approved ? [] : [routeValidation.route_validation.reason],
    requested_route: requestedRoute,
    route_validation: routeValidation.route_validation,
    review_scope: reviewScope,
  };
  const next = nextLedger(
    {
      ...ledger,
      execution: {
        ...ledger.execution,
        requested_path: requestedRoute.generator ?? ledger.execution.requested_path,
      },
      route_intent: {
        planner: requestedRoute.planner,
        generator: requestedRoute.generator,
        evaluator_a: requestedRoute.evaluator_a,
        evaluator_b: requestedRoute.evaluator_b,
        synthesizer: requestedRoute.synthesizer,
        substrate: requestedRoute.substrate,
        fallback_policy: requestedRoute.fallback_policy,
      },
    },
    ledger.current_stage === 'review' ? 'review' : ledger.current_stage === 'handoff' ? 'handoff' : 'plan',
    routeValidation.approved ? 'active' : result.outcome === 'refused' ? 'refused' : 'blocked',
    startedAt,
    ctx.via,
  );
  next.artifact_index = {
    ...next.artifact_index,
    [routingPath]: artifactPointerFor(routingPath),
    [handoffPath]: artifactPointerFor(handoffPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  if (result.outcome !== 'success' || routeValidation.approved !== true) {
    const conflict: ConflictRecord = {
      stage: 'handoff',
      adapter: requestedRoute.transport === 'local' ? 'local' : 'ccb',
      kind: 'backend_conflict',
      message: routeValidation.route_validation.reason,
      canonical_paths: [routingPath, handoffPath, statusPath],
      trace_paths: [
        '.planning/current/handoff/adapter-request.json',
        '.planning/current/handoff/adapter-output.json',
        '.planning/current/handoff/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'handoff',
      statusPath,
      canonicalWrites,
      traceWrites: buildCcbTraceabilityPayloads(
        'handoff',
        ledger.run_id,
        [planStatusPath],
        {
          adapter: requestedRoute.transport === 'local' ? 'local' : 'ccb',
          stage: 'handoff',
          requested_route: requestedRoute,
        },
        result,
        {
          outcome: result.outcome === 'success' ? 'blocked' : result.outcome,
          route_validation: routeValidation.route_validation,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: next,
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(
      requestedRoute.transport === 'local'
        ? 'Local provider route is not approved by Nexus'
        : 'Governed route is not approved by Nexus',
    );
  }

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'handoff',
    statusPath,
    canonicalWrites,
    traceWrites: buildCcbTraceabilityPayloads(
      'handoff',
      ledger.run_id,
      [planStatusPath],
      {
        adapter: requestedRoute.transport === 'local' ? 'local' : 'ccb',
        stage: 'handoff',
        requested_route: requestedRoute,
      },
      result,
      {
        outcome: 'success',
        route_validation: routeValidation.route_validation,
        canonical_paths: canonicalWrites.map((write) => write.path),
        status: { state: status.state, decision: status.decision, ready: status.ready },
      },
    ),
    status,
    ledger: next,
  });

  return { command: 'handoff', status };
}
