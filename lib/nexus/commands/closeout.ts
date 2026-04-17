import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CANONICAL_MANIFEST } from '../command-manifest';
import {
  closeoutLearningsJsonPath,
  closeoutLearningsMarkdownPath,
  closeoutNextRunBootstrapJsonPath,
  closeoutNextRunMarkdownPath,
  qaLearningCandidatesPath,
  reviewLearningCandidatesPath,
  shipLearningCandidatesPath,
  stageStatusPath,
} from '../artifacts';
import { executionFieldsFromLedger, withExecutionWorkspace } from '../execution-topology';
import {
  archiveAuditWorkspace,
  archiveExists,
  assertArchiveConsistency,
  assertCloseoutHistory,
  assertQaReadyForCloseout,
  assertReviewReadyForCloseout,
  assertSameRunId,
  assertShipReadyForCloseout,
  gateRequiresArchive,
} from '../governance';
import {
  collectRunLearnings,
  collectValidLearningCandidates,
  renderRunLearningsMarkdown,
} from '../learnings';
import { readLedger } from '../ledger';
import { buildGsdTraceabilityPayloads, normalizeGsdCloseout } from '../normalizers/gsd';
import { applyNormalizationPlan } from '../normalizers';
import { buildNextRunBootstrap, persistCloseoutBootstrap } from '../run-bootstrap';
import { readStageStatus } from '../status';
import { assertLegalTransition } from '../transitions';
import { retireRunWorkspace } from '../workspace-substrate';
import type { GsdCloseoutRaw } from '../adapters/gsd';
import type {
  ArtifactPointer,
  ConflictRecord,
  RunLedger,
  RunLearningsRecord,
  StageLearningCandidatesRecord,
  StageStatus,
} from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

type CloseoutLearningSource = {
  path: string;
  stage: 'review' | 'qa' | 'ship';
  candidates: StageLearningCandidatesRecord['candidates'];
};

function readLearningCandidatesSource(
  cwd: string,
  runId: string,
  path: string,
  stage: CloseoutLearningSource['stage'],
): CloseoutLearningSource | null {
  const absolutePath = join(cwd, path);
  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    const record = JSON.parse(readFileSync(absolutePath, 'utf8')) as Partial<StageLearningCandidatesRecord>;
    const candidates = collectValidLearningCandidates(record.candidates);
    if (
      record.schema_version !== 1
      || record.run_id !== runId
      || record.stage !== stage
      || candidates.length === 0
    ) {
      return null;
    }

    return {
      path,
      stage,
      candidates,
    };
  } catch {
    return null;
  }
}

function collectCloseoutLearningSources(cwd: string, runId: string): CloseoutLearningSource[] {
  return [
    readLearningCandidatesSource(cwd, runId, reviewLearningCandidatesPath(), 'review'),
    readLearningCandidatesSource(cwd, runId, qaLearningCandidatesPath(), 'qa'),
    readLearningCandidatesSource(cwd, runId, shipLearningCandidatesPath(), 'ship'),
  ].filter((source): source is CloseoutLearningSource => source !== null);
}

function clearCloseoutLearningArtifactIndex(ledger: RunLedger): RunLedger {
  const nextArtifactIndex = { ...ledger.artifact_index };
  delete nextArtifactIndex[closeoutLearningsMarkdownPath()];
  delete nextArtifactIndex[closeoutLearningsJsonPath()];

  return {
    ...ledger,
    artifact_index: nextArtifactIndex,
  };
}

