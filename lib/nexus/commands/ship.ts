import { existsSync } from 'fs';
import { join } from 'path';
import { CANONICAL_MANIFEST } from '../command-manifest';
import {
  planVerificationMatrixPath,
  qaPerfVerificationPath,
  shipDeployReadinessPath,
  qaDesignVerificationPath,
  shipLearningCandidatesPath,
  shipChecklistPath,
  shipPersonaGatePath,
  shipPersonaGatePaths,
  shipPullRequestPath,
  shipReleaseGateRecordPath,
  stageCompletionAdvisorPath,
  stageStatusPath,
} from '../artifacts';
import { resolveDeployReadiness } from '../deploy-contract';
import { executionFieldsFromLedger, withExecutionSessionRoot, withExecutionWorkspace } from '../execution-topology';
import { assertCanonicalTailLedger, assertQaReadyForCloseout, assertReviewReadyForCloseout, assertSameRunId } from '../governance';
import { readLedger } from '../ledger';
import { applyNormalizationPlan } from '../normalizers';
import { buildShipStageTraceabilityPayloads } from '../normalizers/superpowers';
import { resolveShipPullRequest } from '../ship-pull-request';
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import { resolveExecutionWorkspace, resolveSessionRootRecord, syncRunWorkspaceArtifacts } from '../workspace-substrate';
import {
  advisoryDispositionPermitsStage,
  buildReviewAdvisoryDispositionRecord,
  effectiveReviewAdvisoryDisposition,
  persistReviewAdvisoryDisposition,
  requiredReviewAdvisoryDispositionError,
  reviewHasAdvisories,
} from '../review-advisories';
import type { SuperpowersShipDisciplineRaw } from '../adapters/superpowers';
import type { LocalExecuteShipPersonasRaw } from '../adapters/local';
import { LEARNING_SOURCES, LEARNING_TYPES, LOCAL_SHIP_PERSONA_ROLES } from '../types';
import type {
  ArtifactPointer,
  ConflictRecord,
  LearningCandidate,
  LocalPersonaShipStatusRecord,
  LocalShipPersonaRole,
  PullRequestRecord,
  RunLedger,
  StageLearningCandidatesRecord,
  StageStatus,
} from '../types';
import type { CommandContext, CommandResult } from './index';
import { readVerificationMatrix, resolveVerificationMatrix } from '../verification-matrix';
import { buildCompletionAdvisorWrite, buildShipCompletionAdvisor } from '../completion-advisor';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function designBearing(designImpact: StageStatus['design_impact'] | null | undefined): boolean {
  return (designImpact ?? 'none') !== 'none';
}

function designVerificationSummary(
  designImpact: StageStatus['design_impact'] | null | undefined,
  designContractPath: string | null | undefined,
  designVerified: boolean | null | undefined,
): string {
  return [
    '',
    '## Design Verification',
    '',
    `- Design impact: ${designImpact ?? 'none'}`,
    `- Design contract: ${designContractPath ?? 'none'}`,
    `- QA design verification: ${
      designVerified === true ? 'verified' : designVerified === false ? 'not verified' : 'not required'
    }`,
    `- Design verification artifact: ${designVerified === true ? qaDesignVerificationPath() : 'none'}`,
    '',
  ].join('\n');
}

function perfVerificationEvidencePath(cwd: string): string | null {
  const path = qaPerfVerificationPath();
  return existsSync(join(cwd, path)) ? path : null;
}

function perfVerificationSummary(path: string | null): string {
  if (!path) {
    return '';
  }

  return [
    '',
    '## Attached Evidence',
    '',
    `- QA performance verification: ${path}`,
    '',
  ].join('\n');
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value as T[number]);
}

function augmentChecklist(
  checklist: SuperpowersShipDisciplineRaw['checklist'],
  designImpact: StageStatus['design_impact'] | null | undefined,
  designContractPath: string | null | undefined,
  designVerified: boolean | null | undefined,
  perfVerificationPath: string | null,
): Record<string, unknown> {
  return {
    ...checklist,
    design_impact: designImpact ?? 'none',
    design_contract_path: designContractPath ?? null,
    design_verified: designVerified,
    design_verification_path: designVerified === true ? qaDesignVerificationPath() : null,
    qa_perf_verification_path: perfVerificationPath,
  };
}

