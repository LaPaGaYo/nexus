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

export async function runBuild(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const handoffStatusPath = stageStatusPath('handoff');
  const handoffStatus = readStageStatus(handoffStatusPath, ctx.cwd);

  if (!ledger || !handoffStatus?.ready) {
    throw new Error('Handoff must be completed before build');
  }

  assertSameRunId(ledger.run_id, handoffStatus.run_id, 'handoff status');
  assertLegalTransition(ledger.current_stage, 'build');

  const startedAt = ctx.clock();
  const buildDir = join(ctx.cwd, '.planning', 'current', 'build');
  const buildRequestPath = '.planning/current/build/build-request.json';
  const buildResultPath = '.planning/current/build/build-result.md';
  const statusPath = stageStatusPath('build');

  mkdirSync(buildDir, { recursive: true });
  writeRepoFile(
    ctx.cwd,
    buildRequestPath,
    JSON.stringify(
      {
        run_id: ledger.run_id,
        requested_route: {
          command: 'build',
          governed: true,
          generator: ledger.route_intent.generator,
          substrate: ledger.route_intent.substrate,
          fallback_policy: ledger.route_intent.fallback_policy,
        },
      },
      null,
      2,
    ) + '\n',
  );
  writeRepoFile(
    ctx.cwd,
    buildResultPath,
    '# Build Result\n\nStatus: ready for review\n\nVerification: pending governed review\n',
  );

  const outputs = [
    artifactPointerFor(buildRequestPath),
    artifactPointerFor(buildResultPath),
    artifactPointerFor(statusPath),
  ];

  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'build',
    state: 'completed',
    decision: 'build_recorded',
    ready: true,
    inputs: [artifactPointerFor(handoffStatusPath)],
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
  };

  ledger.status = 'active';
  ledger.previous_stage = 'handoff';
  ledger.current_command = 'build';
  ledger.current_stage = 'build';
  ledger.allowed_next_stages = getAllowedNextStages('build');
  ledger.command_history = [
    ...ledger.command_history,
    { command: 'build', at: startedAt, via: ctx.via },
  ];
  ledger.artifact_index = {
    ...ledger.artifact_index,
    [buildRequestPath]: artifactPointerFor(buildRequestPath),
    [buildResultPath]: artifactPointerFor(buildResultPath),
    [statusPath]: artifactPointerFor(statusPath),
  };

  writeStageStatus(statusPath, status, ctx.cwd);
  writeLedger(ledger, ctx.cwd);

  return { command: 'build', status };
}
