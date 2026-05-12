// test/nexus/learning/schema.test.ts
import { describe, test, expect } from 'bun:test';
import { assertSchemaV2, type LearningEntry } from '../../../lib/nexus/learning/schema';

describe('assertSchemaV2', () => {
  test('accepts a fully-populated v2 entry', () => {
    const entry: LearningEntry = {
      id: 'lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y',
      schema_version: 2,
      ts: '2026-05-12T03:14:15.926Z',
      writer_skill: 'investigate',
      subject_skill: 'build',
      subject_stage: 'build',
      type: 'pitfall',
      key: 'n-plus-one',
      insight: 'Demo insight under test.',
      confidence: 8,
      evidence_type: 'test-output',
      source: 'observed',
      files: ['app/api/x.ts'],
      cluster_id: null,
      supersedes: [],
      supersedes_reason: null,
      derived_from: [],
      last_applied_at: null,
      mirror: null,
    };
    expect(() => assertSchemaV2(entry)).not.toThrow();
  });

  test('rejects entry missing id', () => {
    const bad = { schema_version: 2, type: 'pitfall', key: 'x', insight: 'y', confidence: 5 };
    expect(() => assertSchemaV2(bad)).toThrow(/id/);
  });

  test('rejects schema_version != 2 in strict mode', () => {
    const v1 = { schema_version: 1, type: 'pitfall', key: 'x', insight: 'y' };
    expect(() => assertSchemaV2(v1)).toThrow(/schema_version/);
  });
});