export async function runCloseout(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const reviewStatusPath = stageStatusPath('review');
  const qaStatusPath = stageStatusPath('qa');
  const shipStatusPath = stageStatusPath('ship');
  const reviewStatus = readStageStatus(reviewStatusPath, ctx.cwd);
  const qaStatus = readStageStatus(qaStatusPath, ctx.cwd);
  const shipStatus = readStageStatus(shipStatusPath, ctx.cwd);

  if (!ledger || !reviewStatus) {
    throw new Error('Review must be completed before closeout');
  }

  assertSameRunId(ledger.run_id, reviewStatus.run_id, 'review status');
  if (qaStatus) {
    assertSameRunId(ledger.run_id, qaStatus.run_id, 'qa status');
  }
  if (shipStatus) {
    assertSameRunId(ledger.run_id, shipStatus.run_id, 'ship status');
  }
  assertLegalTransition(ledger.current_stage, 'closeout');
  assertCloseoutHistory(ledger, { qaRecorded: Boolean(qaStatus), shipRecorded: Boolean(shipStatus) });
  assertReviewReadyForCloseout(reviewStatus, ctx.cwd);
  assertQaReadyForCloseout(qaStatus);
  assertShipReadyForCloseout(shipStatus);

  const metaPath = '.planning/audits/current/meta.json';
  const gateDecisionPath = '.planning/audits/current/gate-decision.md';
  const meta = JSON.parse(readFileSync(join(ctx.cwd, metaPath), 'utf8')) as {
    run_id: string;
    execution_mode?: string;
    primary_provider?: string;
    provider_topology?: string;
    implementation_route?: string;
    implementation_substrate?: string;
    implementation?: {
      requested_route?: {
        generator?: string | null;
        substrate?: string | null;
      };
      actual_route?: {
        route?: string | null;
        substrate?: string | null;
      } | null;
    };
  };
  const gateDecisionMarkdown = readFileSync(join(ctx.cwd, gateDecisionPath), 'utf8');

  assertSameRunId(ledger.run_id, meta.run_id, 'reviewed provenance');

  if (meta.execution_mode && meta.execution_mode !== ledger.execution.mode) {
    throw new Error('Reviewed execution mode does not match ledger execution mode');
  }

  if (meta.primary_provider && meta.primary_provider !== ledger.execution.primary_provider) {
    throw new Error('Reviewed primary provider does not match ledger primary provider');
  }

  const reviewedGenerator = meta.implementation?.requested_route?.generator ?? meta.implementation_route;
  const reviewedSubstrate = meta.implementation?.requested_route?.substrate ?? meta.implementation_substrate;

  if (reviewedGenerator !== ledger.route_intent.generator) {
    throw new Error('Reviewed provenance route does not match ledger route intent');
  }

  if (reviewedSubstrate !== ledger.route_intent.substrate) {
    throw new Error('Reviewed provenance substrate does not match ledger route intent');
  }

  if (
    meta.implementation?.actual_route
    && (
      meta.implementation.actual_route.route !== reviewedGenerator
      || meta.implementation.actual_route.substrate !== reviewedSubstrate
    )
  ) {
    throw new Error('Reviewed actual route does not match reviewed requested route');
  }

  const archiveRequired = gateRequiresArchive(gateDecisionMarkdown);
  if (archiveRequired && archiveExists(ledger.run_id, ctx.cwd)) {
    assertArchiveConsistency(ledger.run_id, {
      ...reviewStatus,
      archive_required: true,
    }, ctx.cwd);
  }
  const archivePath = archiveRequired ? archiveAuditWorkspace(ledger.run_id, ctx.cwd) : null;
  assertArchiveConsistency(ledger.run_id, {
    ...reviewStatus,
    archive_required: archiveRequired,
  }, ctx.cwd);
  const startedAt = ctx.clock();
  const closeoutRecordPath = '.planning/current/closeout/CLOSEOUT-RECORD.md';
  const closeoutStatusPath = stageStatusPath('closeout');
  const closeoutBootstrapJson = closeoutNextRunBootstrapJsonPath();
  const closeoutBootstrapMarkdown = closeoutNextRunMarkdownPath();
  const closeoutLearningSources = collectCloseoutLearningSources(ctx.cwd, ledger.run_id);
  const closeoutLearningRecord: RunLearningsRecord | null = closeoutLearningSources.length > 0
    ? collectRunLearnings({
        runId: ledger.run_id,
        generatedAt: startedAt,
        candidates: closeoutLearningSources,
      })
    : null;
  const closeoutLearningMarkdown = closeoutLearningRecord
    ? renderRunLearningsMarkdown(closeoutLearningRecord)
    : null;
  const closeoutLearningInputs = closeoutLearningSources.map((source) => artifactPointerFor(source.path));
  const predecessorArtifacts = [
    artifactPointerFor(reviewStatusPath),
    ...closeoutLearningInputs.filter((artifact) => artifact.path === reviewLearningCandidatesPath()),
    ...(qaStatus ? [artifactPointerFor(qaStatusPath)] : []),
    ...closeoutLearningInputs.filter((artifact) => artifact.path === qaLearningCandidatesPath()),
    ...(shipStatus ? [artifactPointerFor(shipStatusPath)] : []),
    ...closeoutLearningInputs.filter((artifact) => artifact.path === shipLearningCandidatesPath()),
    artifactPointerFor(metaPath),
  ];
  const manifest = CANONICAL_MANIFEST.closeout;
  const result = await ctx.adapters.gsd.closeout({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'closeout',
    stage: 'closeout',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.gsd.closeout>> & { raw_output: GsdCloseoutRaw };

  if (result.outcome !== 'success') {
    const nextLedger = clearCloseoutLearningArtifactIndex({
      ...ledger,
      status: result.outcome === 'refused' ? 'refused' : 'blocked',
      current_command: 'closeout',
      current_stage: 'closeout',
      allowed_next_stages: [],
      command_history: [...ledger.command_history, { command: 'closeout', at: startedAt, via: ctx.via }],
    });
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'closeout',
      ...executionFieldsFromLedger(ledger),
      state: result.outcome === 'refused' ? 'refused' : 'blocked',
      decision: result.outcome === 'refused' ? 'refused' : 'closeout_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(closeoutStatusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [result.outcome === 'refused' ? 'GSD closeout refused' : 'GSD closeout blocked'],
      learnings_recorded: false,
      archive_required: archiveRequired,
      archive_state: archiveRequired ? 'archived' : 'not_required',
      provenance_consistent: true,
    };
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'closeout',
      statusPath: closeoutStatusPath,
      canonicalWrites: [],
      removeWrites: [closeoutLearningsMarkdownPath(), closeoutLearningsJsonPath()],
      traceWrites: buildGsdTraceabilityPayloads(
        'closeout',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        { adapter: 'gsd', stage: 'closeout', archive_path: archivePath },
        result,
        {
          outcome: result.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger,
    });
    throw new Error(result.outcome === 'refused' ? 'GSD closeout refused' : 'GSD closeout blocked');
  }

  try {
    const normalized = normalizeGsdCloseout(result);
    const bootstrap = buildNextRunBootstrap({
      ledger,
      reviewStatus,
      qaStatus,
      shipStatus,
      generatedAt: startedAt,
    });
    const bootstrapWrites = persistCloseoutBootstrap(ctx.cwd, bootstrap);
    const retiredWorkspace = retireRunWorkspace(ledger.execution.workspace);
    const ledgerWithRetiredWorkspace = retiredWorkspace ? withExecutionWorkspace(ledger, retiredWorkspace) : ledger;
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'closeout',
      ...executionFieldsFromLedger(ledgerWithRetiredWorkspace),
      state: result.raw_output.merge_ready ? 'completed' : 'blocked',
      decision: 'closeout_recorded',
      ready: result.raw_output.merge_ready,
      inputs: predecessorArtifacts,
      outputs: [
        artifactPointerFor(closeoutRecordPath),
        ...(closeoutLearningRecord
          ? [
              artifactPointerFor(closeoutLearningsMarkdownPath()),
              artifactPointerFor(closeoutLearningsJsonPath()),
            ]
          : []),
        artifactPointerFor(closeoutBootstrapMarkdown),
        artifactPointerFor(closeoutBootstrapJson),
        artifactPointerFor(closeoutStatusPath),
      ],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [],
      learnings_recorded: Boolean(closeoutLearningRecord),
      archive_required: archiveRequired,
      archive_state: archiveRequired ? 'archived' : 'not_required',
      provenance_consistent: true,
    };
    const nextLedger = {
      ...ledgerWithRetiredWorkspace,
      status: result.raw_output.merge_ready ? 'completed' : 'blocked',
      previous_stage: (shipStatus ? 'ship' : qaStatus ? 'qa' : 'review') as 'review' | 'qa' | 'ship',
      current_command: 'closeout' as const,
      current_stage: 'closeout' as const,
      allowed_next_stages: [],
      command_history: [...ledger.command_history, { command: 'closeout', at: startedAt, via: ctx.via }],
      artifact_index: {
        ...ledger.artifact_index,
        [closeoutRecordPath]: artifactPointerFor(closeoutRecordPath),
        ...(closeoutLearningRecord
          ? {
              [closeoutLearningsMarkdownPath()]: artifactPointerFor(closeoutLearningsMarkdownPath()),
              [closeoutLearningsJsonPath()]: artifactPointerFor(closeoutLearningsJsonPath()),
            }
          : {}),
        [closeoutBootstrapMarkdown]: artifactPointerFor(closeoutBootstrapMarkdown),
        [closeoutBootstrapJson]: artifactPointerFor(closeoutBootstrapJson),
        [closeoutStatusPath]: artifactPointerFor(closeoutStatusPath),
      },
    };
    if (!closeoutLearningRecord) {
      delete nextLedger.artifact_index[closeoutLearningsMarkdownPath()];
      delete nextLedger.artifact_index[closeoutLearningsJsonPath()];
    }

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'closeout',
      statusPath: closeoutStatusPath,
      canonicalWrites: [
        ...normalized.canonicalWrites,
        ...(closeoutLearningRecord
          ? [
              {
                path: closeoutLearningsMarkdownPath(),
                content: closeoutLearningMarkdown ?? '',
              },
              {
                path: closeoutLearningsJsonPath(),
                content: JSON.stringify(closeoutLearningRecord, null, 2) + '\n',
              },
            ]
          : []),
        ...bootstrapWrites,
      ],
      removeWrites: closeoutLearningRecord
        ? []
        : [closeoutLearningsMarkdownPath(), closeoutLearningsJsonPath()],
      traceWrites: buildGsdTraceabilityPayloads(
        'closeout',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        { adapter: 'gsd', stage: 'closeout', archive_path: archivePath },
        result,
        {
          outcome: 'success',
          canonical_paths: [
            ...normalized.canonicalWrites.map((write) => write.path),
            ...(closeoutLearningRecord
              ? [closeoutLearningsMarkdownPath(), closeoutLearningsJsonPath()]
              : []),
          ],
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger,
    });

    return { command: 'closeout', status };
  } catch (error) {
    const conflict: ConflictRecord = {
      stage: 'closeout',
      adapter: 'gsd',
      kind: 'backend_conflict',
      message: error instanceof Error ? error.message : String(error),
      canonical_paths: [closeoutRecordPath, closeoutStatusPath],
      trace_paths: [
        '.planning/current/closeout/adapter-request.json',
        '.planning/current/closeout/adapter-output.json',
        '.planning/current/closeout/normalization.json',
      ],
    };
    const status: StageStatus = {
      run_id: ledger.run_id,
      stage: 'closeout',
      ...executionFieldsFromLedger(ledger),
      state: 'blocked',
      decision: 'closeout_recorded',
      ready: false,
      inputs: predecessorArtifacts,
      outputs: [artifactPointerFor(closeoutStatusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: ['Canonical writeback failed'],
      learnings_recorded: false,
      archive_required: archiveRequired,
      archive_state: archiveRequired ? 'archived' : 'not_required',
      provenance_consistent: true,
    };
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'closeout',
      statusPath: closeoutStatusPath,
      canonicalWrites: [],
      removeWrites: [closeoutLearningsMarkdownPath(), closeoutLearningsJsonPath()],
      traceWrites: buildGsdTraceabilityPayloads(
        'closeout',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        { adapter: 'gsd', stage: 'closeout', archive_path: archivePath },
        result,
        {
          outcome: 'blocked',
          error: error instanceof Error ? error.message : String(error),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: clearCloseoutLearningArtifactIndex({
        ...ledger,
        status: 'blocked',
        current_command: 'closeout',
        current_stage: 'closeout',
        allowed_next_stages: [],
        command_history: [...ledger.command_history, { command: 'closeout', at: startedAt, via: ctx.via }],
      }),
      conflicts: [conflict],
    });
    throw error;
  }
}
