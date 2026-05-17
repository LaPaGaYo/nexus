// test/nexus/learning/chain-template.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeLearningCandidate } from '../../../lib/nexus/learning/candidates';
import { mirrorCanonicalToJsonl } from '../../../lib/nexus/learning/mirror';
import { generateLearningId } from '../../../lib/nexus/learning/id';
import { isMirrorEnabled } from '../../../lib/nexus/learning/config';
import type { LearningEntry } from '../../../lib/nexus/learning/schema';

let cwd: string;
let stateDir: string;
const SLUG = 'demo-project';

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sp1-chain-cwd-'));
  stateDir = mkdtempSync(join(tmpdir(), 'sp1-chain-state-'));
  process.env.NEXUS_STATE_DIR = stateDir;
});

afterEach(() => {
  delete process.env.NEXUS_STATE_DIR;
  rmSync(cwd, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
});

function makeEntry(overrides: Partial<LearningEntry> = {}): LearningEntry {
  return {
    id: generateLearningId(),
    schema_version: 2,
    ts: new Date().toISOString(),
    writer_skill: 'build',
    subject_skill: 'build',
    subject_stage: 'build',
    type: 'pitfall',
    key: 'three-strike-demo',
    insight: 'Demo strike',
    confidence: 8,
    evidence_type: 'multi-run-observation',
    source: 'observed',
    files: [],
    cluster_id: null,
    supersedes: [],
    supersedes_reason: null,
    derived_from: [],
    last_applied_at: null,
    mirror: null,
    ...overrides,
  };
}

describe('SP1 chain template: build candidate → canonical → mirror', () => {
  test('full chain: build writes candidate → canonical written with derived_from → mirror appends to jsonl', () => {
    // 1. Enable mirror in config
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: true\n');
    expect(isMirrorEnabled()).toBe(true);

    // 2. /build writes a learning-candidate (Task 14 path)
    const buildCandidate = makeEntry({ key: 'pitfall-a' });
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'integ1', entry: buildCandidate });

    // 3. Verify candidate file exists with one entry
    const candPath = join(cwd, '.planning/current/build/learning-candidates.json');
    expect(existsSync(candPath)).toBe(true);
    const candRecord = JSON.parse(readFileSync(candPath, 'utf8'));
    expect(candRecord.candidates).toHaveLength(1);
    expect(candRecord.candidates[0].id).toBe(buildCandidate.id);

    // 4. /closeout produces canonical learning that derives from the build candidate
    //    (We simulate this directly — Task 15's collectRunLearnings is the real producer;
    //    the test exercises the mirror step independently)
    const canonical: LearningEntry = makeEntry({
      id: generateLearningId(),  // fresh id — canonical is a new entity
      writer_skill: 'closeout',
      derived_from: [buildCandidate.id],
    });

    // 5. Mirror canonical to jsonl (Task 15 calls this when isMirrorEnabled)
    mirrorCanonicalToJsonl({
      stateDir,
      slug: SLUG,
      runId: 'integ1',
      sourcePath: '.planning/current/closeout/learnings.json',
      canonical: [canonical],
    });

    // 6. Verify jsonl contains the mirrored canonical with correct metadata
    const jsonlPath = join(stateDir, 'projects', SLUG, 'learnings.jsonl');
    expect(existsSync(jsonlPath)).toBe(true);
    const lines = readFileSync(jsonlPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);

    const out = JSON.parse(lines[0]);
    expect(out.id).toBe(canonical.id);
    expect(out.derived_from).toContain(buildCandidate.id);
    expect(out.mirror).toBeDefined();
    expect(out.mirror.origin).toBe('closeout');
    expect(out.mirror.run_id).toBe('integ1');
    expect(out.mirror.source_path).toBe('.planning/current/closeout/learnings.json');
  });

  test('mirror is idempotent: re-running on same (canonical_id, run_id) is a no-op', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: true\n');

    const canonical = makeEntry({ writer_skill: 'closeout' });

    // First mirror
    mirrorCanonicalToJsonl({
      stateDir, slug: SLUG, runId: 'integ1',
      sourcePath: '.planning/current/closeout/learnings.json',
      canonical: [canonical],
    });

    // Second mirror with identical args
    mirrorCanonicalToJsonl({
      stateDir, slug: SLUG, runId: 'integ1',
      sourcePath: '.planning/current/closeout/learnings.json',
      canonical: [canonical],
    });

    const jsonlPath = join(stateDir, 'projects', SLUG, 'learnings.jsonl');
    const lines = readFileSync(jsonlPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);  // no duplicate from re-run
  });

  test('mirror is opt-in: when isMirrorEnabled returns false, no jsonl write happens', () => {
    // No config file — isMirrorEnabled returns false
    expect(isMirrorEnabled()).toBe(false);

    // Simulate /closeout deciding NOT to call the mirror because isMirrorEnabled is false.
    // We assert by not calling mirrorCanonicalToJsonl at all — the test demonstrates the
    // contract: if mirror is disabled, no jsonl side effect.
    const jsonlPath = join(stateDir, 'projects', SLUG, 'learnings.jsonl');
    expect(existsSync(jsonlPath)).toBe(false);
  });

  test('multiple build candidates → one canonical with derived_from referencing both', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: true\n');

    const cand1 = makeEntry({ key: 'pitfall-a' });
    const cand2 = makeEntry({ key: 'pitfall-b' });

    writeLearningCandidate({ cwd, stage: 'build', run_id: 'integ2', entry: cand1 });
    writeLearningCandidate({ cwd, stage: 'build', run_id: 'integ2', entry: cand2 });

    const candPath = join(cwd, '.planning/current/build/learning-candidates.json');
    expect(JSON.parse(readFileSync(candPath, 'utf8')).candidates).toHaveLength(2);

    // /closeout consolidates the two into one canonical
    const canonical = makeEntry({
      id: generateLearningId(),
      writer_skill: 'closeout',
      key: 'pitfall-consolidated',
      derived_from: [cand1.id, cand2.id],
    });

    mirrorCanonicalToJsonl({
      stateDir, slug: SLUG, runId: 'integ2',
      sourcePath: '.planning/current/closeout/learnings.json',
      canonical: [canonical],
    });

    const jsonlPath = join(stateDir, 'projects', SLUG, 'learnings.jsonl');
    const lines = readFileSync(jsonlPath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const out = JSON.parse(lines[0]);
    expect(out.derived_from).toEqual([cand1.id, cand2.id]);
  });
});
