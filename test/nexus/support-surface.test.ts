import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..', '..');
const SUPPORT_SURFACE_MODULE = join(ROOT, 'lib', 'nexus', 'support-surface.ts');

describe('nexus support surface contract', () => {
  test('defines Nexus helper ownership and preserves legacy names as historical metadata', async () => {
    expect(existsSync(SUPPORT_SURFACE_MODULE)).toBe(true);
    if (!existsSync(SUPPORT_SURFACE_MODULE)) return;

    const mod = await import('../../lib/nexus/support-surface');

    expect(mod.PRIMARY_SUPPORT_NAMESPACE).toBe('nexus');
    expect(mod.LEGACY_SUPPORT_NAMESPACE).toBe('gstack');

    expect(mod.PRIMARY_SUPPORT_HELPERS).toEqual({
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
    });

    expect(mod.LEGACY_SUPPORT_HELPERS).toEqual({
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
    });
  });

  test('defines Nexus developer roots and keeps legacy roots historical only', async () => {
    expect(existsSync(SUPPORT_SURFACE_MODULE)).toBe(true);
    if (!existsSync(SUPPORT_SURFACE_MODULE)) return;

    const mod = await import('../../lib/nexus/support-surface');

    expect(mod.PRIMARY_WORKTREE_ROOT).toBe('.nexus-worktrees');
    expect(mod.LEGACY_WORKTREE_ROOT).toBe('.gstack-worktrees');
    expect(mod.PRIMARY_DEV_ROOT).toBe('.nexus-dev');
    expect(mod.LEGACY_DEV_ROOT).toBe('.gstack-dev');

    expect(mod.getPrimaryWorktreeRoot('/repo')).toBe('/repo/.nexus-worktrees');
    expect(mod.getLegacyWorktreeRoot('/repo')).toBe('/repo/.gstack-worktrees');
    expect(mod.getPrimaryDevRoot('/Users/tester')).toBe('/Users/tester/.nexus-dev');
    expect(mod.getLegacyDevRoot('/Users/tester')).toBe('/Users/tester/.gstack-dev');
  });

  test('resolves developer substrate into Nexus-owned roots even when legacy roots exist', async () => {
    expect(existsSync(SUPPORT_SURFACE_MODULE)).toBe(true);
    if (!existsSync(SUPPORT_SURFACE_MODULE)) return;

    const mod = await import('../../lib/nexus/support-surface');

    expect(
      mod.resolveDeveloperSubstrateRoot({
        homeDir: '/Users/tester',
        nexusDevExists: true,
        legacyDevExists: true,
      }),
    ).toEqual({
      root: '/Users/tester/.nexus-dev',
      source: 'existing:nexus',
      migration_from: null,
    });

    expect(
      mod.resolveDeveloperSubstrateRoot({
        homeDir: '/Users/tester',
        nexusDevExists: false,
        legacyDevExists: true,
      }),
    ).toEqual({
      root: '/Users/tester/.nexus-dev',
      source: 'migrate:gstack',
      migration_from: '/Users/tester/.gstack-dev',
    });
  });
});
