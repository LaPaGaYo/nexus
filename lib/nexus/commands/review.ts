import { CANONICAL_MANIFEST } from '../command-manifest';
import {
  artifactPointerFor,
  BUILD_STATUS_PATH,
  dedupeArtifactPointers,
  executionContractArtifacts,
} from '../contract-artifacts';
import { currentAuditArtifactPaths, currentAuditPointer, stageStatusPath } from '../artifacts';
import { executionFieldsFromLedger, withExecutionSessionRoot, withExecutionWorkspace } from '../execution-topology';
import { assertSameRunId, gateRequiresArchive } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildReviewGateDecisionMarkdown,
  buildReviewSynthesisMarkdown,
  buildReviewTraceabilityPayloads,
  requestedAndActualAuditRouteMatch,
  requestedAuditRouteFromBuild,
} from '../normalizers/ccb';
import {
  boundedFixCycleReviewScopeFromAudits,
  fullAcceptanceReviewScope,
  normalizeReviewScopeRecord,
  resolveFixCycleReviewScope,
} from '../review-scope';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import { resolveExecutionWorkspace, resolveSessionRootRecord, syncRunWorkspaceArtifacts } from '../workspace-substrate';
import type { CcbExecuteAuditRaw } from '../adapters/ccb';
import type { LocalExecuteAuditRaw } from '../adapters/local';
import type { SuperpowersReviewDisciplineRaw } from '../adapters/superpowers';
import type {
  ArtifactPointer,
  CommandHistoryVia,
  ConflictRecord,
  ReviewMetaRecord,
  RunLedger,
  StageStatus,
} from '../types';
import type { CommandContext, CommandResult } from './index';

type AtomicWriteFile = (cwd: string, relativePath: string, content: string) => void;
const PLAN_STATUS_PATH = stageStatusPath('plan');

function nextLedger(
  ledger: RunLedger,
  status: RunLedger['status'],
  at: string,
  via: CommandHistoryVia,
  allowedNextStages: RunLedger['allowed_next_stages'] = status === 'active' ? getAllowedNextStages('review') : [],
): RunLedger {
  return {
    ...ledger,
    status,
    previous_stage: ledger.current_stage === 'review' ? (ledger.previous_stage ?? 'build') : 'build',
    current_command: 'review',
    current_stage: 'review',
    allowed_next_stages: allowedNextStages,
    command_history: [...ledger.command_history, { command: 'review', at, via }],
  };
}

function clearCurrentAuditArtifactIndex(ledger: RunLedger): RunLedger {
  const nextArtifactIndex = { ...ledger.artifact_index };

  for (const path of currentAuditArtifactPaths()) {
    delete nextArtifactIndex[path];
  }

  return {
    ...ledger,
    artifact_index: nextArtifactIndex,
  };
}

function reviewCommandHistoryVia(
  ledger: RunLedger,
  via: string | null,
): CommandHistoryVia {
  if (ledger.current_stage === 'review') {
    return 'retry';
  }

  return via as CommandHistoryVia;
}

function parseAuditVerdict(markdown: string, label: string): 'pass' | 'fail' {
  const match = markdown.match(/Result:\s*(pass|fail)/i);
  if (!match) {
    throw new Error(`${label} audit is missing a canonical Result: pass|fail line`);
  }

  return match[1].toLowerCase() as 'pass' | 'fail';
}

function blockedReviewStatus(
  ledger: RunLedger,
  startedAt: string,
  inputs: ArtifactPointer[],
  outputs: ArtifactPointer[],
  design: Pick<StageStatus, 'design_impact' | 'design_contract_required' | 'design_contract_path' | 'design_verified'>,
  requestedRoute: StageStatus['requested_route'],
  actualRoute: StageStatus['actual_route'],
  reviewScope: StageStatus['review_scope'],
  error: string,
  state: 'blocked' | 'refused' = 'blocked',
): StageStatus {
  return {
    run_id: ledger.run_id,
    stage: 'review',
    ...executionFieldsFromLedger(ledger, actualRoute?.route ?? null),
    state,
    decision: state === 'refused' ? 'refused' : 'audit_recorded',
    ready: false,
    inputs,
    outputs,
    ...design,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [error],
    requested_route: requestedRoute,
    actual_route: actualRoute,
    review_scope: reviewScope,
    review_complete: false,
    audit_set_complete: false,
    provenance_consistent: false,
    gate_decision: state === 'refused' ? 'blocked' : 'blocked',
    archive_required: false,
    archive_state: 'not_required',
  };
}

