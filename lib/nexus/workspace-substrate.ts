import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, realpathSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { getPrimaryWorktreeRoot } from './support-surface';
import type { SessionRootRecord, WorkspaceRecord } from './types';

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

function gitExitCode(cwd: string, args: string[]): number {
  const result = spawnSync('git', ['-C', cwd, ...args], {
    stdio: 'pipe',
    timeout: 15_000,
  });
  return result.status ?? 1;
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

export function resolveRepositoryRoot(cwd: string): string {
  const commonDir = gitCommonDir(cwd);
  if (commonDir) {
    const normalizedCommonDir = canonicalPath(commonDir);
    if (normalizedCommonDir.endsWith('/.git')) {
      return canonicalPath(dirname(normalizedCommonDir));
    }
  }

  const topLevel = gitStdout(cwd, ['rev-parse', '--show-toplevel'])?.trim();
  if (topLevel) {
    return canonicalPath(topLevel);
  }

  return canonicalPath(cwd);
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

function branchExists(repoRoot: string, branch: string): boolean {
  return gitExitCode(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]) === 0;
}

function freshRunBranch(runId: string): string {
  return `codex/${runId}`;
}

function isGitRepository(repoRoot: string): boolean {
  const resolvedRoot = gitStdout(repoRoot, ['rev-parse', '--show-toplevel'])?.trim() ?? null;
  return resolvedRoot !== null;
}

function allocatedWorkspace(repoRoot: string, worktreePath: string, runId: string): WorkspaceRecord {
  return {
    path: canonicalPath(worktreePath),
    kind: 'worktree',
    branch: currentBranch(worktreePath) ?? freshRunBranch(runId),
    source: 'allocated:fresh_run',
    run_id: runId,
    retirement_state: 'active',
  };
}

export function resolveRepositoryPrimaryBranch(repoRoot: string): string {
  const remoteHead = normalizeBranch(gitStdout(repoRoot, ['symbolic-ref', 'refs/remotes/origin/HEAD'])?.trim() ?? null);
  return remoteHead ?? currentBranch(repoRoot) ?? 'main';
}

export function resolveSessionRootRecord(repoRoot: string): SessionRootRecord {
  let current = resolveRepositoryRoot(repoRoot);

  while (true) {
    if (existsSync(join(current, '.ccb')) || existsSync(join(current, '.ccb_config'))) {
      return {
        path: current,
        kind: 'repo_root',
        source: 'ccb_root',
      };
    }

    const parent = dirname(current);
    if (parent === current) {
      return {
        path: resolveRepositoryRoot(repoRoot),
        kind: 'repo_root',
        source: 'ccb_root',
      };
    }

    current = parent;
  }
}

export function allocateFreshRunWorkspace(repoRoot: string, runId: string): WorkspaceRecord {
  const resolvedRepoRoot = resolveRepositoryRoot(repoRoot);
  if (!isGitRepository(resolvedRepoRoot)) {
    return rootWorkspace(resolvedRepoRoot);
  }

  const worktreeRoot = getPrimaryWorktreeRoot(resolvedRepoRoot);
  const worktreePath = join(worktreeRoot, runId);
  const branch = freshRunBranch(runId);

  if (isWorkspaceUsable(resolvedRepoRoot, worktreePath)) {
    return allocatedWorkspace(resolvedRepoRoot, worktreePath, runId);
  }

  mkdirSync(worktreeRoot, { recursive: true });

  const args = branchExists(resolvedRepoRoot, branch)
    ? ['worktree', 'add', worktreePath, branch]
    : ['worktree', 'add', worktreePath, '-b', branch, resolveRepositoryPrimaryBranch(resolvedRepoRoot)];
  const result = spawnSync('git', ['-C', resolvedRepoRoot, ...args], {
    stdio: 'pipe',
    timeout: 15_000,
  });

  if (result.status !== 0) {
    const stderr = result.stderr.toString('utf8').trim();
    const stdout = result.stdout.toString('utf8').trim();
    throw new Error(stderr || stdout || `failed to allocate fresh run workspace for ${runId}`);
  }

  return allocatedWorkspace(resolvedRepoRoot, worktreePath, runId);
}

export function resolveExecutionWorkspace(
  repoRoot: string,
  existingWorkspace?: WorkspaceRecord | null,
): WorkspaceRecord {
  const resolvedRepoRoot = resolveRepositoryRoot(repoRoot);

  if (existingWorkspace && isWorkspaceUsable(resolvedRepoRoot, existingWorkspace.path)) {
    return {
      ...existingWorkspace,
      path: canonicalPath(existingWorkspace.path),
      branch: currentBranch(existingWorkspace.path),
    };
  }

  const worktreeList = gitStdout(resolvedRepoRoot, ['worktree', 'list', '--porcelain']);
  if (!worktreeList) {
    return rootWorkspace(resolvedRepoRoot);
  }

  const candidates = parseWorktreeList(worktreeList)
    .filter((entry) => canonicalPath(entry.path) !== resolvedRepoRoot)
    .filter((entry) => preferredWorktreeSource(resolvedRepoRoot, entry.path) !== null)
    .filter((entry) => isWorkspaceUsable(resolvedRepoRoot, entry.path));

  if (candidates.length === 0) {
    return rootWorkspace(resolvedRepoRoot);
  }

  const selected = sortCandidates(resolvedRepoRoot, candidates)[0]!;
  return {
    path: canonicalPath(selected.path),
    kind: 'worktree',
    branch: currentBranch(selected.path) ?? selected.branch,
    source: preferredWorktreeSource(resolvedRepoRoot, selected.path) ?? 'existing:legacy_worktree',
  };
}
