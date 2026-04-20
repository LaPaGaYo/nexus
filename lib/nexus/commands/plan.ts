import { CANONICAL_MANIFEST } from '../command-manifest';
import {
  planDesignContractPath,
  planVerificationMatrixPath,
  stageCompletionAdvisorPath,
  stageStatusPath,
} from '../artifacts';
import { executionFieldsFromLedger } from '../execution-topology';
import { applyNormalizationPlan } from '../normalizers';
import { buildGsdTraceabilityPayloads, normalizeGsdPlan } from '../normalizers/gsd';
import { makeRunId, readLedger, startLedger } from '../ledger';
import type { GsdPlanRaw } from '../adapters/gsd';
import type { ArtifactPointer, ConflictRecord, RunLedger, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';
import { readStageStatus } from '../status';
import { buildVerificationMatrix } from '../verification-matrix';
import { buildCompletionAdvisorWrite, buildPlanCompletionAdvisor } from '../completion-advisor';

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

function designContractPointerFromWrites(writes: Array<{ path: string }>): ArtifactPointer | null {
  return writes.some((write) => write.path === planDesignContractPath())
    ? artifactPointerFor(planDesignContractPath())
    : null;
}

function buildStatus(
  ledger: RunLedger,
  at: string,
  frameStatus: StageStatus | null,
  designContractPath: string | null,
  outputs: ArtifactPointer[],
  state: StageStatus['state'],
  decision: StageStatus['decision'],
  ready: boolean,
  errors: string[],
): StageStatus {
  const designImpact = frameStatus?.design_impact ?? 'none';

  return {
    run_id: ledger.run_id,
    stage: 'plan',
    ...executionFieldsFromLedger(ledger),
    design_impact: designImpact,
    design_contract_required: frameStatus?.design_contract_required ?? false,
    design_contract_path: designContractPath,
    design_verified: designImpact === 'none' ? null : false,
    state,
    decision,
    ready,
    inputs: [artifactPointerFor(stageStatusPath('frame'))],
    outputs,
    started_at: at,
    completed_at: at,
    errors,
  };
}

export async function runPlan(ctx: CommandContext): Promise<CommandResult> {
  const existingLedger = readLedger(ctx.cwd);
  const runId = existingLedger?.run_id ?? makeRunId(ctx.clock);
  const ledger = existingLedger ?? startLedger(runId, 'plan', ctx.execution);
  const startedAt = ctx.clock();
  const statusPath = stageStatusPath('plan');
  const frameStatus = readStageStatus(stageStatusPath('frame'), ctx.cwd);
  const manifest = CANONICAL_MANIFEST.plan;
  const planInputs = [artifactPointerFor(stageStatusPath('frame'))];
  const result = await ctx.adapters.gsd.plan({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'plan',
    stage: 'plan',
    ledger,
    manifest,
    predecessor_artifacts: planInputs,
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.gsd.plan>> & { raw_output: GsdPlanRaw };

  if (result.outcome !== 'success') {
    const status = buildStatus(
      ledger,
      startedAt,
      frameStatus,
      null,
      [artifactPointerFor(stageCompletionAdvisorPath('plan')), artifactPointerFor(statusPath)],
      result.outcome === 'refused' ? 'refused' : 'blocked',
      result.outcome === 'refused' ? 'refused' : 'not_ready',
      false,
      [result.outcome === 'refused' ? 'GSD planning refused' : 'GSD planning blocked'],
    );
    const completionAdvisor = buildPlanCompletionAdvisor(status, null, startedAt);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'plan',
      statusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor)],
      traceWrites: buildGsdTraceabilityPayloads(
        'plan',
        runId,
        [stageStatusPath('frame')],
        { adapter: 'gsd', stage: 'plan', contract_outputs: manifest.durable_outputs },
        result,
        {
          outcome: result.outcome,
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: nextLedger(ledger, result.outcome === 'refused' ? 'refused' : 'blocked', startedAt, ctx.via),
    });
    throw new Error(result.outcome === 'refused' ? 'GSD planning refused' : 'GSD planning blocked');
  }

  try {
    const normalized = normalizeGsdPlan(result);
    const verificationMatrix = buildVerificationMatrix(ctx.cwd, ledger.run_id, startedAt, 'full_acceptance');
    normalized.canonicalWrites.push({
      path: planVerificationMatrixPath(),
      content: JSON.stringify(verificationMatrix, null, 2) + '\n',
    });
    const designContractPointer = designContractPointerFromWrites(normalized.canonicalWrites);
    const designContractMissing = frameStatus?.design_impact === 'material' && !designContractPointer;
    const ready = result.raw_output.ready && !designContractMissing;
    const status = buildStatus(
      ledger,
      startedAt,
      frameStatus,
      designContractPointer?.path ?? null,
      [
        artifactPointerFor('.planning/current/plan/execution-readiness-packet.md'),
        artifactPointerFor('.planning/current/plan/sprint-contract.md'),
        artifactPointerFor(planVerificationMatrixPath()),
        ...(designContractPointer ? [designContractPointer] : []),
        artifactPointerFor(stageCompletionAdvisorPath('plan')),
        artifactPointerFor(statusPath),
      ],
      ready ? 'completed' : 'blocked',
      ready ? 'ready' : 'not_ready',
      ready,
      [],
    );
    const completionAdvisor = buildPlanCompletionAdvisor(status, verificationMatrix, startedAt);

    const next = nextLedger(ledger, ready ? 'active' : 'blocked', startedAt, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      '.planning/current/plan/execution-readiness-packet.md': artifactPointerFor(
        '.planning/current/plan/execution-readiness-packet.md',
      ),
      '.planning/current/plan/sprint-contract.md': artifactPointerFor('.planning/current/plan/sprint-contract.md'),
      [planVerificationMatrixPath()]: artifactPointerFor(planVerificationMatrixPath()),
      ...(designContractPointer ? { [designContractPointer.path]: designContractPointer } : {}),
      [stageCompletionAdvisorPath('plan')]: artifactPointerFor(stageCompletionAdvisorPath('plan')),
      [statusPath]: artifactPointerFor(statusPath),
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'plan',
      statusPath,
      canonicalWrites: [...normalized.canonicalWrites, buildCompletionAdvisorWrite(completionAdvisor)],
      traceWrites: buildGsdTraceabilityPayloads(
        'plan',
        runId,
        planInputs.map((input) => input.path),
        { adapter: 'gsd', stage: 'plan', contract_outputs: manifest.durable_outputs },
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

    if (!ready) {
      throw new Error('Plan is not ready for execution');
    }

    return { command: 'plan', status, completion_advisor: completionAdvisor };
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
        planVerificationMatrixPath(),
        statusPath,
      ],
      trace_paths: [
        '.planning/current/plan/adapter-request.json',
        '.planning/current/plan/adapter-output.json',
        '.planning/current/plan/normalization.json',
      ],
    };
    const status = buildStatus(
      ledger,
      startedAt,
      frameStatus,
      null,
      [artifactPointerFor(stageCompletionAdvisorPath('plan')), artifactPointerFor(statusPath)],
      'blocked',
      'not_ready',
      false,
      ['Canonical writeback failed'],
    );
    const completionAdvisor = buildPlanCompletionAdvisor(status, null, startedAt);

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'plan',
      statusPath,
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor)],
      traceWrites: buildGsdTraceabilityPayloads(
        'plan',
        runId,
        planInputs.map((input) => input.path),
        { adapter: 'gsd', stage: 'plan', contract_outputs: manifest.durable_outputs },
        result,
        {
          outcome: 'blocked',
          error: error instanceof Error ? error.message : String(error),
          status: { state: status.state, decision: status.decision, ready: status.ready },
        },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: nextLedger(ledger, 'blocked', startedAt, ctx.via),
      conflicts: [conflict],
    });
    throw error;
  }
}
