import { CANONICAL_MANIFEST } from '../contracts/command-manifest';
import {
  artifactPointerFor,
  BUILD_STATUS_PATH,
  dedupeArtifactPointers,
  executionContractArtifacts,
} from '../contracts/artifacts';
import {
  currentAuditArtifactPaths,
  currentAuditPointer,
  reviewLearningCandidatesPath,
  reviewAttemptAuditMarkdownPath,
  reviewPersonaAuditPath,
  reviewPersonaAuditPaths,
  stageCompletionAdvisorPath,
  stageStatusPath,
} from '../io/artifacts';
import { reviewAdvisoriesPath, reviewAdvisoryDispositionPath } from '../io/artifacts';
import { executionFieldsFromLedger, withExecutionSessionRoot, withExecutionWorkspace } from '../runtime/execution-topology';
import { assertSameRunId, gateRequiresArchive } from '../governance';
import { readLedger } from '../governance/ledger';
import { applyNormalizationPlan } from '../normalizers';
import {
  buildReviewGateDecisionMarkdown,
  buildReviewSynthesisMarkdown,
  buildReviewTraceabilityPayloads,
  describeCcbLatencySummary,
  requestedBuildRouteFromLedger,
  requestedAndActualAuditRouteMatch,
  requestedAuditRouteFromBuild,
} from '../normalizers/ccb';
import {
  boundedFixCycleReviewScopeFromAudits,
  fullAcceptanceReviewScope,
  normalizeReviewScopeRecord,
  resolveFixCycleReviewScope,
} from '../review/scope';
import {
  buildReviewAdvisoriesRecord,
  buildReviewAdvisoryDispositionRecord,
} from '../review/advisories';
import { buildReviewMetaWrite, CURRENT_REVIEW_META_PATH } from '../review/meta';
import { readStageStatus } from '../io/status';
import { assertLegalTransition, getAllowedNextStages } from '../governance/transitions';
import { resolveExecutionWorkspace, resolveSessionRootRecord, syncRunWorkspaceArtifacts } from '../runtime/workspace-substrate';
import type { CcbExecuteAuditRaw } from '../adapters/ccb';
import type { LocalExecuteAuditRaw } from '../adapters/local';
import type { ExecutionReviewDisciplineRaw } from '../adapters/execution';
import type {
  ArtifactPointer,
  CommandHistoryVia,
  ConflictRecord,
  LearningCandidate,
  LocalPersonaReviewStatusRecord,
  LocalReviewPersonaRole,
  ReviewMetaRecord,
  RunLedger,
  StageStatus,
} from '../contracts/types';
import { LEARNING_SOURCES, LEARNING_TYPES, NEXUS_LEDGER_SCHEMA_VERSION } from '../contracts/types';
import type { CommandContext, CommandResult } from './index';
import { readVerificationMatrix } from '../review/verification-matrix';
import { buildReviewCompletionAdvisor } from '../completion-advisor';
import { buildCompletionAdvisorWrite } from '../completion-advisor/writer';
import {
  buildTelemetryEvent,
  emitTelemetryEventForCwd,
  type ReviewAdvisoryDispatchedEvent,
} from '../telemetry';
import {
  buildReviewAuditReceiptRecord,
  persistReviewAuditReceipt,
  readReviewAuditReceipt,
} from '../review/receipts';

type AtomicWriteFile = (cwd: string, relativePath: string, content: string) => void;
const HANDOFF_STATUS_PATH = stageStatusPath('handoff');
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

  delete nextArtifactIndex[reviewLearningCandidatesPath()];
  delete nextArtifactIndex[reviewAdvisoriesPath()];
  delete nextArtifactIndex[reviewAdvisoryDispositionPath()];

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

