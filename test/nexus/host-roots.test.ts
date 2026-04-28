import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..', '..');
const HOST_ROOTS_MODULE = join(ROOT, 'lib', 'nexus', 'host-roots.ts');

describe('nexus host root contract', () => {
  test('defines Nexus primary roots with Nexus-only live metadata', async () => {
    expect(existsSync(HOST_ROOTS_MODULE)).toBe(true);
    if (!existsSync(HOST_ROOTS_MODULE)) return;

    const mod = await import('../../lib/nexus/host-roots');

    expect(mod.PRIMARY_STATE_ROOT).toBe('.nexus');
    expect(mod.NEXUS_STATE_ENV_VAR).toBe('NEXUS_STATE_DIR');

    expect(mod.PRIMARY_HOST_ROOTS).toEqual({
      claude_global: '~/.claude/skills/nexus',
      claude_local: '.claude/skills/nexus',
      codex_sidecar: '.agents/skills/nexus',
      codex_global: '~/.codex/skills/nexus',
      gemini_cli_global: '~/.gemini/skills/nexus',
      kiro_global: '~/.kiro/skills/nexus',
      factory_global: '~/.factory/skills/nexus',
    });
  });

  test('resolves only Nexus-owned active state roots', async () => {
    expect(existsSync(HOST_ROOTS_MODULE)).toBe(true);
    if (!existsSync(HOST_ROOTS_MODULE)) return;

    const mod = await import('../../lib/nexus/host-roots');

    expect(
      mod.resolveHostStateRoot({
        env: { NEXUS_STATE_DIR: '/tmp/custom-nexus' },
        homeDir: '/Users/tester',
        nexusStateExists: false,
      }),
    ).toEqual({
      root: '/tmp/custom-nexus',
      source: 'env:nexus',
      migration_from: null,
    });

    expect(
      mod.resolveHostStateRoot({
        env: {},
        homeDir: '/Users/tester',
        nexusStateExists: true,
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
      }),
    ).toEqual({
      root: '/Users/tester/.nexus',
      source: 'init:nexus',
      migration_from: null,
    });
  });

  test('never exports legacy host-state fallback contracts', async () => {
    expect(existsSync(HOST_ROOTS_MODULE)).toBe(true);
    if (!existsSync(HOST_ROOTS_MODULE)) return;

    const mod = await import('../../lib/nexus/host-roots');

    expect('LEGACY_STATE_ROOT' in mod).toBe(false);
    expect('LEGACY_HOST_ROOTS' in mod).toBe(false);
    expect('resolveManagedHostStateRoot' in mod).toBe(false);
    expect('assessHostStateMigration' in mod).toBe(false);
  });
});
