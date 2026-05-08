import { describe, expect, test } from 'bun:test';
import { Glob } from 'bun';
import { readFileSync } from 'fs';
import { join } from 'path';

import { resolveRuntimeCwd } from '../../../lib/nexus/runtime/cwd';

const ROOT = join(import.meta.dir, '..', '..', '..');
const PROCESS_CWD_EXEMPTIONS = new Set([
  'lib/nexus/runtime/cwd.ts',
]);
const PROCESS_CWD_PATTERN = /process\.cwd\(\s*\)/g;

describe('resolveRuntimeCwd', () => {
  test('returns the process cwd when no override is set', () => {
    expect(resolveRuntimeCwd({}, '/tmp/project')).toBe('/tmp/project');
  });

  test('prefers NEXUS_PROJECT_CWD when provided', () => {
    expect(resolveRuntimeCwd({ NEXUS_PROJECT_CWD: '/tmp/active-project' }, '/tmp/nexus-install')).toBe(
      '/tmp/active-project',
    );
  });

  test('ignores blank overrides', () => {
    expect(resolveRuntimeCwd({ NEXUS_PROJECT_CWD: '   ' }, '/tmp/project')).toBe('/tmp/project');
  });

  test('keeps library helpers on explicit cwd parameters', async () => {
    const glob = new Glob('lib/nexus/**/*.ts');
    const sampleMatches = [
      'const cwd = process.cwd();',
      'const config = { cwd: process.cwd() };',
      'someFn(process.cwd())',
      'function f(cwd: string = process.cwd()) { return cwd; }',
    ].flatMap((sample) => [...sample.matchAll(PROCESS_CWD_PATTERN)]);
    expect(sampleMatches.length).toBe(4);

    const ambientCwdCalls: string[] = [];

    for await (const scannedFile of glob.scan(ROOT)) {
      const file = scannedFile.replace(/\\/g, '/');
      if (PROCESS_CWD_EXEMPTIONS.has(file)) {
        continue;
      }
      const content = readFileSync(join(ROOT, file), 'utf8');
      for (const match of content.matchAll(PROCESS_CWD_PATTERN)) {
        ambientCwdCalls.push(`${file}:${match.index}`);
      }
    }

    expect(ambientCwdCalls).toEqual([]);
  });
});
