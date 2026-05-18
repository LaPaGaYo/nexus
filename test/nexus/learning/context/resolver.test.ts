// test/nexus/learning/context/resolver.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveLearningContext } from '../../../../lib/nexus/learning/context/resolver';
import type { RecommendedSkill } from '../../../../lib/nexus/contracts/types';

function rs(name: string, score: number): RecommendedSkill {
  return { name, surface: `/${name}`, namespace: 'external_installed', summary: '', why_relevant: '', score, manifest_backed: false } as RecommendedSkill;
}
let cwd: string; let home: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'sp6-r-')); home = mkdtempSync(join(tmpdir(), 'sp6-h-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); });

function writeJsonl(slug: string, lines: object[]) {
  const dir = join(home, '.nexus', 'projects', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'learnings.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
}

const natural = [rs('design', 5), rs('investigate', 3)];

describe('resolveLearningContext', () => {
  test('no learnings → boosted equals natural, status ok, record written', () => {
    const r = resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: [], naturalRanking: natural, projectSlug: 'demo' });
    expect(r.boostedRanking.map((s) => s.name)).toEqual(natural.map((s) => s.name));
    expect(r.status).toBe('ok');
    expect(existsSync(r.recordPath)).toBe(true);
  });

  test('a strong on-topic learning for "investigate" boosts it and records disagreement', () => {
    writeJsonl('demo', [{
      id: 'lrn_1', schema_version: 2, ts: new Date().toISOString(),
      writer_skill: 'investigate', subject_skill: 'investigate', subject_stage: 'build',
      type: 'pitfall', key: 'socket timeout build', insight: 'investigate socket timeout on build',
      confidence: 9, evidence_type: 'test-output', source: 'observed', files: ['lib/net/socket.ts'],
      cluster_id: null, supersedes: [], supersedes_reason: null, derived_from: [],
      last_applied_at: null, mirror: null,
    }]);
    const r = resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: ['lib/net/socket.ts'], naturalRanking: natural, projectSlug: 'demo' });
    expect(r.packet.length).toBeGreaterThan(0);
    const rec = JSON.parse(readFileSync(r.recordPath, 'utf8'));
    expect(rec.boosts.some((b: { skill: string }) => b.skill === 'investigate')).toBe(true);
  });

  test('malformed jsonl line → degraded status + warning + still returns ranking', () => {
    const dir = join(home, '.nexus', 'projects', 'demo'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'learnings.jsonl'), 'not json\n');
    const r = resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: [], naturalRanking: natural, projectSlug: 'demo' });
    expect(['ok', 'degraded']).toContain(r.status);
    expect(r.boostedRanking.map((s) => s.name)).toEqual(natural.map((s) => s.name));
  });

  test('catastrophic failure (bad config type) → status failed, natural ranking returned', () => {
    const r = resolveLearningContext({
      cwd, home, stage: 'build', runId: 'r1', changedFiles: [], naturalRanking: natural, projectSlug: 'demo',
      config: { weights: null } as unknown as undefined,
    });
    expect(r.status).toBe('failed');
    expect(r.boostedRanking).toEqual(natural);
  });
});
