import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stageStatusPath } from '../artifacts';
import { assertSameRunId } from '../governance';
import { readLedger, writeLedger } from '../ledger';
import { readStageStatus, writeStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { ArtifactPointer, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function writeRepoFile(cwd: string, relativePath: string, content: string): void {
  writeFileSync(join(cwd, relativePath), content);
}

export async function runHandoff(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const planStatusPath = stageStatusPath('plan');
  const planStatus = readStageStatus(planStatusPath, ctx.cwd);

  if (!ledger || !planStatus?.ready) {
    throw new Error('Plan must be completed and ready before handoff');
  }

  assertSameRunId(ledger.run_id, planStatus.run_id, 'plan status');
  assertLegalTransition(ledger.current_stage, 'handoff');

  const startedAt = ctx.clock();
  const handoffDir = join(ctx.cwd, '.planning', 'current', 'handoff');
  const routingPath = '.planning/current/handoff/governed-execution-routing.md';
  const handoffPath = '.planning/current/handoff/governed-handoff.md';
  const statusPath = stageStatusPath('handoff');

  mkdirSync(handoffDir, { recursive: true });
  writeRepoFile(
    ctx.cwd,
    routingPath,
    '# Governed Execution Routing\n\nGenerator: codex-via-ccb\n\nFallback: disabled\n',
  );
  writeRepoFile(
    ctx.cwd,
    handoffPath,
    '# Governed Handoff\n\nPlanner: claude+pm-gsd\n\nExecution substrate: superpowers-core\n',
  );

  const outputs = [
    artifactPointerFor(routingPath),
    artifactPointerFor(handoffPath),
    artifactPointerFor(statusPath),
  ];

  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'handoff',
    state: 'completed',
    decision: 'route_recorded',
    ready: true,
    inputs: [artifactPointerFor(planStatusPath)],
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
  };

  ledger.status = 'active';
  ledger.previous_stage = 'plan';
  ledger.current_command = 'handoff';
  ledger.current_stage = 'handoff';
  ledger.allowed_next_stages = getAllowedNextStages('handoff');
  ledger.command_history = [
    ...ledger.command_history,
    { command: 'handoff', at: startedAt, via: ctx.via },
  ];
  ledger.route_intent = {
    planner: 'claude+pm-gsd',
    generator: 'codex-via-ccb',
    evaluator_a: 'codex-via-ccb',
    evaluator_b: 'gemini-via-ccb',
    synthesizer: 'claude',
    substrate: 'superpowers-core',
    fallback_policy: 'disabled',
  };
  ledger.artifact_index = {
    ...ledger.artifact_index,
    [routingPath]: artifactPointerFor(routingPath),
    [handoffPath]: artifactPointerFor(handoffPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  writeStageStatus(statusPath, status, ctx.cwd);
  writeLedger(ledger, ctx.cwd);

  return { command: 'handoff', status };
}
