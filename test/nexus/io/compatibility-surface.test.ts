import { describe, expect, test } from 'bun:test';
import {
  COMPATIBILITY_SURFACES,
  COMPATIBILITY_SURFACE_STATUSES,
  HISTORICAL_LEGACY_REFERENCES,
  REMOVED_COMPATIBILITY_BOUNDARY_SHIMS,
  REMOVED_LEGACY_RUNTIME_IDENTITIES,
} from '../../../lib/nexus/io/compatibility-surface';

describe('nexus compatibility surface contract', () => {
  test('freezes the final two-state compatibility model', () => {
    expect(COMPATIBILITY_SURFACE_STATUSES).toEqual({
      removed_from_active_path: 'removed_from_active_path',
      historical_record_only: 'historical_record_only',
    });
  });

  test('tracks removed shims, removed runtime identities, and historical residue explicitly', () => {
    expect(REMOVED_COMPATIBILITY_BOUNDARY_SHIMS).toEqual([
      'bin/gstack-config',
      'bin/gstack-relink',
      'bin/gstack-uninstall',
      'bin/gstack-update-check',
      'bin/gstack-analytics',
      'bin/gstack-community-dashboard',
      'bin/gstack-global-discover',
      'bin/gstack-learnings-log',
      'bin/gstack-learnings-search',
      'bin/gstack-review-log',
      'bin/gstack-review-read',
      'bin/gstack-repo-mode',
      'bin/gstack-slug',
      'bin/gstack-telemetry-log',
      'bin/gstack-telemetry-sync',
    ]);

    expect(REMOVED_LEGACY_RUNTIME_IDENTITIES).toEqual([
      'bin/gstack-patch-names',
      'bin/gstack-diff-scope',
      'bin/gstack-platform-detect',
      'bin/gstack-open-url',
      'bin/gstack-extension',
      'gstack-upgrade',
      '~/.gstack',
      '.gstack-worktrees',
      '~/.gstack-dev',
    ]);

    expect(HISTORICAL_LEGACY_REFERENCES).toEqual(['archived docs and closeouts']);
  });

  test('describes every remaining legacy residue through the shared contract', () => {
    const byStatus = Object.groupBy(COMPATIBILITY_SURFACES, (surface) => surface.status);

    expect(byStatus.removed_from_active_path?.map((surface) => surface.path)).toEqual([
      ...REMOVED_COMPATIBILITY_BOUNDARY_SHIMS,
      ...REMOVED_LEGACY_RUNTIME_IDENTITIES,
    ]);
    expect(byStatus.historical_record_only?.map((surface) => surface.path)).toEqual(HISTORICAL_LEGACY_REFERENCES);
  });
});
