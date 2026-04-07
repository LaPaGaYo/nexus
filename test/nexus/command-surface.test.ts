import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import { resolveInvocation } from '../../lib/nexus/commands/index';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

function makeTempRepo(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-command-surface-'));
  tempDirs.push(cwd);
  return cwd;
}

describe('nexus command dispatcher', () => {
  test('resolves aliases through canonical commands', () => {
    const invocation = resolveInvocation('office-hours');
    expect(invocation.command).toBe('discover');
    expect(invocation.via).toBe('office-hours');
  });

  test('keeps qa on the implemented canonical runtime while ship remains a placeholder', async () => {
    expect(resolveInvocation('qa').contract.implementation).toBe('implemented');

    const invocation = resolveInvocation('ship');
    const result = await invocation.handler({
      cwd: makeTempRepo(),
      clock: () => '2026-03-31T12:00:00Z',
      via: null,
      adapters: getDefaultNexusAdapters(),
    });

    expect(result.status.state).toBe('blocked');
    expect(result.status.decision).toBe('not_implemented');
    expect(result.status.ready).toBe(false);
  });
});
