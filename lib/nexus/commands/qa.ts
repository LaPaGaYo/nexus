import type { CommandContext, CommandResult } from './index';
import { runPlaceholder } from './index';

export async function runQa(ctx: CommandContext): Promise<CommandResult> {
  return runPlaceholder('qa', ctx);
}
