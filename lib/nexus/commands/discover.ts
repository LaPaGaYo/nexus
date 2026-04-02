import { writeLedger, readLedger, startLedger, makeRunId } from '../ledger';
import { writeStageStatus } from '../status';
import { CANONICAL_MANIFEST } from '../command-manifest';
import { applyNormalizationPlan } from '../normalizers';
import { stageStatusPath } from '../artifacts';
import { canonicalNextStages, normalizePmDiscover, buildPmTraceabilityPayloads } from '../normalizers/pm';
import type { PmDiscoverRaw } from '../adapters/pm';
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
    previous_stage: ledger.current_stage === 'discover' ? ledger.previous_stage : ledger.current_stage,
    current_command: 'discover',
    current_stage: 'discover',
    allowed_next_stages: status === 'active' ? canonicalNextStages('discover') : [],
    command_history: [...ledger.command_history, { command: 'discover', at, via }],
  };
}

function buildStatus(
  runId: string,
  at: string,
  state: StageStatus['state'],
  decision: StageStatus['decision'],
  ready: boolean,
  errors: string[],
): StageStatus {
  return {
    run_id: runId,
    stage: 'discover',
    state,
    decision,
    ready,
    inputs: [],
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
  const existingLedger = readLedger(ctx.cwd);
  if (existingLedger && existingLedger.current_stage !== 'discover') {
    throw new Error(`Illegal Nexus transition: ${existingLedger.current_stage} -> discover`);
  }

  const ledger = existingLedger ?? startLedger(makeRunId(ctx.clock), 'discover');
  const at = ctx.clock();
  const manifest = CANONICAL_MANIFEST.discover;
  const requestPayload = {
    adapter: 'pm',
    stage: 'discover',
    contract_outputs: manifest.durable_outputs,
  };
  const result = await ctx.adapters.pm.discover({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'discover',
    stage: 'discover',
    ledger,
    manifest,
    predecessor_artifacts: [],
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.pm.discover>> & { raw_output: PmDiscoverRaw };

  if (result.outcome === 'refused') {
    const status = buildStatus(ledger.run_id, at, 'refused', 'refused', false, ['PM discovery refused']);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [],
      traceWrites: buildPmTraceabilityPayloads(
        'discover',
        ledger.run_id,
        [],
        requestPayload,
        result,
        { outcome: 'refused', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      ledger: nextLedger(ledger, 'refused', at, ctx.via),
    });
    throw new Error('PM discovery refused');
  }

  if (result.outcome !== 'success') {
    const status = buildStatus(ledger.run_id, at, 'blocked', 'not_ready', false, ['PM discovery blocked']);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [],
      traceWrites: buildPmTraceabilityPayloads(
        'discover',
        ledger.run_id,
        [],
        requestPayload,
        result,
        { outcome: 'blocked', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
    });
    throw new Error('PM discovery blocked');
  }

  try {
    const normalized = normalizePmDiscover(result);
    const status = buildStatus(ledger.run_id, at, 'completed', 'ready', true, []);
    const next = nextLedger(ledger, 'active', at, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      'docs/product/idea-brief.md': artifactPointerFor('docs/product/idea-brief.md'),
      [stageStatusPath('discover')]: artifactPointerFor(stageStatusPath('discover')),
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: normalized.canonicalWrites,
      traceWrites: buildPmTraceabilityPayloads(
        'discover',
        ledger.run_id,
        [],
        requestPayload,
        result,
        {
          outcome: 'success',
          canonical_paths: normalized.canonicalWrites.map((write) => write.path),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
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
    const status = buildStatus(ledger.run_id, at, 'blocked', 'not_ready', false, ['Canonical writeback failed']);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'discover',
      statusPath: stageStatusPath('discover'),
      canonicalWrites: [],
      traceWrites: buildPmTraceabilityPayloads(
        'discover',
        ledger.run_id,
        [],
        requestPayload,
        result,
        {
          outcome: 'blocked',
          error: error instanceof Error ? error.message : String(error),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
      conflicts: [conflict],
    });
    throw error;
  }
}
