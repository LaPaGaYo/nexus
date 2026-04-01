import type { CommandContext, CommandResult } from './index';
import { runPlaceholder } from './index';

export async function runShip(ctx: CommandContext): Promise<CommandResult> {
  return runPlaceholder('ship', ctx);
}
