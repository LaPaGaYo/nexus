import { CANONICAL_MANIFEST } from '../command-manifest';
import {
  planVerificationMatrixPath,
  qaDesignVerificationPath,
  qaLearningCandidatesPath,
  qaReportPath,
  stageStatusPath,
} from '../artifacts';
import { executionFieldsFromLedger, withExecutionSessionRoot, withExecutionWorkspace } from '../execution-topology';
import { assertCanonicalTailLedger, assertReviewReadyForCloseout, assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildQaTraceabilityPayloads,
  describeCcbLatencySummary,
  requestedAndActualRouteMatch,
  requestedQaRouteFromLedger,
} from '../normalizers/ccb';
import { readStageStatus } from '../status';
import { assertLegalTransition } from '../transitions';
import { resolveExecutionWorkspace, resolveSessionRootRecord, syncRunWorkspaceArtifacts } from '../workspace-substrate';
import type { CcbExecuteQaRaw } from '../adapters/ccb';
import type { LocalExecuteQaRaw } from '../adapters/local';
import { LEARNING_SOURCES, LEARNING_TYPES } from '../types';
import type {
  ArtifactPointer,
  ConflictRecord,
  LearningCandidate,
  RunLedger,
  StageLearningCandidatesRecord,
  StageStatus,
} from '../types';
import type { CommandContext, CommandResult } from './index';
import { readVerificationMatrix, resolveVerificationMatrix } from '../verification-matrix';
import { boundedFixCycleReviewScopeFromQaFindings } from '../review-scope';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function designBearing(designImpact: StageStatus['design_impact'] | null | undefined): boolean {
  return (designImpact ?? 'none') !== 'none';
}

function buildDesignVerificationMarkdown(
  designImpact: StageStatus['design_impact'] | null | undefined,
  designContractPath: string | null | undefined,
  ready: boolean,
): string {
  return [
    '# Design Verification',
    '',
    `- Design impact: ${designImpact ?? 'none'}`,
    `- Design contract: ${designContractPath ?? 'none'}`,
    `- Result: ${ready ? 'verified' : 'not verified'}`,
  ].join('\n');
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

function normalizeQaLearningCandidate(candidate: unknown): LearningCandidate | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const rawCandidate = candidate as Partial<LearningCandidate> & { files?: unknown };
  const type = typeof rawCandidate.type === 'string' ? rawCandidate.type.trim() : '';
  const key = typeof rawCandidate.key === 'string' ? rawCandidate.key.trim() : '';
  const insight = typeof rawCandidate.insight === 'string' ? rawCandidate.insight.trim() : '';
  const source = typeof rawCandidate.source === 'string' ? rawCandidate.source.trim() : '';

  if (
    !isOneOf(type, LEARNING_TYPES)
    || !key
    || !insight
    || typeof rawCandidate.confidence !== 'number'
    || !Number.isFinite(rawCandidate.confidence)
    || !isOneOf(source, LEARNING_SOURCES)
    || !Array.isArray(rawCandidate.files)
    || rawCandidate.files.some((file) => typeof file !== 'string')
  ) {
    return null;
  }

  const files = rawCandidate.files
    .map((file) => file.trim())
    .filter((file) => file.length > 0);

  return {
    type,
    key,
    insight,
    confidence: rawCandidate.confidence,
    source,
    files,
  };
}

function collectQaLearningCandidates(rawCandidates: unknown): LearningCandidate[] {
  if (!Array.isArray(rawCandidates)) {
    return [];
  }

  const candidates: LearningCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of rawCandidates) {
    const normalized = normalizeQaLearningCandidate(candidate);
    if (!normalized) {
      continue;
    }

    const candidateKey = `${normalized.type}:${normalized.key}`;
    if (seen.has(candidateKey)) {
      continue;
    }

    seen.add(candidateKey);
    candidates.push(normalized);
  }

  return candidates;
}

