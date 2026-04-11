import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..', '..');
const SUPPORT_SURFACE_MODULE = join(ROOT, 'lib', 'nexus', 'support-surface.ts');

describe('nexus support surface contract', () => {
  test('defines Nexus helper ownership with Nexus-only live metadata', async () => {
    expect(existsSync(SUPPORT_SURFACE_MODULE)).toBe(true);
    if (!existsSync(SUPPORT_SURFACE_MODULE)) return;

    const mod = await import('../../lib/nexus/support-surface');

    expect(mod.PRIMARY_SUPPORT_NAMESPACE).toBe('nexus');

    expect(mod.PRIMARY_SUPPORT_HELPERS).toEqual({
      global_discover: 'nexus-global-discover',
      learnings_log: 'nexus-learnings-log',
      learnings_search: 'nexus-learnings-search',
      review_log: 'nexus-review-log',
      review_read: 'nexus-review-read',
      repo_mode: 'nexus-repo-mode',
      slug: 'nexus-slug',
    });
  });

  test('defines Nexus developer roots only', async () => {
    expect(existsSync(SUPPORT_SURFACE_MODULE)).toBe(true);
    if (!existsSync(SUPPORT_SURFACE_MODULE)) return;

    const mod = await import('../../lib/nexus/support-surface');

    expect(mod.PRIMARY_WORKTREE_ROOT).toBe('.nexus-worktrees');
    expect(mod.PRIMARY_DEV_ROOT).toBe('.nexus-dev');

    expect(mod.getPrimaryWorktreeRoot('/repo')).toBe('/repo/.nexus-worktrees');
    expect(mod.getPrimaryDevRoot('/Users/tester')).toBe('/Users/tester/.nexus-dev');
  });

  test('resolves developer substrate into Nexus-owned roots only', async () => {
    expect(existsSync(SUPPORT_SURFACE_MODULE)).toBe(true);
    if (!existsSync(SUPPORT_SURFACE_MODULE)) return;

    const mod = await import('../../lib/nexus/support-surface');

    expect(
      mod.resolveDeveloperSubstrateRoot({
        homeDir: '/Users/tester',
        nexusDevExists: true,
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
      }),
    ).toEqual({
      root: '/Users/tester/.nexus-dev',
      source: 'init:nexus',
      migration_from: null,
    });
  });
});
