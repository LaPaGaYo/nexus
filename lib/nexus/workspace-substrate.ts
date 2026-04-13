import { spawnSync } from 'child_process';
import { existsSync, realpathSync } from 'fs';
import { join, resolve } from 'path';
import { getPrimaryWorktreeRoot } from './support-surface';
import type { WorkspaceRecord } from './types';

const LEGACY_WORKTREE_ROOT = '.worktrees';

type GitWorktreeEntry = {
  path: string;
  branch: string | null;
};

function gitStdout(cwd: string, args: string[]): string | null {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    stdio: 'pipe',
    timeout: 15_000,
  });

  if (result.status !== 0) {
    return null;
  }

  return result.stdout.toString('utf8');
}

function normalizeBranch(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value === 'HEAD' || value === 'detached') {
    return null;
  }

  return value.startsWith('refs/heads/') ? value.slice('refs/heads/'.length) : value;
}

function currentBranch(cwd: string): string | null {
  return normalizeBranch(gitStdout(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])?.trim() ?? null);
}

function gitCommonDir(cwd: string): string | null {
  const raw = gitStdout(cwd, ['rev-parse', '--git-common-dir'])?.trim();
  if (!raw) {
    return null;
  }

  return resolve(cwd, raw);
}

function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path);
  } catch {
    return resolve(path);
  }
}

function parseWorktreeList(stdout: string): GitWorktreeEntry[] {
  const entries: GitWorktreeEntry[] = [];
  let current: GitWorktreeEntry | null = null;

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      if (current) {
        entries.push(current);
        current = null;
      }
      continue;
    }

    if (line.startsWith('worktree ')) {
      if (current) {
        entries.push(current);
      }
      current = {
        path: line.slice('worktree '.length),
        branch: null,
      };
      continue;
    }

    if (line.startsWith('branch ') && current) {
      current.branch = normalizeBranch(line.slice('branch '.length));
      continue;
    }

    if (line === 'detached' && current) {
      current.branch = null;
    }
  }

  if (current) {
    entries.push(current);
  }

  return entries;
}

function preferredWorktreeSource(
  repoRoot: string,
  candidatePath: string,
): WorkspaceRecord['source'] | null {
  const normalizedCandidate = canonicalPath(candidatePath);
  const normalizedPrimaryRoot = canonicalPath(getPrimaryWorktreeRoot(repoRoot));
  const normalizedLegacyRoot = canonicalPath(join(repoRoot, LEGACY_WORKTREE_ROOT));

  if (
    normalizedCandidate === normalizedPrimaryRoot
    || normalizedCandidate.startsWith(`${normalizedPrimaryRoot}/`)
  ) {
    return 'existing:nexus_worktree';
  }

  if (
    normalizedCandidate === normalizedLegacyRoot
    || normalizedCandidate.startsWith(`${normalizedLegacyRoot}/`)
  ) {
    return 'existing:legacy_worktree';
  }

  return null;
}

function isWorkspaceUsable(repoRoot: string, workspacePath: string): boolean {
  if (!existsSync(workspacePath)) {
    return false;
  }

  const repoCommonDir = gitCommonDir(repoRoot);
  const workspaceCommonDir = gitCommonDir(workspacePath);
  return repoCommonDir !== null
    && workspaceCommonDir !== null
    && canonicalPath(repoCommonDir) === canonicalPath(workspaceCommonDir);
}

function candidateRank(repoRoot: string, candidate: GitWorktreeEntry): [number, number, number, string] {
  const source = preferredWorktreeSource(repoRoot, candidate.path);
  const sourceRank = source === 'existing:nexus_worktree' ? 0 : 1;
  const implementRank = candidate.path.endsWith('/implement') ? 0 : 1;
  const branchRank = candidate.branch ? 0 : 1;
  return [sourceRank, implementRank, branchRank, candidate.path];
}

function sortCandidates(repoRoot: string, candidates: GitWorktreeEntry[]): GitWorktreeEntry[] {
  return [...candidates].sort((left, right) => {
    const leftRank = candidateRank(repoRoot, left);
    const rightRank = candidateRank(repoRoot, right);
    for (let index = 0; index < leftRank.length; index += 1) {
      const leftValue = leftRank[index]!;
      const rightValue = rightRank[index]!;
      if (leftValue < rightValue) {
        return -1;
      }
      if (leftValue > rightValue) {
        return 1;
      }
    }
    return 0;
  });
}

function rootWorkspace(repoRoot: string): WorkspaceRecord {
  return {
    path: canonicalPath(repoRoot),
    kind: 'root',
    branch: currentBranch(repoRoot),
    source: 'repo_root',
  };
}

export function resolveExecutionWorkspace(
  repoRoot: string,
  existingWorkspace?: WorkspaceRecord | null,
): WorkspaceRecord {
  if (existingWorkspace && isWorkspaceUsable(repoRoot, existingWorkspace.path)) {
    return {
      ...existingWorkspace,
      path: canonicalPath(existingWorkspace.path),
      branch: currentBranch(existingWorkspace.path),
    };
  }

  const worktreeList = gitStdout(repoRoot, ['worktree', 'list', '--porcelain']);
  if (!worktreeList) {
    return rootWorkspace(repoRoot);
  }

  const resolvedRepoRoot = canonicalPath(repoRoot);
  const candidates = parseWorktreeList(worktreeList)
    .filter((entry) => canonicalPath(entry.path) !== resolvedRepoRoot)
    .filter((entry) => preferredWorktreeSource(repoRoot, entry.path) !== null)
    .filter((entry) => isWorkspaceUsable(repoRoot, entry.path));

  if (candidates.length === 0) {
    return rootWorkspace(repoRoot);
  }

  const selected = sortCandidates(repoRoot, candidates)[0]!;
  return {
    path: canonicalPath(selected.path),
    kind: 'worktree',
    branch: currentBranch(selected.path) ?? selected.branch,
    source: preferredWorktreeSource(repoRoot, selected.path) ?? 'existing:legacy_worktree',
  };
}