function buildQaLearningCandidatesRecord(
  runId: string,
  startedAt: string,
  rawCandidates: unknown,
): StageLearningCandidatesRecord | null {
  const candidates = collectQaLearningCandidates(rawCandidates);
  if (candidates.length === 0) {
    return null;
  }

  return {
    schema_version: 1,
    run_id: runId,
    stage: 'qa',
    generated_at: startedAt,
    candidates,
  };
}

function qaStatusTracePayload(
  status: Pick<StageStatus, 'state' | 'decision' | 'ready' | 'design_impact' | 'design_contract_path' | 'design_verified' | 'learning_candidates_path' | 'learnings_recorded' | 'review_scope' | 'advisory_count'>,
): Record<string, unknown> {
  return {
    state: status.state,
    decision: status.decision,
    ready: status.ready,
    design_impact: status.design_impact,
    design_contract_path: status.design_contract_path,
    design_verified: status.design_verified,
    learning_candidates_path: status.learning_candidates_path ?? null,
    learnings_recorded: status.learnings_recorded ?? false,
    review_scope: status.review_scope ?? null,
    advisory_count: status.advisory_count ?? 0,
  };
}

const QA_READY_NEXT_STAGES: RunLedger['allowed_next_stages'] = ['ship', 'closeout'];

function nextLedger(
  ledger: RunLedger,
  status: RunLedger['status'],
  at: string,
  via: string | null,
  allowedNextStages: RunLedger['allowed_next_stages'] = status === 'active' ? QA_READY_NEXT_STAGES : [],
): RunLedger {
  return {
    ...ledger,
    status,
    previous_stage: 'review',
    current_command: 'qa',
    current_stage: 'qa',
    allowed_next_stages: allowedNextStages,
    command_history: [...ledger.command_history, { command: 'qa', at, via }],
  };
}

function clearQaLearningArtifactIndex(ledger: RunLedger): RunLedger {
  const nextArtifactIndex = { ...ledger.artifact_index };
  delete nextArtifactIndex[qaLearningCandidatesPath()];

  return {
    ...ledger,
    artifact_index: nextArtifactIndex,
  };
}

function blockedQaStatus(
  ledger: RunLedger,
  startedAt: string,
  inputs: ArtifactPointer[],
  requestedRoute: StageStatus['requested_route'],
  actualRoute: StageStatus['actual_route'],
  designImpact: StageStatus['design_impact'] | null | undefined,
  designContractPath: string | null | undefined,
  error: string,
  state: 'blocked' | 'refused' = 'blocked',
): StageStatus {
  return {
    run_id: ledger.run_id,
    stage: 'qa',
    ...executionFieldsFromLedger(ledger, actualRoute?.route ?? null),
    design_impact: designImpact ?? 'none',
    design_contract_path: designContractPath ?? null,
    design_verified: designBearing(designImpact) ? false : null,
    learning_candidates_path: null,
    learnings_recorded: false,
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
    verification_count: 0,
    defect_count: 0,
    workspace: ledger.execution.workspace,
  };
}

function blockedQaStatusError(
  baseMessage: string,
  rawOutput: CcbExecuteQaRaw | LocalExecuteQaRaw,
): string {
  const diagnostic = 'latency_summary' in rawOutput
    ? describeCcbLatencySummary(rawOutput.latency_summary ?? null)
    : null;
  return diagnostic ? `${baseMessage} (${diagnostic})` : baseMessage;
}

