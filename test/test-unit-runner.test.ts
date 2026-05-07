import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import {
  hasBunTestFailureMarkers,
  unitTestArgsFromCli,
} from '../scripts/test-unit';

describe('unit test runner gate', () => {
  test('detects Bun failure markers when the process status is misleading', () => {
    expect(hasBunTestFailureMarkers('ok 1\n(fail) rejects stale runtime path [12ms]\n')).toBe(true);
    expect(hasBunTestFailureMarkers('18 pass\n3 fail\n')).toBe(true);
    expect(hasBunTestFailureMarkers('18 pass\n0 skipped\n')).toBe(false);
    expect(hasBunTestFailureMarkers('Usage mentions --profile and --proxy flags\n')).toBe(false);
  });

  test('honors explicit CLI test arguments after the delimiter', () => {
    expect(unitTestArgsFromCli(['--', 'test/example.test.ts'])).toEqual(['test/example.test.ts']);
  });

  test('exits non-zero for a deliberately failing test file', () => {
    const repoRoot = join(import.meta.dir, '..');
    const tempDir = mkdtempSync(join(tmpdir(), 'nexus-test-unit-runner-'));

    try {
      const failingTest = join(tempDir, 'intentional-failure.test.ts');
      writeFileSync(
        failingTest,
        [
          "import { expect, test } from 'bun:test';",
          "test('intentional failure for runner smoke', () => {",
          "  expect(false).toBe(true);",
          '});',
          '',
        ].join('\n'),
        'utf8',
      );

      const result = spawnSync('bun', ['run', 'scripts/test-unit.ts', '--', failingTest], {
        cwd: repoRoot,
        encoding: 'utf8',
      });
      const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

      expect(result.status).not.toBe(0);
      expect(hasBunTestFailureMarkers(output)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
