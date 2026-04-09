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

  test('keeps qa and ship on the implemented canonical runtime', async () => {
    expect(resolveInvocation('qa').contract.implementation).toBe('implemented');
    expect(resolveInvocation('ship').contract.implementation).toBe('implemented');
    expect(getDefaultNexusAdapters().registry.ship.superpowers).toBe('active');
  });
});