export async function runQa(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const reviewStatusPath = stageStatusPath('review');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before QA');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  assertCanonicalTailLedger(ledger, 'QA');
  assertLegalTransition(ledger.current_stage, 'qa');
  try {
    assertReviewReadyForCloseout(reviewStatus, ctx.cwd);
  } catch {
    throw new Error('Review must be completed before QA');
  }

  const startedAt = ctx.clock();
  const verificationMatrix = resolveVerificationMatrix(ctx.cwd, ledger.run_id, startedAt);
  const canonicalVerificationMatrix = readVerificationMatrix(ctx.cwd);
  const designImpact = reviewStatus?.design_impact ?? verificationMatrix.design_impact;
  const designContractPath = reviewStatus?.design_contract_path ?? null;
  const designIsBearing = verificationMatrix.obligations.qa.design_verification_required || designBearing(designImpact);
  const manifest = CANONICAL_MANIFEST.qa;
  const workspace = resolveExecutionWorkspace(
    ctx.cwd,
    ledger.execution.workspace ?? reviewStatus.workspace ?? null,
  );
  const sessionRoot = ledger.execution.session_root
    ?? reviewStatus.session_root
    ?? resolveSessionRootRecord(ctx.cwd);
  const ledgerWithExecution = withExecutionSessionRoot(withExecutionWorkspace(ledger, workspace), sessionRoot);
  const statusPath = stageStatusPath('qa');
  const reportPath = qaReportPath();
  const learningCandidatesPath = qaLearningCandidatesPath();
  const predecessorArtifacts = [
    artifactPointerFor(reviewStatusPath),
    ...(canonicalVerificationMatrix ? [artifactPointerFor(planVerificationMatrixPath())] : []),
  ];
  const requestedRoute = requestedQaRouteFromLedger(ledgerWithExecution);
  const qaAdapter = ledger.execution.mode === 'local_provider' ? ctx.adapters.local : ctx.adapters.ccb;
  syncRunWorkspaceArtifacts(ctx.cwd, workspace);
  const result = await qaAdapter.execute_qa({
    cwd: ctx.cwd,
    workspace,
    run_id: ledger.run_id,
    command: 'qa',
    stage: 'qa',
    ledger: ledgerWithExecution,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof qaAdapter.execute_qa>> & { raw_output: CcbExecuteQaRaw | LocalExecuteQaRaw };

  if (result.outcome !== 'success') {
    const message = result.outcome === 'refused'
      ? `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} QA validation refused`
      : `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} QA validation blocked`;
    const statusMessage = blockedQaStatusError(message, result.raw_output);
    const status = blockedQaStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      requestedRoute,
      result.actual_route,
      designImpact,
      designContractPath,
      statusMessage,
      result.outcome === 'refused' ? 'refused' : 'blocked',
    );
    const conflict: ConflictRecord = {
      stage: 'qa',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
      result,
      {
        outcome: result.outcome,
        status: qaStatusTracePayload(status),
      },
    ),
      status,
      mirrorWorkspace: workspace,
      ledger: clearQaLearningArtifactIndex(
        nextLedger(ledgerWithExecution, result.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via),
      ),
      removeWrites: [learningCandidatesPath],
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  if (!requestedAndActualRouteMatch(requestedRoute, result.actual_route)) {
    const message = 'Requested and actual QA route diverged';
    const status = blockedQaStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      requestedRoute,
      result.actual_route,
      designImpact,
      designContractPath,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'qa',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
      result,
      {
        outcome: 'blocked',
        error: message,
        status: qaStatusTracePayload(status),
      },
    ),
      status,
      mirrorWorkspace: workspace,
      ledger: clearQaLearningArtifactIndex(nextLedger(ledgerWithExecution, 'blocked', startedAt, ctx.via)),
      removeWrites: [learningCandidatesPath],
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const reportMarkdown = result.raw_output.report_markdown?.trim();
  if (!reportMarkdown) {
    const message = 'QA report markdown is empty';
    const status = blockedQaStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      requestedRoute,
      result.actual_route,
      designImpact,
      designContractPath,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'qa',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
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
        predecessorArtifacts.map((artifact) => artifact.path),
        requestedRoute,
        workspace,
      result,
      {
        outcome: 'blocked',
        error: message,
        status: qaStatusTracePayload(status),
      },
    ),
      status,
      mirrorWorkspace: workspace,
      ledger: clearQaLearningArtifactIndex(nextLedger(ledgerWithExecution, 'blocked', startedAt, ctx.via)),
      removeWrites: [learningCandidatesPath],
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const ready = result.raw_output.ready;
  const findings = result.raw_output.findings ?? [];
  const advisories = Array.isArray(result.raw_output.advisories)
    ? result.raw_output.advisories.filter((advisory): advisory is string => typeof advisory === 'string')
    : [];
  const verificationCount = ready ? findings.length : 0;
  const defectCount = ready ? 0 : findings.length;
  const advisoryCount = advisories.length;
  const designVerificationPath = qaDesignVerificationPath();
  const learningCandidatesRecord = buildQaLearningCandidatesRecord(
    ledger.run_id,
    startedAt,
    result.raw_output.learning_candidates,
  );
  const designVerificationMarkdown = designIsBearing
    ? buildDesignVerificationMarkdown(designImpact, designContractPath, ready)
    : null;
  const reviewScope = ready ? null : boundedFixCycleReviewScopeFromQaFindings(findings);
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'qa',
    ...executionFieldsFromLedger(ledgerWithExecution, result.actual_route?.route ?? null),
    design_impact: designImpact,
    design_contract_path: designContractPath,
    design_verified: designIsBearing ? ready : null,
    state: 'completed',
    decision: 'qa_recorded',
    ready,
    inputs: predecessorArtifacts,
    outputs: [
      artifactPointerFor(reportPath),
      ...(designVerificationMarkdown ? [artifactPointerFor(designVerificationPath)] : []),
      ...(learningCandidatesRecord ? [artifactPointerFor(learningCandidatesPath)] : []),
      artifactPointerFor(statusPath),
    ],
    started_at: startedAt,
    completed_at: startedAt,
    errors: ready ? [] : findings,
    requested_route: requestedRoute,
    actual_route: result.actual_route,
    review_scope: reviewScope,
    verification_count: verificationCount,
    defect_count: defectCount,
    advisory_count: advisoryCount,
    learning_candidates_path: learningCandidatesRecord ? learningCandidatesPath : null,
    learnings_recorded: Boolean(learningCandidatesRecord),
    workspace,
  };
  const next = nextLedger(
    ledgerWithExecution,
    ready ? 'active' : 'blocked',
    startedAt,
    ctx.via,
    ready ? QA_READY_NEXT_STAGES : ['build'],
  );
  next.artifact_index = {
    ...next.artifact_index,
    [reportPath]: artifactPointerFor(reportPath),
    [statusPath]: artifactPointerFor(statusPath),
  };
  if (designVerificationMarkdown) {
    next.artifact_index[designVerificationPath] = artifactPointerFor(designVerificationPath);
  } else {
    delete next.artifact_index[designVerificationPath];
  }
  if (learningCandidatesRecord) {
    next.artifact_index[learningCandidatesPath] = artifactPointerFor(learningCandidatesPath);
  } else {
    delete next.artifact_index[learningCandidatesPath];
  }

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'qa',
    statusPath,
    canonicalWrites: [
      { path: reportPath, content: `${reportMarkdown}\n` },
      ...(designVerificationMarkdown
        ? [{ path: designVerificationPath, content: `${designVerificationMarkdown}\n` }]
        : []),
      ...(learningCandidatesRecord
        ? [{ path: learningCandidatesPath, content: JSON.stringify(learningCandidatesRecord, null, 2) + '\n' }]
        : []),
    ],
    removeWrites: [
      ...(designVerificationMarkdown ? [] : [designVerificationPath]),
      ...(learningCandidatesRecord ? [] : [learningCandidatesPath]),
    ],
    traceWrites: buildQaTraceabilityPayloads(
      ledger.run_id,
      predecessorArtifacts.map((artifact) => artifact.path),
      requestedRoute,
      workspace,
      result,
      {
        outcome: 'success',
        canonical_paths: [
          reportPath,
          ...(designVerificationMarkdown ? [designVerificationPath] : []),
          ...(learningCandidatesRecord ? [learningCandidatesPath] : []),
        ],
        verification_count: verificationCount,
        defect_count: defectCount,
        learning_candidates_path: learningCandidatesRecord ? learningCandidatesPath : null,
        learnings_recorded: Boolean(learningCandidatesRecord),
        status: qaStatusTracePayload(status),
      },
    ),
    status,
    mirrorWorkspace: workspace,
    ledger: next,
  });

  return { command: 'qa', status };
}