function reviewCompatibleBuildRoute(
  requestedRoute: StageStatus['requested_route'] | null | undefined,
): requestedRoute is NonNullable<StageStatus['requested_route']> {
  return Boolean(
    requestedRoute
      && requestedRoute.command === 'build'
      && typeof requestedRoute.generator === 'string'
      && requestedRoute.generator.length > 0
      && typeof requestedRoute.evaluator_a === 'string'
      && requestedRoute.evaluator_a.length > 0
      && typeof requestedRoute.evaluator_b === 'string'
      && requestedRoute.evaluator_b.length > 0,
  );
}

function parseAuditVerdict(markdown: string, label: string): 'pass' | 'fail' {
  const matches = [...markdown.matchAll(/Result:\s*(pass|fail)/gi)];
  const verdict = matches.at(-1)?.[1]?.toLowerCase();
  if (!verdict) {
    throw new Error(`${label} audit is missing a canonical Result: pass|fail line`);
  }

  return verdict as 'pass' | 'fail';
}

function reviewAttemptId(startedAt: string): string {
  return `review-${startedAt.replace(/[^0-9A-Za-z]+/g, '-')}`;
}

function requestIdFromAuditRaw(rawOutput: CcbExecuteAuditRaw | LocalExecuteAuditRaw | null | undefined): string | null {
  if (!rawOutput || !('request_id' in rawOutput)) {
    return null;
  }

  return typeof rawOutput.request_id === 'string' ? rawOutput.request_id : null;
}

function receiptFromAuditRaw(rawOutput: CcbExecuteAuditRaw | LocalExecuteAuditRaw | null | undefined): string | null {
  if (!rawOutput || typeof rawOutput.receipt !== 'string' || rawOutput.receipt.length === 0) {
    return null;
  }

  return rawOutput.receipt;
}

function requestedReviewRoute(
  requestedRoute: NonNullable<StageStatus['requested_route']>,
  provider: 'codex' | 'gemini',
) {
  return requestedAuditRouteFromBuild(requestedRoute, provider);
}

function persistReviewAuditReceiptForResult(input: {
  cwd: string;
  reviewAttemptId: string;
  provider: 'codex' | 'gemini';
  generatedAt: string;
  requestedRoute: NonNullable<StageStatus['requested_route']>;
  result: {
    raw_output: CcbExecuteAuditRaw | LocalExecuteAuditRaw;
    actual_route: StageStatus['actual_route'];
  };
}): { markdownPath: string; receiptPath: string } {
  const markdown = input.result.raw_output.markdown;
  assertNonEmptyMarkdown(markdown, input.provider === 'codex' ? 'Codex audit' : 'Gemini audit');

  return persistReviewAuditReceipt({
    cwd: input.cwd,
    review_attempt_id: input.reviewAttemptId,
    provider: input.provider,
    markdown,
    record: buildReviewAuditReceiptRecord({
      review_attempt_id: input.reviewAttemptId,
      provider: input.provider,
      request_id: requestIdFromAuditRaw(input.result.raw_output),
      generated_at: input.generatedAt,
      requested_route: requestedReviewRoute(input.requestedRoute, input.provider),
      actual_route: input.result.actual_route,
      verdict: parseAuditVerdict(markdown, input.provider === 'codex' ? 'Codex' : 'Gemini'),
      markdown_path: reviewAttemptAuditMarkdownPath(input.reviewAttemptId, input.provider),
    }),
  });
}

function readRequiredReviewAuditReceipt(input: {
  cwd: string;
  reviewAttemptId: string;
  provider: 'codex' | 'gemini';
}): NonNullable<ReturnType<typeof readReviewAuditReceipt>> {
  const receipt = readReviewAuditReceipt({
    cwd: input.cwd,
    review_attempt_id: input.reviewAttemptId,
    provider: input.provider,
  });

  if (!receipt) {
    throw new Error(`Missing ${input.provider} review receipt for attempt ${input.reviewAttemptId}`);
  }

  if (receipt.record.review_attempt_id !== input.reviewAttemptId || receipt.record.provider !== input.provider) {
    throw new Error(`Malformed ${input.provider} review receipt for attempt ${input.reviewAttemptId}`);
  }

  return receipt;
}

