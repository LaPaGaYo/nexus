// test/nexus/learning/context/ranking.test.ts
import { describe, test, expect } from 'bun:test';
import { STRENGTH_MAX, scoreEntry } from '../../../../lib/nexus/learning/context/ranking';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';
import type { NormalizedEntry } from '../../../../lib/nexus/learning/normalize';

function e(over: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    id: 'lrn_x', ts: new Date(0).toISOString(), writer_skill: 'investigate', type: 'pitfall',
    key: 'socket timeout', insight: 'build socket retries on slow ci',
    confidence: 8, source: 'observed', files: ['lib/net/socket.ts'],
    subject_skill: 'investigate', subject_stage: 'build', evidence_type: 'test-output',
    ...(over as object),
  } as NormalizedEntry;
}
const ctx = { stage: 'build' as const, changedFiles: ['lib/net/socket.ts'], skillNames: ['investigate'], now: 0 };

describe('STRENGTH_MAX', () => {
  test('is the max possible computeStrength output (8), derived not hardcoded', () => {
    expect(STRENGTH_MAX).toBe(8);
  });
});

describe('scoreEntry', () => {
  test('returns score in [0,1] with per-factor contributions summing to score', () => {
    const r = scoreEntry(e(), [e()], ctx, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
    const sum =
      r.factors.relevance.contribution +
      r.factors.effective_confidence.contribution +
      r.factors.evidence_strength.contribution +
      r.factors.file_overlap.contribution +
      r.factors.stage_match.contribution +
      r.factors.contradiction_risk.contribution;
    expect(sum).toBeCloseTo(r.score, 10);
  });

  test('contradiction penalty pushes a superseded entry below the score floor', () => {
    const a = e({ id: 'lrn_a' });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], ctx, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.factors.contradiction_risk.value).toBe(1);
    expect(r.score).toBeLessThan(DEFAULT_LEARNING_CONTEXT_CONFIG.score_floor);
  });

  test('clamps at 0 (never negative even with full contradiction penalty)', () => {
    const a = e({ id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz', subject_stage: 'closeout', files: [] });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBe(0);
  });
});
