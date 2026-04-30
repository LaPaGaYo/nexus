import { resolve } from 'path';

export const BROWSE_RUNTIME_BIN_PATH = 'runtimes/browse/dist/browse' as const;
export const BROWSE_RUNTIME_DIST_PATH = 'runtimes/browse/dist' as const;

export const REVIEW_DESIGN_CHECKLIST_SOURCE_PATH =
  'references/review/design-checklist.md' as const;

export const REVIEW_DESIGN_CHECKLIST_COMPAT_PATH =
  'review/design-checklist.md' as const;

export const UPSTREAM_SOURCE_ROOT = 'vendor/upstream' as const;
export const UPSTREAM_NOTES_SOURCE_ROOT = 'vendor/upstream-notes' as const;

export const UPSTREAM_SOURCE_MARKER_PATH = 'README.md' as const;
export const UPSTREAM_NOTES_SOURCE_MARKER_PATH = 'upstream-lock.json' as const;

export const UPSTREAM_COMPAT_ROOT = 'upstream' as const;
export const UPSTREAM_NOTES_COMPAT_ROOT = 'upstream-notes' as const;

export function repoPathToNativePath(root: string, repoPath: string): string {
  return resolve(root, ...repoPath.split('/').filter(Boolean));
}

export function browseRuntimeBinPath(root: string): string {
  return repoPathToNativePath(root, BROWSE_RUNTIME_BIN_PATH);
}
