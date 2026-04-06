import { describe, expect, test } from 'bun:test';
import { resolveInvocation } from '../../lib/nexus/commands';
import { assertCanonicalLifecycleEntrypoint } from '../../lib/nexus/migration-safety';

describe('nexus migration safety', () => {
  test('rejects upstream-native command names as governed lifecycle entrypoints', () => {
    expect(() => assertCanonicalLifecycleEntrypoint('gsd-plan-phase')).toThrow(/non-canonical/i);
    expect(() => assertCanonicalLifecycleEntrypoint('write-prd')).toThrow(/non-canonical/i);
    expect(() => assertCanonicalLifecycleEntrypoint('superpowers-build-discipline')).toThrow(/non-canonical/i);
  });

  test('dispatcher refuses backend-native entrypoints before lifecycle resolution', () => {
    expect(() => resolveInvocation('write-prd')).toThrow(/non-canonical lifecycle entrypoint refused/i);
    expect(() => resolveInvocation('gsd-plan-phase')).toThrow(/non-canonical lifecycle entrypoint refused/i);
  });
});
