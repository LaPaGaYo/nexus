import type { CommandContext, CommandResult } from './index';
import { runPlaceholder } from './index';

export async function runFrame(ctx: CommandContext): Promise<CommandResult> {
  return runPlaceholder('frame', ctx);
}
