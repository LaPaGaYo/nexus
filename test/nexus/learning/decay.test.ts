// test/nexus/learning/decay.test.ts
import { describe, test, expect } from 'bun:test';
import { computeEffectiveConfidence } from '../../../lib/nexus/learning/decay';

const DAY = 86_400_000;
function entry(over: Partial<{ confidence: number; source: string; ts: string }> = {}) {
  return {
    confidence: 8,
    source: 'observed' as const,
    ts: new Date(0).toISOString(),
    ...over,
  } as { confidence: number; source: 'observed' | 'inferred' | 'cross-model' | 'user-stated' | 'team-consensus' | 'external-reference' | 'speculation' | 'unknown'; ts: string };
}

describe('computeEffectiveConfidence', () => {
  test('observed decays 1pt per 30 full days', () => {
    const now = 75 * DAY; // 75 days → floor(75/30) = 2 lost
    expect(computeEffectiveConfidence(entry({ confidence: 8, source: 'observed', ts: new Date(0).toISOString() }), now)).toBe(6);
  });

  test('inferred decays the same way', () => {
    const now = 60 * DAY; // floor(60/30) = 2
    expect(computeEffectiveConfidence(entry({ confidence: 9, source: 'inferred', ts: new Date(0).toISOString() }), now)).toBe(7);
  });

  test('non observed/inferred sources do NOT decay', () => {
    const now = 365 * DAY;
    for (const s of ['cross-model', 'user-stated', 'team-consensus', 'external-reference', 'speculation', 'unknown'] as const) {
      expect(computeEffectiveConfidence(entry({ confidence: 7, source: s, ts: new Date(0).toISOString() }), now)).toBe(7);
    }
  });

  test('exactly 30 days = 1pt lost; 29 days = 0 lost', () => {
    expect(computeEffectiveConfidence(entry({ confidence: 5, source: 'observed', ts: new Date(0).toISOString() }), 30 * DAY)).toBe(4);
    expect(computeEffectiveConfidence(entry({ confidence: 5, source: 'observed', ts: new Date(0).toISOString() }), 29 * DAY)).toBe(5);
  });

  test('floors at 0, never negative', () => {
    expect(computeEffectiveConfidence(entry({ confidence: 2, source: 'observed', ts: new Date(0).toISOString() }), 365 * DAY)).toBe(0);
  });

  test('missing/zero confidence defaults to 5 before decay', () => {
    expect(computeEffectiveConfidence(entry({ confidence: 0, source: 'team-consensus', ts: new Date(0).toISOString() }), 0)).toBe(5);
    // 0 confidence + observed + 60 days → 5 then floor(60/30)=2 → 3
    expect(computeEffectiveConfidence(entry({ confidence: 0, source: 'observed', ts: new Date(0).toISOString() }), 60 * DAY)).toBe(3);
  });

  test('now defaults to Date.now() when omitted', () => {
    const recent = new Date(Date.now() - 5 * DAY).toISOString();
    expect(computeEffectiveConfidence(entry({ confidence: 6, source: 'observed', ts: recent }))).toBe(6);
  });
});
