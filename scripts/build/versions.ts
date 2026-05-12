/**
 * scripts/build/versions.ts — write runtime version markers for sidecar binaries.
 *
 * Resolution order:
 *   1. git rev-parse HEAD  — used in dev installs (the repo has a .git directory)
 *   2. release.json tag    — used in release tarball installs (no .git, but release.json is shipped)
 *   3. literal "release"   — final fallback so build never fails for lack of provenance
 *
 * Replaces an earlier inline `git rev-parse HEAD > path` chain that hard-failed when
 * `.git` was absent (e.g. release tarball setup). See v1.1.1 release notes.
 */
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const TARGETS = [
  'runtimes/browse/dist/.version',
  'runtimes/design/dist/.version',
];

function resolveVersion(): { value: string; source: string } {
  if (existsSync('.git')) {
    const result = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) {
      return { value: result.stdout.trim(), source: 'git rev-parse HEAD' };
    }
  }

  if (existsSync('release.json')) {
    try {
      const release = JSON.parse(readFileSync('release.json', 'utf8')) as { tag?: unknown };
      if (typeof release.tag === 'string' && release.tag.length > 0) {
        return { value: release.tag, source: 'release.json tag' };
      }
    } catch {
      // fall through
    }
  }

  return { value: 'release', source: 'literal fallback' };
}

const { value, source } = resolveVersion();
for (const target of TARGETS) {
  writeFileSync(target, value + '\n');
}
console.log(`build:versions: wrote "${value}" (source: ${source}) to ${TARGETS.length} files`);
