import { describe, expect, test } from 'bun:test';
import {
  ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE,
  COMPATIBILITY_SURFACE_STATUSES,
  DEFERRED_LEGACY_REMOVAL_SURFACES,
  GSTACK_COMPATIBILITY_SURFACES,
  RETAINED_BOUNDARY_COMPATIBILITY_SHIMS,
} from '../../lib/nexus/compatibility-surface';

describe('nexus compatibility surface contract', () => {
  test('freezes the explicit three-way compatibility status model', () => {
    expect(COMPATIBILITY_SURFACE_STATUSES).toEqual({
      removed_from_active_path: 'removed_from_active_path',
      retained_compatibility_shim: 'retained_compatibility_shim',
      deferred_final_removal: 'deferred_final_removal',
    });
  });

  test('keeps only boundary shims in the retained compatibility budget', () => {
    expect(RETAINED_BOUNDARY_COMPATIBILITY_SHIMS).toEqual([
      'bin/gstack-config',
      'bin/gstack-relink',
      'bin/gstack-uninstall',
      'bin/gstack-update-check',
    ]);
  });

  test('freezes the internal gstack identities that must leave the active path', () => {
    expect(ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE).toEqual([
      'bin/gstack-patch-names',
      'bin/gstack-diff-scope',
      'bin/gstack-platform-detect',
      'bin/gstack-open-url',
      'bin/gstack-extension',
      'gstack-upgrade',
    ]);
  });

  test('tracks deferred cleanup surfaces separately from retained shims', () => {
    expect(DEFERRED_LEGACY_REMOVAL_SURFACES).toEqual([
      '~/.gstack',
      '.gstack-worktrees',
      '~/.gstack-dev',
      'repository remote naming',
    ]);
  });

  test('describes every compatibility surface through the shared contract', () => {
    const byStatus = Object.groupBy(GSTACK_COMPATIBILITY_SURFACES, (surface) => surface.status);

    expect(byStatus.retained_compatibility_shim?.map((surface) => surface.path)).toEqual(
      RETAINED_BOUNDARY_COMPATIBILITY_SHIMS,
    );
    expect(byStatus.removed_from_active_path?.map((surface) => surface.path)).toEqual(
      ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE,
    );
    expect(byStatus.deferred_final_removal?.map((surface) => surface.path)).toEqual(
      DEFERRED_LEGACY_REMOVAL_SURFACES,
    );
  });
});
