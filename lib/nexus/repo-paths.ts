import { resolve } from 'path';

export const BROWSE_RUNTIME_BIN_PATH = 'runtimes/browse/dist/browse' as const;
export const BROWSE_RUNTIME_DIST_PATH = 'runtimes/browse/dist' as const;

export const REVIEW_DESIGN_CHECKLIST_SOURCE_PATH =
  'references/review/design-checklist.md' as const;

export const REVIEW_DESIGN_CHECKLIST_COMPAT_PATH =
  'review/design-checklist.md' as const;

export function repoPathToNativePath(root: string, repoPath: string): string {
  return resolve(root, ...repoPath.split('/').filter(Boolean));
}

export function browseRuntimeBinPath(root: string): string {
  return repoPathToNativePath(root, BROWSE_RUNTIME_BIN_PATH);
}
