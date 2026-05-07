import { spawnSync } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export const UNIT_TEST_ROOTS = [
  'runtimes/browse/test',
  'test',
];

const BUN_TEST_OUTPUT_BUFFER_BYTES = 64 * 1024 * 1024;
const TEST_FILE_SUFFIX = '.test.ts';

const EXCLUDED_UNIT_TEST_FILES = new Set([
  'test/codex-e2e.test.ts',
  'test/gemini-e2e.test.ts',
  'test/skill-e2e.test.ts',
  'test/skill-llm-eval.test.ts',
  'test/skill-routing-e2e.test.ts',
]);

const EXCLUDED_UNIT_TEST_PATTERNS = [
  /^test\/skill-e2e-.*\.test\.ts$/,
];

export function hasBunTestFailureMarkers(output: string): boolean {
  return /^\s*\(fail\)\s+\S+/m.test(output)
    || /^\s*[1-9]\d*\s+fail\b/im.test(output);
}

function toRepoPath(repoRoot: string, filePath: string): string {
  return relative(repoRoot, filePath).replace(/\\/g, '/');
}

function collectTestFiles(repoRoot: string, rootPath: string): string[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  const entries = readdirSync(rootPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTestFiles(repoRoot, entryPath));
      continue;
    }

    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }

    if (!entry.name.endsWith(TEST_FILE_SUFFIX)) {
      continue;
    }

    if (!statSync(entryPath).isFile()) {
      continue;
    }

    files.push(toRepoPath(repoRoot, entryPath));
  }

  return files;
}

export function isDefaultUnitTestFile(repoPath: string): boolean {
  const normalizedPath = repoPath.replace(/\\/g, '/');
  if (!normalizedPath.endsWith(TEST_FILE_SUFFIX)) {
    return false;
  }

  if (EXCLUDED_UNIT_TEST_FILES.has(normalizedPath)) {
    return false;
  }

  return !EXCLUDED_UNIT_TEST_PATTERNS.some((pattern) => pattern.test(normalizedPath));
}

export function defaultUnitTestArgs(repoRoot = process.cwd()): string[] {
  return UNIT_TEST_ROOTS
    .flatMap((root) => collectTestFiles(repoRoot, join(repoRoot, root)))
    .filter(isDefaultUnitTestFile)
    .sort();
}

export function unitTestArgsFromCli(argv: string[], repoRoot = process.cwd()): string[] {
  const delimiter = argv.indexOf('--');
  if (delimiter >= 0) {
    const explicitArgs = argv.slice(delimiter + 1);
    return explicitArgs.length > 0 ? explicitArgs : defaultUnitTestArgs(repoRoot);
  }

  return argv.length > 0 ? argv : defaultUnitTestArgs(repoRoot);
}

export function runUnitTests(args: string[] = defaultUnitTestArgs()): number {
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
