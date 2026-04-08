export const COMPATIBILITY_SURFACE_STATUSES = {
  removed_from_active_path: 'removed_from_active_path',
  historical_record_only: 'historical_record_only',
} as const;

export type CompatibilitySurfaceStatus =
  (typeof COMPATIBILITY_SURFACE_STATUSES)[keyof typeof COMPATIBILITY_SURFACE_STATUSES];

export type CompatibilitySurfaceKind = 'former_shim' | 'former_runtime_identity' | 'historical_reference';

export type CompatibilitySurface = {
  id: string;
  path: string;
  kind: CompatibilitySurfaceKind;
  status: CompatibilitySurfaceStatus;
  notes: string;
};

export const REMOVED_GSTACK_BOUNDARY_SHIMS = [
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
] as const;

export const REMOVED_GSTACK_RUNTIME_IDENTITIES = [
  'bin/gstack-patch-names',
  'bin/gstack-diff-scope',
  'bin/gstack-platform-detect',
  'bin/gstack-open-url',
  'bin/gstack-extension',
  'gstack-upgrade',
  '~/.gstack',
  '.gstack-worktrees',
  '~/.gstack-dev',
] as const;

export const HISTORICAL_GSTACK_REFERENCES = [
  'repository remote naming',
  'archived docs and closeouts',
] as const;

export const COMPATIBILITY_SURFACE_RULES = {
  removed_gstack_boundary_shims: REMOVED_GSTACK_BOUNDARY_SHIMS,
  removed_gstack_runtime_identities: REMOVED_GSTACK_RUNTIME_IDENTITIES,
  historical_gstack_references: HISTORICAL_GSTACK_REFERENCES,
} as const;

export const GSTACK_COMPATIBILITY_SURFACES: readonly CompatibilitySurface[] = [
  ...REMOVED_GSTACK_BOUNDARY_SHIMS.map((path) => ({
    id: path.replaceAll(/[/.~]/g, '-').replaceAll('--', '-'),
    path,
    kind: 'former_shim' as const,
    status: COMPATIBILITY_SURFACE_STATUSES.removed_from_active_path,
    notes: 'Former compatibility shim removed from the live Nexus surface.',
  })),
  ...REMOVED_GSTACK_RUNTIME_IDENTITIES.map((path) => ({
    id: path.replaceAll(/[/.~]/g, '-').replaceAll('--', '-'),
    path,
    kind: 'former_runtime_identity' as const,
    status: COMPATIBILITY_SURFACE_STATUSES.removed_from_active_path,
    notes: 'Former runtime or state identity removed from the live Nexus path.',
  })),
  ...HISTORICAL_GSTACK_REFERENCES.map((path) => ({
    id: path.replaceAll(/[/.~ ]/g, '-').replaceAll('--', '-'),
    path,
    kind: 'historical_reference' as const,
    status: COMPATIBILITY_SURFACE_STATUSES.historical_record_only,
    notes: 'Historical-only reference retained outside the active Nexus path.',
  })),
] as const;