function assertNonEmptyMarkdown(markdown: string, label: string): void {
  if (!markdown.trim()) {
    throw new Error(`${label} markdown is empty`);
  }
}

function planDesignContractPointer(planStatus: StageStatus | null | undefined): ArtifactPointer | null {
  return planStatus?.design_contract_path ? artifactPointerFor(planStatus.design_contract_path) : null;
}

function reviewDesignFields(
  planStatus: StageStatus | null | undefined,
  buildStatus: StageStatus | null | undefined,
): Pick<StageStatus, 'design_impact' | 'design_contract_required' | 'design_contract_path' | 'design_verified'> {
  const designImpact = planStatus?.design_impact ?? buildStatus?.design_impact;
  const designContractRequired = planStatus?.design_contract_required ?? buildStatus?.design_contract_required;
  const designContractPath = planStatus?.design_contract_path ?? buildStatus?.design_contract_path ?? null;
  const designVerified = designImpact === 'none'
    ? null
    : (buildStatus?.design_verified ?? false);

  return {
    design_impact: designImpact,
    design_contract_required: designContractRequired,
    design_contract_path: designContractPath,
    design_verified: designVerified,
  };
}

export async function runReviewWithWriteAtomicFile(
  ctx: CommandContext,
  writeAtomicFile?: AtomicWriteFile,
): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const planStatus = readStageStatus(PLAN_STATUS_PATH, ctx.cwd);
  const buildStatusPath = stageStatusPath('build');
  const reviewStatusPath = stageStatusPath('review');
  const buildStatus = readStageStatus(buildStatusPath, ctx.cwd);
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !buildStatus?.ready) {
    throw new Error('Build must be completed before review');
  }

  if (planStatus) {
    assertSameRunId(ledger.run_id, planStatus.run_id, 'plan status');
  }
  assertSameRunId(ledger.run_id, buildStatus.run_id, 'build status');
  assertLegalTransition(ledger.current_stage, 'review');

  if (ledger.current_stage === 'review') {
    if (!reviewStatus) {
      throw new Error('Review status must exist before rerunning review');
    }

    assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');

    if (reviewStatus.gate_decision === 'pass' && reviewStatus.ready) {
      throw new Error('Review retry is only valid after a failing or blocked review');
    }
  }

  if (!buildStatus.requested_route || !buildStatus.actual_route) {
    throw new Error('Build must record requested and actual route before review');
  }

  const buildProvenanceConsistent = buildStatus.requested_route.generator === buildStatus.actual_route.route
    && buildStatus.requested_route.substrate === buildStatus.actual_route.substrate;
  if (!buildProvenanceConsistent) {
    throw new Error('Build provenance is inconsistent before review');
  }

  const startedAt = ctx.clock();
  const manifest = CANONICAL_MANIFEST.review;
  const designContractPointer = planDesignContractPointer(planStatus);
  const predecessorArtifacts = dedupeArtifactPointers([
    artifactPointerFor(BUILD_STATUS_PATH),
    ...executionContractArtifacts(),
    ...(designContractPointer ? [designContractPointer] : []),
  ]);
  const workspace = resolveExecutionWorkspace(
    ctx.cwd,
    ledger.execution.workspace
      ?? buildStatus.workspace
      ?? (ledger.current_stage === 'review' ? reviewStatus?.workspace ?? null : null),
  );
  const sessionRoot = ledger.execution.session_root
    ?? buildStatus.session_root
    ?? (ledger.current_stage === 'review' ? reviewStatus?.session_root ?? null : null)
    ?? resolveSessionRootRecord(ctx.cwd);
  const ledgerWithExecution = withExecutionSessionRoot(withExecutionWorkspace(ledger, workspace), sessionRoot);
  const commandHistoryVia = reviewCommandHistoryVia(ledger, ctx.via);
  const requestedRoute = buildStatus.requested_route;
  const actualRoute = buildStatus.actual_route;
  const designFields = reviewDesignFields(planStatus, buildStatus);
  const inheritedReviewScope = buildStatus.review_scope
    ? normalizeReviewScopeRecord(buildStatus.review_scope)
    : (buildStatus.inputs.some((artifact) => artifact.path === reviewStatusPath)
      ? resolveFixCycleReviewScope(ctx.cwd, reviewStatus)
      : fullAcceptanceReviewScope());
  const codexPath = '.planning/audits/current/codex.md';
  const geminiPath = '.planning/audits/current/gemini.md';
  const synthesisPath = '.planning/audits/current/synthesis.md';
  const gateDecisionPath = '.planning/audits/current/gate-decision.md';
  const metaPath = '.planning/audits/current/meta.json';
  const currentAuditPaths = currentAuditArtifactPaths();

  if (planStatus?.design_impact === 'material') {
    const designContractPath = designContractPointer?.path ?? null;
    const buildRecordedDesignContract = designContractPath
      ? buildStatus.inputs.some((artifact) => artifact.path === designContractPath)
      : false;

    if (!designContractPath || !buildRecordedDesignContract) {
      const message = !designContractPath
        ? 'Material design-bearing run is missing required design contract provenance'
        : 'Build inputs are missing required design contract provenance for a material design-bearing run';
      const status = blockedReviewStatus(
        ledgerWithExecution,
        startedAt,
        predecessorArtifacts,
        [artifactPointerFor(reviewStatusPath)],
        designFields,
        requestedRoute,
        actualRoute,
        inheritedReviewScope,
        message,
      );
      const conflict: ConflictRecord = {
        stage: 'review',
        adapter: 'superpowers',
        kind: 'backend_conflict',
        message,
        canonical_paths: [reviewStatusPath],
        trace_paths: [
          '.planning/current/review/adapter-request.json',
          '.planning/current/review/adapter-output.json',
          '.planning/current/review/normalization.json',
        ],
      };

      await applyNormalizationPlan({
        cwd: ctx.cwd,
        stage: 'review',
        statusPath: reviewStatusPath,
        canonicalWrites: [],
        removeWrites: currentAuditPaths,
        traceWrites: buildReviewTraceabilityPayloads(
          ledger.run_id,
          [buildStatusPath],
          requestedRoute,
          inheritedReviewScope,
          workspace,
          null,
          null,
          null,
          {
            outcome: 'blocked',
            error: message,
            status: { state: status.state, decision: status.decision, ready: status.ready },
          },
        ),
        status,
        mirrorWorkspace: workspace,
        ledger: clearCurrentAuditArtifactIndex(nextLedger(ledgerWithExecution, 'blocked', startedAt, commandHistoryVia, ['review'])),
        conflicts: [conflict],
        writeAtomicFile,
      });

      throw new Error(message);
    }
  }
  syncRunWorkspaceArtifacts(ctx.cwd, workspace);

  const disciplineResult = await ctx.adapters.superpowers.review_discipline({
    cwd: ctx.cwd,
    workspace,
    run_id: ledger.run_id,
    command: 'review',
    stage: 'review',
    ledger: ledgerWithExecution,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
    review_scope: inheritedReviewScope,
  }) as Awaited<ReturnType<typeof ctx.adapters.superpowers.review_discipline>> & {
    raw_output: SuperpowersReviewDisciplineRaw;
  };

  if (disciplineResult.outcome !== 'success') {
    const message = disciplineResult.outcome === 'refused'
      ? 'Superpowers review discipline refused review'
      : 'Superpowers review discipline blocked review';
    const status = blockedReviewStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      [artifactPointerFor(reviewStatusPath)],
      designFields,
      requestedRoute,
      actualRoute,
      inheritedReviewScope,
      message,
      disciplineResult.outcome === 'refused' ? 'refused' : 'blocked',
    );
    const conflict: ConflictRecord = {
      stage: 'review',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [reviewStatusPath],
      trace_paths: [
        '.planning/current/review/adapter-request.json',
        '.planning/current/review/adapter-output.json',
        '.planning/current/review/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'review',
      statusPath: reviewStatusPath,
      canonicalWrites: [],
      removeWrites: currentAuditPaths,
      traceWrites: buildReviewTraceabilityPayloads(
        ledger.run_id,
        [buildStatusPath],
        requestedRoute,
        inheritedReviewScope,
        workspace,
        disciplineResult,
        null,
        null,
        {
          outcome: disciplineResult.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: clearCurrentAuditArtifactIndex(
        nextLedger(
          ledgerWithExecution,
          disciplineResult.outcome === 'refused' ? 'refused' : 'blocked',
          startedAt,
          commandHistoryVia,
          disciplineResult.outcome === 'refused' ? [] : ['review'],
        ),
      ),
      conflicts: [conflict, ...disciplineResult.conflict_candidates],
      writeAtomicFile,
    });

    throw new Error(message);
  }

  const disciplineSummary = disciplineResult.raw_output?.discipline_summary?.trim();
  if (!disciplineSummary) {
    const message = 'Review discipline summary is missing';
    const status = blockedReviewStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      [artifactPointerFor(reviewStatusPath)],
      designFields,
      requestedRoute,
      actualRoute,
      inheritedReviewScope,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'review',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [reviewStatusPath],
      trace_paths: [
        '.planning/current/review/adapter-request.json',
        '.planning/current/review/adapter-output.json',
        '.planning/current/review/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'review',
      statusPath: reviewStatusPath,
      canonicalWrites: [],
      removeWrites: currentAuditPaths,
      traceWrites: buildReviewTraceabilityPayloads(
        ledger.run_id,
        [buildStatusPath],
        requestedRoute,
        inheritedReviewScope,
        workspace,
        disciplineResult,
        null,
        null,
        {
          outcome: 'blocked',
          error: message,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: clearCurrentAuditArtifactIndex(nextLedger(ledgerWithExecution, 'blocked', startedAt, commandHistoryVia, ['review'])),
      conflicts: [conflict, ...disciplineResult.conflict_candidates],
      writeAtomicFile,
    });

    throw new Error(message);
  }

  const auditAdapter = ledger.execution.mode === 'local_provider' ? ctx.adapters.local : ctx.adapters.ccb;
  const [auditAResult, auditBResult] = await Promise.all([
    auditAdapter.execute_audit_a({
      cwd: ctx.cwd,
      workspace,
      run_id: ledger.run_id,
      command: 'review',
      stage: 'review',
      ledger: ledgerWithExecution,
      manifest,
      predecessor_artifacts: predecessorArtifacts,
      requested_route: requestedRoute,
      review_scope: inheritedReviewScope,
    }) as Promise<Awaited<ReturnType<typeof auditAdapter.execute_audit_a>> & { raw_output: CcbExecuteAuditRaw | LocalExecuteAuditRaw }>,
    auditAdapter.execute_audit_b({
      cwd: ctx.cwd,
      workspace,
      run_id: ledger.run_id,
      command: 'review',
      stage: 'review',
      ledger: ledgerWithExecution,
      manifest,
      predecessor_artifacts: predecessorArtifacts,
      requested_route: requestedRoute,
      review_scope: inheritedReviewScope,
    }) as Promise<Awaited<ReturnType<typeof auditAdapter.execute_audit_b>> & { raw_output: CcbExecuteAuditRaw | LocalExecuteAuditRaw }>,
  ]);

  for (const [label, result] of [
    ['codex', auditAResult] as const,
    ['gemini', auditBResult] as const,
  ]) {
    if (result.outcome !== 'success') {
      const message = result.outcome === 'refused'
        ? `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} ${label} audit refused review`
        : `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} ${label} audit blocked review`;
      const status = blockedReviewStatus(
        ledgerWithExecution,
        startedAt,
        predecessorArtifacts,
        [artifactPointerFor(reviewStatusPath)],
        designFields,
        requestedRoute,
        actualRoute,
        inheritedReviewScope,
        message,
        result.outcome === 'refused' ? 'refused' : 'blocked',
      );
      const conflict: ConflictRecord = {
        stage: 'review',
        adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
        kind: 'backend_conflict',
        message,
        canonical_paths: [reviewStatusPath],
        trace_paths: [
          '.planning/current/review/adapter-request.json',
          '.planning/current/review/adapter-output.json',
          '.planning/current/review/normalization.json',
        ],
      };

      await applyNormalizationPlan({
        cwd: ctx.cwd,
        stage: 'review',
        statusPath: reviewStatusPath,
        canonicalWrites: [],
        removeWrites: currentAuditPaths,
        traceWrites: buildReviewTraceabilityPayloads(
          ledger.run_id,
          [buildStatusPath],
          requestedRoute,
          inheritedReviewScope,
          workspace,
          disciplineResult,
          auditAResult,
          auditBResult,
          {
            outcome: result.outcome,
            status: { state: status.state, decision: status.decision, ready: status.ready },
          },
        ),
        status,
        mirrorWorkspace: workspace,
        ledger: clearCurrentAuditArtifactIndex(
          nextLedger(
            ledgerWithExecution,
            result.outcome === 'refused' ? 'refused' : 'blocked',
            startedAt,
            commandHistoryVia,
            result.outcome === 'refused' ? [] : ['review'],
          ),
        ),
        conflicts: [conflict, ...result.conflict_candidates],
        writeAtomicFile,
      });

      throw new Error(message);
    }
  }

  const requestedCodexRoute = requestedAuditRouteFromBuild(requestedRoute, 'codex');
  const requestedGeminiRoute = requestedAuditRouteFromBuild(requestedRoute, 'gemini');

  if (
    !requestedAndActualAuditRouteMatch(requestedCodexRoute, auditAResult.actual_route)
    || !requestedAndActualAuditRouteMatch(requestedGeminiRoute, auditBResult.actual_route)
  ) {
    const message = 'Requested and actual audit route diverged';
    const status = blockedReviewStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      [artifactPointerFor(reviewStatusPath)],
      designFields,
      requestedRoute,
      actualRoute,
      inheritedReviewScope,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'review',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
      kind: 'route_mismatch',
      message,
      canonical_paths: [reviewStatusPath],
      trace_paths: [
        '.planning/current/review/adapter-request.json',
        '.planning/current/review/adapter-output.json',
        '.planning/current/review/normalization.json',
      ],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'review',
      statusPath: reviewStatusPath,
      canonicalWrites: [],
      removeWrites: currentAuditPaths,
      traceWrites: buildReviewTraceabilityPayloads(
        ledger.run_id,
        [buildStatusPath],
        requestedRoute,
        inheritedReviewScope,
        workspace,
        disciplineResult,
        auditAResult,
        auditBResult,
        {
          outcome: 'blocked',
          error: message,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: clearCurrentAuditArtifactIndex(nextLedger(ledgerWithExecution, 'blocked', startedAt, commandHistoryVia, ['review'])),
      conflicts: [conflict, ...auditAResult.conflict_candidates, ...auditBResult.conflict_candidates],
      writeAtomicFile,
    });

    throw new Error(message);
  }

  const codexMarkdown = auditAResult.raw_output.markdown;
  const geminiMarkdown = auditBResult.raw_output.markdown;
  assertNonEmptyMarkdown(codexMarkdown, 'Codex audit');
  assertNonEmptyMarkdown(geminiMarkdown, 'Gemini audit');

  const codexVerdict = parseAuditVerdict(codexMarkdown, 'Codex');
  const geminiVerdict = parseAuditVerdict(geminiMarkdown, 'Gemini');
  const gateDecision = codexVerdict === 'pass' && geminiVerdict === 'pass' ? 'pass' : 'fail';
  const reviewScope = gateDecision === 'fail'
    ? boundedFixCycleReviewScopeFromAudits(codexMarkdown, geminiMarkdown)
    : inheritedReviewScope;
  const synthesisMarkdown = buildReviewSynthesisMarkdown(disciplineSummary, codexMarkdown, geminiMarkdown, gateDecision);
  const gateDecisionMarkdown = buildReviewGateDecisionMarkdown(gateDecision);
  const meta: ReviewMetaRecord = {
    run_id: ledger.run_id,
    execution_mode: ledger.execution.mode,
    primary_provider: ledger.execution.primary_provider,
    provider_topology: ledger.execution.provider_topology,
    workspace,
    implementation_provider: actualRoute.provider ?? ledger.execution.primary_provider,
    implementation_path: '.planning/current/build/build-result.md',
    implementation_route: requestedRoute.generator,
    implementation_substrate: requestedRoute.substrate,
    implementation: {
      path: '.planning/current/build/build-result.md',
      requested_route: requestedRoute,
      actual_route: actualRoute,
    },
    audits: {
      codex: {
        provider: requestedCodexRoute.provider ?? ledger.execution.primary_provider,
        path: codexPath,
        requested_route: requestedCodexRoute,
        actual_route: auditAResult.actual_route,
      },
      gemini: {
        provider: requestedGeminiRoute.provider ?? ledger.execution.primary_provider,
        path: geminiPath,
        requested_route: requestedGeminiRoute,
        actual_route: auditBResult.actual_route,
      },
    },
    review_discipline: {
      adapter: 'superpowers',
      summary: disciplineSummary,
    },
    codex_audit: {
      provider: requestedCodexRoute.provider ?? ledger.execution.primary_provider,
      path: codexPath,
      route: requestedCodexRoute.route,
      substrate: requestedCodexRoute.substrate,
    },
    gemini_audit: {
      provider: requestedGeminiRoute.provider ?? ledger.execution.primary_provider,
      path: geminiPath,
      route: requestedGeminiRoute.route,
      substrate: requestedGeminiRoute.substrate,
    },
    pm_skill: 'frame',
    execution_skill_chain: ['plan', 'handoff', 'build', 'review'],
    lifecycle_stage: 'review',
    handoff_from: '.planning/current/handoff/governed-handoff.md',
    handoff_to: '.planning/audits/current/',
    review_scope: reviewScope,
  };

  const outputs = [
    currentAuditPointer('codex'),
    currentAuditPointer('gemini'),
    currentAuditPointer('synthesis'),
    currentAuditPointer('gate-decision'),
    currentAuditPointer('meta'),
    artifactPointerFor(reviewStatusPath),
  ];
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'review',
    ...executionFieldsFromLedger(ledgerWithExecution, actualRoute.route),
    state: 'completed',
    decision: 'audit_recorded',
    ready: gateDecision === 'pass',
    inputs: predecessorArtifacts,
    outputs,
    ...designFields,
    started_at: startedAt,
    completed_at: startedAt,
    errors: gateDecision === 'pass' ? [] : ['Review gate failed; fix cycle required before QA, ship, or closeout'],
    requested_route: requestedRoute,
    actual_route: actualRoute,
    review_scope: reviewScope,
    workspace,
    review_complete: true,
    audit_set_complete: true,
    provenance_consistent: true,
    gate_decision: gateDecision,
    archive_required: gateRequiresArchive(gateDecisionMarkdown),
    archive_state: gateRequiresArchive(gateDecisionMarkdown) ? 'pending' : 'not_required',
  };
  const next = nextLedger(
    ledgerWithExecution,
    gateDecision === 'pass' ? 'active' : 'blocked',
    startedAt,
    commandHistoryVia,
    gateDecision === 'pass' ? getAllowedNextStages('review') : ['build', 'review'],
  );
  next.artifact_index = {
    ...next.artifact_index,
    [codexPath]: currentAuditPointer('codex'),
    [geminiPath]: currentAuditPointer('gemini'),
    [synthesisPath]: currentAuditPointer('synthesis'),
    [gateDecisionPath]: currentAuditPointer('gate-decision'),
    [metaPath]: currentAuditPointer('meta'),
    [reviewStatusPath]: artifactPointerFor(reviewStatusPath),
  };

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'review',
    statusPath: reviewStatusPath,
    canonicalWrites: [
      { path: codexPath, content: codexMarkdown },
      { path: geminiPath, content: geminiMarkdown },
      { path: synthesisPath, content: synthesisMarkdown },
      { path: gateDecisionPath, content: gateDecisionMarkdown },
      { path: metaPath, content: JSON.stringify(meta, null, 2) + '\n' },
    ],
    traceWrites: buildReviewTraceabilityPayloads(
      ledger.run_id,
      [buildStatusPath],
      requestedRoute,
      inheritedReviewScope,
      workspace,
      disciplineResult,
      auditAResult,
      auditBResult,
      {
        outcome: 'success',
        canonical_paths: [codexPath, geminiPath, synthesisPath, gateDecisionPath, metaPath],
        status: { state: status.state, decision: status.decision, ready: status.ready },
      },
    ),
    status,
    mirrorWorkspace: workspace,
    ledger: next,
    writeAtomicFile,
  });

  return { command: 'review', status };
}

export async function runReview(ctx: CommandContext): Promise<CommandResult> {
  return runReviewWithWriteAtomicFile(ctx);
}
