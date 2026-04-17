import { describe, expect, test } from 'bun:test';

import { resolveRuntimeInvocation } from '../../lib/nexus/runtime-invocation';

describe('resolveRuntimeInvocation', () => {
  test('parses discover continuation mode from the CLI flag', () => {
    const resolved = resolveRuntimeInvocation(['discover', '--continuation-mode', 'task'], {});

    expect(resolved.command).toBe('discover');
    expect(resolved.continuationModeOverride).toBe('task');
  });

  test('prefers the CLI flag over NEXUS_CONTINUATION_MODE', () => {
    const resolved = resolveRuntimeInvocation(
      ['discover', '--continuation-mode', 'task'],
      { NEXUS_CONTINUATION_MODE: 'phase' },
    );

    expect(resolved.continuationModeOverride).toBe('task');
  });

  test('uses NEXUS_CONTINUATION_MODE when the CLI flag is absent', () => {
    const resolved = resolveRuntimeInvocation(['discover'], { NEXUS_CONTINUATION_MODE: 'phase' });

    expect(resolved.continuationModeOverride).toBe('phase');
  });

  test('rejects invalid continuation modes', () => {
    expect(() => resolveRuntimeInvocation(['discover', '--continuation-mode', 'milestone'], {})).toThrow(
      /Invalid continuation mode/i,
    );
  });

  test('rejects continuation mode flags on non-discover commands', () => {
    expect(() => resolveRuntimeInvocation(['review', '--continuation-mode', 'task'], {})).toThrow(
      /only supported for discover/i,
    );
  });

  test('rejects unknown CLI arguments', () => {
    expect(() => resolveRuntimeInvocation(['discover', '--bogus'], {})).toThrow(/Unknown Nexus argument/i);
  });
});
