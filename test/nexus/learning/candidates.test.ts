// test/nexus/learning/candidates.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
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

  // ── SP1 Task 21 fix: same-run v1 candidates must be merged, not overwritten ──
  //
  // Scenario: applyNormalizationPlan writes auditor-sourced candidates as
  // schema_version: 1. Then captureReviewFailingVerdictLearning calls
  // writeLearningCandidate (schema_version: 2 entry) for the same run_id and
  // stage. Without the fix the v1 file fails the old `=== 2` guard, the
  // fresh-record branch fires, and the auditor candidates are silently lost.

  test('same-run v1 file is merged (not overwritten) when a v2 entry is appended', () => {
    const path = join(cwd, '.planning/current/review/learning-candidates.json');
    mkdirSync(dirname(path), { recursive: true });

    // Pre-existing auditor-sourced schema_version: 1 record (mimics applyNormalizationPlan output)
    const v1Record = {
      schema_version: 1,
      stage: 'review',
      run_id: 'shared-run',
      generated_at: '2026-05-12T00:00:00Z',
      candidates: [
        { type: 'pitfall', key: 'auditor-found-x', insight: 'auditor insight', confidence: 7, source: 'observed', files: [] },
      ],
    };
    writeFileSync(path, JSON.stringify(v1Record, null, 2));

    // Append a v2 entry (mimics captureReviewFailingVerdictLearning)
    const v2Entry = makeEntry();
    writeLearningCandidate({ cwd, stage: 'review', run_id: 'shared-run', entry: v2Entry });

    const result = JSON.parse(readFileSync(path, 'utf8'));

    // Merged record is schema_version 2
    expect(result.schema_version).toBe(2);
    expect(result.stage).toBe('review');
    expect(result.run_id).toBe('shared-run');

    // Both candidates present — original v1 + new v2
    expect(result.candidates).toHaveLength(2);

    // Original auditor candidate preserved intact (not mutated)
    const auditorCand = result.candidates.find((c: { key: string }) => c.key === 'auditor-found-x');
    expect(auditorCand).toBeDefined();
    expect(auditorCand.type).toBe('pitfall');
    expect(auditorCand.insight).toBe('auditor insight');

    // New v2 entry present
    const v2Cand = result.candidates.find((c: { id: string }) => c.id === v2Entry.id);
    expect(v2Cand).toBeDefined();
    expect(v2Cand.schema_version).toBe(2);
  });

  test('same-run v1 file with different run_id is NOT merged (starts fresh)', () => {
    const path = join(cwd, '.planning/current/review/learning-candidates.json');
    mkdirSync(dirname(path), { recursive: true });

    const v1Record = {
      schema_version: 1,
      stage: 'review',
      run_id: 'old-run',
      generated_at: '2026-05-12T00:00:00Z',
      candidates: [
        { type: 'pitfall', key: 'stale-candidate', insight: 'stale', confidence: 5, source: 'observed', files: [] },
      ],
    };
    writeFileSync(path, JSON.stringify(v1Record, null, 2));

    const v2Entry = makeEntry();
    writeLearningCandidate({ cwd, stage: 'review', run_id: 'new-run', entry: v2Entry });

    const result = JSON.parse(readFileSync(path, 'utf8'));
    expect(result.run_id).toBe('new-run');
    // Only the new entry — stale v1 candidates discarded as expected
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe(v2Entry.id);
  });
});
