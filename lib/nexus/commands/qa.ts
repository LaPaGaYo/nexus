import { CANONICAL_MANIFEST } from '../contracts/command-manifest';
import {
  planVerificationMatrixPath,
  reviewAdvisoryDispositionPath,
  qaDesignVerificationPath,
  qaLearningCandidatesPath,
  qaReportPath,
  stageCompletionAdvisorPath,
  stageStatusPath,
} from '../io/artifacts';
import { executionFieldsFromLedger, withExecutionSessionRoot, withExecutionWorkspace } from '../runtime/execution-topology';
import { assertCanonicalTailLedger, assertReviewReadyForCloseout, assertSameRunId } from '../governance';
import { readLedger } from '../governance/ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildQaTraceabilityPayloads,
  describeCcbLatencySummary,
  requestedAndActualRouteMatch,
  requestedQaRouteFromLedger,
} from '../normalizers/ccb';
import { readStageStatus } from '../io/status';
import { assertLegalTransition } from '../governance/transitions';
import { resolveExecutionWorkspace, resolveSessionRootRecord, syncRunWorkspaceArtifacts } from '../runtime/workspace-substrate';
import { writeLearningCandidate } from '../learning/candidates';
import { generateLearningId } from '../learning/id';
import type { CcbExecuteQaRaw } from '../adapters/ccb';
import type { LocalExecuteQaRaw } from '../adapters/local';
import { LEARNING_SOURCES, LEARNING_TYPES } from '../contracts/types';
import type {
  ArtifactPointer,
  ConflictRecord,
  LearningCandidate,
  RunLedger,
  StageLearningCandidatesRecord,
  StageStatus,
} from '../contracts/types';
import type { CommandContext, CommandResult } from './index';
import { readVerificationMatrix, resolveVerificationMatrix } from '../review/verification-matrix';
import { boundedFixCycleReviewScopeFromQaFindings } from '../review/scope';
import {
  advisoryDispositionPermitsStage,
  buildReviewAdvisoryDispositionRecord,
  effectiveReviewAdvisoryDisposition,
  requiredReviewAdvisoryDispositionError,
  reviewHasAdvisories,
} from '../review/advisories';
import { buildQaCompletionAdvisor } from '../completion-advisor';
import { buildCompletionAdvisorWrite } from '../completion-advisor/writer';

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
const QA_RETRY_NEXT_STAGES: RunLedger['allowed_next_stages'] = ['qa'];

// ─── Ship-blocking cluster capture helpers ────────────────────────────────────

/**
 * Derive a kebab-case key from the QA finding context. Uses the first defect
 * finding (if present) to create a stable, readable key.
 * Max ~40 chars, lowercase, hyphen-separated, no special chars except `-`.
 */
