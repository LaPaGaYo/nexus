import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST, LEGACY_ALIASES, resolveCommandName } from '../../lib/nexus/command-manifest';
import { resolveInvocation } from '../../lib/nexus/commands';

describe('nexus alias safety', () => {
  test('aliases resolve to canonical commands only', () => {
    for (const [alias, command] of Object.entries(LEGACY_ALIASES)) {
      expect(resolveCommandName(alias)).toBe(command);
      expect(alias in CANONICAL_MANIFEST).toBe(false);
    }
  });

  test('aliases reuse canonical artifact and transition contracts', () => {
    for (const [alias, command] of Object.entries(LEGACY_ALIASES)) {
      const invocation = resolveInvocation(alias);

      expect(invocation.command).toBe(command);
      expect(invocation.via).toBe(alias);
      expect(invocation.contract.durable_outputs).toEqual(CANONICAL_MANIFEST[command].durable_outputs);
      expect(invocation.contract.legal_predecessors).toEqual(CANONICAL_MANIFEST[command].legal_predecessors);
    }
  });
});
