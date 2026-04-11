import type { NexusAdapters } from '../adapters/types';
import { CANONICAL_MANIFEST, resolveCommandName } from '../command-manifest';
import type { ExecutionSelection } from '../execution-topology';
import { assertCanonicalLifecycleEntrypoint } from '../migration-safety';
import type { CanonicalCommandId, StageStatus } from '../types';
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
