import type { CommandContext } from './index';

export async function runPlan(_ctx: CommandContext): Promise<never> {
  throw new Error('runPlan must be wired before the governed slice can execute');
}