export function deriveQaKey(findings: string[]): string {
  const prefix = 'qa-defect';
  if (findings.length === 0) {
    return `${prefix}-cluster`;
  }
  const target = findings[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return `${prefix}-${target}`.slice(0, 40);
}

/**
 * Compose a one-sentence insight describing the ship-blocking QA defect cluster.
 */
export function composeQaInsight(findings: string[]): string {
  if (findings.length === 0) {
    return 'QA found ship-blocking defects with no extractable finding text; review the QA report for details before retrying the build cycle.';
  }
  const target = findings[0].slice(0, 120);
  const total = findings.length;
  const suffix = total > 1 ? ` (${total} defects total)` : '';
  return `QA found ship-blocking defect: "${target}"${suffix} — a fix cycle is required before proceeding to ship.`;
}

/**
 * Emit a learning candidate when /qa produces a ship-blocking verdict.
 * Captures the highest-information event: QA found defects the build cycle
 * did not address. Best-effort — failure must not break the QA result.
 */
export function captureQaShipBlockingLearning(
  cwd: string,
  runId: string,
  findings: string[],
): void {
  try {
    writeLearningCandidate({
      cwd,
      stage: 'qa',
      run_id: runId,
      entry: {
        id: generateLearningId(),
        schema_version: 2,
        ts: new Date().toISOString(),
        writer_skill: 'qa',
        subject_skill: 'qa',
        subject_stage: 'qa',
        type: 'pitfall',
        key: deriveQaKey(findings),
        insight: composeQaInsight(findings),
        confidence: 8,
        evidence_type: 'multi-run-observation',
        source: 'observed',
        files: [],
        cluster_id: null,
        supersedes: [],
        supersedes_reason: null,
        derived_from: [],
        last_applied_at: null,
        mirror: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[qa] learning-candidate capture failed (best-effort): ${message}`);
  }
}

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
    previous_stage: ledger.current_stage === 'qa' ? 'qa' : 'review',
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
    outputs: [artifactPointerFor(stageCompletionAdvisorPath('qa')), artifactPointerFor(stageStatusPath('qa'))],
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
  const statusPath = stageStatusPath('qa');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);
  const priorQaStatus = ledger?.current_stage === 'qa'
    ? readStageStatus(statusPath, ctx.cwd)
    : null;

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before QA');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  assertCanonicalTailLedger(ledger, 'QA');
  assertLegalTransition(ledger.current_stage, 'qa');
  if (ledger.current_stage === 'qa') {
    if (!priorQaStatus) {
      throw new Error('QA status must exist before rerunning QA');
    }

    assertSameRunId(ledger.run_id, priorQaStatus.run_id, 'qa status');

    if (priorQaStatus.state === 'completed') {
      if (priorQaStatus.ready === false) {
        throw new Error('QA found defects; run /build fix cycle before rerunning QA');
      }

      throw new Error('QA retry is only valid after a blocked or refused QA');
    }

    if (priorQaStatus.state !== 'blocked' && priorQaStatus.state !== 'refused') {
      throw new Error('QA retry is only valid after a blocked or refused QA');
    }
  }
  try {
    assertReviewReadyForCloseout(reviewStatus, ctx.cwd);
  } catch {
    throw new Error('Review must be completed before QA');
  }

  const startedAt = ctx.clock();
  const reviewAdvisoryDisposition = effectiveReviewAdvisoryDisposition(
    ctx.cwd,
    reviewStatus,
    ctx.review_advisory_disposition_override,
  );
  const reviewHasPendingAdvisories = reviewHasAdvisories(reviewStatus);
  if (reviewHasPendingAdvisories && !advisoryDispositionPermitsStage('qa', reviewAdvisoryDisposition)) {
    throw new Error(requiredReviewAdvisoryDispositionError('qa'));
  }
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
  const completionAdvisorPath = stageCompletionAdvisorPath('qa');
  const reportPath = qaReportPath();
  const learningCandidatesPath = qaLearningCandidatesPath();
  const predecessorArtifacts = [
    artifactPointerFor(reviewStatusPath),
    ...(canonicalVerificationMatrix ? [artifactPointerFor(planVerificationMatrixPath())] : []),
  ];
  const reviewAdvisoryDispositionRecord = reviewHasPendingAdvisories
    ? buildReviewAdvisoryDispositionRecord(
        ledger.run_id,
        reviewStatus.advisory_count ?? 0,
        reviewAdvisoryDisposition,
        startedAt,
      )
    : null;
  const reviewAdvisoryDispositionWrite = reviewAdvisoryDispositionRecord
    ? {
        path: reviewAdvisoryDispositionPath(),
        content: JSON.stringify(reviewAdvisoryDispositionRecord, null, 2) + '\n',
      }
    : null;
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
      canonical_paths: [completionAdvisorPath, statusPath],
      trace_paths: [
        '.planning/current/qa/adapter-request.json',
        '.planning/current/qa/adapter-output.json',
        '.planning/current/qa/normalization.json',
      ],
    };

    const completionAdvisor = buildQaCompletionAdvisor(status, verificationMatrix, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'qa',
      statusPath,
      canonicalWrites: [
        buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd }),
        ...(reviewAdvisoryDispositionWrite ? [reviewAdvisoryDispositionWrite] : []),
      ],
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
      ledger: (() => {
        const next = clearQaLearningArtifactIndex(
          nextLedger(
            ledgerWithExecution,
            result.outcome === 'refused' ? 'refused' : 'blocked',
            startedAt,
            ctx.via,
            QA_RETRY_NEXT_STAGES,
          ),
        );
        next.artifact_index[completionAdvisorPath] = artifactPointerFor(completionAdvisorPath);
        if (reviewAdvisoryDispositionWrite) {
          next.artifact_index[reviewAdvisoryDispositionPath()] = artifactPointerFor(reviewAdvisoryDispositionPath());
        }
        return next;
      })(),
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
      canonical_paths: [completionAdvisorPath, statusPath],
      trace_paths: [
        '.planning/current/qa/adapter-request.json',
        '.planning/current/qa/adapter-output.json',
        '.planning/current/qa/normalization.json',
      ],
    };

    const completionAdvisor = buildQaCompletionAdvisor(status, verificationMatrix, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'qa',
      statusPath,
      canonicalWrites: [
        buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd }),
        ...(reviewAdvisoryDispositionWrite ? [reviewAdvisoryDispositionWrite] : []),
      ],
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
      ledger: (() => {
        const next = clearQaLearningArtifactIndex(
          nextLedger(ledgerWithExecution, 'blocked', startedAt, ctx.via, QA_RETRY_NEXT_STAGES),
        );
        next.artifact_index[completionAdvisorPath] = artifactPointerFor(completionAdvisorPath);
        if (reviewAdvisoryDispositionWrite) {
          next.artifact_index[reviewAdvisoryDispositionPath()] = artifactPointerFor(reviewAdvisoryDispositionPath());
        }
        return next;
      })(),
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
      canonical_paths: [completionAdvisorPath, statusPath],
      trace_paths: [
        '.planning/current/qa/adapter-request.json',
        '.planning/current/qa/adapter-output.json',
        '.planning/current/qa/normalization.json',
      ],
    };

    const completionAdvisor = buildQaCompletionAdvisor(status, verificationMatrix, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'qa',
      statusPath,
      canonicalWrites: [
        buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd }),
        ...(reviewAdvisoryDispositionWrite ? [reviewAdvisoryDispositionWrite] : []),
      ],
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
      ledger: (() => {
        const next = clearQaLearningArtifactIndex(
          nextLedger(ledgerWithExecution, 'blocked', startedAt, ctx.via, QA_RETRY_NEXT_STAGES),
        );
        next.artifact_index[completionAdvisorPath] = artifactPointerFor(completionAdvisorPath);
        if (reviewAdvisoryDispositionWrite) {
          next.artifact_index[reviewAdvisoryDispositionPath()] = artifactPointerFor(reviewAdvisoryDispositionPath());
        }
        return next;
      })(),
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
      artifactPointerFor(completionAdvisorPath),
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
  const completionAdvisor = buildQaCompletionAdvisor(status, verificationMatrix, startedAt);
  next.artifact_index = {
    ...next.artifact_index,
    [reportPath]: artifactPointerFor(reportPath),
    [completionAdvisorPath]: artifactPointerFor(completionAdvisorPath),
    [statusPath]: artifactPointerFor(statusPath),
    ...(reviewAdvisoryDispositionWrite ? { [reviewAdvisoryDispositionPath()]: artifactPointerFor(reviewAdvisoryDispositionPath()) } : {}),
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
      buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd }),
      ...(reviewAdvisoryDispositionWrite ? [reviewAdvisoryDispositionWrite] : []),
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
          completionAdvisorPath,
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

  // ── /qa ship-blocking cluster capture (SP1 Task 22) ────────────────────────
  // When QA finds defects (ready === false), capture a learning candidate.
  // Run AFTER applyNormalizationPlan so the normalization removeWrites pass
  // does not delete the file we write here (success-path removeWrites includes
  // learningCandidatesPath when no auditor-sourced record exists; chain-template
  // captures are written independently after normalization).
  // Placement is load-bearing: must come after applyNormalizationPlan.
  // Best-effort — failure must not break the QA result.
  if (!ready) {
    captureQaShipBlockingLearning(ctx.cwd, ledger.run_id, findings);
  }
  // ───────────────────────────────────────────────────────────────────────────

  return { command: 'qa', status, completion_advisor: completionAdvisor };
}
