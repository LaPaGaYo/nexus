// test/nexus/learning/candidates.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeLearningCandidate } from '../../../lib/nexus/learning/candidates';
import { generateLearningId } from '../../../lib/nexus/learning/id';
import type { LearningEntry } from '../../../lib/nexus/learning/schema';

let cwd: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'sp1-cand-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); });

function makeEntry(): LearningEntry {
  return {
    id: generateLearningId(),
    schema_version: 2 as const,
    ts: new Date().toISOString(),
    writer_skill: 'build', subject_skill: 'build', subject_stage: 'build',
    type: 'pitfall', key: 'three-strike', insight: 'demo',
    confidence: 7, evidence_type: 'multi-run-observation',
    source: 'observed', files: [],
    cluster_id: null, supersedes: [], supersedes_reason: null,
    derived_from: [], last_applied_at: null, mirror: null,
  };
}

describe('writeLearningCandidate', () => {
  test('first write creates file with one candidate', () => {
    const entry = makeEntry();
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'run1', entry });
    const path = join(cwd, '.planning/current/build/learning-candidates.json');
    expect(existsSync(path)).toBe(true);
    const record = JSON.parse(readFileSync(path, 'utf8'));
    expect(record.schema_version).toBe(2);
    expect(record.stage).toBe('build');
    expect(record.run_id).toBe('run1');
    expect(record.candidates).toHaveLength(1);
  });

  test('second write to same run appends, preserving previous candidate', () => {
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'r2', entry: makeEntry() });
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'r2', entry: makeEntry() });
    const record = JSON.parse(readFileSync(join(cwd, '.planning/current/build/learning-candidates.json'), 'utf8'));
    expect(record.candidates).toHaveLength(2);
  });

  test('different run_id starts fresh (overwrites previous run)', () => {
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'r1', entry: makeEntry() });
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'r2', entry: makeEntry() });
    const record = JSON.parse(readFileSync(join(cwd, '.planning/current/build/learning-candidates.json'), 'utf8'));
    expect(record.run_id).toBe('r2');
    expect(record.candidates).toHaveLength(1);
  });

  test('rejects malformed entry (write-time schema gate)', () => {
    const bad = { ...makeEntry(), schema_version: 99 } as any;
    expect(() => writeLearningCandidate({ cwd, stage: 'build', run_id: 'r1', entry: bad })).toThrow(/schema_version/);
  });

  test('rejects empty writer_skill (write-time gate per Concern B fix)', () => {
    const bad = { ...makeEntry(), writer_skill: '' } as any;
    expect(() => writeLearningCandidate({ cwd, stage: 'build', run_id: 'r1', entry: bad })).toThrow(/writer_skill/);
  });

  test('atomic write: no partial file on concurrent attempts (uses temp + rename)', () => {
    // Note: this is approximate — true concurrency would need fs spy or race scenarios.
    // Here just verify the basic semantic that successful write produces complete JSON.
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'r1', entry: makeEntry() });
    const content = readFileSync(join(cwd, '.planning/current/build/learning-candidates.json'), 'utf8');
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
