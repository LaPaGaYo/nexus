import { describe, expect, test } from 'bun:test';
import {
  PLACEHOLDER_OUTCOME,
  RUN_STATUSES,
  type CanonicalCommandId,
  type RunStatus,
} from '../../lib/nexus/types';

describe('nexus types', () => {
  test('freezes placeholder outcome model', () => {
    expect(PLACEHOLDER_OUTCOME).toEqual({
      state: 'blocked',
      decision: 'not_implemented',
      ready: false,
    });
  });

  test('freezes the run-level status enum', () => {
    expect(RUN_STATUSES).toEqual(['active', 'blocked', 'completed', 'refused']);
  });

  test('canonical command ids include the full Nexus surface', () => {
    const commands: CanonicalCommandId[] = [
      'discover',
      'frame',
      'plan',
      'handoff',
      'build',
      'review',
      'qa',
      'ship',
      'closeout',
    ];

    expect(commands).toHaveLength(9);
  });

  test('run status stays string-literal typed', () => {
    const status: RunStatus = 'active';
    expect(status).toBe('active');
  });
});
