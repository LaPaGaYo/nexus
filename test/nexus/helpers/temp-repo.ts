import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDefaultNexusAdapters } from '../../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../../lib/nexus/adapters/types';
import { resolveInvocation } from '../../../lib/nexus/commands/index';

interface TempRepoRun {
  (command: string, adapters?: NexusAdapters): Promise<void>;
  readJson: (path: string) => Promise<any>;
}

export async function runInTempRepo(
  fn: (ctx: { cwd: string; run: TempRepoRun }) => Promise<void>,
): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-plan-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });

  const run = Object.assign(
    async (command: string, adapters = getDefaultNexusAdapters()) => {
      const invocation = resolveInvocation(command);
      await invocation.handler({
        cwd,
        clock: () => new Date().toISOString(),
        via: invocation.via,
        adapters,
      });
    },
    {
      readJson: async (path: string) => JSON.parse(readFileSync(join(cwd, path), 'utf8')),
    },
  ) as TempRepoRun;

  try {
    await fn({ cwd, run });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
