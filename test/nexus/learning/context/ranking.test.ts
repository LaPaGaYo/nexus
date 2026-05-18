// test/nexus/learning/context/ranking.test.ts
import { describe, test, expect } from 'bun:test';
import { STRENGTH_MAX, scoreEntry } from '../../../../lib/nexus/learning/context/ranking';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';
import type { NormalizedEntry } from '../../../../lib/nexus/learning/normalize';

const NOW = Date.UTC(2026, 4, 1); // fixed, deterministic — no wall-clock dependence

function e(over: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    id: 'lrn_x', ts: new Date(NOW).toISOString(), writer_skill: 'investigate', type: 'pitfall',
    key: 'socket timeout', insight: 'build socket retries on slow ci',
    confidence: 8, source: 'observed', files: ['lib/net/socket.ts'],
    subject_skill: 'investigate', subject_stage: 'build', evidence_type: 'test-output',
    ...(over as object),
  } as NormalizedEntry;
}
const ctx = { stage: 'build' as const, changedFiles: ['lib/net/socket.ts'], skillNames: ['investigate'], now: NOW };

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

  test('contradiction penalty pushes a WEAK superseded entry below the score floor', () => {
    // weak on every positive factor (no relevance/file/stage match, low conf, weak evidence)
    const a = e({
      id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz',
      subject_stage: 'closeout', files: [], confidence: 2,
      source: 'speculation', evidence_type: 'speculation',
    });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.factors.contradiction_risk.value).toBe(1);
    expect(r.score).toBeLessThan(DEFAULT_LEARNING_CONTEXT_CONFIG.score_floor);
  });

  test('clamps at 0 (never negative even with full contradiction penalty)', () => {
    const a = e({ id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz', subject_stage: 'closeout', files: [], confidence: 1, source: 'speculation', evidence_type: 'speculation' });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBe(0);
  });
});
