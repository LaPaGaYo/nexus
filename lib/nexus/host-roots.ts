import { join } from 'path';

export const PRIMARY_STATE_ROOT = '.nexus' as const;
export const NEXUS_STATE_ENV_VAR = 'NEXUS_STATE_DIR' as const;

export const PRIMARY_HOST_ROOTS = {
  claude_global: '~/.claude/skills/nexus',
  claude_local: '.claude/skills/nexus',
  codex_sidecar: '.agents/skills/nexus',
  codex_global: '~/.codex/skills/nexus',
  gemini_cli_global: '~/.gemini/skills/nexus',
  kiro_global: '~/.kiro/skills/nexus',
  factory_global: '~/.factory/skills/nexus',
} as const;

export type HostStateResolutionSource =
  | 'env:nexus'
  | 'existing:nexus'
  | 'init:nexus';

export type ResolveHostStateRootInput = {
  env: Partial<Record<typeof NEXUS_STATE_ENV_VAR, string | undefined>>;
  homeDir: string;
  nexusStateExists: boolean;
};

export type ResolveHostStateRootResult = {
  root: string;
  source: HostStateResolutionSource;
  migration_from: string | null;
};

export function getPrimaryStatePath(homeDir: string): string {
  return join(homeDir, PRIMARY_STATE_ROOT);
}

export function resolveHostStateRoot({
  env,
  homeDir,
  nexusStateExists,
}: ResolveHostStateRootInput): ResolveHostStateRootResult {
  const primaryStatePath = getPrimaryStatePath(homeDir);
  const nexusOverride = env[NEXUS_STATE_ENV_VAR];

  if (nexusOverride) {
    return {
      root: nexusOverride,
      source: 'env:nexus',
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

  return {
    root: primaryStatePath,
    source: 'init:nexus',
    migration_from: null,
  };
}
