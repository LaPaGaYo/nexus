import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getDefaultNexusAdapters, getRuntimeNexusAdapters } from '../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../lib/nexus/adapters/types';
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

const STUB_REJECTION_CASES: Array<{
  family: Exclude<keyof NexusAdapters, 'registry'>;
  mutate: (adapters: NexusAdapters) => void;
}> = [
  {
    family: 'discovery',
    mutate: (adapters) => {
      adapters.discovery = { ...adapters.discovery, kind: 'stub' };
    },
  },
  {
    family: 'planning',
    mutate: (adapters) => {
      adapters.planning = { ...adapters.planning, kind: 'stub' };
    },
  },
  {
    family: 'execution',
    mutate: (adapters) => {
      adapters.execution = { ...adapters.execution, kind: 'stub' };
    },
  },
  {
    family: 'ccb',
    mutate: (adapters) => {
      adapters.ccb = { ...adapters.ccb, kind: 'stub' };
    },
  },
  {
    family: 'local',
    mutate: (adapters) => {
      adapters.local = { ...adapters.local, kind: 'stub' };
    },
  },
];

function productionCommandContext(adapters: NexusAdapters) {
  const invocation = resolveInvocation('discover');
  return {
    invocation,
    ctx: {
      cwd: makeTempRepo(),
      clock: () => new Date().toISOString(),
      via: invocation.via,
      adapters,
      execution: {
        mode: 'governed_ccb' as const,
        primary_provider: 'codex' as const,
        provider_topology: 'multi_session' as const,
        requested_execution_path: 'codex-via-ccb' as const,
      },
    },
  };
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
    expect(getDefaultNexusAdapters().registry.ship.execution).toBe('active');
    expect(getDefaultNexusAdapters().registry.ship.local).toBe('active');
  });

  test('marks default adapters as stubs and runtime adapters as production-safe', () => {
    const defaults = getDefaultNexusAdapters();
    const runtime = getRuntimeNexusAdapters();

    expect(defaults.discovery.kind).toBe('stub');
    expect(defaults.planning.kind).toBe('stub');
    expect(defaults.execution.kind).toBe('stub');
    expect(defaults.ccb.kind).toBe('stub');
    expect(defaults.local.kind).toBe('stub');
    expect(runtime.discovery.kind).toBe('runtime');
    expect(runtime.planning.kind).toBe('runtime');
    expect(runtime.execution.kind).toBe('runtime');
    expect(runtime.ccb.kind).toBe('runtime');
    expect(runtime.local.kind).toBe('runtime');
  });

  test.each(STUB_REJECTION_CASES)('refuses dispatch when $family adapter is stub', async ({ family, mutate }) => {
    const adapters = getRuntimeNexusAdapters();
    mutate(adapters);
    const { invocation, ctx } = productionCommandContext(adapters);

    await expect(invocation.handler(ctx)).rejects.toThrow(
      `Refusing to run lifecycle command with non-runtime ${family} adapter. Use getRuntimeNexusAdapters() in production.`,
    );
  });

  test.each(STUB_REJECTION_CASES)('treats missing $family adapter kind as stub-equivalent', async ({ family }) => {
    const adapters = getRuntimeNexusAdapters();
    (adapters[family] as unknown as { kind: unknown }).kind = undefined;
    const { invocation, ctx } = productionCommandContext(adapters);

    await expect(invocation.handler(ctx)).rejects.toThrow(
      `Refusing to run lifecycle command with non-runtime ${family} adapter. Use getRuntimeNexusAdapters() in production.`,
    );
  });
});
