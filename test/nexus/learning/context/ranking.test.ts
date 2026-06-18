// test/nexus/learning/context/ranking.test.ts
import { describe, test, expect } from 'bun:test';
import { STRENGTH_MAX, scoreEntry, computeBoostDeltas, applyBoost } from '../../../../lib/nexus/learning/context/ranking';
import type { ScoredEntry } from '../../../../lib/nexus/learning/context/types';
import type { RecommendedSkill } from '../../../../lib/nexus/contracts/types';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';
import type { NormalizedEntry } from '../../../../lib/nexus/learning/normalize';

const NOW = Date.UTC(2026, 4, 1); // fixed, deterministic — no wall-clock dependence

function e(over: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    id: 'lrn_x', ts: new Date(NOW).toISOString(), writer_skill: 'investigate', type: 'pitfall',
    key: 'socket timeout', insight: 'build socket retries on slow ci',
    confidence: 8, source: 'observed', files: ['lib/net/socket.ts'],
    subject_skill: 'investigate', subject_stage: 'build', evidence_type: 'test-output',
    ...(over as object),
  } as NormalizedEntry;
}
const ctx = { stage: 'build' as const, changedFiles: ['lib/net/socket.ts'], skillNames: ['investigate'], now: NOW };

describe('STRENGTH_MAX', () => {
  test('is the max possible computeStrength output (8), derived not hardcoded', () => {
    expect(STRENGTH_MAX).toBe(8);
  });
});

describe('scoreEntry', () => {
  test('returns score in [0,1] with per-factor contributions summing to score', () => {
    const r = scoreEntry(e(), [e()], ctx, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
    const sum =
      r.factors.relevance.contribution +
      r.factors.effective_confidence.contribution +
      r.factors.evidence_strength.contribution +
      r.factors.file_overlap.contribution +
      r.factors.stage_match.contribution +
      r.factors.contradiction_risk.contribution;
    expect(sum).toBeCloseTo(r.score, 10);
  });

  test('contradiction penalty pushes a WEAK superseded entry below the score floor', () => {
    // weak on every positive factor (no relevance/file/stage match, low conf, weak evidence)
    const a = e({
      id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz',
      subject_stage: 'closeout', files: [], confidence: 2,
      source: 'speculation', evidence_type: 'speculation',
    });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.factors.contradiction_risk.value).toBe(1);
    expect(r.score).toBeLessThan(DEFAULT_LEARNING_CONTEXT_CONFIG.score_floor);
  });

  test('clamps at 0 (never negative even with full contradiction penalty)', () => {
    const a = e({ id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz', subject_stage: 'closeout', files: [], confidence: 1, source: 'speculation', evidence_type: 'speculation' });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBe(0);
  });
});

function packetEntry(id: string, subjectSkill: string, score: number): ScoredEntry {
  return {
    entry: { id, key: id, insight: id, subject_skill: subjectSkill } as ScoredEntry['entry'],
    score,
    factors: {} as ScoredEntry['factors'],
  };
}
function rs(name: string, score: number): RecommendedSkill {
  return { name, surface: `/${name}`, namespace: 'external_installed', summary: '', why_relevant: '', score, manifest_backed: false } as RecommendedSkill;
}

describe('computeBoostDeltas', () => {
  test('sums packet entry scores per subject_skill, scaled, capped at boost_cap', () => {
    const deltas = computeBoostDeltas(
      [packetEntry('l1', 'investigate', 0.8), packetEntry('l2', 'investigate', 0.9), packetEntry('l3', 'simplify', 0.2)],
      { boost_cap: 5, boost_scale: 1.0 },
    );
    const inv = deltas.find((d) => d.skill === 'investigate')!;
    expect(inv.delta).toBeCloseTo(1.7, 10);
    expect(inv.from_entries.sort()).toEqual(['l1', 'l2']);
    expect(deltas.find((d) => d.skill === 'simplify')!.delta).toBeCloseTo(0.2, 10);
  });
  test('caps the per-skill delta at boost_cap', () => {
    const deltas = computeBoostDeltas(
      Array.from({ length: 10 }, (_, i) => packetEntry(`x${i}`, 'investigate', 1)),
      { boost_cap: 5, boost_scale: 1.0 },
    );
    expect(deltas[0].delta).toBe(5);
  });
});

describe('applyBoost (Decision D2: boost, not override)', () => {
  test('reorders a skill BELOW the natural top without overtaking it', () => {
    // maxNatural = 6 (design). investigate 2 + delta 3 = 5 → clamped to min(5,6)=5,
    // which lifts it above simplify (4) but leaves design (6) on top.
    const natural = [rs('design', 6), rs('simplify', 4), rs('investigate', 2)];
    const { boosted, disagreements } = applyBoost(natural, [{ skill: 'investigate', delta: 3, from_entries: ['l1'] }]);
    expect(boosted[0].name).toBe('design');        // naturally-strongest never displaced
    expect(boosted[1].name).toBe('investigate');   // lifted above simplify
    expect(boosted.find((s) => s.name === 'investigate')!.score).toBe(5);
    const dis = disagreements.find((d) => d.skill === 'investigate')!;
    expect(dis.natural_rank).toBe(2);
    expect(dis.boosted_rank).toBe(1);
  });

  test('clamps to the top natural score — a boost can never overtake the strongest', () => {
    // investigate 4 + delta 10 = 14 → clamped to maxNatural 5; ties design but the
    // name tiebreak keeps design first, so investigate does NOT overtake it.
    const natural = [rs('design', 5), rs('investigate', 4), rs('simplify', 4)];
    const { boosted, appliedBoosts } = applyBoost(natural, [{ skill: 'investigate', delta: 10, from_entries: ['l1'] }]);
    expect(boosted[0].name).toBe('design');        // D2 guarantee: top is not overridden
    expect(boosted.find((s) => s.name === 'investigate')!.score).toBe(5);
    const applied = appliedBoosts.find((b) => b.skill === 'investigate')!;
    expect(applied.applied_delta).toBe(1);         // 5 - 4, not the raw 10
    expect(applied.clamped).toBe(true);            // clamp bound the boost (recorded for AC#2)
  });

  test('no delta application leaves order identical and yields zero disagreements', () => {
    const natural = [rs('a', 5), rs('b', 3)];
    const { boosted, disagreements } = applyBoost(natural, []);
    expect(boosted.map((s) => s.name)).toEqual(['a', 'b']);
    expect(disagreements).toEqual([]);
  });
});
