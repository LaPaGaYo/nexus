// test/nexus/learning/context/record.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildLearningContextRecord, writeLearningContextRecord } from '../../../../lib/nexus/learning/context/record';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';

const base = {
  stage: 'build' as const, runId: 'r1', projectSlug: 'demo',
  config: DEFAULT_LEARNING_CONTEXT_CONFIG, status: 'ok' as const, warnings: [] as string[],
  packet: [{ entry: { id: 'lrn_a', key: 'k', insight: 'i', subject_skill: 'investigate' }, score: 0.8,
    factors: { relevance: { value: 0.5, weight: 0.3, contribution: 0.15 },
      effective_confidence: { value: 0.8, weight: 0.25, contribution: 0.2 },
      evidence_strength: { value: 0.5, weight: 0.2, contribution: 0.1 },
      file_overlap: { value: 0, weight: 0.15, contribution: 0 },
      stage_match: { value: 1, weight: 0.1, contribution: 0.1 },
      contradiction_risk: { value: 0, weight: -0.5, contribution: 0 } } } ] as any,
  dropped: { below_floor: 3, over_cap: 1 },
  boosts: [{ skill: 'investigate', delta: 0.8, from_entries: ['lrn_a'] }],
  disagreements: [{ skill: 'investigate', natural_rank: 2, boosted_rank: 0, natural_score: 4, boosted_score: 4.8, caused_by: ['lrn_a'] }],
};

describe('buildLearningContextRecord', () => {
  test('schema_version 1, includes limits/packet factors/boosts/disagreements', () => {
    const rec = buildLearningContextRecord({ ...base, generatedAt: '2026-05-18T00:00:00Z' });
    expect(rec.schema_version).toBe(1);
    expect(rec.stage).toBe('build');
    expect(rec.limits.score_floor).toBe(0.15);
    expect(rec.packet[0].factors.relevance.contribution).toBe(0.15);
    expect(rec.rank_disagreements).toHaveLength(1);
    expect(rec.dropped.below_floor).toBe(3);
  });
  test('empty disagreements serialize as [] not omitted', () => {
    const rec = buildLearningContextRecord({ ...base, disagreements: [], generatedAt: 't' });
    expect(rec.rank_disagreements).toEqual([]);
  });
});

describe('writeLearningContextRecord', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sp6-rec-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('writes .planning/current/<stage>/learning-context.json and returns path', () => {
    const rec = buildLearningContextRecord({ ...base, generatedAt: 't' });
    const p = writeLearningContextRecord(dir, 'build', rec);
    expect(p).toBe(join(dir, '.planning', 'current', 'build', 'learning-context.json'));
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, 'utf8')).run_id).toBe('r1');
  });

  test('write failure does not throw — returns the intended path', () => {
    const rec = buildLearningContextRecord({ ...base, generatedAt: 't' });
    const p = writeLearningContextRecord('/dev/null/nope', 'build', rec);
    expect(typeof p).toBe('string');
  });
});
