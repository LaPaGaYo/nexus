import {
  archiveCompletedRunLedger,
  isCompletedCloseoutLedger,
  makeRunId,
  readLedger,
  startLedger,
  writeLedger,
} from '../ledger';
import { CANONICAL_MANIFEST } from '../command-manifest';
import { executionFieldsFromLedger } from '../execution-topology';
import { applyNormalizationPlan } from '../normalizers';
import {
  discoverBootstrapJsonPath,
  discoverBootstrapMarkdownPath,
  discoverRetroContinuityJsonPath,
  discoverRetroContinuityMarkdownPath,
  discoverSessionContinuationAdvicePath,
  discoverSessionContinuationMarkdownPath,
  stageStatusPath,
} from '../artifacts';
import { canonicalNextStages, normalizeDiscoveryDiscover, buildDiscoveryTraceabilityPayloads } from '../normalizers/discovery';
import {
  discoverBootstrapSupportingContextArtifacts,
  resolveContinuationModeFromBootstrap,
  resetCurrentPlanningStateForFreshRun,
  seedDiscoverBootstrapFromArchivedRun,
} from '../run-bootstrap';
import {
  buildSessionContinuationAdvice,
  findLatestContextTransferArtifact,
  renderSessionContinuationMarkdown,
} from '../session-continuation-advice';
import {
  buildDiscoverRetroContinuity,
  renderDiscoverRetroContinuityMarkdown,
} from '../retro-archive';
import {
  allocateFreshRunWorkspace,
  cleanupRetiredRunWorkspace,
  resolveRepositoryRoot,
  resolveSessionRootRecord,
} from '../workspace-substrate';
import { readStageStatus, writeStageStatus } from '../status';
import type { DiscoveryDiscoverRaw } from '../adapters/discovery';
import type { ArtifactPointer, ConflictRecord, RunLedger, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function dedupeArtifacts(artifacts: ArtifactPointer[]): ArtifactPointer[] {
  return [...new Map(artifacts.map((artifact) => [artifact.path, artifact])).values()];
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
    previous_stage: ledger.current_stage === 'discover' ? ledger.previous_stage : ledger.current_stage,
    current_command: 'discover',
    current_stage: 'discover',
    allowed_next_stages: status === 'active' ? canonicalNextStages('discover') : [],
    command_history: [...ledger.command_history, { command: 'discover', at, via }],
  };
}

function buildStatus(
  ledger: RunLedger,
  at: string,
  state: StageStatus['state'],
  decision: StageStatus['decision'],
  ready: boolean,
  inputs: ArtifactPointer[],
  errors: string[],
): StageStatus {
  return {
    run_id: ledger.run_id,
    stage: 'discover',
    ...executionFieldsFromLedger(ledger),
    state,
    decision,
    ready,
    inputs,
    outputs: ready
      ? [
          artifactPointerFor('docs/product/idea-brief.md'),
          artifactPointerFor(stageStatusPath('discover')),
        ]
      : [artifactPointerFor(stageStatusPath('discover'))],
    started_at: at,
    completed_at: at,
    errors,
  };
}

