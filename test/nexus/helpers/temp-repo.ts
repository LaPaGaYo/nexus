import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDefaultNexusAdapters } from '../../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../../lib/nexus/adapters/types';
import { resolveInvocation } from '../../../lib/nexus/commands/index';
import type { ExecutionSelection } from '../../../lib/nexus/execution-topology';

interface TempRepoRun {
  (command: string, adapters?: NexusAdapters, execution?: ExecutionSelection): Promise<void>;
  readJson: (path: string) => Promise<any>;
  readFile: (path: string) => Promise<string>;
}

export async function runInTempRepo(
  fn: (ctx: { cwd: string; run: TempRepoRun }) => Promise<void>,
): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-plan-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });

  const run = Object.assign(
    async (
      command: string,
      adapters = getDefaultNexusAdapters(),
      execution: ExecutionSelection = {
        mode: 'governed_ccb',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        requested_execution_path: 'codex-via-ccb',
      },
    ) => {
      const invocation = resolveInvocation(command);
      await invocation.handler({
        cwd,
        clock: () => new Date().toISOString(),
        via: invocation.via,
        adapters,
        execution,
      });
    },
    {
      readJson: async (path: string) => JSON.parse(readFileSync(join(cwd, path), 'utf8')),
      readFile: async (path: string) => readFileSync(join(cwd, path), 'utf8'),
    },
  ) as TempRepoRun;

  try {
    await fn({ cwd, run });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
