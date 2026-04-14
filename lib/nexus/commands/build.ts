import { CANONICAL_MANIFEST } from '../command-manifest';
import {
  artifactPointerFor,
  dedupeArtifactPointers,
  executionContractArtifacts,
  HANDOFF_STATUS_PATH,
  REVIEW_STATUS_PATH,
} from '../contract-artifacts';
import { stageAdapterOutputPath, stageAdapterRequestPath, stageNormalizationPath, stageStatusPath } from '../artifacts';
import {
  executionFieldsFromLedger,
  withActualExecutionPath,
  withExecutionSessionRoot,
  withExecutionWorkspace,
} from '../execution-topology';
import { assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildBuildResultMarkdown,
  requestedAndActualRouteMatch,
  requestedBuildRouteFromLedger,
  validateGovernedHandoffRouteValidation,
} from '../normalizers/ccb';
import { fullAcceptanceReviewScope, normalizeReviewScopeRecord, resolveFixCycleReviewScope } from '../review-scope';
import { buildBuildStageTraceabilityPayloads, normalizeBuildDiscipline } from '../normalizers/superpowers';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import { resolveExecutionWorkspace, resolveSessionRootRecord, syncRunWorkspaceArtifacts } from '../workspace-substrate';
import type { CcbExecuteGeneratorRaw } from '../adapters/ccb';
import type { LocalExecuteGeneratorRaw } from '../adapters/local';
import type { SuperpowersBuildDisciplineRaw } from '../adapters/superpowers';
import type { ArtifactPointer, CommandHistoryVia, ConflictRecord, RunLedger, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function nextLedger(
  ledger: RunLedger,
  previousStage: 'handoff' | 'review',
  status: RunLedger['status'],
  at: string,
  via: CommandHistoryVia,
): RunLedger {
  return {
    ...ledger,
    status,
    previous_stage: previousStage,
    current_command: 'build',
    current_stage: 'build',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('build') : [],
    command_history: [...ledger.command_history, { command: 'build', at, via }],
  };
}

function buildCommandHistoryVia(
  reviewScope: StageStatus['review_scope'],
  via: string | null,
): CommandHistoryVia {
  if (reviewScope?.mode === 'bounded_fix_cycle') {
    return 'fix-cycle';
  }

  return via as CommandHistoryVia;
}

function blockedPreflightLedger(
  ledger: RunLedger,
  recoveryStage: 'handoff',
): RunLedger {
  return {
    ...ledger,
    status: 'blocked',
    allowed_next_stages: [recoveryStage],
  };
}

interface ParsedBuildExecutionSummary {
  status: 'completed' | 'blocked';
  markdown: string;
  actions: string | null;
  filesTouched: string | null;
  verification: string | null;
}

function parseBuildExecutionSummary(summaryMarkdown: string | null | undefined): ParsedBuildExecutionSummary | null {
  if (!summaryMarkdown) {
    return null;
  }

  const normalized = summaryMarkdown.replace(/\r\n/g, '\n');
  const headerIndex = normalized.lastIndexOf('# Build Execution Summary');
  if (headerIndex === -1) {
    return null;
  }

  const markdown = normalized.slice(headerIndex).trim();
  const statusMatch = markdown.match(/^- Status:\s*(completed|blocked)\s*$/mi);
  if (!statusMatch) {
    return null;
  }

  const extractLine = (label: string): string | null => {
    const match = markdown.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'mi'));
    return match?.[1]?.trim() ?? null;
  };

  return {
    status: statusMatch[1] as 'completed' | 'blocked',
    markdown,
    actions: extractLine('Actions'),
    filesTouched: extractLine('Files touched'),
    verification: extractLine('Verification'),
  };
}

