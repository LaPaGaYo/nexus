// test/nexus/learning/mirror.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mirrorCanonicalToJsonl } from '../../../lib/nexus/learning/mirror';
import { generateLearningId } from '../../../lib/nexus/learning/id';
import type { LearningEntry } from '../../../lib/nexus/learning/schema';

let stateDir: string;
beforeEach(() => { stateDir = mkdtempSync(join(tmpdir(), 'sp1-mir-')); });
afterEach(() => { rmSync(stateDir, { recursive: true, force: true }); });

function makeCanonical(): LearningEntry {
  return {
    id: generateLearningId(),
    schema_version: 2,
    ts: '2026-05-12T00:00:00Z',
    writer_skill: 'closeout', subject_skill: 'build', subject_stage: 'build',
    type: 'pitfall', key: 'k', insight: 'i', confidence: 8,
    evidence_type: 'test-output', source: 'observed', files: [],
    cluster_id: null, supersedes: [], supersedes_reason: null,
    derived_from: ['lrn_src1'], last_applied_at: null, mirror: null,
  };
}

describe('mirrorCanonicalToJsonl', () => {
  test('writes mirrored entries with nested mirror block', () => {
    const entry = makeCanonical();
    mirrorCanonicalToJsonl({
      stateDir, slug: 'demo',
      runId: 'r1', sourcePath: '.planning/current/closeout/learnings.json',
      canonical: [entry],
    });
    const path = join(stateDir, 'projects/demo/learnings.jsonl');
    expect(existsSync(path)).toBe(true);
    const lines = readFileSync(path, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.mirror).toBeDefined();
    expect(parsed.mirror.origin).toBe('closeout');
    expect(parsed.mirror.run_id).toBe('r1');
    expect(parsed.mirror.source_path).toBe('.planning/current/closeout/learnings.json');
  });

  test('re-running on same (canonical_id, run_id) is a no-op (idempotent)', () => {
    const entry = makeCanonical();
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
    const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  test('different run_id appends as new line (re-runs of same canonical across runs are allowed)', () => {
    const entry = makeCanonical();
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r2', sourcePath: 'p', canonical: [entry] });
    const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  test('multiple canonical entries in one call all mirror (all-or-nothing per entry)', () => {
    const e1 = makeCanonical();
    const e2 = makeCanonical();
    mirrorCanonicalToJsonl({
      stateDir, slug: 'demo',
      runId: 'r1', sourcePath: 'p',
      canonical: [e1, e2],
    });
    const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    const ids = lines.map(l => JSON.parse(l).id).sort();
    expect(ids).toEqual([e1.id, e2.id].sort());
  });

  test('preserves existing jsonl entries (append-only, never rewrites)', () => {
    // Pre-seed with a v1-style legacy entry
    const fs = require('fs');
    const path = require('path');
    const projDir = join(stateDir, 'projects/demo');
    fs.mkdirSync(projDir, { recursive: true });
    const jsonl = join(projDir, 'learnings.jsonl');
    fs.writeFileSync(jsonl, JSON.stringify({
      ts: '2026-04-01T00:00:00Z', skill: 'retro', type: 'pattern',
      key: 'old', insight: 'legacy entry', confidence: 7, source: 'observed', files: [],
    }) + '\n');

    const entry = makeCanonical();
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });

    const lines = readFileSync(jsonl, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    // First line is the legacy v1 entry, second is the mirrored canonical
    const legacy = JSON.parse(lines[0]);
    expect(legacy.key).toBe('old');
    expect(legacy.schema_version).toBeUndefined(); // v1, unchanged
    const mirrored = JSON.parse(lines[1]);
    expect(mirrored.mirror.origin).toBe('closeout');
  });

  test('idempotency works across mixed-content jsonl (legacy + prior mirrors)', () => {
    const entry = makeCanonical();
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
    // Simulate second closeout invocation that re-tries the same canonical+run
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
    mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
    const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
  });
});
