import { CANONICAL_MANIFEST } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
import { applyNormalizationPlan } from '../normalizers';
import { buildGsdTraceabilityPayloads, normalizeGsdPlan } from '../normalizers/gsd';
import { makeRunId, readLedger, startLedger } from '../ledger';
import type { GsdPlanRaw } from '../adapters/gsd';
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
    previous_stage: ledger.current_stage === 'plan' ? ledger.previous_stage : ledger.current_stage,
    current_command: 'plan',
    current_stage: 'plan',
    allowed_next_stages: status === 'active' ? ['handoff'] : [],
    command_history: [...ledger.command_history, { command: 'plan', at, via }],
  };
}

export async function runPlan(ctx: CommandContext): Promise<CommandResult> {
  const existingLedger = readLedger(ctx.cwd);
  const runId = existingLedger?.run_id ?? makeRunId(ctx.clock);
  const ledger = existingLedger ?? startLedger(runId, 'plan');
  const startedAt = ctx.clock();
  const statusPath = stageStatusPath('plan');
  const manifest = CANONICAL_MANIFEST.plan;
  const result = await ctx.adapters.gsd.plan({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'plan',
    stage: 'plan',
    ledger,
    manifest,
    predecessor_artifacts: [],
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.gsd.plan>> & { raw_output: GsdPlanRaw };

  if (result.outcome !== 'success') {
    const status: StageStatus = {
      run_id: runId,
      stage: 'plan',
      state: result.outcome === 'refused' ? 'refused' : 'blocked',
      decision: result.outcome === 'refused' ? 'refused' : 'not_ready',
      ready: false,
      inputs: [],
      outputs: [artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [result.outcome === 'refused' ? 'GSD planning refused' : 'GSD planning blocked'],
    };
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'plan',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildGsdTraceabilityPayloads(
        'plan',
        runId,
        [],
        { adapter: 'gsd', stage: 'plan', contract_outputs: manifest.durable_outputs },
        result,
        {
          outcome: result.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledger, result.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via),
    });
    throw new Error(result.outcome === 'refused' ? 'GSD planning refused' : 'GSD planning blocked');
  }

  try {
    const normalized = normalizeGsdPlan(result);
    const status: StageStatus = {
      run_id: runId,
      stage: 'plan',
      state: result.raw_output.ready ? 'completed' : 'blocked',
      decision: result.raw_output.ready ? 'ready' : 'not_ready',
      ready: result.raw_output.ready,
      inputs: [],
      outputs: [
        artifactPointerFor('.planning/current/plan/execution-readiness-packet.md'),
        artifactPointerFor('.planning/current/plan/sprint-contract.md'),
        artifactPointerFor(statusPath),
      ],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [],
    };

    const next = nextLedger(ledger, result.raw_output.ready ? 'active' : 'blocked', startedAt, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      '.planning/current/plan/execution-readiness-packet.md': artifactPointerFor(
        '.planning/current/plan/execution-readiness-packet.md',
      ),
      '.planning/current/plan/sprint-contract.md': artifactPointerFor('.planning/current/plan/sprint-contract.md'),
      [statusPath]: artifactPointerFor(statusPath),
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'plan',
      statusPath,
      canonicalWrites: normalized.canonicalWrites,
      traceWrites: buildGsdTraceabilityPayloads(
        'plan',
        runId,
        [],
        { adapter: 'gsd', stage: 'plan', contract_outputs: manifest.durable_outputs },
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

    if (!result.raw_output.ready) {
      throw new Error('Plan is not ready for execution');
    }

    return { command: 'plan', status };
  } catch (error) {
    if (error instanceof Error && error.message === 'Plan is not ready for execution') {
      throw error;
    }

    const conflict: ConflictRecord = {
      stage: 'plan',
      adapter: 'gsd',
      kind: 'backend_conflict',
      message: error instanceof Error ? error.message : String(error),
      canonical_paths: [
        '.planning/current/plan/execution-readiness-packet.md',
        '.planning/current/plan/sprint-contract.md',
        statusPath,
      ],
      trace_paths: [
        '.planning/current/plan/adapter-request.json',
        '.planning/current/plan/adapter-output.json',
        '.planning/current/plan/normalization.json',
      ],
    };
    const status: StageStatus = {
      run_id: runId,
      stage: 'plan',
      state: 'blocked',
      decision: 'not_ready',
      ready: false,
      inputs: [],
      outputs: [artifactPointerFor(statusPath)],
      started_at: startedAt,
      completed_at: startedAt,
      errors: ['Canonical writeback failed'],
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'plan',
      statusPath,
      canonicalWrites: [],
      traceWrites: buildGsdTraceabilityPayloads(
        'plan',
        runId,
        [],
        { adapter: 'gsd', stage: 'plan', contract_outputs: manifest.durable_outputs },
        result,
        {
          outcome: 'blocked',
          error: error instanceof Error ? error.message : String(error),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      ledger: nextLedger(ledger, 'blocked', startedAt, ctx.via),
      conflicts: [conflict],
    });
    throw error;
  }
}
