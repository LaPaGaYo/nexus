import { describe, test, expect } from 'bun:test';
import { normalizeLearningLine } from '../../../lib/nexus/learning/normalize';

describe('normalizeLearningLine', () => {
  test('v2 entry passes through unchanged', () => {
    const v2 = JSON.stringify({
      id: 'lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y',
      schema_version: 2,
      ts: '2026-05-12T00:00:00Z',
      writer_skill: 'investigate', subject_skill: 'build', subject_stage: 'build',
      type: 'pitfall', key: 'k', insight: 'i', confidence: 7,
      evidence_type: 'test-output', source: 'observed', files: [],
      cluster_id: null, supersedes: [], supersedes_reason: null,
      derived_from: [], last_applied_at: null, mirror: null,
    });
    const out = normalizeLearningLine(v2);
    expect(out?.schema_version).toBe(2);
    expect(out?.id).toBe('lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y');
  });

  test('v1 legacy entry gets legacy:<sha256> id and unknowns', () => {
    const v1 = JSON.stringify({
      ts: '2026-04-01T00:00:00Z',
      skill: 'retro',
      type: 'pattern',
      key: 'distinguish-fork-baselines',
      insight: 'check upstream commit before flagging fork regression',
      confidence: 9,
      source: 'cross-model',
      files: ['.fork-baseline.json'],
    });
    const out = normalizeLearningLine(v1);
    expect(out).toBeDefined();
    expect(out!.id).toMatch(/^legacy:[0-9a-f]{64}$/);
    expect(out!.writer_skill).toBe('retro');
    expect(out!.subject_skill).toBe('unknown');
    expect(out!.evidence_type).toBe('unknown');
    expect(out!.schema_version).toBe(1);
  });

  test('malformed line returns null (fail soft)', () => {
    expect(normalizeLearningLine('not json')).toBeNull();
    expect(normalizeLearningLine('{}')).toBeNull(); // missing key/insight/type
  });

  test('legacy id is stable across calls', () => {
    const v1 = '{"ts":"2026-04-01T00:00:00Z","skill":"retro","type":"pattern","key":"k","insight":"i","confidence":7,"source":"observed","files":[]}';
    const a = normalizeLearningLine(v1)!;
    const b = normalizeLearningLine(v1)!;
    expect(a.id).toBe(b.id);
  });

  test('v2 entry with malformed fields returns null (no silent passthrough)', () => {
    // schema_version is 2 but confidence is a string — must reject
    const malformedV2 = JSON.stringify({
      id: 'lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y',
      schema_version: 2,
      ts: '2026-05-12T00:00:00Z',
      writer_skill: 'investigate', subject_skill: 'build', subject_stage: 'build',
      type: 'pitfall', key: 'k', insight: 'i',
      confidence: 'high',                              // INVALID: should be number 1-10
      evidence_type: 'test-output', source: 'observed', files: [],
      cluster_id: null, supersedes: [], supersedes_reason: null,
      derived_from: [], last_applied_at: null, mirror: null,
    });
    expect(normalizeLearningLine(malformedV2)).toBeNull();

    // schema_version is 2 but files is null instead of array — must reject
    const badFiles = JSON.stringify({
      id: 'lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y',
      schema_version: 2,
      ts: '2026-05-12T00:00:00Z',
      writer_skill: 'x', subject_skill: 'y', subject_stage: 'build',
      type: 'pitfall', key: 'k', insight: 'i', confidence: 7,
      evidence_type: 'test-output', source: 'observed', files: null,  // INVALID
      cluster_id: null, supersedes: [], supersedes_reason: null,
      derived_from: [], last_applied_at: null, mirror: null,
    });
    expect(normalizeLearningLine(badFiles)).toBeNull();
  });
});
