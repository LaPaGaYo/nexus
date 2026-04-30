import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join, posix } from 'path';

export type CompatAliasResolution =
  | { kind: 'missing'; target_path: null }
  | { kind: 'directory'; target_path: string }
  | { kind: 'symlink'; target_path: string }
  | { kind: 'git_symlink_file'; target_path: string }
  | { kind: 'invalid'; target_path: null };

export type ResolveCompatAliasOptions = {
  markerPath?: string;
  maxSymlinkFileBytes?: number;
};

const DEFAULT_MAX_SYMLINK_FILE_BYTES = 4096;

function normalizeTarget(target: string): string {
  const normalized = posix.normalize(target.trim().replace(/\\/g, '/'));
  return normalized === '.' ? '' : normalized.replace(/\/+$/, '');
}

export function resolveCompatAlias(
  repoRoot: string,
  aliasPath: string,
  expectedTargetPath: string,
  options: ResolveCompatAliasOptions = {},
): CompatAliasResolution {
  const fullPath = join(repoRoot, aliasPath);
  const expectedTarget = normalizeTarget(expectedTargetPath);

  if (!existsSync(fullPath)) {
    return { kind: 'missing', target_path: null };
  }

  const stat = lstatSync(fullPath);

  if (stat.isSymbolicLink()) {
    const target = normalizeTarget(readlinkSync(fullPath));
    return target === expectedTarget
      ? { kind: 'symlink', target_path: target }
      : { kind: 'invalid', target_path: null };
  }

  if (stat.isDirectory()) {
    if (options.markerPath) {
      const markerPath = join(fullPath, ...options.markerPath.split('/').filter(Boolean));
      if (!existsSync(markerPath)) {
        return { kind: 'invalid', target_path: null };
      }
    }
    return { kind: 'directory', target_path: expectedTarget };
  }

  if (stat.isFile()) {
    const maxSymlinkFileBytes =
      options.maxSymlinkFileBytes ?? DEFAULT_MAX_SYMLINK_FILE_BYTES;
    if (stat.size > maxSymlinkFileBytes) {
      return { kind: 'invalid', target_path: null };
    }

    const content = readFileSync(fullPath, 'utf8');
    if (content.includes('\n') || content.includes('\r')) {
      return { kind: 'invalid', target_path: null };
    }

    const target = normalizeTarget(content);
    return target === expectedTarget
      ? { kind: 'git_symlink_file', target_path: target }
      : { kind: 'invalid', target_path: null };
  }

  return { kind: 'invalid', target_path: null };
}
