import type { NexusAdapters } from '../adapters/types';
import type { NexusCommandRunner } from '../command-runner';
import { CANONICAL_MANIFEST, resolveCommandName } from '../command-manifest';
import type { ExecutionSelection } from '../execution-topology';
import { assertCanonicalLifecycleEntrypoint } from '../migration-safety';
import type {
  CanonicalCommandId,
  CompletionAdvisorRecord,
  ContinuationMode,
  ReviewAdvisoryDisposition,
  StageStatus,
} from '../types';
import { resolveRepositoryRoot } from '../workspace-substrate';
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
  continuation_mode_override?: ContinuationMode | null;
  review_advisory_disposition_override?: ReviewAdvisoryDisposition | null;
  run_command?: NexusCommandRunner;
  allow_stub_adapters?: boolean;
}

export interface CommandResult {
  command: CanonicalCommandId;
  status: StageStatus;
  completion_advisor?: CompletionAdvisorRecord | null;
}

interface CommandInvocation {
  command: CanonicalCommandId;
  via: string | null;
  handler: (ctx: CommandContext) => Promise<CommandResult>;
  contract: (typeof CANONICAL_MANIFEST)[CanonicalCommandId];
}

type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;
type AdapterFamily = Exclude<keyof NexusAdapters, 'registry'>;

const ADAPTER_FAMILIES: AdapterFamily[] = ['discovery', 'planning', 'execution', 'ccb', 'local'];

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
    handler: async (ctx: CommandContext) => {
      if (!ctx.allow_stub_adapters) {
        assertProductionAdapters(ctx.adapters);
      }

      return handler({ ...ctx, cwd: resolveRepositoryRoot(ctx.cwd), via });
    },
    contract: CANONICAL_MANIFEST[command],
  };
}

export function assertProductionAdapters(adapters: NexusAdapters): void {
  for (const family of ADAPTER_FAMILIES) {
    if (adapters[family].kind === 'stub') {
      throw new Error(
        `Refusing to run lifecycle command with stub ${family} adapter. Use getRuntimeNexusAdapters() in production.`,
      );
    }
  }
}
