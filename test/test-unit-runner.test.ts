import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import {
  defaultUnitTestArgs,
  hasBunTestFailureMarkers,
  hasJunitFailures,
  isDefaultUnitTestFile,
  unitTestArgsFromCli,
} from '../scripts/test-unit';

describe('unit test runner gate', () => {
  test('detects Bun failure markers when the process status is misleading', () => {
    expect(hasBunTestFailureMarkers('ok 1\n(fail) rejects stale runtime path [12ms]\n')).toBe(true);
    expect(hasBunTestFailureMarkers('18 pass\n3 fail\n')).toBe(true);
    expect(hasBunTestFailureMarkers('18 pass\n0 skipped\n')).toBe(false);
    expect(hasBunTestFailureMarkers('Usage mentions --profile and --proxy flags\n')).toBe(false);
  });

  test('detects JUnit failure and error counts from the structured report', () => {
    expect(hasJunitFailures('<testsuites tests="1" failures="0" errors="0" />')).toBe(false);
    expect(hasJunitFailures('<testsuites tests="1" failures="1" errors="0" />')).toBe(true);
    expect(hasJunitFailures('<testsuites tests="1" failures="0" errors="2" />')).toBe(true);
  });

  test('honors explicit CLI test arguments after the delimiter', () => {
    expect(unitTestArgsFromCli(['--', 'test/example.test.ts'])).toEqual(['test/example.test.ts']);
  });

  test('enumerates unit tests without loading eval and e2e suites', () => {
    const repoRoot = join(import.meta.dir, '..');
    const unitArgs = defaultUnitTestArgs(repoRoot);

    expect(unitArgs).toContain('test/test-unit-runner.test.ts');
    expect(unitArgs).toContain('runtimes/browse/test/adversarial-security.test.ts');
    expect(unitArgs).not.toContain('runtimes/browse/test/commands.test.ts');
    expect(unitArgs).not.toContain('runtimes/browse/test/compare-board.test.ts');
    expect(unitArgs).not.toContain('runtimes/browse/test/handoff.test.ts');
    expect(unitArgs).not.toContain('runtimes/browse/test/snapshot.test.ts');
    expect(unitArgs).not.toContain('test/skill-e2e.test.ts');
    expect(unitArgs).not.toContain('test/skill-e2e-review.test.ts');
    expect(unitArgs).not.toContain('test/skill-llm-eval.test.ts');
    expect(unitArgs).not.toContain('test/skill-routing-e2e.test.ts');
    expect(unitArgs).not.toContain('test/codex-e2e.test.ts');
    expect(unitArgs).not.toContain('test/gemini-e2e.test.ts');
  });

  test('classifies default unit test files from repo paths', () => {
    expect(isDefaultUnitTestFile('test/package-scripts.test.ts')).toBe(true);
    expect(isDefaultUnitTestFile('runtimes/browse/test/adversarial-security.test.ts')).toBe(true);
    expect(isDefaultUnitTestFile('test\\package-scripts.test.ts')).toBe(true);
    expect(isDefaultUnitTestFile('runtimes/browse/test/commands.test.ts')).toBe(false);
    expect(isDefaultUnitTestFile('runtimes/browse/test/handoff.test.ts')).toBe(false);
    expect(isDefaultUnitTestFile('test/skill-e2e.test.ts')).toBe(false);
    expect(isDefaultUnitTestFile('test/skill-e2e-review.test.ts')).toBe(false);
    expect(isDefaultUnitTestFile('test/skill-llm-eval.test.ts')).toBe(false);
    expect(isDefaultUnitTestFile('test/fixture.ts')).toBe(false);
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
  }, 15_000);
});
