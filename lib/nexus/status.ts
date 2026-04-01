import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { StageStatus } from './types';

function resolveRepoPath(cwd: string, relativePath: string): string {
  return join(cwd, relativePath);
}

export function readStageStatus(statusPath: string, cwd = process.cwd()): StageStatus | null {
  const path = resolveRepoPath(cwd, statusPath);
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(readFileSync(path, 'utf8')) as StageStatus;
}

export function writeStageStatus(statusPath: string, status: StageStatus, cwd = process.cwd()): void {
  const path = resolveRepoPath(cwd, statusPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(status, null, 2) + '\n');
}
