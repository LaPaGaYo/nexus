import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDefaultNexusAdapters, getRuntimeNexusAdapters } from '../../lib/nexus/adapters/registry';
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
    expect(getDefaultNexusAdapters().registry.ship.local).toBe('active');
  });

  test('marks default adapters as stubs and runtime adapters as production-safe', () => {
    const defaults = getDefaultNexusAdapters();
    const runtime = getRuntimeNexusAdapters();

    expect(defaults.pm.kind).toBe('stub');
    expect(defaults.gsd.kind).toBe('stub');
    expect(defaults.superpowers.kind).toBe('stub');
    expect(defaults.ccb.kind).toBe('stub');
    expect(defaults.local.kind).toBe('stub');
    expect(runtime.pm.kind).toBe('runtime');
    expect(runtime.gsd.kind).toBe('runtime');
    expect(runtime.superpowers.kind).toBe('runtime');
    expect(runtime.ccb.kind).toBe('runtime');
    expect(runtime.local.kind).toBe('runtime');
  });

  test('refuses to run lifecycle commands with stub adapters by default', async () => {
    const invocation = resolveInvocation('discover');
    const ctx = {
      cwd: makeTempRepo(),
      clock: () => new Date().toISOString(),
      via: invocation.via,
      adapters: getDefaultNexusAdapters(),
      execution: {
        mode: 'governed_ccb' as const,
        primary_provider: 'codex' as const,
        provider_topology: 'multi_session' as const,
        requested_execution_path: 'codex-via-ccb' as const,
      },
    };

    await expect(invocation.handler(ctx)).rejects.toThrow(
      'Refusing to run lifecycle command with stub pm adapter. Use getRuntimeNexusAdapters() in production.',
    );
  });
});