function normalizeShipLearningCandidate(candidate: unknown): LearningCandidate | null {
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

function collectShipLearningCandidates(rawCandidates: unknown): LearningCandidate[] {
  if (!Array.isArray(rawCandidates)) {
    return [];
  }

  const candidates: LearningCandidate[] = [];
  const seen = new Set<string>();

  for (const candidate of rawCandidates) {
    const normalized = normalizeShipLearningCandidate(candidate);
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

function buildShipLearningCandidatesRecord(
  runId: string,
  startedAt: string,
  rawCandidates: unknown,
): StageLearningCandidatesRecord | null {
  const candidates = collectShipLearningCandidates(rawCandidates);
  if (candidates.length === 0) {
    return null;
  }

  return {
    schema_version: 1,
    run_id: runId,
    stage: 'ship',
    generated_at: startedAt,
    candidates,
  };
}

function collectLocalShipPersonaGates(
  rawOutput: Pick<LocalExecuteShipPersonasRaw, 'persona_gates'> | null,
): LocalExecuteShipPersonasRaw['persona_gates'] {
  const gates = rawOutput?.persona_gates ?? [];
  const byRole = new Map<LocalShipPersonaRole, LocalExecuteShipPersonasRaw['persona_gates'][number]>();

  for (const gate of gates) {
    byRole.set(gate.role, gate);
  }

  return LOCAL_SHIP_PERSONA_ROLES
    .map((role) => byRole.get(role))
    .filter((gate): gate is LocalExecuteShipPersonasRaw['persona_gates'][number] => Boolean(gate));
}

function buildLocalPersonaShipStatus(
  personaGates: LocalExecuteShipPersonasRaw['persona_gates'],
): LocalPersonaShipStatusRecord | null {
  if (personaGates.length === 0) {
    return null;
  }

  return {
    enabled: true,
    roles: personaGates.map((gate) => gate.role),
    artifact_paths: personaGates.map((gate) => shipPersonaGatePath(gate.role)),
    gate_affecting_roles: personaGates
      .filter((gate) => gate.gate_affecting)
      .map((gate) => gate.role),
    advisory_only_roles: personaGates
      .filter((gate) => !gate.gate_affecting)
      .map((gate) => gate.role),
  };
}

function localShipPersonaGatePassed(personaGates: LocalExecuteShipPersonasRaw['persona_gates']): boolean {
  return personaGates.every((gate) => !gate.gate_affecting || gate.verdict === 'pass');
}

function shipErrors(baseMergeReady: boolean, localPersonaMergeReady: boolean): string[] {
  if (baseMergeReady && localPersonaMergeReady) {
    return [];
  }

  return [
    ...(baseMergeReady ? [] : ['Release gate remains blocked']),
    ...(localPersonaMergeReady ? [] : ['Local ship persona release gate failed']),
  ];
}

function pullRequestHandoffReady(pullRequest: PullRequestRecord): boolean {
  return pullRequest.status !== 'push_required';
}

function pullRequestErrors(pullRequest: PullRequestRecord): string[] {
  if (pullRequestHandoffReady(pullRequest)) {
    return [];
  }

  if (pullRequest.status === 'push_required') {
    return [
      pullRequest.reason
        ?? 'Branch must be pushed before Nexus can create or reuse the pull request handoff',
    ];
  }

  return [];
}

function shipStatusTracePayload(
  status: Pick<
    StageStatus,
    | 'state'
    | 'decision'
    | 'ready'
    | 'design_impact'
    | 'design_contract_path'
    | 'design_verified'
    | 'deploy_configured'
    | 'deploy_config_source'
    | 'deploy_contract_path'
    | 'learning_candidates_path'
    | 'learnings_recorded'
    | 'local_persona_ship'
    | 'pull_request'
  >,
): Record<string, unknown> {
  return {
    state: status.state,
    decision: status.decision,
    ready: status.ready,
    design_impact: status.design_impact,
    design_contract_path: status.design_contract_path,
    design_verified: status.design_verified,
    deploy_configured: status.deploy_configured ?? false,
    deploy_config_source: status.deploy_config_source ?? null,
    deploy_contract_path: status.deploy_contract_path ?? null,
    learning_candidates_path: status.learning_candidates_path ?? null,
    learnings_recorded: status.learnings_recorded ?? false,
    local_persona_ship: status.local_persona_ship ?? null,
    pull_request: status.pull_request ?? null,
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

function clearShipLearningArtifactIndex(ledger: RunLedger): RunLedger {
  const nextArtifactIndex = { ...ledger.artifact_index };
  delete nextArtifactIndex[shipLearningCandidatesPath()];
  for (const path of shipPersonaGatePaths()) {
    delete nextArtifactIndex[path];
  }

  return {
    ...ledger,
    artifact_index: nextArtifactIndex,
  };
}

function blockedShipStatus(
  ledger: RunLedger,
  startedAt: string,
  inputs: ArtifactPointer[],
  error: string,
  designImpact: StageStatus['design_impact'] | null | undefined,
  designContractPath: string | null | undefined,
  designVerified: boolean | null | undefined,
  state: 'blocked' | 'refused' = 'blocked',
): StageStatus {
  return {
    run_id: ledger.run_id,
    stage: 'ship',
    ...executionFieldsFromLedger(ledger),
    design_impact: designImpact ?? 'none',
    design_contract_path: designContractPath ?? null,
    design_verified: designVerified,
    learning_candidates_path: null,
    learnings_recorded: false,
    state,
    decision: state === 'refused' ? 'refused' : 'ship_recorded',
    ready: false,
    inputs,
    outputs: [artifactPointerFor(stageCompletionAdvisorPath('ship')), artifactPointerFor(stageStatusPath('ship'))],
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

  const startedAt = ctx.clock();
  const reviewAdvisoryDisposition = effectiveReviewAdvisoryDisposition(
    ctx.cwd,
    reviewStatus,
    ctx.review_advisory_disposition_override,
  );
  const reviewHasPendingAdvisories = reviewHasAdvisories(reviewStatus);
  if (reviewHasPendingAdvisories && !advisoryDispositionPermitsStage('ship', reviewAdvisoryDisposition)) {
    throw new Error(requiredReviewAdvisoryDispositionError('ship'));
  }
  if (reviewHasPendingAdvisories && ctx.review_advisory_disposition_override) {
    persistReviewAdvisoryDisposition(
      ctx.cwd,
      buildReviewAdvisoryDispositionRecord(
        ledger.run_id,
        reviewStatus.advisory_count ?? 0,
        reviewAdvisoryDisposition,
        startedAt,
      ),
    );
  }
  const verificationMatrix = resolveVerificationMatrix(ctx.cwd, ledger.run_id, startedAt);
  const canonicalVerificationMatrix = readVerificationMatrix(ctx.cwd);
  const designImpact = qaStatus?.design_impact ?? reviewStatus?.design_impact ?? verificationMatrix.design_impact;
  const designContractPath = qaStatus?.design_contract_path ?? reviewStatus?.design_contract_path ?? null;
  const designVerified = qaStatus?.design_verified ?? null;
  const qaRequired = verificationMatrix.obligations.qa.required;
  const designVerificationRequired = verificationMatrix.obligations.qa.design_verification_required;
  const designIsBearing = designVerificationRequired || designBearing(designImpact);
  const perfVerificationPath = perfVerificationEvidencePath(ctx.cwd);

  if (qaRequired && !qaStatus) {
    throw new Error('QA is required by the verification matrix before ship');
  }

  if (qaStatus) {
    try {
      assertQaReadyForCloseout(qaStatus);
    } catch {
      throw new Error('QA must be ready before ship');
    }
  }

  if (designIsBearing && designVerified !== true) {
    throw new Error('Design-bearing runs require QA design verification before ship');
  }
  const manifest = CANONICAL_MANIFEST.ship;
  const workspace = resolveExecutionWorkspace(
    ctx.cwd,
    ledger.execution.workspace ?? qaStatus?.workspace ?? reviewStatus.workspace ?? null,
  );
  const sessionRoot = ledger.execution.session_root
    ?? qaStatus?.session_root
    ?? reviewStatus.session_root
    ?? resolveSessionRootRecord(ctx.cwd);
  const ledgerWithExecution = withExecutionSessionRoot(withExecutionWorkspace(ledger, workspace), sessionRoot);
  const releaseGateRecordPath = shipReleaseGateRecordPath();
  const checklistPath = shipChecklistPath();
  const deployReadinessPath = shipDeployReadinessPath();
  const pullRequestPath = shipPullRequestPath();
  const learningCandidatesPath = shipLearningCandidatesPath();
  const statusPath = stageStatusPath('ship');
  const completionAdvisorPath = stageCompletionAdvisorPath('ship');
  const predecessorArtifacts = [
    artifactPointerFor(reviewStatusPath),
    ...(canonicalVerificationMatrix ? [artifactPointerFor(planVerificationMatrixPath())] : []),
    ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
    ...(perfVerificationPath ? [artifactPointerFor(perfVerificationPath)] : []),
  ];
  syncRunWorkspaceArtifacts(ctx.cwd, workspace);
  const result = await ctx.adapters.superpowers.ship_discipline({
    cwd: ctx.cwd,
    workspace,
    run_id: ledger.run_id,
    command: 'ship',
    stage: 'ship',
    ledger: ledgerWithExecution,
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
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      message,
      designImpact,
      designContractPath,
      designVerified,
      result.outcome === 'refused' ? 'refused' : 'blocked',
    );
    const conflict: ConflictRecord = {
      stage: 'ship',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [completionAdvisorPath, statusPath],
      trace_paths: [
        '.planning/current/ship/adapter-request.json',
        '.planning/current/ship/adapter-output.json',
        '.planning/current/ship/normalization.json',
      ],
    };

    const completionAdvisor = buildShipCompletionAdvisor(status, verificationMatrix, null, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'ship',
      statusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
      removeWrites: [learningCandidatesPath, ...shipPersonaGatePaths()],
      traceWrites: buildShipStageTraceabilityPayloads(
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        workspace,
        result,
        {
          outcome: result.outcome,
          learning_candidates_path: null,
          learnings_recorded: false,
          status: {
            ...shipStatusTracePayload(status),
          },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: (() => {
        const next = clearShipLearningArtifactIndex(nextLedger(
          ledgerWithExecution,
          previousStage,
          result.outcome === 'refused' ? 'refused' : 'blocked',
          startedAt,
          ctx.via,
        ));
        next.artifact_index[completionAdvisorPath] = artifactPointerFor(completionAdvisorPath);
        return next;
      })(),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  if (!result.raw_output.release_gate_record?.trim()) {
    const message = 'Release gate record is empty';
    const status = blockedShipStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      message,
      designImpact,
      designContractPath,
      designVerified,
    );
    const conflict: ConflictRecord = {
      stage: 'ship',
      adapter: 'superpowers',
      kind: 'backend_conflict',
      message,
      canonical_paths: [completionAdvisorPath, statusPath],
      trace_paths: [
        '.planning/current/ship/adapter-request.json',
        '.planning/current/ship/adapter-output.json',
        '.planning/current/ship/normalization.json',
      ],
    };

    const completionAdvisor = buildShipCompletionAdvisor(status, verificationMatrix, null, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'ship',
      statusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
      removeWrites: [learningCandidatesPath, ...shipPersonaGatePaths()],
      traceWrites: buildShipStageTraceabilityPayloads(
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        workspace,
        result,
        {
          outcome: 'blocked',
          error: message,
          learning_candidates_path: null,
          learnings_recorded: false,
          status: {
            ...shipStatusTracePayload(status),
          },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: (() => {
        const next = clearShipLearningArtifactIndex(nextLedger(ledgerWithExecution, previousStage, 'blocked', startedAt, ctx.via));
        next.artifact_index[completionAdvisorPath] = artifactPointerFor(completionAdvisorPath);
        return next;
      })(),
      conflicts: [conflict, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const localShipPersonaResult = ledger.execution.mode === 'local_provider'
    ? await ctx.adapters.local.execute_ship_personas({
        cwd: ctx.cwd,
        workspace,
        run_id: ledger.run_id,
        command: 'ship',
        stage: 'ship',
        ledger: ledgerWithExecution,
        manifest,
        predecessor_artifacts: predecessorArtifacts,
        requested_route: null,
      })
    : null;

  if (localShipPersonaResult && localShipPersonaResult.outcome !== 'success') {
    const message = 'Local ship persona release gate blocked';
    const status = blockedShipStatus(
      ledgerWithExecution,
      startedAt,
      predecessorArtifacts,
      message,
      designImpact,
      designContractPath,
      designVerified,
    );
    const conflict: ConflictRecord = {
      stage: 'ship',
      adapter: 'local',
      kind: 'backend_conflict',
      message,
      canonical_paths: [completionAdvisorPath, statusPath],
      trace_paths: [
        '.planning/current/ship/adapter-request.json',
        '.planning/current/ship/adapter-output.json',
        '.planning/current/ship/normalization.json',
      ],
    };

    const completionAdvisor = buildShipCompletionAdvisor(status, verificationMatrix, null, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'ship',
      statusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd })],
      removeWrites: [learningCandidatesPath, ...shipPersonaGatePaths()],
      traceWrites: buildShipStageTraceabilityPayloads(
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        workspace,
        result,
        {
          outcome: 'blocked',
          error: message,
          local_ship_persona_result: localShipPersonaResult,
          learning_candidates_path: null,
          learnings_recorded: false,
          status: {
            ...shipStatusTracePayload(status),
          },
        },
      ),
      status,
      mirrorWorkspace: workspace,
      ledger: (() => {
        const next = clearShipLearningArtifactIndex(nextLedger(ledgerWithExecution, previousStage, 'blocked', startedAt, ctx.via));
        next.artifact_index[completionAdvisorPath] = artifactPointerFor(completionAdvisorPath);
        return next;
      })(),
      conflicts: [conflict, ...localShipPersonaResult.conflict_candidates, ...result.conflict_candidates],
    });

    throw new Error(message);
  }

  const localShipPersonaRaw = localShipPersonaResult?.raw_output as LocalExecuteShipPersonasRaw | null | undefined;
  const localShipPersonaGates = collectLocalShipPersonaGates(localShipPersonaRaw ?? null);
  const localPersonaShip = buildLocalPersonaShipStatus(localShipPersonaGates);
  const localPersonaMergeReady = localShipPersonaGatePassed(localShipPersonaGates);
  const finalMergeReady = result.raw_output.merge_ready && localPersonaMergeReady;
  const checklist = {
    ...augmentChecklist(
    result.raw_output.checklist,
    designImpact,
    designContractPath,
    designVerified,
    perfVerificationPath,
    ),
    merge_ready: finalMergeReady,
    local_persona_ship: localPersonaShip,
  };
  const learningCandidatesRecord = buildShipLearningCandidatesRecord(
    ledger.run_id,
    startedAt,
    result.raw_output.learning_candidates,
  );
  const deployReadiness = resolveDeployReadiness(ctx.cwd, ledger.run_id, startedAt);
  const localShipPersonaReleaseGateRecord = localShipPersonaRaw?.release_gate_record?.trim();
  const releaseGateRecord = `${result.raw_output.release_gate_record.trimEnd()}${designVerificationSummary(
    designImpact,
    designContractPath,
    designVerified,
  )}${perfVerificationSummary(perfVerificationPath)}${localShipPersonaReleaseGateRecord ? `\n${localShipPersonaReleaseGateRecord}\n` : ''}`;
  const pullRequest = await resolveShipPullRequest(workspace.path, finalMergeReady, ctx.run_command);
  const shipReady = finalMergeReady && pullRequestHandoffReady(pullRequest);
  const errors = [
    ...shipErrors(result.raw_output.merge_ready, localPersonaMergeReady),
    ...pullRequestErrors(pullRequest),
  ];
  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'ship',
    ...executionFieldsFromLedger(ledgerWithExecution),
    design_impact: designImpact,
    design_contract_path: designContractPath,
    design_verified: designVerified,
    deploy_configured: deployReadiness.configured,
    deploy_config_source: deployReadiness.source,
    deploy_contract_path: deployReadiness.contract_path,
    state: 'completed',
    decision: 'ship_recorded',
    ready: shipReady,
    inputs: predecessorArtifacts,
    outputs: [
      artifactPointerFor(releaseGateRecordPath),
      artifactPointerFor(checklistPath),
      artifactPointerFor(deployReadinessPath),
      artifactPointerFor(pullRequestPath),
      ...localShipPersonaGates.map((gate) => artifactPointerFor(shipPersonaGatePath(gate.role))),
      ...(learningCandidatesRecord ? [artifactPointerFor(learningCandidatesPath)] : []),
      artifactPointerFor(completionAdvisorPath),
      artifactPointerFor(statusPath),
    ],
    started_at: startedAt,
    completed_at: startedAt,
    errors,
    workspace,
    pull_request: pullRequest,
    learning_candidates_path: learningCandidatesRecord ? learningCandidatesPath : null,
    learnings_recorded: Boolean(learningCandidatesRecord),
    local_persona_ship: localPersonaShip,
  };
  const next = nextLedger(ledgerWithExecution, previousStage, shipReady ? 'active' : 'blocked', startedAt, ctx.via);
  const completionAdvisor = buildShipCompletionAdvisor(status, verificationMatrix, deployReadiness, startedAt);
  next.artifact_index = {
    ...next.artifact_index,
    [releaseGateRecordPath]: artifactPointerFor(releaseGateRecordPath),
    [checklistPath]: artifactPointerFor(checklistPath),
    [deployReadinessPath]: artifactPointerFor(deployReadinessPath),
    [pullRequestPath]: artifactPointerFor(pullRequestPath),
    ...Object.fromEntries(localShipPersonaGates.map((gate) => {
      const path = shipPersonaGatePath(gate.role);
      return [path, artifactPointerFor(path)];
    })),
    ...(learningCandidatesRecord ? { [learningCandidatesPath]: artifactPointerFor(learningCandidatesPath) } : {}),
    [completionAdvisorPath]: artifactPointerFor(completionAdvisorPath),
    [statusPath]: artifactPointerFor(statusPath),
  };
  if (!learningCandidatesRecord) {
    delete next.artifact_index[learningCandidatesPath];
  }
  if (localShipPersonaGates.length === 0) {
    for (const path of shipPersonaGatePaths()) {
      delete next.artifact_index[path];
    }
  }

  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage: 'ship',
    statusPath,
    canonicalWrites: [
      { path: releaseGateRecordPath, content: `${releaseGateRecord}\n` },
      { path: checklistPath, content: JSON.stringify(checklist, null, 2) + '\n' },
      { path: deployReadinessPath, content: JSON.stringify(deployReadiness, null, 2) + '\n' },
      { path: pullRequestPath, content: JSON.stringify(pullRequest, null, 2) + '\n' },
      ...localShipPersonaGates.map((gate) => ({
        path: shipPersonaGatePath(gate.role),
        content: `${gate.markdown.trimEnd()}\n`,
      })),
      ...(learningCandidatesRecord
        ? [{ path: learningCandidatesPath, content: JSON.stringify(learningCandidatesRecord, null, 2) + '\n' }]
        : []),
      buildCompletionAdvisorWrite(completionAdvisor, { verificationMatrix, cwd: ctx.cwd }),
    ],
    removeWrites: [
      ...(localShipPersonaGates.length > 0 ? [] : shipPersonaGatePaths()),
      ...(learningCandidatesRecord ? [] : [learningCandidatesPath]),
    ],
    traceWrites: buildShipStageTraceabilityPayloads(
      ledger.run_id,
      predecessorArtifacts.map((artifact) => artifact.path),
      workspace,
      result,
      {
        outcome: 'success',
        canonical_paths: [
          releaseGateRecordPath,
          checklistPath,
          deployReadinessPath,
          pullRequestPath,
          ...localShipPersonaGates.map((gate) => shipPersonaGatePath(gate.role)),
          ...(learningCandidatesRecord ? [learningCandidatesPath] : []),
          completionAdvisorPath,
        ],
        learning_candidates_path: learningCandidatesRecord ? learningCandidatesPath : null,
        learnings_recorded: Boolean(learningCandidatesRecord),
        deploy_readiness_path: deployReadinessPath,
        deploy_readiness: deployReadiness,
        status: shipStatusTracePayload(status),
        pull_request: pullRequest,
        checklist,
        local_ship_persona_result: localShipPersonaResult,
      },
    ),
    status,
    mirrorWorkspace: workspace,
    ledger: next,
  });

  return { command: 'ship', status, completion_advisor: completionAdvisor };
}