export async function runDiscover(ctx: CommandContext): Promise<CommandResult> {
  const repositoryRoot = resolveRepositoryRoot(ctx.cwd);
  const existingLedger = readLedger(repositoryRoot);
  const requestedContinuationMode = ctx.continuation_mode_override ?? null;
  let predecessorArtifacts: ArtifactPointer[] = [];
  if (
    existingLedger
    && existingLedger.current_stage !== 'discover'
    && !isCompletedCloseoutLedger(existingLedger, repositoryRoot)
  ) {
    throw new Error(`Illegal Nexus transition: ${existingLedger.current_stage} -> discover`);
  }

  if (existingLedger && existingLedger.current_stage === 'closeout') {
    const finalizedWorkspace = cleanupRetiredRunWorkspace(repositoryRoot, existingLedger.execution.workspace);
    const archivedLedger = finalizedWorkspace
      ? {
        ...existingLedger,
        execution: {
          ...existingLedger.execution,
          workspace: finalizedWorkspace,
        },
      }
      : existingLedger;
    if (archivedLedger !== existingLedger) {
      writeLedger(archivedLedger, repositoryRoot);

      const closeoutStatus = readStageStatus(stageStatusPath('closeout'), repositoryRoot);
      if (closeoutStatus && closeoutStatus.run_id === archivedLedger.run_id) {
        writeStageStatus(
          stageStatusPath('closeout'),
          {
            ...closeoutStatus,
            workspace: archivedLedger.execution.workspace,
            session_root: archivedLedger.execution.session_root,
          },
          repositoryRoot,
        );
      }
    }
    archiveCompletedRunLedger(archivedLedger, repositoryRoot);
    resetCurrentPlanningStateForFreshRun(repositoryRoot);
    predecessorArtifacts = seedDiscoverBootstrapFromArchivedRun(repositoryRoot, archivedLedger.run_id);
  }

  const seededFromArchivedRun = predecessorArtifacts.some(
    (artifact) =>
      artifact.path === discoverBootstrapJsonPath()
      || artifact.path === discoverBootstrapMarkdownPath(),
  );

  const ledger = existingLedger && existingLedger.current_stage === 'discover'
    ? existingLedger
    : (() => {
      const freshRunId = makeRunId(ctx.clock);
      return startLedger(freshRunId, 'discover', ctx.execution, {
        continuationMode: requestedContinuationMode ?? resolveContinuationModeFromBootstrap(repositoryRoot),
        workspace: allocateFreshRunWorkspace(repositoryRoot, freshRunId),
        sessionRoot: resolveSessionRootRecord(repositoryRoot),
      });
    })();
  const at = ctx.clock();
  const retroContinuity = seededFromArchivedRun
    ? buildDiscoverRetroContinuity({
        cwd: repositoryRoot,
        runId: ledger.run_id,
        generatedAt: at,
      })
    : null;
  predecessorArtifacts = dedupeArtifacts([
    ...predecessorArtifacts,
    ...(retroContinuity?.sourceArtifacts ?? []),
  ]);
  const manifest = CANONICAL_MANIFEST.discover;
  const contextTransferArtifactPath = seededFromArchivedRun
    ? findLatestContextTransferArtifact(repositoryRoot)
    : null;
  const bootstrapSupportingContextArtifacts = seededFromArchivedRun
    ? discoverBootstrapSupportingContextArtifacts(repositoryRoot)
    : [];
  const requestPayload = {
    adapter: 'pm',
    stage: 'discover',
    continuation_mode: ledger.continuation_mode,
    requested_continuation_mode: requestedContinuationMode,
    effective_continuation_mode: ledger.continuation_mode,
    contract_outputs: manifest.durable_outputs,
  };
  const result = await ctx.adapters.discovery.discover({
    cwd: repositoryRoot,
    run_id: ledger.run_id,
    command: 'discover',
    stage: 'discover',
    ledger,
    manifest,
    predecessor_artifacts: predecessorArtifacts,
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.discovery.discover>> & { raw_output: DiscoveryDiscoverRaw };

  if (result.outcome === 'refused') {
    const status = buildStatus(ledger, at, 'refused', 'refused', false, predecessorArtifacts, ['PM discovery refused']);
    await applyNormalizationPlan({
      cwd: repositoryRoot,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'discover',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        requestPayload,
        result,
        { outcome: 'refused', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: {
        ...nextLedger(ledger, 'refused', at, ctx.via),
        artifact_index: {
          ...ledger.artifact_index,
          ...Object.fromEntries(
            predecessorArtifacts.map((artifact) => [artifact.path, artifact]),
          ),
        },
      },
    });
    throw new Error('PM discovery refused');
  }

  if (result.outcome !== 'success') {
    const status = buildStatus(ledger, at, 'blocked', 'not_ready', false, predecessorArtifacts, ['PM discovery blocked']);
    await applyNormalizationPlan({
      cwd: repositoryRoot,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'discover',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        requestPayload,
        result,
        { outcome: 'blocked', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: {
        ...nextLedger(ledger, 'blocked', at, ctx.via),
        artifact_index: {
          ...ledger.artifact_index,
          ...Object.fromEntries(
            predecessorArtifacts.map((artifact) => [artifact.path, artifact]),
          ),
        },
      },
    });
    throw new Error('PM discovery blocked');
  }

  try {
    const normalized = normalizeDiscoveryDiscover(result);
    const status = buildStatus(ledger, at, 'completed', 'ready', true, predecessorArtifacts, []);
    const next = nextLedger(ledger, 'active', at, ctx.via);
    const continuationAdvice = seededFromArchivedRun
      ? buildSessionContinuationAdvice({
          runId: ledger.run_id,
          boundaryKind: 'fresh_run_phase',
          continuationMode: ledger.continuation_mode,
          hostCompactSupported: false,
          contextTransferArtifactPath,
          supportingContextArtifacts: [
            ...bootstrapSupportingContextArtifacts,
            ...(retroContinuity
              ? [
                  discoverRetroContinuityJsonPath(),
                  discoverRetroContinuityMarkdownPath(),
                ]
              : []),
          ],
          recommendedNextCommand: '/frame',
          generatedAt: at,
        })
      : null;
    const retroContinuityArtifacts = retroContinuity?.outputArtifacts ?? [];
    const continuationAdviceArtifacts = continuationAdvice
      ? [
          artifactPointerFor(discoverSessionContinuationAdvicePath()),
          artifactPointerFor(discoverSessionContinuationMarkdownPath()),
        ]
      : [];
    next.artifact_index = {
      ...next.artifact_index,
      ...Object.fromEntries(
        predecessorArtifacts.map((artifact) => [artifact.path, artifact]),
      ),
      ...Object.fromEntries(
        retroContinuityArtifacts.map((artifact) => [artifact.path, artifact]),
      ),
      ...Object.fromEntries(
        continuationAdviceArtifacts.map((artifact) => [artifact.path, artifact]),
      ),
      'docs/product/idea-brief.md': artifactPointerFor('docs/product/idea-brief.md'),
      [stageStatusPath('discover')]: artifactPointerFor(stageStatusPath('discover')),
    };

    await applyNormalizationPlan({
      cwd: repositoryRoot,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [
        ...normalized.canonicalWrites,
        ...(retroContinuity
          ? [
              {
                path: discoverRetroContinuityJsonPath(),
                content: JSON.stringify(retroContinuity.record, null, 2) + '\n',
              },
              {
                path: discoverRetroContinuityMarkdownPath(),
                content: renderDiscoverRetroContinuityMarkdown(retroContinuity.record),
              },
            ]
          : []),
        ...(continuationAdvice
          ? [
              {
                path: discoverSessionContinuationAdvicePath(),
                content: JSON.stringify(continuationAdvice, null, 2) + '\n',
              },
              {
                path: discoverSessionContinuationMarkdownPath(),
                content: renderSessionContinuationMarkdown(continuationAdvice),
              },
            ]
          : []),
      ],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'discover',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        requestPayload,
        result,
        {
          outcome: 'success',
          canonical_paths: normalized.canonicalWrites.map((write) => write.path),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: next.execution.workspace,
      ledger: next,
    });

    return { command: 'discover', status };
  } catch (error) {
    const conflict: ConflictRecord = {
      stage: 'discover',
      adapter: 'pm',
      kind: 'backend_conflict',
      message: error instanceof Error ? error.message : String(error),
      canonical_paths: ['docs/product/idea-brief.md', stageStatusPath('discover')],
      trace_paths: [
        '.planning/current/discover/adapter-request.json',
        '.planning/current/discover/adapter-output.json',
        '.planning/current/discover/normalization.json',
      ],
    };
    const status = buildStatus(
      ledger,
      at,
      'blocked',
      'not_ready',
      false,
      predecessorArtifacts,
      ['Canonical writeback failed'],
    );
    await applyNormalizationPlan({
      cwd: repositoryRoot,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'discover',
        ledger.run_id,
        predecessorArtifacts.map((artifact) => artifact.path),
        requestPayload,
        result,
        {
          outcome: 'blocked',
          error: error instanceof Error ? error.message : String(error),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: {
        ...nextLedger(ledger, 'blocked', at, ctx.via),
        artifact_index: {
          ...ledger.artifact_index,
          ...Object.fromEntries(
            predecessorArtifacts.map((artifact) => [artifact.path, artifact]),
          ),
        },
      },
      conflicts: [conflict],
    });
    throw error;
  }
}
