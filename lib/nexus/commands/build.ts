import type { CommandContext } from './index';

export async function runBuild(_ctx: CommandContext): Promise<never> {
  throw new Error('runBuild must be wired before the governed slice can execute');
}
