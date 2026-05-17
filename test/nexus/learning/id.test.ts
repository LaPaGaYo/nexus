import { describe, test, expect } from 'bun:test';
import { generateLearningId, parseLearningId, deriveLegacyId } from '../../../lib/nexus/learning/id';

describe('learning id', () => {
  test('generateLearningId produces lrn_<26-char-ULID>', () => {
    const id = generateLearningId();
    expect(id).toMatch(/^lrn_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('parseLearningId accepts new and legacy forms', () => {
    expect(parseLearningId('lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y').kind).toBe('ulid');
    expect(parseLearningId('legacy:' + 'a'.repeat(64)).kind).toBe('legacy');
    expect(() => parseLearningId('garbage')).toThrow(/invalid/);
  });

  test('deriveLegacyId is deterministic across calls', () => {
    const legacy = { ts: '2026-04-01T00:00:00Z', skill: 'retro', type: 'pattern', key: 'x', insight: 'y', files: ['a.ts'] };
    const a = deriveLegacyId(legacy);
    const b = deriveLegacyId(legacy);
    expect(a).toBe(b);
    expect(a).toMatch(/^legacy:[0-9a-f]{64}$/);
  });

  test('generateLearningId values are unique across N=1000 calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateLearningId()));
    expect(ids.size).toBe(1000);
  });
});
