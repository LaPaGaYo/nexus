import type { CommandContext } from './index';

export async function runCloseout(_ctx: CommandContext): Promise<never> {
  throw new Error('runCloseout must be wired before the governed slice can execute');
}
