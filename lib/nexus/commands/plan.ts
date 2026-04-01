import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { stageStatusPath } from '../artifacts';
import { makeRunId, readLedger, startLedger, writeLedger } from '../ledger';
import { writeStageStatus } from '../status';
import { getAllowedNextStages } from '../transitions';
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

export async function runPlan(ctx: CommandContext): Promise<CommandResult> {
  const existingLedger = readLedger(ctx.cwd);
  const runId = existingLedger?.run_id ?? makeRunId(ctx.clock);
  const ledger = existingLedger ?? startLedger(runId, 'plan');
  const startedAt = ctx.clock();
  const planDir = join(ctx.cwd, '.planning', 'current', 'plan');
  const readinessPath = '.planning/current/plan/execution-readiness-packet.md';
  const sprintContractPath = '.planning/current/plan/sprint-contract.md';
  const statusPath = stageStatusPath('plan');

  mkdirSync(planDir, { recursive: true });
  writeRepoFile(
    ctx.cwd,
    readinessPath,
    '# Execution Readiness Packet\n\nStatus: ready\n\nScope: governed thin slice\n',
  );
  writeRepoFile(
    ctx.cwd,
    sprintContractPath,
    '# Sprint Contract\n\nScope: governed thin slice\n\nVerification: review then closeout\n',
  );

  const outputs = [
    artifactPointerFor(readinessPath),
    artifactPointerFor(sprintContractPath),
    artifactPointerFor(statusPath),
  ];

  const status: StageStatus = {
    run_id: runId,
    stage: 'plan',
    state: 'completed',
    decision: 'ready',
    ready: true,
    inputs: [],
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
  };

  ledger.status = 'active';
  ledger.previous_stage = existingLedger?.current_stage ?? null;
  ledger.current_command = 'plan';
  ledger.current_stage = 'plan';
  ledger.allowed_next_stages = getAllowedNextStages('plan');
  ledger.command_history = [
    ...ledger.command_history,
    { command: 'plan', at: startedAt, via: ctx.via },
  ];
  ledger.artifact_index = {
    ...ledger.artifact_index,
    [readinessPath]: artifactPointerFor(readinessPath),
    [sprintContractPath]: artifactPointerFor(sprintContractPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  writeStageStatus(statusPath, status, ctx.cwd);
  writeLedger(ledger, ctx.cwd);

  return { command: 'plan', status };
}
