// test/nexus/learning/strength.test.ts
import { describe, test, expect } from 'bun:test';
import { computeStrength } from '../../../lib/nexus/learning/strength';
import type { LearningEntry } from '../../../lib/nexus/learning/schema';

const base: LearningEntry = {
  id: 'lrn_01HK0000000000000000000000', schema_version: 2,
  ts: '2026-05-12T00:00:00Z', writer_skill: 'x', subject_skill: 'y',
  subject_stage: null, type: 'pitfall', key: 'k', insight: 'i', confidence: 5,
  evidence_type: 'unknown', source: 'unknown', files: [], cluster_id: null,
  supersedes: [], supersedes_reason: null, derived_from: [], last_applied_at: null, mirror: null,
};

describe('computeStrength', () => {
  test('high-confidence test-output observed: ~ 8', () => {
    const s = computeStrength({ ...base, evidence_type: 'test-output', source: 'observed', confidence: 9 });
    expect(s).toBe(8); // 4 + 2 + 2
  });

  test('low-confidence speculation inferred: ~ 0', () => {
    const s = computeStrength({ ...base, evidence_type: 'speculation', source: 'inferred', confidence: 2 });
    expect(s).toBe(1); // clamp(1, 10, 0 + 0 + 0)
  });

  test('clamps to 1..10', () => {
    const s = computeStrength({ ...base, evidence_type: 'test-output', source: 'observed', confidence: 10 });
    expect(s).toBeLessThanOrEqual(10);
    expect(s).toBeGreaterThanOrEqual(1);
  });

  test('unknown evidence_type maps to base 0', () => {
    const s = computeStrength({ ...base, evidence_type: 'unknown', source: 'observed', confidence: 8 });
    expect(s).toBe(4); // 0 + 2 + 2
  });
});
