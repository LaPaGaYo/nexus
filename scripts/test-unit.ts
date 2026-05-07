import { spawnSync } from 'child_process';

export const UNIT_TEST_ARGS = [
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
];

const BUN_TEST_OUTPUT_BUFFER_BYTES = 64 * 1024 * 1024;

export function hasBunTestFailureMarkers(output: string): boolean {
  return /^\s*\(fail\)\s+\S+/m.test(output)
    || /^\s*[1-9]\d*\s+fail\b/im.test(output);
}

export function unitTestArgsFromCli(argv: string[]): string[] {
  const delimiter = argv.indexOf('--');
  if (delimiter >= 0) {
    const explicitArgs = argv.slice(delimiter + 1);
    return explicitArgs.length > 0 ? explicitArgs : UNIT_TEST_ARGS;
  }

  return argv.length > 0 ? argv : UNIT_TEST_ARGS;
}

export function runUnitTests(args: string[] = UNIT_TEST_ARGS): number {
  const result = spawnSync('bun', ['test', ...args], {
    encoding: 'utf8',
    maxBuffer: BUN_TEST_OUTPUT_BUFFER_BYTES,
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  process.stdout.write(stdout);
  process.stderr.write(stderr);

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  const status = typeof result.status === 'number' ? result.status : 1;
  if (status !== 0) {
    return status;
  }

  return hasBunTestFailureMarkers(`${stdout}\n${stderr}`) ? 1 : 0;
}

if (import.meta.main) {
  process.exit(runUnitTests(unitTestArgsFromCli(process.argv.slice(2))));
}
