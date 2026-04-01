import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST, LEGACY_ALIASES, resolveCommandName } from '../../lib/nexus/command-manifest';

describe('nexus alias safety', () => {
  test('aliases resolve to canonical commands only', () => {
    for (const [alias, command] of Object.entries(LEGACY_ALIASES)) {
      expect(resolveCommandName(alias)).toBe(command);
      expect(alias in CANONICAL_MANIFEST).toBe(false);
    }
  });

  test('aliases reuse canonical artifact and transition contracts', () => {
    expect(CANONICAL_MANIFEST[resolveCommandName('office-hours')].durable_outputs).toEqual(
      CANONICAL_MANIFEST.discover.durable_outputs,
    );
    expect(CANONICAL_MANIFEST[resolveCommandName('office-hours')].legal_predecessors).toEqual(
      CANONICAL_MANIFEST.discover.legal_predecessors,
    );
    expect(CANONICAL_MANIFEST[resolveCommandName('autoplan')].durable_outputs).toEqual(
      CANONICAL_MANIFEST.plan.durable_outputs,
    );
    expect(CANONICAL_MANIFEST[resolveCommandName('autoplan')].legal_predecessors).toEqual(
      CANONICAL_MANIFEST.plan.legal_predecessors,
    );
  });
});
