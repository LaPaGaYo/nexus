// test/nexus/learning/context/types.test.ts
import { describe, test, expect } from 'bun:test';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';

describe('DEFAULT_LEARNING_CONTEXT_CONFIG', () => {
  test('positive factor weights sum to exactly 1.0', () => {
    const w = DEFAULT_LEARNING_CONTEXT_CONFIG.weights;
    const sum = w.relevance + w.effective_confidence + w.evidence_strength + w.file_overlap + w.stage_match;
    expect(sum).toBeCloseTo(1.0, 10);
  });
  test('cap + floor + boost defaults match the spec', () => {
    const c = DEFAULT_LEARNING_CONTEXT_CONFIG;
    expect(c.score_floor).toBe(0.15);
    expect(c.max_entries).toBe(12);
    expect(c.token_budget).toBe(1500);
    expect(c.boost_cap).toBe(5);
    expect(c.boost_scale).toBe(1.0);
    expect(c.weights.contradiction_risk).toBe(-0.5);
  });
});
