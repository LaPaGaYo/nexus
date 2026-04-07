import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..', '..');
const HOST_ROOTS_MODULE = join(ROOT, 'lib', 'nexus', 'host-roots.ts');

describe('nexus host root contract', () => {
  test('defines shared primary and compatibility roots for every supported host', async () => {
    expect(existsSync(HOST_ROOTS_MODULE)).toBe(true);
    if (!existsSync(HOST_ROOTS_MODULE)) {
      return;
    }

    const mod = await import('../../lib/nexus/host-roots');

    expect(mod.PRIMARY_STATE_ROOT).toBe('.nexus');
    expect(mod.LEGACY_STATE_ROOT).toBe('.gstack');
    expect(mod.NEXUS_STATE_ENV_VAR).toBe('NEXUS_STATE_DIR');
    expect(mod.GSTACK_STATE_ENV_VAR).toBe('GSTACK_STATE_DIR');

    expect(mod.PRIMARY_HOST_ROOTS).toEqual({
      claude_global: '~/.claude/skills/nexus',
      claude_local: '.claude/skills/nexus',
      codex_sidecar: '.agents/skills/nexus',
      codex_global: '~/.codex/skills/nexus',
      kiro_global: '~/.kiro/skills/nexus',
      factory_global: '~/.factory/skills/nexus',
    });

    expect(mod.LEGACY_HOST_ROOTS).toEqual({
      claude_global: '~/.claude/skills/gstack',
      claude_local: '.claude/skills/gstack',
      codex_sidecar: '.agents/skills/gstack',
      codex_global: '~/.codex/skills/gstack',
      kiro_global: '~/.kiro/skills/gstack',
      factory_global: '~/.factory/skills/gstack',
    });
  });

  test('resolves host support state precedence without granting lifecycle truth', async () => {
    expect(existsSync(HOST_ROOTS_MODULE)).toBe(true);
    if (!existsSync(HOST_ROOTS_MODULE)) {
      return;
    }

    const mod = await import('../../lib/nexus/host-roots');

    expect(
      mod.resolveHostStateRoot({
        env: { NEXUS_STATE_DIR: '/tmp/custom-nexus', GSTACK_STATE_DIR: '/tmp/custom-gstack' },
        homeDir: '/Users/tester',
        nexusStateExists: false,
        legacyStateExists: true,
      }),
    ).toEqual({
      root: '/tmp/custom-nexus',
      source: 'env:nexus',
      migration_from: null,
    });

    expect(
      mod.resolveHostStateRoot({
        env: { GSTACK_STATE_DIR: '/tmp/custom-gstack' },
        homeDir: '/Users/tester',
        nexusStateExists: false,
        legacyStateExists: true,
      }),
    ).toEqual({
      root: '/tmp/custom-gstack',
      source: 'env:gstack',
      migration_from: null,
    });

    expect(
      mod.resolveHostStateRoot({
        env: {},
        homeDir: '/Users/tester',
        nexusStateExists: true,
        legacyStateExists: true,
      }),
    ).toEqual({
      root: '/Users/tester/.nexus',
      source: 'existing:nexus',
      migration_from: null,
    });

    expect(
      mod.resolveHostStateRoot({
        env: {},
        homeDir: '/Users/tester',
        nexusStateExists: false,
        legacyStateExists: true,
      }),
    ).toEqual({
      root: '/Users/tester/.nexus',
      source: 'migrate:gstack',
      migration_from: '/Users/tester/.gstack',
    });
  });

  test('assesses migration completeness conservatively when both roots exist', async () => {
    expect(existsSync(HOST_ROOTS_MODULE)).toBe(true);
    if (!existsSync(HOST_ROOTS_MODULE)) {
      return;
    }

    const mod = await import('../../lib/nexus/host-roots');

    expect(mod.NEXUS_STATE_MIGRATION_MARKER).toBe('.migrated-from-gstack');
    expect(mod.NEXUS_STATE_INCOMPLETE_MARKER).toBe('.migration-incomplete');
    expect(mod.getStateMigrationMarkerPath('/Users/tester/.nexus')).toBe('/Users/tester/.nexus/.migrated-from-gstack');
    expect(mod.getIncompleteMigrationMarkerPath('/Users/tester/.nexus')).toBe('/Users/tester/.nexus/.migration-incomplete');

    expect(
      mod.assessHostStateMigration({
        nexusStateExists: false,
        legacyStateExists: true,
        migrationMarkerExists: false,
      }),
    ).toEqual({
      status: 'needs_migration',
      use_legacy_fallback: false,
    });

    expect(
      mod.assessHostStateMigration({
        nexusStateExists: true,
        legacyStateExists: true,
        migrationMarkerExists: false,
      }),
    ).toEqual({
      status: 'partial',
      use_legacy_fallback: true,
    });

    expect(
      mod.assessHostStateMigration({
        nexusStateExists: true,
        legacyStateExists: true,
        migrationMarkerExists: true,
      }),
    ).toEqual({
      status: 'complete',
      use_legacy_fallback: false,
    });

    expect(
      mod.resolveManagedHostStateRoot({
        env: {},
        homeDir: '/Users/tester',
        nexusStateExists: true,
        legacyStateExists: true,
        migrationMarkerExists: false,
      }),
    ).toEqual({
      root: '/Users/tester/.gstack',
      source: 'fallback:gstack',
      migration_from: '/Users/tester/.gstack',
    });
  });
});
