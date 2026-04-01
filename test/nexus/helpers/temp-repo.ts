import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '../../..');

interface TempRepoRun {
  (command: string): Promise<void>;
  readJson: (path: string) => Promise<any>;
}

export async function runInTempRepo(
  fn: (ctx: { cwd: string; run: TempRepoRun }) => Promise<void>,
): Promise<void> {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-plan-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });

  const run = Object.assign(
    async (command: string) => {
      const result = spawnSync('bun', ['run', join(ROOT, 'bin/nexus.ts'), command], {
        cwd,
        stdio: 'pipe',
        encoding: 'utf8',
      });

      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout);
      }
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
