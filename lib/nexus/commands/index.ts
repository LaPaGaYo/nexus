import { existsSync } from 'fs';
import { join } from 'path';
import type { NexusAdapters } from '../adapters/types';
import { CANONICAL_MANIFEST, resolveCommandName } from '../command-manifest';
import type { ExecutionSelection } from '../execution-topology';
import { stageStatusPath } from '../artifacts';
import { makeRunId, readLedger, startLedger, writeLedger } from '../ledger';
import { assertCanonicalLifecycleEntrypoint } from '../migration-safety';
import { writeStageStatus } from '../status';
import { PLACEHOLDER_OUTCOME, type ArtifactPointer, type CanonicalCommandId, type StageStatus } from '../types';
import { runBuild } from './build';
import { runCloseout } from './closeout';
import { runDiscover } from './discover';
import { runFrame } from './frame';
import { runHandoff } from './handoff';
import { runPlan } from './plan';
import { runQa } from './qa';
import { runReview } from './review';
import { runShip } from './ship';

export interface CommandContext {
  cwd: string;
  clock: () => string;
  via: string | null;
  adapters: NexusAdapters;
  execution: ExecutionSelection;
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
  const ledger = existingLedger ?? startLedger(makeRunId(ctx.clock), command, ctx.execution);
  const contract = CANONICAL_MANIFEST[command];
  const startedAt = ctx.clock();
  const statusPointer = artifactPointerFor(stageStatusPath(command));
  const missingInputs = contract.required_inputs.filter((inputPath) => !existsSync(join(ctx.cwd, inputPath)));

  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: command,
    execution_mode: ledger.execution.mode,
    primary_provider: ledger.execution.primary_provider,
    provider_topology: ledger.execution.provider_topology,
    requested_execution_path: ledger.execution.requested_path,
    actual_execution_path: ledger.execution.actual_path,
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
  discover: runDiscover,
  frame: runFrame,
  plan: runPlan,
  handoff: runHandoff,
  build: runBuild,
  review: runReview,
  qa: runQa,
  ship: runShip,
  closeout: runCloseout,
};

export function resolveInvocation(name: string): CommandInvocation {
  assertCanonicalLifecycleEntrypoint(name);
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
