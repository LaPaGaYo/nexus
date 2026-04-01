import type { CommandContext, CommandResult } from './index';
import { runPlaceholder } from './index';

export async function runDiscover(ctx: CommandContext): Promise<CommandResult> {
  return runPlaceholder('discover', ctx);
}
