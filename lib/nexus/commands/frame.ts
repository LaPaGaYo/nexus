import { existsSync } from 'fs';
import { join } from 'path';
import { readLedger, startLedger, makeRunId } from '../governance/ledger';
import { CANONICAL_MANIFEST } from '../contracts/command-manifest';
import { executionFieldsFromLedger } from '../runtime/execution-topology';
import { frameDesignIntentPath, stageCompletionAdvisorPath, stageStatusPath } from '../io/artifacts';
import { applyNormalizationPlan } from '../normalizers';
import { canonicalNextStages, normalizeDiscoveryFrame, buildDiscoveryTraceabilityPayloads } from '../normalizers/discovery';
import { assertLegalTransition } from '../governance/transitions';
import type { DiscoveryFrameRaw } from '../adapters/discovery';
import type { ArtifactPointer, ConflictRecord, RunLedger, StageStatus } from '../contracts/types';
import type { CommandContext, CommandResult } from './index';
import { buildFrameCompletionAdvisor } from '../completion-advisor';
import { buildCompletionAdvisorWrite } from '../completion-advisor/writer';

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
    previous_stage: ledger.current_stage === 'frame' ? ledger.previous_stage : ledger.current_stage,
    current_command: 'frame',
    current_stage: 'frame',
    allowed_next_stages: status === 'active' ? canonicalNextStages('frame') : [],
    command_history: [...ledger.command_history, { command: 'frame', at, via }],
  };
}

function buildStatus(
  ledger: RunLedger,
  at: string,
  designIntent: DiscoveryFrameRaw['design_intent'] | null,
  state: StageStatus['state'],
  decision: StageStatus['decision'],
  ready: boolean,
  errors: string[],
): StageStatus {
  const designImpact = designIntent?.impact ?? 'none';
  return {
    run_id: ledger.run_id,
    stage: 'frame',
    ...executionFieldsFromLedger(ledger),
    design_impact: designImpact,
    design_contract_required: designIntent?.contract_required ?? false,
    design_verified: null,
    state,
    decision,
    ready,
    inputs: [artifactPointerFor('docs/product/idea-brief.md')],
    outputs: ready
      ? [
          artifactPointerFor('docs/product/decision-brief.md'),
          artifactPointerFor('docs/product/prd.md'),
          artifactPointerFor(frameDesignIntentPath()),
          artifactPointerFor(stageCompletionAdvisorPath('frame')),
          artifactPointerFor(stageStatusPath('frame')),
        ]
      : [artifactPointerFor(stageCompletionAdvisorPath('frame')), artifactPointerFor(stageStatusPath('frame'))],
    started_at: at,
    completed_at: at,
    errors,
  };
}

export async function runFrame(ctx: CommandContext): Promise<CommandResult> {
  const inputPath = 'docs/product/idea-brief.md';
  const inputExists = existsSync(join(ctx.cwd, inputPath));
  const existingLedger = readLedger(ctx.cwd);

  if (existingLedger) {
    assertLegalTransition(existingLedger.current_stage, 'frame');
  }

  const ledger = existingLedger ?? startLedger(makeRunId(ctx.clock), 'frame', ctx.execution);
  const at = ctx.clock();
  const manifest = CANONICAL_MANIFEST.frame;
  const requestPayload = {
    adapter: 'pm',
    stage: 'frame',
    contract_outputs: manifest.durable_outputs,
  };

  if (!inputExists) {
    const status = buildStatus(
      ledger,
      at,
      null,
      'blocked',
      'not_ready',
      false,
      [`Missing required input artifact: ${inputPath}`],
    );
    const completionAdvisor = buildFrameCompletionAdvisor(status, at);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { cwd: ctx.cwd })],
      traceWrites: [],
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
    });
    throw new Error(`Missing required input artifact: ${inputPath}`);
  }

  const result = await ctx.adapters.discovery.frame({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'frame',
    stage: 'frame',
    ledger,
    manifest,
    predecessor_artifacts: [artifactPointerFor(inputPath)],
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.discovery.frame>> & { raw_output: DiscoveryFrameRaw };

  if (result.outcome === 'refused') {
    const status = buildStatus(ledger, at, null, 'refused', 'refused', false, ['PM framing refused']);
    const completionAdvisor = buildFrameCompletionAdvisor(status, at);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { cwd: ctx.cwd })],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'frame',
        ledger.run_id,
        [inputPath],
        requestPayload,
        result,
        { outcome: 'refused', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: nextLedger(ledger, 'refused', at, ctx.via),
    });
    throw new Error('PM framing refused');
  }

  if (result.outcome !== 'success') {
    const status = buildStatus(ledger, at, null, 'blocked', 'not_ready', false, ['PM framing blocked']);
    const completionAdvisor = buildFrameCompletionAdvisor(status, at);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { cwd: ctx.cwd })],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'frame',
        ledger.run_id,
        [inputPath],
        requestPayload,
        result,
        { outcome: 'blocked', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      mirrorWorkspace: ledger.execution.workspace,
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
    });
    throw new Error('PM framing blocked');
  }

  try {
    const normalized = normalizeDiscoveryFrame(result);
    const status = buildStatus(ledger, at, result.raw_output.design_intent, 'completed', 'ready', true, []);
    const completionAdvisor = buildFrameCompletionAdvisor(status, at);
    const next = nextLedger(ledger, 'active', at, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      'docs/product/decision-brief.md': artifactPointerFor('docs/product/decision-brief.md'),
      'docs/product/prd.md': artifactPointerFor('docs/product/prd.md'),
      [frameDesignIntentPath()]: artifactPointerFor(frameDesignIntentPath()),
      [stageCompletionAdvisorPath('frame')]: artifactPointerFor(stageCompletionAdvisorPath('frame')),
      [stageStatusPath('frame')]: artifactPointerFor(stageStatusPath('frame')),
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [...normalized.canonicalWrites, buildCompletionAdvisorWrite(completionAdvisor, { cwd: ctx.cwd })],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'frame',
        ledger.run_id,
        [inputPath],
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

    return { command: 'frame', status, completion_advisor: completionAdvisor };
  } catch (error) {
    const conflict: ConflictRecord = {
      stage: 'frame',
      adapter: 'pm',
      kind: 'backend_conflict',
      message: error instanceof Error ? error.message : String(error),
      canonical_paths: [
        'docs/product/decision-brief.md',
        'docs/product/prd.md',
        frameDesignIntentPath(),
        stageCompletionAdvisorPath('frame'),
        stageStatusPath('frame'),
      ],
      trace_paths: [
        '.planning/current/frame/adapter-request.json',
        '.planning/current/frame/adapter-output.json',
        '.planning/current/frame/normalization.json',
      ],
    };
    const status = buildStatus(ledger, at, null, 'blocked', 'not_ready', false, ['Canonical writeback failed']);
    const completionAdvisor = buildFrameCompletionAdvisor(status, at);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [buildCompletionAdvisorWrite(completionAdvisor, { cwd: ctx.cwd })],
      traceWrites: buildDiscoveryTraceabilityPayloads(
        'frame',
        ledger.run_id,
        [inputPath],
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
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
      conflicts: [conflict],
    });
    throw error;
  }
}
