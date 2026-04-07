import { join } from 'path';

export const PRIMARY_SUPPORT_NAMESPACE = 'nexus' as const;
export const LEGACY_SUPPORT_NAMESPACE = 'gstack' as const;

export const PRIMARY_SUPPORT_HELPERS = {
  analytics: 'nexus-analytics',
  community_dashboard: 'nexus-community-dashboard',
  global_discover: 'nexus-global-discover',
  learnings_log: 'nexus-learnings-log',
  learnings_search: 'nexus-learnings-search',
  review_log: 'nexus-review-log',
  review_read: 'nexus-review-read',
  repo_mode: 'nexus-repo-mode',
  slug: 'nexus-slug',
  telemetry_log: 'nexus-telemetry-log',
  telemetry_sync: 'nexus-telemetry-sync',
} as const;

export const LEGACY_SUPPORT_HELPERS = {
  analytics: 'gstack-analytics',
  community_dashboard: 'gstack-community-dashboard',
  global_discover: 'gstack-global-discover',
  learnings_log: 'gstack-learnings-log',
  learnings_search: 'gstack-learnings-search',
  review_log: 'gstack-review-log',
  review_read: 'gstack-review-read',
  repo_mode: 'gstack-repo-mode',
  slug: 'gstack-slug',
  telemetry_log: 'gstack-telemetry-log',
  telemetry_sync: 'gstack-telemetry-sync',
} as const;

export const PRIMARY_WORKTREE_ROOT = '.nexus-worktrees' as const;
export const LEGACY_WORKTREE_ROOT = '.gstack-worktrees' as const;

export const PRIMARY_DEV_ROOT = '.nexus-dev' as const;
export const LEGACY_DEV_ROOT = '.gstack-dev' as const;

export type DeveloperSubstrateResolutionSource =
  | 'existing:nexus'
  | 'migrate:gstack'
  | 'init:nexus';

export type ResolveDeveloperSubstrateRootInput = {
  homeDir: string;
  nexusDevExists: boolean;
  legacyDevExists: boolean;
};

export type ResolveDeveloperSubstrateRootResult = {
  root: string;
  source: DeveloperSubstrateResolutionSource;
  migration_from: string | null;
};

export function getPrimaryWorktreeRoot(repoRoot: string): string {
  return join(repoRoot, PRIMARY_WORKTREE_ROOT);
}

export function getLegacyWorktreeRoot(repoRoot: string): string {
  return join(repoRoot, LEGACY_WORKTREE_ROOT);
}

export function getPrimaryDevRoot(homeDir: string): string {
  return join(homeDir, PRIMARY_DEV_ROOT);
}

export function getLegacyDevRoot(homeDir: string): string {
  return join(homeDir, LEGACY_DEV_ROOT);
}

export function resolveDeveloperSubstrateRoot({
  homeDir,
  nexusDevExists,
  legacyDevExists,
}: ResolveDeveloperSubstrateRootInput): ResolveDeveloperSubstrateRootResult {
  const primaryDevRoot = getPrimaryDevRoot(homeDir);
  const legacyDevRoot = getLegacyDevRoot(homeDir);

  if (nexusDevExists) {
    return {
      root: primaryDevRoot,
      source: 'existing:nexus',
      migration_from: null,
    };
  }

  if (legacyDevExists) {
    return {
      root: primaryDevRoot,
      source: 'migrate:gstack',
      migration_from: legacyDevRoot,
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
  legacy_namespace: LEGACY_SUPPORT_NAMESPACE,
  primary_helpers: PRIMARY_SUPPORT_HELPERS,
  legacy_helpers: LEGACY_SUPPORT_HELPERS,
  primary_worktree_root: PRIMARY_WORKTREE_ROOT,
  legacy_worktree_root: LEGACY_WORKTREE_ROOT,
  primary_dev_root: PRIMARY_DEV_ROOT,
  legacy_dev_root: LEGACY_DEV_ROOT,
} as const;
