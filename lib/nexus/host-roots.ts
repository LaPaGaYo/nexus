import { join } from 'path';

export const PRIMARY_STATE_ROOT = '.nexus' as const;
export const LEGACY_STATE_ROOT = '.gstack' as const;

export const NEXUS_STATE_ENV_VAR = 'NEXUS_STATE_DIR' as const;
export const GSTACK_STATE_ENV_VAR = 'GSTACK_STATE_DIR' as const;
export const NEXUS_STATE_MIGRATION_MARKER = '.migrated-from-gstack' as const;
export const NEXUS_STATE_INCOMPLETE_MARKER = '.migration-incomplete' as const;

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
  | 'fallback:gstack'
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

export type AssessHostStateMigrationInput = {
  nexusStateExists: boolean;
  legacyStateExists: boolean;
  migrationMarkerExists: boolean;
};

export type AssessHostStateMigrationResult = {
  status: 'fresh' | 'needs_migration' | 'complete' | 'partial';
  use_legacy_fallback: boolean;
};

export function getPrimaryStatePath(homeDir: string): string {
  return join(homeDir, PRIMARY_STATE_ROOT);
}

export function getLegacyStatePath(homeDir: string): string {
  return join(homeDir, LEGACY_STATE_ROOT);
}

export function getStateMigrationMarkerPath(stateRoot: string): string {
  return join(stateRoot, NEXUS_STATE_MIGRATION_MARKER);
}

export function getIncompleteMigrationMarkerPath(stateRoot: string): string {
  return join(stateRoot, NEXUS_STATE_INCOMPLETE_MARKER);
}

export function assessHostStateMigration({
  nexusStateExists,
  legacyStateExists,
  migrationMarkerExists,
}: AssessHostStateMigrationInput): AssessHostStateMigrationResult {
  if (!nexusStateExists && legacyStateExists) {
    return {
      status: 'needs_migration',
      use_legacy_fallback: false,
    };
  }

  if (nexusStateExists && legacyStateExists && !migrationMarkerExists) {
    return {
      status: 'partial',
      use_legacy_fallback: true,
    };
  }

  if (nexusStateExists || migrationMarkerExists) {
    return {
      status: 'complete',
      use_legacy_fallback: false,
    };
  }

  return {
    status: 'fresh',
    use_legacy_fallback: false,
  };
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

export function resolveManagedHostStateRoot({
  env,
  homeDir,
  nexusStateExists,
  legacyStateExists,
  migrationMarkerExists,
}: ResolveHostStateRootInput & { migrationMarkerExists: boolean }): ResolveHostStateRootResult {
  const nexusOverride = env[NEXUS_STATE_ENV_VAR];
  const gstackOverride = env[GSTACK_STATE_ENV_VAR];
  if (nexusOverride || gstackOverride) {
    return resolveHostStateRoot({
      env,
      homeDir,
      nexusStateExists,
      legacyStateExists,
    });
  }

  const primaryStatePath = getPrimaryStatePath(homeDir);
  const legacyStatePath = getLegacyStatePath(homeDir);
  const migration = assessHostStateMigration({
    nexusStateExists,
    legacyStateExists,
    migrationMarkerExists,
  });

  if (migration.status === 'partial') {
    return {
      root: legacyStatePath,
      source: 'fallback:gstack',
      migration_from: legacyStatePath,
    };
  }

  if (migration.status === 'needs_migration') {
    return {
      root: primaryStatePath,
      source: 'migrate:gstack',
      migration_from: legacyStatePath,
    };
  }

  if (migration.status === 'complete' && nexusStateExists) {
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