function buildSummaryReliesOnStageOutputs(summary: ParsedBuildExecutionSummary): boolean {
  const evidenceText = [summary.actions, summary.verification]
    .filter((value): value is string => Boolean(value))
    .join('\n');

  if (evidenceText.includes('build_recorded')) {
    return true;
  }

  const reliancePatterns = [
    /already marks the stage [`'"]?build_recorded[`'"]?/i,
    /already (?:show|shows|showed)\b.*recorded build outcome/i,
    /no repository changes were required\b.*\b(?:because|since)\b.*(?:\.planning\/current\/build|\.planning\/nexus\/current-run\.json)/i,
    /\b(?:used|using|relied on|based on|determined from|confirmed)\b.*(?:\.planning\/current\/build|\.planning\/nexus\/current-run\.json)/i,
  ];

  return reliancePatterns.some((pattern) => pattern.test(evidenceText));
}

export async function runBuild(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const handoffStatusPath = stageStatusPath('handoff');
  const reviewStatusPath = stageStatusPath('review');
  const handoffStatus = readStageStatus(handoffStatusPath, ctx.cwd);
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !handoffStatus?.ready) {
    throw new Error('Handoff must be completed before build');
  }

  assertSameRunId(ledger.run_id, handoffStatus.run_id, 'handoff status');
  assertLegalTransition(ledger.current_stage, 'build');

  const fixCycle = ledger.current_stage === 'review';
  if (fixCycle) {
    if (!reviewStatus) {
      throw new Error('Review status must exist before running a governed fix-cycle build');
    }

    assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');

    if (reviewStatus.gate_decision !== 'fail') {
      throw new Error('Fix-cycle /build is only valid after a failing review gate');
    }
  }

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.build;
  const workspace = resolveExecutionWorkspace(
    ctx.cwd,
    ledger.execution.workspace ?? (fixCycle ? reviewStatus?.workspace ?? null : handoffStatus.workspace ?? null),
  );
  const sessionRoot = ledger.execution.session_root
    ?? (fixCycle ? reviewStatus?.session_root ?? null : handoffStatus.session_root ?? null)
    ?? resolveSessionRootRecord(ctx.cwd);
  const ledgerWithExecution = withExecutionSessionRoot(withExecutionWorkspace(ledger, workspace), sessionRoot);
  const buildRequestPath = '.planning/current/build/build-request.json';
  const buildResultPath = '.planning/current/build/build-result.md';
  const statusPath = stageStatusPath('build');
  const reviewScope = fixCycle
    ? resolveFixCycleReviewScope(ctx.cwd, reviewStatus)
    : normalizeReviewScopeRecord(handoffStatus.review_scope ?? fullAcceptanceReviewScope());
  const requestedRoute = (fixCycle ? reviewStatus?.requested_route : null) ?? handoffStatus.requested_route ?? requestedBuildRouteFromLedger(ledgerWithExecution);
  const commandHistoryVia = buildCommandHistoryVia(reviewScope, ctx.via);
  const predecessorArtifacts = dedupeArtifactPointers(
    fixCycle
      ? [
          artifactPointerFor(HANDOFF_STATUS_PATH),
          artifactPointerFor(REVIEW_STATUS_PATH),
          ...executionContractArtifacts(),
        ]
      : [
          artifactPointerFor(HANDOFF_STATUS_PATH),
          ...executionContractArtifacts(),
        ],
  );
  const buildRequestWrite = {
    path: buildRequestPath,
    content: JSON.stringify(
      {
        run_id: ledger.run_id,
        execution_mode: ledger.execution.mode,
        primary_provider: ledger.execution.primary_provider,
        provider_topology: ledger.execution.provider_topology,
        workspace,
        requested_route: requestedRoute,
        review_scope: reviewScope,
      },
      null,
      2,
    ) + '\n',
  };
  const governedHandoffValidation = validateGovernedHandoffRouteValidation(
    requestedRoute,
    handoffStatus.route_validation ?? null,
  );
  if (!governedHandoffValidation.ok) {
    const message = governedHandoffValidation.reason;
    const tracePaths = [
      stageAdapterRequestPath('build'),
      stageAdapterOutputPath('build'),
      stageNormalizationPath('build'),
    ];
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      ...executionFieldsFromLedger(ledgerWithExecution),
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
      review_scope: reviewScope,
      workspace,
    };
    const next = blockedPreflightLedger(ledgerWithExecution, 'handoff');
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };
    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: 'ccb',
      kind: 'backend_conflict',
      message,
      canonical_paths: [buildRequestPath, statusPath],
      trace_paths: tracePaths,
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'build',
      statusPath,
      canonicalWrites: [buildRequestWrite],
      traceWrites: [
        {
          path: tracePaths[0],
          content: JSON.stringify(
            {
              run_id: ledger.run_id,
              inputs: predecessorArtifacts.map((artifact) => artifact.path),
              adapter_chain: ['superpowers', requestedRoute.transport],
              requested_route: requestedRoute,
              review_scope: reviewScope,
              workspace,
              gate: 'handoff_route_validation',
            },
            null,
            2,
          ) + '\n',
        },
        {
          path: tracePaths[1],
          content: JSON.stringify(
            {
              discipline: null,
              transport: null,
              gate_result: {
                outcome: 'blocked',
                reason: message,
                handoff_route_validation: handoffStatus.route_validation ?? null,
              },
            },
            null,
            2,
          ) + '\n',
        },
        {
          path: tracePaths[2],
          content: JSON.stringify(
            {
              outcome: 'blocked',
              error: message,
              status: { state: status.state, decision: status.decision, ready: status.ready },
            },
            null,
            2,
          ) + '\n',
        },
      ],
      status,
      mirrorWorkspace: workspace,
      ledger: next,
      conflicts: [conflict],
    });

    throw new Error(message);
  }
  syncRunWorkspaceArtifacts(ctx.cwd, workspace);
  const disciplineResult = await ctx.adapters.superpowers.build_discipline({
    cwd: ctx.cwd,
    workspace,
    run_id: ledger.run_id,
    command: 'build',
    stage: 'build',
    ledger: ledgerWithExecution,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
    review_scope: reviewScope,
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
      ...executionFieldsFromLedger(ledgerWithExecution),
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
      review_scope: reviewScope,
      workspace,
    };
    const next = nextLedger(
      ledgerWithExecution,
      fixCycle ? 'review' : 'handoff',
      disciplineResult.outcome === 'refused' ? 'refused' : 'blocked',
      startedAt,
      commandHistoryVia,
    );
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
        disciplineResult,
        null,
        {
          outcome: disciplineResult.outcome,
          discipline_summary: disciplineResult.raw_output?.verification_summary ?? null,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: workspace,
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
      ...executionFieldsFromLedger(ledgerWithExecution),
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
      review_scope: reviewScope,
      workspace,
    };
    const next = nextLedger(ledgerWithExecution, fixCycle ? 'review' : 'handoff', 'blocked', startedAt, commandHistoryVia);
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
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
      mirrorWorkspace: workspace,
      ledger: next,
      conflicts: [conflict, ...disciplineResult.conflict_candidates],
    });

    throw error;
  }

  const executionAdapter = ledger.execution.mode === 'local_provider' ? ctx.adapters.local : ctx.adapters.ccb;
  const result = await executionAdapter.execute_generator({
    cwd: ctx.cwd,
    workspace,
    run_id: ledger.run_id,
    command: 'build',
    stage: 'build',
    ledger: ledgerWithExecution,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
    review_scope: reviewScope,
  }) as Awaited<ReturnType<typeof executionAdapter.execute_generator>> & { raw_output: CcbExecuteGeneratorRaw | LocalExecuteGeneratorRaw };

  if (result.outcome !== 'success') {
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      ...executionFieldsFromLedger(ledgerWithExecution, result.actual_route?.route ?? null),
      state: result.outcome === 'refused' ? 'refused' : 'blocked',
      decision: result.outcome === 'refused' ? 'refused' : 'build_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(buildRequestPath), artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [
        result.outcome === 'refused'
          ? `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} generator execution refused`
          : `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} generator execution blocked`,
      ],
      requested_route: requestedRoute,
      actual_route: result.actual_route,
      review_scope: reviewScope,
      workspace,
    };
    const next = withActualExecutionPath(
      nextLedger(
        ledgerWithExecution,
        fixCycle ? 'review' : 'handoff',
        result.outcome === 'refused' ? 'refused' : 'blocked',
        startedAt,
        commandHistoryVia,
      ),
      result.actual_route?.route ?? null,
    );
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };

    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
      kind: 'backend_conflict',
      message: result.outcome === 'refused'
        ? `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} generator execution refused`
        : `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} generator execution blocked`,
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
        disciplineResult,
        result,
        {
          outcome: result.outcome,
          discipline_summary: normalizedDiscipline.verification_summary,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: next,
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(
      result.outcome === 'refused'
        ? `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} generator execution refused`
        : `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} generator execution blocked`,
    );
  }

  const recordBlockedBuild = async (
    message: string,
    actualRoute: StageStatus['actual_route'],
    kind: ConflictRecord['kind'] = 'backend_conflict',
  ) => {
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'build',
      ...executionFieldsFromLedger(ledgerWithExecution, actualRoute?.route ?? null),
      state: 'blocked',
      decision: 'build_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(buildRequestPath), artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [message],
      requested_route: requestedRoute,
      actual_route: actualRoute,
      review_scope: reviewScope,
      workspace,
    };
    const next = withActualExecutionPath(
      nextLedger(ledgerWithExecution, fixCycle ? 'review' : 'handoff', 'blocked', startedAt, commandHistoryVia),
      actualRoute?.route ?? null,
    );
    next.artifact_index = {
      ...next.artifact_index,
      [buildRequestPath]: artifactPointerFor(buildRequestPath),
      [statusPath]: artifactPointerFor(statusPath),
    };
    const conflict: ConflictRecord = {
      stage: 'build',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
      kind,
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
        disciplineResult,
        result,
        {
          outcome: 'blocked',
          error: message,
          discipline_summary: normalizedDiscipline.verification_summary,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: next,
      conflicts: [conflict, ...result.conflict_candidates],
    });
  };

  const routesMatch = requestedAndActualRouteMatch(requestedRoute, result.actual_route);
  if (!routesMatch) {
    await recordBlockedBuild('Requested and actual route diverged', result.actual_route, 'route_mismatch');
    throw new Error('Requested and actual route diverged');
  }

  const parsedSummary = parseBuildExecutionSummary(result.raw_output.summary_markdown);
  if (parsedSummary?.status === 'blocked') {
    const message = parsedSummary.actions
      ? `Generator reported blocked build contract: ${parsedSummary.actions}`
      : 'Generator reported blocked build contract';
    await recordBlockedBuild(message, result.actual_route);
    throw new Error(message);
  }

  if (parsedSummary && buildSummaryReliesOnStageOutputs(parsedSummary)) {
    const message = 'Generator build summary relied on existing build-stage artifacts instead of predecessor artifacts or repository implementation state';
    await recordBlockedBuild(message, result.actual_route);
    throw new Error(message);
  }

  const buildResultWrite = {
    path: buildResultPath,
    content: buildBuildResultMarkdown(
      requestedRoute,
      result.actual_route!,
      result.raw_output.receipt,
      normalizedDiscipline.verification_summary,
      reviewScope,
      workspace,
    ),
  };
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'build',
    ...executionFieldsFromLedger(ledgerWithExecution, result.actual_route?.route ?? null),
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
    review_scope: reviewScope,
    workspace,
  };
  const next = withActualExecutionPath(
    nextLedger(ledgerWithExecution, fixCycle ? 'review' : 'handoff', 'active', startedAt, commandHistoryVia),
    result.actual_route?.route ?? null,
  );
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
      predecessorArtifacts.map((artifact) => artifact.path),
      requestedRoute,
      workspace,
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
    mirrorWorkspace: workspace,
    ledger: next,
  });

  return { command: 'build', status };
}
