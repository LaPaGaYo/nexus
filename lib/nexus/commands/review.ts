import type { CommandContext } from './index';

export async function runReview(_ctx: CommandContext): Promise<never> {
  throw new Error('runReview must be wired before the governed slice can execute');
}
