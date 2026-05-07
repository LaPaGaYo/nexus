import { spawnSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join, relative } from 'path';

export const UNIT_TEST_ROOTS = [
  'runtimes/browse/test',
  'test',
];

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

export function hasJunitFailures(output: string): boolean {
  return Array.from(output.matchAll(/\b(?:failures|errors)="([0-9]+)"/g))
    .some((match) => Number(match[1]) > 0);
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

function junitPath(): string {
  return join(tmpdir(), `nexus-bun-test-${process.pid}-${Date.now()}.xml`);
}

export function runUnitTests(args: string[] = defaultUnitTestArgs()): number {
  const reportPath = junitPath();
  const result = spawnSync('bun', [
    'test',
    ...args,
    '--reporter',
    'junit',
    '--reporter-outfile',
    reportPath,
  ], {
    stdio: 'inherit',
  });

  if (result.error) {
    rmSync(reportPath, { force: true });
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }

  const status = typeof result.status === 'number' ? result.status : 1;
  if (status !== 0) {
    rmSync(reportPath, { force: true });
    return status;
  }

  if (!existsSync(reportPath)) {
    process.stderr.write(`bun test did not write the expected JUnit report: ${reportPath}\n`);
    return 1;
  }

  const report = readFileSync(reportPath, 'utf8');
  rmSync(reportPath, { force: true });
  return hasJunitFailures(report) ? 1 : 0;
}

if (import.meta.main) {
  process.exit(runUnitTests(unitTestArgsFromCli(process.argv.slice(2))));
}
