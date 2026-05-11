import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_UNIT_TEST_ARGS,
  countBunFailMarkers,
  runWithFailMarkerGate,
} from '../scripts/test/unit';

const ROOT = join(import.meta.dir, '..');

describe('unit test wrapper', () => {
  test('detects only Bun fail markers anchored at the start of a line', () => {
    expect(countBunFailMarkers('')).toBe(0);
    expect(countBunFailMarkers('(pass) ok\n(fail) broken\n  (fail) indented text\n(fail) second\n')).toBe(2);
  });

  test('fails the gate when Bun returns 0 but emits fail markers', async () => {
    const result = await runWithFailMarkerGate(
      ['bun', '-e', 'console.log("(fail) synthetic hidden failure")'],
      {
        cwd: ROOT,
        stdout: () => {},
        stderr: () => {},
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.gatedExitCode).toBe(1);
  });

  test('package test script uses the fail-marker gate', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

    expect(pkg.scripts.test).toBe('bun run scripts/test/unit.ts');
  });

  test('default command preserves the existing local unit-test scope', () => {
    expect(DEFAULT_UNIT_TEST_ARGS).toEqual([
      'test',
      'runtimes/browse/test/',
      'test/',
      '--ignore',
      'test/skill-e2e-*.test.ts',
      '--ignore',
      'test/skill-llm-eval.test.ts',
      '--ignore',
      'test/skill-routing-e2e.test.ts',
      '--ignore',
      'test/codex-e2e.test.ts',
      '--ignore',
      'test/gemini-e2e.test.ts',
    ]);
  });
});
