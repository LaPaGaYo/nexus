// test/nexus/learning/read.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readLearningsJsonl,
  readStageCandidatesFile,
  readCanonicalLearningsFile,
  walkArchiveRunLearnings,
} from '../../../lib/nexus/learning/read';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sp1fu-read-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('readLearningsJsonl', () => {
  test('reads + normalizes lines, skips malformed (fail-soft)', () => {
    const p = join(dir, 'learnings.jsonl');
    writeFileSync(p, [
      JSON.stringify({ ts: '2026-04-01T00:00:00Z', skill: 'retro', type: 'pattern', key: 'k1', insight: 'i1', confidence: 7, source: 'observed', files: [] }),
      'not json',
      '',
      JSON.stringify({ ts: '2026-04-02T00:00:00Z', skill: 'investigate', type: 'pitfall', key: 'k2', insight: 'i2', confidence: 8, source: 'observed', files: [] }),
    ].join('\n'));
    const out = readLearningsJsonl(p);
    expect(out).toHaveLength(2);
    expect(out.map(e => e.key).sort()).toEqual(['k1', 'k2']);
  });

  test('missing file → []', () => {
    expect(readLearningsJsonl(join(dir, 'nope.jsonl'))).toEqual([]);
  });
});

describe('readStageCandidatesFile', () => {
  test('reads a valid v2 stage record', () => {
    const p = join(dir, 'learning-candidates.json');
    writeFileSync(p, JSON.stringify({
      schema_version: 2, run_id: 'r1', stage: 'build', generated_at: '2026-05-12T00:00:00Z',
      candidates: [{ type: 'pitfall', key: 'k', insight: 'i', confidence: 7, source: 'observed', files: [] }],
    }));
    const rec = readStageCandidatesFile(p);
    expect(rec?.schema_version).toBe(2);
    expect(rec?.stage).toBe('build');
    expect(rec?.candidates).toHaveLength(1);
  });

  test('missing file → null', () => {
    expect(readStageCandidatesFile(join(dir, 'nope.json'))).toBeNull();
  });

  test('malformed json → null (fail-soft)', () => {
    const p = join(dir, 'bad.json');
    writeFileSync(p, '{ not valid');
    expect(readStageCandidatesFile(p)).toBeNull();
  });
});

describe('readCanonicalLearningsFile', () => {
  test('reads a canonical run-learnings record', () => {
    const p = join(dir, 'learnings.json');
    writeFileSync(p, JSON.stringify({
      schema_version: 2, run_id: 'r1', generated_at: '2026-05-12T00:00:00Z',
      source_candidates: ['build'],
      learnings: [{ type: 'pitfall', key: 'k', insight: 'i', confidence: 8, source: 'observed', files: [], origin_stage: 'build' }],
    }));
    const rec = readCanonicalLearningsFile(p);
    expect(rec?.run_id).toBe('r1');
    expect(rec?.learnings).toHaveLength(1);
  });

  test('missing/malformed → null', () => {
    expect(readCanonicalLearningsFile(join(dir, 'nope.json'))).toBeNull();
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, 'nope');
    expect(readCanonicalLearningsFile(bad)).toBeNull();
  });
});

describe('walkArchiveRunLearnings', () => {
  test('collects every .planning/archive/runs/*/closeout/learnings.json', () => {
    const a = join(dir, '.planning/archive/runs/run-a/closeout');
    const b = join(dir, '.planning/archive/runs/run-b/closeout');
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'learnings.json'), JSON.stringify({ schema_version: 2, run_id: 'a', generated_at: 't', source_candidates: [], learnings: [] }));
    writeFileSync(join(b, 'learnings.json'), JSON.stringify({ schema_version: 2, run_id: 'b', generated_at: 't', source_candidates: [], learnings: [] }));
    const recs = walkArchiveRunLearnings(dir);
    expect(recs.map(r => r.run_id).sort()).toEqual(['a', 'b']);
  });

  test('ignores stray top-level files (not directories)', () => {
    const a = join(dir, '.planning/archive/runs/run-a/closeout');
    const b = join(dir, '.planning/archive/runs/run-b/closeout');
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'learnings.json'), JSON.stringify({ schema_version: 2, run_id: 'a', generated_at: 't', source_candidates: [], learnings: [] }));
    writeFileSync(join(b, 'learnings.json'), JSON.stringify({ schema_version: 2, run_id: 'b', generated_at: 't', source_candidates: [], learnings: [] }));
    writeFileSync(join(dir, '.planning/archive/runs/stray.txt'), 'stray');
    const recs = walkArchiveRunLearnings(dir);
    expect(recs.map(r => r.run_id).sort()).toEqual(['a', 'b']);
  });

  test('no archive dir → []', () => {
    expect(walkArchiveRunLearnings(join(dir, 'empty'))).toEqual([]);
  });
});
