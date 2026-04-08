export const COMPATIBILITY_SURFACE_STATUSES = {
  removed_from_active_path: 'removed_from_active_path',
  retained_compatibility_shim: 'retained_compatibility_shim',
  deferred_final_removal: 'deferred_final_removal',
} as const;

export type CompatibilitySurfaceStatus =
  (typeof COMPATIBILITY_SURFACE_STATUSES)[keyof typeof COMPATIBILITY_SURFACE_STATUSES];

export type CompatibilitySurfaceKind = 'boundary_shim' | 'internal_identity' | 'deferred_cleanup';

export type CompatibilitySurface = {
  id: string;
  path: string;
  kind: CompatibilitySurfaceKind;
  status: CompatibilitySurfaceStatus;
  notes: string;
};

export const RETAINED_BOUNDARY_COMPATIBILITY_SHIMS = [
  'bin/gstack-config',
  'bin/gstack-relink',
  'bin/gstack-uninstall',
  'bin/gstack-update-check',
] as const;

export const ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE = [
  'bin/gstack-patch-names',
  'bin/gstack-diff-scope',
  'bin/gstack-platform-detect',
  'bin/gstack-open-url',
  'bin/gstack-extension',
  'gstack-upgrade',
] as const;

export const DEFERRED_LEGACY_REMOVAL_SURFACES = [
  '~/.gstack',
  '.gstack-worktrees',
  '~/.gstack-dev',
  'repository remote naming',
] as const;

export const COMPATIBILITY_SURFACE_RULES = {
  retained_boundary_compatibility_shims: RETAINED_BOUNDARY_COMPATIBILITY_SHIMS,
  active_path_gstack_identities_to_remove: ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE,
  deferred_legacy_removal_surfaces: DEFERRED_LEGACY_REMOVAL_SURFACES,
} as const;

export const GSTACK_COMPATIBILITY_SURFACES: readonly CompatibilitySurface[] = [
  ...RETAINED_BOUNDARY_COMPATIBILITY_SHIMS.map((path) => ({
    id: path.replaceAll(/[/.~]/g, '-').replaceAll('--', '-'),
    path,
    kind: 'boundary_shim' as const,
    status: COMPATIBILITY_SURFACE_STATUSES.retained_compatibility_shim,
    notes: 'Boundary helper shim retained only for compatibility migration.',
  })),
  ...ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE.map((path) => ({
    id: path.replaceAll(/[/.~]/g, '-').replaceAll('--', '-'),
    path,
    kind: 'internal_identity' as const,
    status: COMPATIBILITY_SURFACE_STATUSES.removed_from_active_path,
    notes: 'Internal runtime identity that must leave the active Nexus path.',
  })),
  ...DEFERRED_LEGACY_REMOVAL_SURFACES.map((path) => ({
    id: path.replaceAll(/[/.~ ]/g, '-').replaceAll('--', '-'),
    path,
    kind: 'deferred_cleanup' as const,
    status: COMPATIBILITY_SURFACE_STATUSES.deferred_final_removal,
    notes: 'Deferred legacy surface scheduled for the final cleanup milestone.',
  })),
] as const;
