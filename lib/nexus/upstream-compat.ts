import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join } from 'path';

export type CompatAliasResolution =
  | { kind: 'missing'; target_path: null }
  | { kind: 'directory'; target_path: string }
  | { kind: 'symlink'; target_path: string }
  | { kind: 'git_symlink_file'; target_path: string }
  | { kind: 'invalid'; target_path: null };

function normalizeTarget(target: string): string {
  return target.trim().replace(/\\/g, '/').replace(/\/+$/, '');
}

export function resolveCompatAlias(
  repoRoot: string,
  aliasPath: string,
  expectedTargetPath: string,
): CompatAliasResolution {
  const fullPath = join(repoRoot, aliasPath);

  if (!existsSync(fullPath)) {
    return { kind: 'missing', target_path: null };
  }

  const stat = lstatSync(fullPath);

  if (stat.isSymbolicLink()) {
    const target = normalizeTarget(readlinkSync(fullPath));
    return target === expectedTargetPath
      ? { kind: 'symlink', target_path: target }
      : { kind: 'invalid', target_path: null };
  }

  if (stat.isDirectory()) {
    return { kind: 'directory', target_path: aliasPath };
  }

  if (stat.isFile()) {
    const target = normalizeTarget(readFileSync(fullPath, 'utf8'));
    return target === expectedTargetPath
      ? { kind: 'git_symlink_file', target_path: target }
      : { kind: 'invalid', target_path: null };
  }

  return { kind: 'invalid', target_path: null };
}
