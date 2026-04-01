import { existsSync } from 'fs';
import { join } from 'path';
import { CANONICAL_MANIFEST, resolveCommandName } from '../command-manifest';
import { stageStatusPath } from '../artifacts';
import { makeRunId, readLedger, startLedger, writeLedger } from '../ledger';
import { writeStageStatus } from '../status';
import { PLACEHOLDER_OUTCOME, type ArtifactPointer, type CanonicalCommandId, type StageStatus } from '../types';
import { runBuild } from './build';
import { runCloseout } from './closeout';
import { runHandoff } from './handoff';
import { runPlan } from './plan';
import { runReview } from './review';

export interface CommandContext {
  cwd: string;
  clock: () => string;
  via: string | null;
}

export interface CommandResult {
  command: CanonicalCommandId;
  status: StageStatus;
}

interface CommandInvocation {
  command: CanonicalCommandId;
  via: string | null;
  handler: (ctx: CommandContext) => Promise<CommandResult>;
  contract: (typeof CANONICAL_MANIFEST)[CanonicalCommandId];
}

type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

export async function runPlaceholder(
  command: CanonicalCommandId,
  ctx: CommandContext,
): Promise<CommandResult> {
  const existingLedger = readLedger(ctx.cwd);
  const ledger = existingLedger ?? startLedger(makeRunId(ctx.clock), command);
  const contract = CANONICAL_MANIFEST[command];
  const startedAt = ctx.clock();
  const statusPointer = artifactPointerFor(stageStatusPath(command));
  const missingInputs = contract.required_inputs.filter((inputPath) => !existsSync(join(ctx.cwd, inputPath)));

  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: command,
    state: PLACEHOLDER_OUTCOME.state,
    decision: PLACEHOLDER_OUTCOME.decision,
    ready: PLACEHOLDER_OUTCOME.ready,
    inputs: contract.required_inputs.map(artifactPointerFor),
    outputs: [statusPointer],
    started_at: startedAt,
    completed_at: startedAt,
    errors: [
      ...missingInputs.map((inputPath) => `Missing required input artifact: ${inputPath}`),
      `${command} is not implemented in Nexus v0.1`,
    ],
  };

  ledger.status = 'blocked';
  ledger.previous_stage = existingLedger?.current_stage ?? null;
  ledger.current_command = command;
  ledger.current_stage = command;
  ledger.allowed_next_stages = [];
  ledger.command_history = [
    ...ledger.command_history,
    { command, at: startedAt, via: ctx.via },
  ];
  ledger.artifact_index = {
    ...ledger.artifact_index,
    [statusPointer.path]: statusPointer,
  };

  writeLedger(ledger, ctx.cwd);
  writeStageStatus(statusPointer.path, status, ctx.cwd);

  return { command, status };
}

const COMMAND_HANDLERS: Record<CanonicalCommandId, CommandHandler> = {
  discover: async (ctx) => runPlaceholder('discover', ctx),
  frame: async (ctx) => runPlaceholder('frame', ctx),
  plan: runPlan,
  handoff: runHandoff,
  build: runBuild,
  review: runReview,
  qa: async (ctx) => runPlaceholder('qa', ctx),
  ship: async (ctx) => runPlaceholder('ship', ctx),
  closeout: runCloseout,
};

export function resolveInvocation(name: string): CommandInvocation {
  const command = resolveCommandName(name);
  const via = name === command ? null : name;
  const handler = COMMAND_HANDLERS[command];

  return {
    command,
    via,
    handler: async (ctx: CommandContext) => handler({ ...ctx, via }),
    contract: CANONICAL_MANIFEST[command],
  };
}
