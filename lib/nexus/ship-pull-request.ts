import type { PullRequestRecord } from './types';
import { runNexusCommand, type NexusCommandRunner } from './command-runner';

interface GithubPullRequestPayload {
  number?: number;
  url?: string;
  state?: string;
  headRefName?: string;
  baseRefName?: string;
}

function unavailablePullRequest(
  headBranch: string | null,
  reason: string,
  provider: PullRequestRecord['provider'] = 'github',
): PullRequestRecord {
  return {
    provider,
    status: 'unavailable',
    number: null,
    url: null,
    state: null,
    head_branch: headBranch,
    base_branch: null,
    reason,
  };
}

function notRequestedPullRequest(reason: string): PullRequestRecord {
  return {
    provider: 'github',
    status: 'not_requested',
    number: null,
    url: null,
    state: null,
    head_branch: null,
    base_branch: null,
    reason,
  };
}

function fromGithubPayload(
  payload: GithubPullRequestPayload,
  status: PullRequestRecord['status'],
): PullRequestRecord {
  return {
    provider: 'github',
    status,
    number: typeof payload.number === 'number' ? payload.number : null,
    url: typeof payload.url === 'string' ? payload.url : null,
    state: typeof payload.state === 'string' ? payload.state : null,
    head_branch: typeof payload.headRefName === 'string' ? payload.headRefName : null,
    base_branch: typeof payload.baseRefName === 'string' ? payload.baseRefName : null,
  };
}

function parseGithubPullRequest(stdout: string): GithubPullRequestPayload | null {
  try {
    return JSON.parse(stdout) as GithubPullRequestPayload;
  } catch {
    return null;
  }
}

async function readGithubPullRequest(
  cwd: string,
  runCommand: NexusCommandRunner,
): Promise<{ ok: true; pullRequest: GithubPullRequestPayload } | { ok: false; error: string }> {
  const result = await runCommand({
    argv: ['gh', 'pr', 'view', '--json', 'number,url,state,headRefName,baseRefName'],
    cwd,
  });

  if (result.exitCode !== 0) {
    return {
      ok: false,
      error: result.stderr.trim() || result.stdout.trim() || 'gh pr view failed',
    };
  }

  const payload = parseGithubPullRequest(result.stdout);
  if (!payload) {
    return {
      ok: false,
      error: 'gh pr view returned invalid JSON',
    };
  }

  return { ok: true, pullRequest: payload };
}

export async function resolveShipPullRequest(
  cwd: string,
  mergeReady: boolean,
  runCommand: NexusCommandRunner = runNexusCommand,
): Promise<PullRequestRecord> {
  if (!mergeReady) {
    return notRequestedPullRequest('Release gate is not merge-ready.');
  }

  const branchResult = await runCommand({
    argv: ['git', 'branch', '--show-current'],
    cwd,
  });

  if (branchResult.exitCode !== 0) {
    return unavailablePullRequest(null, branchResult.stderr.trim() || branchResult.stdout.trim() || 'failed to determine the current branch');
  }

  const headBranch = branchResult.stdout.trim() || null;
  if (!headBranch) {
    return unavailablePullRequest(null, 'Current branch is unknown; cannot prepare PR handoff.');
  }

  const existingPr = await readGithubPullRequest(cwd, runCommand);
  if (existingPr.ok) {
    const existingState = typeof existingPr.pullRequest.state === 'string'
      ? existingPr.pullRequest.state.toUpperCase()
      : null;
    if (existingState === 'OPEN') {
      return fromGithubPayload(existingPr.pullRequest, 'reused');
    }
  }

  const baseBranchResult = await runCommand({
    argv: ['gh', 'repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name'],
    cwd,
  });

  if (baseBranchResult.exitCode !== 0) {
    return unavailablePullRequest(
      headBranch,
      baseBranchResult.stderr.trim() || baseBranchResult.stdout.trim() || existingPr.error,
    );
  }

  const baseBranch = baseBranchResult.stdout.trim() || 'main';
  const createResult = await runCommand({
    argv: ['gh', 'pr', 'create', '--base', baseBranch, '--head', headBranch, '--fill'],
    cwd,
  });

  if (createResult.exitCode !== 0) {
    return unavailablePullRequest(
      headBranch,
      createResult.stderr.trim() || createResult.stdout.trim() || 'gh pr create failed',
    );
  }

  const createdPr = await readGithubPullRequest(cwd, runCommand);
  if (!createdPr.ok) {
    return unavailablePullRequest(headBranch, createdPr.error);
  }

  return fromGithubPayload(createdPr.pullRequest, 'created');
}
