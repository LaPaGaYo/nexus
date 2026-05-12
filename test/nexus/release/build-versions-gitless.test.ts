import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

/**
 * Regression test for v1.1.0 → v1.1.1 release-tarball bug.
 *
 * v1.1.0 shipped a `build:versions` npm script that hard-failed when `.git`
 * was absent. Release tarball setup runs in a freshly-extracted directory with
 * no `.git`, so install reliably broke with "fatal: not a git repository".
 *
 * v1.1.1 replaces the inline shell with `scripts/build/versions.ts`, which
 * resolves the version through (1) git, (2) `release.json` tag, (3) literal
 * "release" fallback. This test asserts the script behaves correctly in all
 * three contexts and especially does not exit non-zero when `.git` is absent.
 */

const REPO_ROOT = (() => {
  let dir = import.meta.dir;
  while (dir !== '/' && !existsSync(join(dir, 'package.json'))) {
    dir = join(dir, '..');
  }
  return dir;
})();

const VERSIONS_SCRIPT = join(REPO_ROOT, 'scripts/build/versions.ts');

let workDir: string;
beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'nexus-build-versions-'));
  mkdirSync(join(workDir, 'runtimes/browse/dist'), { recursive: true });
  mkdirSync(join(workDir, 'runtimes/design/dist'), { recursive: true });
  copyFileSync(VERSIONS_SCRIPT, join(workDir, 'versions.ts'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function runVersionsScript(): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('bun', ['run', 'versions.ts'], {
    cwd: workDir,
    encoding: 'utf8',
  });
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

describe('build:versions in release tarball (no .git)', () => {
  test('exits 0 when .git is absent and release.json carries a tag', () => {
    writeFileSync(
      join(workDir, 'release.json'),
      JSON.stringify({ schema_version: 1, product: 'nexus', tag: 'v1.1.1', version: '1.1.1' }),
    );

    expect(existsSync(join(workDir, '.git'))).toBe(false);
    const result = runVersionsScript();

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(workDir, 'runtimes/browse/dist/.version'), 'utf8').trim()).toBe('v1.1.1');
    expect(readFileSync(join(workDir, 'runtimes/design/dist/.version'), 'utf8').trim()).toBe('v1.1.1');
    expect(result.stdout).toContain('release.json tag');
  });

  test('exits 0 when .git is absent and release.json is missing (literal fallback)', () => {
    expect(existsSync(join(workDir, '.git'))).toBe(false);
    expect(existsSync(join(workDir, 'release.json'))).toBe(false);

    const result = runVersionsScript();

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(workDir, 'runtimes/browse/dist/.version'), 'utf8').trim()).toBe('release');
    expect(result.stdout).toContain('literal fallback');
  });

  test('exits 0 when release.json is malformed (falls through to literal)', () => {
    writeFileSync(join(workDir, 'release.json'), 'not valid json {{{');

    const result = runVersionsScript();

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(workDir, 'runtimes/browse/dist/.version'), 'utf8').trim()).toBe('release');
  });

  test('exits 0 when release.json has no tag field', () => {
    writeFileSync(
      join(workDir, 'release.json'),
      JSON.stringify({ schema_version: 1, product: 'nexus', version: '1.1.1' }),
    );

    const result = runVersionsScript();

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(workDir, 'runtimes/browse/dist/.version'), 'utf8').trim()).toBe('release');
  });
});
