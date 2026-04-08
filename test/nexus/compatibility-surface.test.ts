import { describe, expect, test } from 'bun:test';
import {
  COMPATIBILITY_SURFACE_STATUSES,
  GSTACK_COMPATIBILITY_SURFACES,
  HISTORICAL_GSTACK_REFERENCES,
  REMOVED_GSTACK_RUNTIME_IDENTITIES,
  REMOVED_GSTACK_BOUNDARY_SHIMS,
} from '../../lib/nexus/compatibility-surface';

describe('nexus compatibility surface contract', () => {
  test('freezes the final two-state compatibility model', () => {
    expect(COMPATIBILITY_SURFACE_STATUSES).toEqual({
      removed_from_active_path: 'removed_from_active_path',
      historical_record_only: 'historical_record_only',
    });
  });

  test('tracks removed shims, removed runtime identities, and historical residue explicitly', () => {
    expect(REMOVED_GSTACK_BOUNDARY_SHIMS).toEqual([
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

    expect(REMOVED_GSTACK_RUNTIME_IDENTITIES).toEqual([
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

    expect(HISTORICAL_GSTACK_REFERENCES).toEqual(['repository remote naming', 'archived docs and closeouts']);
  });

  test('describes every remaining gstack residue through the shared contract', () => {
    const byStatus = Object.groupBy(GSTACK_COMPATIBILITY_SURFACES, (surface) => surface.status);

    expect(byStatus.removed_from_active_path?.map((surface) => surface.path)).toEqual([
      ...REMOVED_GSTACK_BOUNDARY_SHIMS,
      ...REMOVED_GSTACK_RUNTIME_IDENTITIES,
    ]);
    expect(byStatus.historical_record_only?.map((surface) => surface.path)).toEqual(HISTORICAL_GSTACK_REFERENCES);
  });
});
