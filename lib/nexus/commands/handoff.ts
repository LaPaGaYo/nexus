import type { CommandContext } from './index';

export async function runHandoff(_ctx: CommandContext): Promise<never> {
  throw new Error('runHandoff must be wired before the governed slice can execute');
}
