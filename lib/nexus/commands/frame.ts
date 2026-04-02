import { existsSync } from 'fs';
import { join } from 'path';
import { readLedger, startLedger, makeRunId } from '../ledger';
import { CANONICAL_MANIFEST } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
import { applyNormalizationPlan } from '../normalizers';
import { canonicalNextStages, normalizePmFrame, buildPmTraceabilityPayloads } from '../normalizers/pm';
import { assertLegalTransition } from '../transitions';
import type { PmFrameRaw } from '../adapters/pm';
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
    previous_stage: ledger.current_stage === 'frame' ? ledger.previous_stage : ledger.current_stage,
    current_command: 'frame',
    current_stage: 'frame',
    allowed_next_stages: status === 'active' ? canonicalNextStages('frame') : [],
    command_history: [...ledger.command_history, { command: 'frame', at, via }],
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
    stage: 'frame',
    state,
    decision,
    ready,
    inputs: [artifactPointerFor('docs/product/idea-brief.md')],
    outputs: ready
      ? [
          artifactPointerFor('docs/product/decision-brief.md'),
          artifactPointerFor('docs/product/prd.md'),
          artifactPointerFor(stageStatusPath('frame')),
        ]
      : [artifactPointerFor(stageStatusPath('frame'))],
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

  const ledger = existingLedger ?? startLedger(makeRunId(ctx.clock), 'frame');
  const at = ctx.clock();
  const manifest = CANONICAL_MANIFEST.frame;
  const requestPayload = {
    adapter: 'pm',
    stage: 'frame',
    contract_outputs: manifest.durable_outputs,
  };

  if (!inputExists) {
    const status = buildStatus(
      ledger.run_id,
      at,
      'blocked',
      'not_ready',
      false,
      [`Missing required input artifact: ${inputPath}`],
    );
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [],
      traceWrites: [],
      status,
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
    });
    throw new Error(`Missing required input artifact: ${inputPath}`);
  }

  const result = await ctx.adapters.pm.frame({
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: 'frame',
    stage: 'frame',
    ledger,
    manifest,
    predecessor_artifacts: [artifactPointerFor(inputPath)],
    requested_route: null,
  }) as Awaited<ReturnType<typeof ctx.adapters.pm.frame>> & { raw_output: PmFrameRaw };

  if (result.outcome === 'refused') {
    const status = buildStatus(ledger.run_id, at, 'refused', 'refused', false, ['PM framing refused']);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [],
      traceWrites: buildPmTraceabilityPayloads(
        'frame',
        ledger.run_id,
        [inputPath],
        requestPayload,
        result,
        { outcome: 'refused', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      ledger: nextLedger(ledger, 'refused', at, ctx.via),
    });
    throw new Error('PM framing refused');
  }

  if (result.outcome !== 'success') {
    const status = buildStatus(ledger.run_id, at, 'blocked', 'not_ready', false, ['PM framing blocked']);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [],
      traceWrites: buildPmTraceabilityPayloads(
        'frame',
        ledger.run_id,
        [inputPath],
        requestPayload,
        result,
        { outcome: 'blocked', status: { state: status.state, decision: status.decision, ready: status.ready } },
      ),
      status,
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
    });
    throw new Error('PM framing blocked');
  }

  try {
    const normalized = normalizePmFrame(result);
    const status = buildStatus(ledger.run_id, at, 'completed', 'ready', true, []);
    const next = nextLedger(ledger, 'active', at, ctx.via);
    next.artifact_index = {
      ...next.artifact_index,
      'docs/product/decision-brief.md': artifactPointerFor('docs/product/decision-brief.md'),
      'docs/product/prd.md': artifactPointerFor('docs/product/prd.md'),
      [stageStatusPath('frame')]: artifactPointerFor(stageStatusPath('frame')),
    };

    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: normalized.canonicalWrites,
      traceWrites: buildPmTraceabilityPayloads(
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
      ledger: next,
    });

    return { command: 'frame', status };
  } catch (error) {
    const conflict: ConflictRecord = {
      stage: 'frame',
      adapter: 'pm',
      kind: 'backend_conflict',
      message: error instanceof Error ? error.message : String(error),
      canonical_paths: [
        'docs/product/decision-brief.md',
        'docs/product/prd.md',
        stageStatusPath('frame'),
      ],
      trace_paths: [
        '.planning/current/frame/adapter-request.json',
        '.planning/current/frame/adapter-output.json',
        '.planning/current/frame/normalization.json',
      ],
    };
    const status = buildStatus(ledger.run_id, at, 'blocked', 'not_ready', false, ['Canonical writeback failed']);
    await applyNormalizationPlan({
      cwd: ctx.cwd,
      stage: 'frame',
      statusPath: stageStatusPath('frame'),
      canonicalWrites: [],
      traceWrites: buildPmTraceabilityPayloads(
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
      ledger: nextLedger(ledger, 'blocked', at, ctx.via),
      conflicts: [conflict],
    });
    throw error;
  }
}
