import { CANONICAL_MANIFEST } from '../command-manifest';
import { currentAuditPointer, stageStatusPath } from '../artifacts';
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
import { readStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { CcbExecuteAuditRaw } from '../adapters/ccb';
import type { SuperpowersReviewDisciplineRaw } from '../adapters/superpowers';
import type {
  ArtifactPointer,
  ConflictRecord,
  ReviewMetaRecord,
  RunLedger,
  StageStatus,
} from '../types';
import type { CommandContext, CommandResult } from './index';

type AtomicWriteFile = (cwd: string, relativePath: string, content: string) => void;

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
    previous_stage: 'build',
    current_command: 'review',
    current_stage: 'review',
    allowed_next_stages: status === 'active' ? getAllowedNextStages('review') : [],
    command_history: [...ledger.command_history, { command: 'review', at, via }],
  };
}

function blockedReviewStatus(
  runId: string,
  startedAt: string,
  inputs: ArtifactPointer[],
  outputs: ArtifactPointer[],
  requestedRoute: StageStatus['requested_route'],
  actualRoute: StageStatus['actual_route'],
  error: string,
  state: 'blocked' | 'refused' = 'blocked',
): StageStatus {
  return {
    run_id: runId,
    stage: 'review',
    state,
    decision: state === 'refused' ? 'refused' : 'audit_recorded',
    ready: false,
    inputs,
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [error],
    requested_route: requestedRoute,
    actual_route: actualRoute,
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

export async function runReviewWithWriteAtomicFile(
  ctx: CommandContext,
  writeAtomicFile?: AtomicWriteFile,
): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const buildStatusPath = stageStatusPath('build');
  const buildStatus = readStageStatus(buildStatusPath, ctx.cwd);

  if (!ledger || !buildStatus?.ready) {
    throw new Error('Build must be completed before review');
  }

  assertSameRunId(ledger.run_id, buildStatus.run_id, 'build status');
  assertLegalTransition(ledger.current_stage, 'review');

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
  const predecessorArtifacts = [artifactPointerFor(buildStatusPath)];
  const requestedRoute = buildStatus.requested_route;
  const actualRoute = buildStatus.actual_route;
  const reviewStatusPath = stageStatusPath('review');
  const codexPath = '.planning/audits/current/codex.md';
  const geminiPath = '.planning/audits/current/gemini.md';
  const synthesisPath = '.planning/audits/current/synthesis.md';
  const gateDecisionPath = '.planning/audits/current/gate-decision.md';
  const metaPath = '.planning/audits/current/meta.json';

  const disciplineResult = await ctx.adapters.superpowers.review_discipline({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'review',
    stage: 'review',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.superpowers.review_discipline>> & {
    raw_output: SuperpowersReviewDisciplineRaw;
  };

  if (disciplineResult.outcome !== 'success') {
    const message = disciplineResult.outcome === 'refused'
      ? 'Superpowers review discipline refused review'
      : 'Superpowers review discipline blocked review';
    const status = blockedReviewStatus(
      ledger.run_id,
      startedAt,
      predecessorArtifacts,
      [artifactPointerFor(reviewStatusPath)],
      requestedRoute,
      actualRoute,
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
      traceWrites: buildReviewTraceabilityPayloads(
        ledger.run_id,
        [buildStatusPath],
        requestedRoute,
        disciplineResult,
        null,
        null,
        {
          outcome: disciplineResult.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(
        ledger,
        disciplineResult.outcome === 'refused' ? 'refused' : 'blocked',
        startedAt,
        ctx.via,
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
      ledger.run_id,
      startedAt,
      predecessorArtifacts,
      [artifactPointerFor(reviewStatusPath)],
      requestedRoute,
      actualRoute,
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
      traceWrites: buildReviewTraceabilityPayloads(
        ledger.run_id,
        [buildStatusPath],
        requestedRoute,
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
      ledger: nextLedger(ledger, 'blocked', startedAt, ctx.via),
      conflicts: [conflict, ...disciplineResult.conflict_candidates],
      writeAtomicFile,
    });

    throw new Error(message);
  }

  const auditAResult = await ctx.adapters.ccb.execute_audit_a({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'review',
    stage: 'review',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.ccb.execute_audit_a>> & { raw_output: CcbExecuteAuditRaw };
  const auditBResult = await ctx.adapters.ccb.execute_audit_b({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'review',
    stage: 'review',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: requestedRoute,
  }) as Awaited<ReturnType<typeof ctx.adapters.ccb.execute_audit_b>> & { raw_output: CcbExecuteAuditRaw };

  for (const [label, result] of [
    ['codex', auditAResult] as const,
    ['gemini', auditBResult] as const,
  ]) {
    if (result.outcome !== 'success') {
      const message = result.outcome === 'refused'
        ? `CCB ${label} audit refused review`
        : `CCB ${label} audit blocked review`;
      const status = blockedReviewStatus(
        ledger.run_id,
        startedAt,
        predecessorArtifacts,
        [artifactPointerFor(reviewStatusPath)],
        requestedRoute,
        actualRoute,
        message,
        result.outcome === 'refused' ? 'refused' : 'blocked',
      );
      const conflict: ConflictRecord = {
        stage: 'review',
        adapter: 'ccb',
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
        traceWrites: buildReviewTraceabilityPayloads(
          ledger.run_id,
          [buildStatusPath],
          requestedRoute,
          disciplineResult,
          auditAResult,
          auditBResult,
          {
            outcome: result.outcome,
            status: { state: status.state, decision: status.decision, ready: status.ready },
          },
        ),
        status,
        ledger: nextLedger(ledger, result.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via),
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
      ledger.run_id,
      startedAt,
      predecessorArtifacts,
      [artifactPointerFor(reviewStatusPath)],
      requestedRoute,
      actualRoute,
      message,
    );
    const conflict: ConflictRecord = {
      stage: 'review',
      adapter: 'ccb',
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
      traceWrites: buildReviewTraceabilityPayloads(
        ledger.run_id,
        [buildStatusPath],
        requestedRoute,
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
      ledger: nextLedger(ledger, 'blocked', startedAt, ctx.via),
      conflicts: [conflict, ...auditAResult.conflict_candidates, ...auditBResult.conflict_candidates],
      writeAtomicFile,
    });

    throw new Error(message);
  }

  const codexMarkdown = auditAResult.raw_output.markdown;
  const geminiMarkdown = auditBResult.raw_output.markdown;
  assertNonEmptyMarkdown(codexMarkdown, 'Codex audit');
  assertNonEmptyMarkdown(geminiMarkdown, 'Gemini audit');

  const synthesisMarkdown = buildReviewSynthesisMarkdown(disciplineSummary, codexMarkdown, geminiMarkdown);
  const gateDecisionMarkdown = buildReviewGateDecisionMarkdown('pass');
  const meta: ReviewMetaRecord = {
    run_id: ledger.run_id,
    implementation_provider: 'codex',
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
        provider: 'codex',
        path: codexPath,
        requested_route: requestedCodexRoute,
        actual_route: auditAResult.actual_route,
      },
      gemini: {
        provider: 'gemini',
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
      provider: 'codex',
      path: codexPath,
      route: requestedCodexRoute.route,
      substrate: requestedCodexRoute.substrate,
    },
    gemini_audit: {
      provider: 'gemini',
      path: geminiPath,
      route: requestedGeminiRoute.route,
      substrate: requestedGeminiRoute.substrate,
    },
    pm_skill: 'frame',
    execution_skill_chain: ['plan', 'handoff', 'build', 'review'],
    lifecycle_stage: 'review',
    handoff_from: '.planning/current/handoff/governed-handoff.md',
    handoff_to: '.planning/audits/current/',
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
    state: 'completed',
    decision: 'audit_recorded',
    ready: true,
    inputs: predecessorArtifacts,
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
    requested_route: requestedRoute,
    actual_route: actualRoute,
    review_complete: true,
    audit_set_complete: true,
    provenance_consistent: true,
    gate_decision: 'pass',
    archive_required: gateRequiresArchive(gateDecisionMarkdown),
    archive_state: gateRequiresArchive(gateDecisionMarkdown) ? 'pending' : 'not_required',
  };
  const next = nextLedger(ledger, 'active', startedAt, ctx.via);
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
    ledger: next,
    writeAtomicFile,
  });

  return { command: 'review', status };
}

export async function runReview(ctx: CommandContext): Promise<CommandResult> {
  return runReviewWithWriteAtomicFile(ctx);
}
