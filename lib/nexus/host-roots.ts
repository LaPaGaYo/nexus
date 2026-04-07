import { join } from 'path';

export const PRIMARY_STATE_ROOT = '.nexus' as const;
export const LEGACY_STATE_ROOT = '.gstack' as const;

export const NEXUS_STATE_ENV_VAR = 'NEXUS_STATE_DIR' as const;
export const GSTACK_STATE_ENV_VAR = 'GSTACK_STATE_DIR' as const;

export const PRIMARY_HOST_ROOTS = {
  claude_global: '~/.claude/skills/nexus',
  claude_local: '.claude/skills/nexus',
  codex_sidecar: '.agents/skills/nexus',
  codex_global: '~/.codex/skills/nexus',
  kiro_global: '~/.kiro/skills/nexus',
  factory_global: '~/.factory/skills/nexus',
} as const;

export const LEGACY_HOST_ROOTS = {
  claude_global: '~/.claude/skills/gstack',
  claude_local: '.claude/skills/gstack',
  codex_sidecar: '.agents/skills/gstack',
  codex_global: '~/.codex/skills/gstack',
  kiro_global: '~/.kiro/skills/gstack',
  factory_global: '~/.factory/skills/gstack',
} as const;

export type HostStateResolutionSource =
  | 'env:nexus'
  | 'env:gstack'
  | 'existing:nexus'
  | 'migrate:gstack'
  | 'init:nexus';

export type ResolveHostStateRootInput = {
  env: Partial<Record<typeof NEXUS_STATE_ENV_VAR | typeof GSTACK_STATE_ENV_VAR, string | undefined>>;
  homeDir: string;
  nexusStateExists: boolean;
  legacyStateExists: boolean;
};

export type ResolveHostStateRootResult = {
  root: string;
  source: HostStateResolutionSource;
  migration_from: string | null;
};

export function getPrimaryStatePath(homeDir: string): string {
  return join(homeDir, PRIMARY_STATE_ROOT);
}

export function getLegacyStatePath(homeDir: string): string {
  return join(homeDir, LEGACY_STATE_ROOT);
}

export function resolveHostStateRoot({
  env,
  homeDir,
  nexusStateExists,
  legacyStateExists,
}: ResolveHostStateRootInput): ResolveHostStateRootResult {
  const primaryStatePath = getPrimaryStatePath(homeDir);
  const legacyStatePath = getLegacyStatePath(homeDir);
  const nexusOverride = env[NEXUS_STATE_ENV_VAR];
  const gstackOverride = env[GSTACK_STATE_ENV_VAR];

  if (nexusOverride) {
    return {
      root: nexusOverride,
      source: 'env:nexus',
      migration_from: null,
    };
  }

  if (gstackOverride) {
    return {
      root: gstackOverride,
      source: 'env:gstack',
      migration_from: null,
    };
  }

  if (nexusStateExists) {
    return {
      root: primaryStatePath,
      source: 'existing:nexus',
      migration_from: null,
    };
  }

  if (legacyStateExists) {
    return {
      root: primaryStatePath,
      source: 'migrate:gstack',
      migration_from: legacyStatePath,
    };
  }

  return {
    root: primaryStatePath,
    source: 'init:nexus',
    migration_from: null,
  };
}