function blockedReviewStatus(
  ledger: RunLedger,
  startedAt: string,
  attemptId: string,
  inputs: ArtifactPointer[],
  outputs: ArtifactPointer[],
  design: Pick<StageStatus, 'design_impact' | 'design_contract_required' | 'design_contract_path' | 'design_verified'>,
  requestedRoute: StageStatus['requested_route'],
  actualRoute: StageStatus['actual_route'],
  reviewScope: StageStatus['review_scope'],
  error: string,
  state: 'blocked' | 'refused' = 'blocked',
  auditRequestIds: StageStatus['audit_request_ids'] = null,
): StageStatus {
  return {
    run_id: ledger.run_id,
    stage: 'review',
    ...executionFieldsFromLedger(ledger, actualRoute?.route ?? null),
    review_attempt_id: attemptId,
    audit_request_ids: auditRequestIds,
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

function blockedReviewStatusError(
  baseMessage: string,
  rawOutput: CcbExecuteAuditRaw | LocalExecuteAuditRaw,
): string {
  const diagnostic = 'latency_summary' in rawOutput
    ? describeCcbLatencySummary(rawOutput.latency_summary ?? null)
    : null;
  return diagnostic ? `${baseMessage} (${diagnostic})` : baseMessage;
}

function assertNonEmptyMarkdown(markdown: string, label: string): void {
  if (!markdown.trim()) {
    throw new Error(`${label} markdown is empty`);
  }
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

function normalizeLearningCandidate(candidate: unknown): LearningCandidate | null {
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

function collectReviewLearningCandidates(
  auditAResult: Pick<CcbExecuteAuditRaw | LocalExecuteAuditRaw, 'learning_candidates'>,
  auditBResult: Pick<CcbExecuteAuditRaw | LocalExecuteAuditRaw, 'learning_candidates'>,
): LearningCandidate[] {
  const candidates: LearningCandidate[] = [];
  const seen = new Set<string>();

  for (const rawCandidates of [auditAResult.learning_candidates, auditBResult.learning_candidates]) {
    if (!Array.isArray(rawCandidates)) {
      continue;
    }

    for (const candidate of rawCandidates) {
      const normalized = normalizeLearningCandidate(candidate);
      if (normalized) {
        const candidateKey = `${normalized.type}:${normalized.key}`;
        if (seen.has(candidateKey)) {
          continue;
        }
        seen.add(candidateKey);
        candidates.push(normalized);
      }
    }
  }

  return candidates;
}

function collectLocalPersonaAudits(
  auditAResult: Pick<LocalExecuteAuditRaw, 'persona_audits'>,
  auditBResult: Pick<LocalExecuteAuditRaw, 'persona_audits'>,
): NonNullable<LocalExecuteAuditRaw['persona_audits']> {
  const audits = [
    ...(auditAResult.persona_audits ?? []),
    ...(auditBResult.persona_audits ?? []),
  ];
  const byRole = new Map<LocalReviewPersonaRole, NonNullable<LocalExecuteAuditRaw['persona_audits']>[number]>();

  for (const audit of audits) {
    byRole.set(audit.role, audit);
  }

  return (['code', 'test', 'security', 'design'] as const)
    .map((role) => byRole.get(role))
    .filter((audit): audit is NonNullable<LocalExecuteAuditRaw['persona_audits']>[number] => Boolean(audit));
}

function buildLocalPersonaReviewStatus(
  personaAudits: NonNullable<LocalExecuteAuditRaw['persona_audits']>,
): LocalPersonaReviewStatusRecord | null {
  if (personaAudits.length === 0) {
    return null;
  }

  return {
    enabled: true,
    roles: personaAudits.map((audit) => audit.role),
    artifact_paths: personaAudits.map((audit) => reviewPersonaAuditPath(audit.role)),
    gate_affecting_roles: personaAudits
      .filter((audit) => audit.gate_affecting)
      .map((audit) => audit.role),
    advisory_only_roles: personaAudits
      .filter((audit) => !audit.gate_affecting)
      .map((audit) => audit.role),
  };
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
  const handoffStatus = readStageStatus(HANDOFF_STATUS_PATH, ctx.cwd);
  const planStatus = readStageStatus(PLAN_STATUS_PATH, ctx.cwd);
  const buildStatusPath = stageStatusPath('build');
  const reviewStatusPath = stageStatusPath('review');
  const completionAdvisorPath = stageCompletionAdvisorPath('review');
  const buildStatus = readStageStatus(buildStatusPath, ctx.cwd);
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);

  if (!ledger || !buildStatus?.ready) {
    throw new Error('Build must be completed before review');
  }

  if (planStatus) {
    assertSameRunId(ledger.run_id, planStatus.run_id, 'plan status');
  }
  if (handoffStatus) {
    assertSameRunId(ledger.run_id, handoffStatus.run_id, 'handoff status');
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
  const attemptId = reviewAttemptId(startedAt);
  const manifest = CANONICAL_MANIFEST.review;
  const designContractPointer = planDesignContractPointer(planStatus);
  const verificationMatrix = readVerificationMatrix(ctx.cwd);
  const predecessorArtifacts = dedupeArtifactPointers([
    artifactPointerFor(BUILD_STATUS_PATH),
    ...executionContractArtifacts(Boolean(verificationMatrix)),
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
  const requestedRoute = reviewCompatibleBuildRoute(buildStatus.requested_route)
    ? buildStatus.requested_route
    : (
      reviewCompatibleBuildRoute(handoffStatus?.requested_route)
        ? handoffStatus.requested_route
        : requestedBuildRouteFromLedger(ledgerWithExecution)
    );
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
  const metaPath = CURRENT_REVIEW_META_PATH;
  const learningCandidatesPath = reviewLearningCandidatesPath();
  const advisoriesPath = reviewAdvisoriesPath();
  const advisoryDispositionPath = reviewAdvisoryDispositionPath();
  const currentAuditPaths = [
    ...currentAuditArtifactPaths(),
    learningCandidatesPath,
    advisoriesPath,
    advisoryDispositionPath,
    ...reviewPersonaAuditPaths(),
  ];

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
        attemptId,
        predecessorArtifacts,
        [artifactPointerFor(completionAdvisorPath), artifactPointerFor(reviewStatusPath)],
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
        canonical_paths: [completionAdvisorPath, reviewStatusPath],
        trace_paths: [
          '.planning/current/review/adapter-request.json',
          '.planning/current/review/adapter-output.json',
          '.planning/current/review/normalization.json',
        ],
      };
      const completionAdvisor = buildReviewCompletionAdvisor(status, verificationMatrix, startedAt);

      await applyNormalizationPlan({
        cwd: ctx.cwd,
        stage: 'review',
        statusPath: reviewStatusPath,
        canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
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

  const disciplineResult = await ctx.adapters.execution.review_discipline({
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
  }) as Awaited<ReturnType<typeof ctx.adapters.execution.review_discipline>> & {
    raw_output: ExecutionReviewDisciplineRaw;
  };

  if (disciplineResult.outcome !== 'success') {
    const message = disciplineResult.outcome === 'refused'
      ? 'Superpowers review discipline refused review'
      : 'Superpowers review discipline blocked review';
    const status = blockedReviewStatus(
      ledgerWithExecution,
      startedAt,
      attemptId,
      predecessorArtifacts,
      [artifactPointerFor(completionAdvisorPath), artifactPointerFor(reviewStatusPath)],
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
      canonical_paths: [completionAdvisorPath, reviewStatusPath],
      trace_paths: [
        '.planning/current/review/adapter-request.json',
        '.planning/current/review/adapter-output.json',
        '.planning/current/review/normalization.json',
      ],
    };
    const completionAdvisor = buildReviewCompletionAdvisor(status, verificationMatrix, startedAt);

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'review',
      statusPath: reviewStatusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
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
      attemptId,
      predecessorArtifacts,
      [artifactPointerFor(completionAdvisorPath), artifactPointerFor(reviewStatusPath)],
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
      canonical_paths: [completionAdvisorPath, reviewStatusPath],
      trace_paths: [
        '.planning/current/review/adapter-request.json',
        '.planning/current/review/adapter-output.json',
        '.planning/current/review/normalization.json',
      ],
    };
    const completionAdvisor = buildReviewCompletionAdvisor(status, verificationMatrix, startedAt);

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'review',
      statusPath: reviewStatusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
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
      review_attempt_id: attemptId,
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
      review_attempt_id: attemptId,
    }) as Promise<Awaited<ReturnType<typeof auditAdapter.execute_audit_b>> & { raw_output: CcbExecuteAuditRaw | LocalExecuteAuditRaw }>,
  ]);

  if (auditAResult.outcome === 'success') {
    persistReviewAuditReceiptForResult({
      cwd: ctx.cwd,
      reviewAttemptId: attemptId,
      provider: 'codex',
      generatedAt: startedAt,
      requestedRoute,
      result: auditAResult,
    });
  }

  if (auditBResult.outcome === 'success') {
    persistReviewAuditReceiptForResult({
      cwd: ctx.cwd,
      reviewAttemptId: attemptId,
      provider: 'gemini',
      generatedAt: startedAt,
      requestedRoute,
      result: auditBResult,
    });
  }

  for (const [label, result] of [
    ['codex', auditAResult] as const,
    ['gemini', auditBResult] as const,
  ]) {
    if (result.outcome !== 'success') {
      const message = result.outcome === 'refused'
        ? `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} ${label} audit refused review`
        : `${ledger.execution.mode === 'local_provider' ? 'Local provider' : 'CCB'} ${label} audit blocked review`;
      const statusMessage = blockedReviewStatusError(message, result.raw_output);
      const status = blockedReviewStatus(
        ledgerWithExecution,
        startedAt,
        attemptId,
        predecessorArtifacts,
        [artifactPointerFor(completionAdvisorPath), artifactPointerFor(reviewStatusPath)],
        designFields,
        requestedRoute,
        actualRoute,
        inheritedReviewScope,
        statusMessage,
        result.outcome === 'refused' ? 'refused' : 'blocked',
        {
          codex: requestIdFromAuditRaw(auditAResult.raw_output),
          gemini: requestIdFromAuditRaw(auditBResult.raw_output),
        },
      );
      const conflict: ConflictRecord = {
        stage: 'review',
        adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
        kind: 'backend_conflict',
        message,
        canonical_paths: [completionAdvisorPath, reviewStatusPath],
        trace_paths: [
          '.planning/current/review/adapter-request.json',
          '.planning/current/review/adapter-output.json',
          '.planning/current/review/normalization.json',
        ],
      };
      const completionAdvisor = buildReviewCompletionAdvisor(status, verificationMatrix, startedAt);

      await applyNormalizationPlan({
        cwd: ctx.cwd,
        stage: 'review',
        statusPath: reviewStatusPath,
        canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
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

  const requestedCodexRoute = requestedReviewRoute(requestedRoute, 'codex');
  const requestedGeminiRoute = requestedReviewRoute(requestedRoute, 'gemini');

  if (
    !requestedAndActualAuditRouteMatch(requestedCodexRoute, auditAResult.actual_route)
    || !requestedAndActualAuditRouteMatch(requestedGeminiRoute, auditBResult.actual_route)
  ) {
    const message = 'Requested and actual audit route diverged';
    const status = blockedReviewStatus(
      ledgerWithExecution,
      startedAt,
      attemptId,
      predecessorArtifacts,
      [artifactPointerFor(completionAdvisorPath), artifactPointerFor(reviewStatusPath)],
      designFields,
      requestedRoute,
      actualRoute,
      inheritedReviewScope,
      message,
      'blocked',
      {
        codex: requestIdFromAuditRaw(auditAResult.raw_output),
        gemini: requestIdFromAuditRaw(auditBResult.raw_output),
      },
    );
    const conflict: ConflictRecord = {
      stage: 'review',
      adapter: ledger.execution.mode === 'local_provider' ? 'local' : 'ccb',
      kind: 'route_mismatch',
      message,
      canonical_paths: [completionAdvisorPath, reviewStatusPath],
      trace_paths: [
        '.planning/current/review/adapter-request.json',
        '.planning/current/review/adapter-output.json',
        '.planning/current/review/normalization.json',
      ],
    };
    const completionAdvisor = buildReviewCompletionAdvisor(status, verificationMatrix, startedAt);

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'review',
      statusPath: reviewStatusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
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

  const codexReceipt = readRequiredReviewAuditReceipt({
    cwd: ctx.cwd,
    reviewAttemptId: attemptId,
    provider: 'codex',
  });
  const geminiReceipt = readRequiredReviewAuditReceipt({
    cwd: ctx.cwd,
    reviewAttemptId: attemptId,
    provider: 'gemini',
  });
  const codexMarkdown = codexReceipt.markdown;
  const geminiMarkdown = geminiReceipt.markdown;
  assertNonEmptyMarkdown(codexMarkdown, 'Codex audit');
  assertNonEmptyMarkdown(geminiMarkdown, 'Gemini audit');

  const codexVerdict = parseAuditVerdict(codexMarkdown, 'Codex');
  const geminiVerdict = parseAuditVerdict(geminiMarkdown, 'Gemini');
  const gateDecision = codexVerdict === 'pass' && geminiVerdict === 'pass' ? 'pass' : 'fail';
  const reviewScope = gateDecision === 'fail'
    ? boundedFixCycleReviewScopeFromAudits(codexMarkdown, geminiMarkdown)
    : inheritedReviewScope;
  const learningCandidates = collectReviewLearningCandidates(auditAResult.raw_output, auditBResult.raw_output);
  const localPersonaAudits = ledger.execution.mode === 'local_provider'
    ? collectLocalPersonaAudits(
        auditAResult.raw_output as LocalExecuteAuditRaw,
        auditBResult.raw_output as LocalExecuteAuditRaw,
      )
    : [];
  const localPersonaReview = buildLocalPersonaReviewStatus(localPersonaAudits);
  const advisoriesRecord = buildReviewAdvisoriesRecord(
    ledger.run_id,
    startedAt,
    codexMarkdown,
    geminiMarkdown,
  );
  const advisoryDispositionRecord = advisoriesRecord
    ? buildReviewAdvisoryDispositionRecord(ledger.run_id, advisoriesRecord.advisories.length, null, null)
    : null;
  const learningCandidatesRecord = learningCandidates.length > 0
    ? {
        schema_version: 1 as const,
        run_id: ledger.run_id,
        stage: 'review' as const,
        generated_at: startedAt,
        candidates: learningCandidates,
      }
    : null;
  const synthesisMarkdown = buildReviewSynthesisMarkdown(
    disciplineSummary,
    codexMarkdown,
    geminiMarkdown,
    gateDecision,
    ledger.execution.mode === 'local_provider'
      ? {
          auditA: 'Local audit A (code/test)',
          auditB: 'Local audit B (security/design)',
        }
      : undefined,
  );
  const gateDecisionMarkdown = buildReviewGateDecisionMarkdown(gateDecision);
  const meta: ReviewMetaRecord = {
    schema_version: NEXUS_LEDGER_SCHEMA_VERSION,
    run_id: ledger.run_id,
    review_attempt_id: attemptId,
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
        request_id: requestIdFromAuditRaw(auditAResult.raw_output),
        receipt: receiptFromAuditRaw(auditAResult.raw_output),
        receipt_markdown_path: codexReceipt.markdownPath,
        receipt_record_path: codexReceipt.receiptPath,
      },
      gemini: {
        provider: requestedGeminiRoute.provider ?? ledger.execution.primary_provider,
        path: geminiPath,
        requested_route: requestedGeminiRoute,
        actual_route: auditBResult.actual_route,
        request_id: requestIdFromAuditRaw(auditBResult.raw_output),
        receipt: receiptFromAuditRaw(auditBResult.raw_output),
        receipt_markdown_path: geminiReceipt.markdownPath,
        receipt_record_path: geminiReceipt.receiptPath,
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
      receipt_markdown_path: codexReceipt.markdownPath,
      receipt_record_path: codexReceipt.receiptPath,
    },
    gemini_audit: {
      provider: requestedGeminiRoute.provider ?? ledger.execution.primary_provider,
      path: geminiPath,
      route: requestedGeminiRoute.route,
      substrate: requestedGeminiRoute.substrate,
      receipt_markdown_path: geminiReceipt.markdownPath,
      receipt_record_path: geminiReceipt.receiptPath,
    },
    pm_skill: 'frame',
    execution_skill_chain: ['plan', 'handoff', 'build', 'review'],
    lifecycle_stage: 'review',
    handoff_from: '.planning/current/handoff/governed-handoff.md',
    handoff_to: '.planning/audits/current/',
    review_scope: reviewScope,
    local_persona_review: localPersonaReview,
  };

  const outputs = [
    currentAuditPointer('codex'),
    currentAuditPointer('gemini'),
    currentAuditPointer('synthesis'),
    currentAuditPointer('gate-decision'),
    currentAuditPointer('meta'),
    ...localPersonaAudits.map((audit) => artifactPointerFor(reviewPersonaAuditPath(audit.role))),
    ...(learningCandidatesRecord ? [artifactPointerFor(learningCandidatesPath)] : []),
    ...(advisoriesRecord ? [artifactPointerFor(advisoriesPath), artifactPointerFor(advisoryDispositionPath)] : []),
    artifactPointerFor(completionAdvisorPath),
    artifactPointerFor(reviewStatusPath),
  ];
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'review',
    ...executionFieldsFromLedger(ledgerWithExecution, actualRoute.route),
    review_attempt_id: attemptId,
    audit_request_ids: {
      codex: requestIdFromAuditRaw(auditAResult.raw_output),
      gemini: requestIdFromAuditRaw(auditBResult.raw_output),
    },
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
    learning_candidates_path: learningCandidatesRecord ? learningCandidatesPath : null,
    learnings_recorded: Boolean(learningCandidatesRecord),
    advisories_path: advisoriesRecord ? advisoriesPath : null,
    advisory_count: advisoriesRecord?.advisories.length ?? 0,
    advisory_categories: advisoriesRecord?.categories ?? [],
    advisory_disposition: advisoryDispositionRecord?.selected ?? null,
    advisory_disposition_path: advisoryDispositionRecord ? advisoryDispositionPath : null,
    local_persona_review: localPersonaReview,
    workspace,
    review_complete: true,
    audit_set_complete: true,
    provenance_consistent: true,
    gate_decision: gateDecision,
    archive_required: gateRequiresArchive(gateDecisionMarkdown),
    archive_state: gateRequiresArchive(gateDecisionMarkdown) ? 'pending' : 'not_required',
  };

  // Phase H (Track D-D3 Iron Law telemetry): emit
  // `review_advisory_dispatched` when the operator has selected an advisory
  // disposition. This maps directly to /review Law 2 (two-round protocol)
  // and Law 3 (disagreement protocol) — disposition is where the operator's
  // routing decision becomes structured data. No-op when telemetry disabled.
  if (advisoryDispositionRecord?.selected) {
    emitTelemetryEventForCwd(
      buildTelemetryEvent<ReviewAdvisoryDispatchedEvent>({
        run_id: ledger.run_id,
        kind: 'review_advisory_dispatched',
        stage: 'review',
        advisory_disposition: advisoryDispositionRecord.selected,
      }),
      ctx.cwd,
    );
  }

  const next = nextLedger(
    ledgerWithExecution,
    gateDecision === 'pass' ? 'active' : 'blocked',
    startedAt,
    commandHistoryVia,
    gateDecision === 'pass' ? getAllowedNextStages('review') : ['build', 'review'],
  );
  const completionAdvisor = buildReviewCompletionAdvisor(status, verificationMatrix, startedAt);
  next.artifact_index = {
    ...next.artifact_index,
    [codexPath]: currentAuditPointer('codex'),
    [geminiPath]: currentAuditPointer('gemini'),
    [synthesisPath]: currentAuditPointer('synthesis'),
    [gateDecisionPath]: currentAuditPointer('gate-decision'),
    [metaPath]: currentAuditPointer('meta'),
    ...Object.fromEntries(localPersonaAudits.map((audit) => {
      const path = reviewPersonaAuditPath(audit.role);
      return [path, artifactPointerFor(path)];
    })),
    ...(learningCandidatesRecord ? { [learningCandidatesPath]: artifactPointerFor(learningCandidatesPath) } : {}),
    ...(advisoriesRecord
      ? {
          [advisoriesPath]: artifactPointerFor(advisoriesPath),
          [advisoryDispositionPath]: artifactPointerFor(advisoryDispositionPath),
        }
      : {}),
    [completionAdvisorPath]: artifactPointerFor(completionAdvisorPath),
    [reviewStatusPath]: artifactPointerFor(reviewStatusPath),
  };
  if (!learningCandidatesRecord) {
    delete next.artifact_index[learningCandidatesPath];
  }
  if (!advisoriesRecord) {
    delete next.artifact_index[advisoriesPath];
    delete next.artifact_index[advisoryDispositionPath];
  }
  if (localPersonaAudits.length === 0) {
    for (const path of reviewPersonaAuditPaths()) {
      delete next.artifact_index[path];
    }
  }

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'review',
    statusPath: reviewStatusPath,
    canonicalWrites: [
      { path: codexPath, content: codexMarkdown },
      { path: geminiPath, content: geminiMarkdown },
      { path: synthesisPath, content: synthesisMarkdown },
      { path: gateDecisionPath, content: gateDecisionMarkdown },
      buildReviewMetaWrite(meta),
      ...localPersonaAudits.map((audit) => ({
        path: reviewPersonaAuditPath(audit.role),
        content: `${audit.markdown.trimEnd()}\n`,
      })),
      ...(learningCandidatesRecord
        ? [{ path: learningCandidatesPath, content: JSON.stringify(learningCandidatesRecord, null, 2) + '\n' }]
        : []),
      ...(advisoriesRecord
        ? [
            { path: advisoriesPath, content: JSON.stringify(advisoriesRecord, null, 2) + '\n' },
            { path: advisoryDispositionPath, content: JSON.stringify(advisoryDispositionRecord, null, 2) + '\n' },
          ]
        : []),
      buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd }),
    ],
    removeWrites: [
      ...(localPersonaAudits.length > 0 ? [] : reviewPersonaAuditPaths()),
      ...(learningCandidatesRecord ? [] : [learningCandidatesPath]),
      ...(advisoriesRecord ? [] : [advisoriesPath, advisoryDispositionPath]),
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
        canonical_paths: [
          codexPath,
          geminiPath,
          synthesisPath,
          gateDecisionPath,
          metaPath,
          ...localPersonaAudits.map((audit) => reviewPersonaAuditPath(audit.role)),
          ...(learningCandidatesRecord ? [learningCandidatesPath] : []),
          completionAdvisorPath,
        ],
        learning_candidates_path: learningCandidatesRecord ? learningCandidatesPath : null,
        learnings_recorded: Boolean(learningCandidatesRecord),
        status: { state: status.state, decision: status.decision, ready: status.ready },
      },
    ),
    status,
    mirrorWorkspace: workspace,
    ledger: next,
    writeAtomicFile,
  });

  return { command: 'review', status, completion_advisor: completionAdvisor };
}

export async function runReview(ctx: CommandContext): Promise<CommandResult> {
  return runReviewWithWriteAtomicFile(ctx);
}
