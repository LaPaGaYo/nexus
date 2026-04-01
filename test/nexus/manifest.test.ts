import { describe, expect, test } from 'bun:test';
import {
  CANONICAL_MANIFEST,
  LEGACY_ALIASES,
  resolveCommandName,
} from '../../lib/nexus/command-manifest';

describe('nexus command manifest', () => {
  test('declares all canonical commands exactly once', () => {
    expect(Object.keys(CANONICAL_MANIFEST)).toEqual([
      'discover',
      'frame',
      'plan',
      'handoff',
      'build',
      'review',
      'qa',
      'ship',
      'closeout',
    ]);
  });

  test('maps start-work to discover only', () => {
    expect(LEGACY_ALIASES['start-work']).toBe('discover');
  });

  test('resolves aliases to canonical commands', () => {
    expect(resolveCommandName('office-hours')).toBe('discover');
    expect(resolveCommandName('autoplan')).toBe('plan');
    expect(resolveCommandName('verify-close')).toBe('closeout');
  });
});
