import { CANONICAL_MANIFEST } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
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
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { CcbResolveRouteRaw } from '../adapters/ccb';
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
    previous_stage: 'plan',
    current_command: 'handoff',
    current_stage: 'handoff',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('handoff') : [],
    command_history: [...ledger.command_history, { command: 'handoff', at, via }],
  };
}

export async function runHandoff(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const planStatusPath = stageStatusPath('plan');
  const planStatus = readStageStatus(planStatusPath, ctx.cwd);

  if (!ledger || !planStatus?.ready) {
    throw new Error('Plan must be completed and ready before handoff');
  }

  assertSameRunId(ledger.run_id, planStatus.run_id, 'plan status');
  assertLegalTransition(ledger.current_stage, 'handoff');

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.handoff;
  const requestedRoute = requestedBuildRouteFromLedger({
    ...ledger,
    route_intent: {
      planner: ledger.route_intent.planner ?? 'claude+pm-gsd',
      generator: ledger.route_intent.generator ?? 'codex-via-ccb',
      evaluator_a: ledger.route_intent.evaluator_a ?? 'codex-via-ccb',
      evaluator_b: ledger.route_intent.evaluator_b ?? 'gemini-via-ccb',
      synthesizer: ledger.route_intent.synthesizer ?? 'claude',
      substrate: ledger.route_intent.substrate ?? 'superpowers-core',
      fallback_policy: 'disabled',
    },
  });
  const routingPath = '.planning/current/handoff/governed-execution-routing.md';
  const handoffPath = '.planning/current/handoff/governed-handoff.md';
  const statusPath = stageStatusPath('handoff');
  const result = await ctx.adapters.ccb.resolve_route({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'handoff',
    stage: 'handoff',
    ledger,
    manifest,
    predecessor_artifacts: [artifactPointerFor(planStatusPath)],
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.ccb.resolve_route>> & { raw_output: CcbResolveRouteRaw };
  const routeValidation = result.outcome === 'success'
    ? normalizeHandoffRouteValidation(requestedRoute, result)
    : {
        route_validation: {
          transport: 'ccb' as const,
          available: false,
          approved: false,
          reason: result.outcome === 'refused'
            ? 'CCB route validation refused the governed route'
            : 'CCB route validation blocked the governed route',
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
      content: buildGovernedHandoffMarkdown(requestedRoute, routeValidation.route_validation),
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
  };
  const next = nextLedger(
    {
      ...ledger,
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
      adapter: 'ccb',
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
          adapter: 'ccb',
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

    throw new Error('Governed route is not approved by Nexus');
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
        adapter: 'ccb',
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
