// test/nexus/learning/context/acceptance.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveLearningContext } from '../../../../lib/nexus/learning/context/resolver';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';
import type { RecommendedSkill } from '../../../../lib/nexus/contracts/types';

function rs(n: string, s: number): RecommendedSkill {
  return { name: n, surface: `/${n}`, namespace: 'external_installed', summary: '', why_relevant: '', score: s, manifest_backed: false } as RecommendedSkill;
}
let cwd: string; let home: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'sp6-ac-')); home = mkdtempSync(join(tmpdir(), 'sp6-ach-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); });
function seed(n: number) {
  const dir = join(home, '.nexus', 'projects', 'demo'); mkdirSync(dir, { recursive: true });
  const lines = Array.from({ length: n }, (_, i) => JSON.stringify({
    id: `lrn_${i}`, schema_version: 2, ts: new Date().toISOString(),
    writer_skill: 'investigate', subject_skill: 'investigate', subject_stage: 'build',
    type: 'pitfall', key: `build socket timeout ${i}`, insight: `investigate build socket timeout case ${i}`,
    confidence: 9, evidence_type: 'test-output', source: 'observed', files: ['lib/net/socket.ts'],
    cluster_id: null, supersedes: [], supersedes_reason: null, derived_from: [],
    last_applied_at: null, mirror: null,
  }));
  writeFileSync(join(dir, 'learnings.jsonl'), lines.join('\n'));
}
const natural = [rs('design', 5), rs('investigate', 3)];
const call = (extra = {}) => resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: ['lib/net/socket.ts'], naturalRanking: natural, projectSlug: 'demo', ...extra });

describe('SP6 acceptance criteria', () => {
  test('AC#1 packet cap — never exceeds max_entries', () => {
    seed(50);
    const r = call();
    expect(r.packet.length).toBeLessThanOrEqual(DEFAULT_LEARNING_CONTEXT_CONFIG.max_entries);
  });
  test('AC#2 explainable — every packet entry records factor value/weight/contribution', () => {
    seed(3);
    const r = call();
    const rec = JSON.parse(readFileSync(r.recordPath, 'utf8'));
    expect(rec.packet.length).toBeGreaterThan(0); // guard: AC#2 must not vacuously pass on empty packet
    for (const p of rec.packet) {
      for (const k of ['relevance', 'effective_confidence', 'evidence_strength', 'file_overlap', 'stage_match', 'contradiction_risk']) {
        expect(p.factors[k]).toHaveProperty('value');
        expect(p.factors[k]).toHaveProperty('weight');
        expect(p.factors[k]).toHaveProperty('contribution');
      }
    }
  });
  test('AC#3 fail-soft — malformed entry does not crash; status degraded/ok, ranking returned', () => {
    const dir = join(home, '.nexus', 'projects', 'demo'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'learnings.jsonl'), '{bad json\n{"also":bad}\n');
    const r = call();
    // Malformed lines are silently dropped by readLearningsJsonl (no throw) →
    // status 'ok'; the reader-threw degrade + catastrophic 'failed' paths are
    // covered in resolver.test.ts. AC#3 here proves "no crash, ranking returned".
    expect(r.boostedRanking.length).toBe(natural.length);
    expect(['ok', 'degraded']).toContain(r.status);
  });
  test('AC#4 disagreement recorded iff ordering differs', () => {
    seed(5);
    const r = call();
    const rec = JSON.parse(readFileSync(r.recordPath, 'utf8'));
    const orderChanged = r.boostedRanking.map((s) => s.name).join() !== natural.map((s) => s.name).join();
    expect(rec.rank_disagreements.length > 0).toBe(orderChanged);
  });
  test('AC#5 no mutation — resolver writes only learning-context.json under .planning/current/<stage>', () => {
    seed(2);
    const r = call();
    expect(r.recordPath).toBe(join(cwd, '.planning', 'current', 'build', 'learning-context.json'));
    // No mutation: the ONLY file the resolver creates under cwd is the single
    // learning-context.json. Walk cwd and assert exactly that one file exists.
    const found: string[] = [];
    const walk = (d: string) => {
      for (const name of readdirSync(d)) {
        const fp = join(d, name);
        if (statSync(fp).isDirectory()) walk(fp);
        else found.push(fp);
      }
    };
    walk(cwd);
    expect(found).toEqual([join(cwd, '.planning', 'current', 'build', 'learning-context.json')]);
  });
});
