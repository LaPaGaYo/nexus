import { join } from 'path';

export const PRIMARY_SUPPORT_NAMESPACE = 'nexus' as const;

export const PRIMARY_SUPPORT_HELPERS = {
  global_discover: 'nexus-global-discover',
  learnings_log: 'nexus-learnings-log',
  learnings_search: 'nexus-learnings-search',
  review_log: 'nexus-review-log',
  review_read: 'nexus-review-read',
  repo_mode: 'nexus-repo-mode',
  slug: 'nexus-slug',
} as const;

export const PRIMARY_WORKTREE_ROOT = '.nexus-worktrees' as const;
export const PRIMARY_DEV_ROOT = '.nexus-dev' as const;

export type DeveloperSubstrateResolutionSource =
  | 'existing:nexus'
  | 'init:nexus';

export type ResolveDeveloperSubstrateRootInput = {
  homeDir: string;
  nexusDevExists: boolean;
};

export type ResolveDeveloperSubstrateRootResult = {
  root: string;
  source: DeveloperSubstrateResolutionSource;
  migration_from: string | null;
};

export function getPrimaryWorktreeRoot(repoRoot: string): string {
  return join(repoRoot, PRIMARY_WORKTREE_ROOT);
}

export function getPrimaryDevRoot(homeDir: string): string {
  return join(homeDir, PRIMARY_DEV_ROOT);
}

export function resolveDeveloperSubstrateRoot({
  homeDir,
  nexusDevExists,
}: ResolveDeveloperSubstrateRootInput): ResolveDeveloperSubstrateRootResult {
  const primaryDevRoot = getPrimaryDevRoot(homeDir);

  if (nexusDevExists) {
    return {
      root: primaryDevRoot,
      source: 'existing:nexus',
      migration_from: null,
    };
  }

  return {
    root: primaryDevRoot,
    source: 'init:nexus',
    migration_from: null,
  };
}

export const SUPPORT_SURFACE_RULES = {
  primary_namespace: PRIMARY_SUPPORT_NAMESPACE,
  primary_helpers: PRIMARY_SUPPORT_HELPERS,
  primary_worktree_root: PRIMARY_WORKTREE_ROOT,
  primary_dev_root: PRIMARY_DEV_ROOT,
} as const;
