// lib/nexus/learning/context/ranking.ts
import { computeStrength } from '../strength';
import { computeEffectiveConfidence } from '../decay';
import type { NormalizedEntry } from '../normalize';
import { fileOverlap, stageMatch, relevance, contradictionRisk, type RelevanceCtx } from './match';
import type { LearningContextConfig, ScoredEntry, BoostDelta, RankDisagreement } from './types';
import type { RecommendedSkill } from '../../contracts/types';

/**
 * Max possible computeStrength output — derived (not a magic literal) by
 * evaluating computeStrength on the strongest synthetic entry. If the SP1
 * strength tables change, this re-derives automatically.
 */
export const STRENGTH_MAX: number = computeStrength({
  evidence_type: 'test-output',
  source: 'observed',
  confidence: 10,
});

export interface RankCtx extends RelevanceCtx {
  now?: number;
}

export function scoreEntry(
  entry: NormalizedEntry,
  all: NormalizedEntry[],
  ctx: RankCtx,
  config: LearningContextConfig,
): ScoredEntry {
  const w = config.weights;

  const relVal = relevance(entry, ctx);
  const confVal = computeEffectiveConfidence(entry, ctx.now) / 10;
  const strVal = computeStrength(entry) / STRENGTH_MAX;
  const fileVal = fileOverlap(entry.files ?? [], ctx.changedFiles);
  const stageVal = stageMatch(ctx.stage, (entry as { subject_stage?: string }).subject_stage);
  const contraVal = contradictionRisk(entry, all);

  const f = (value: number, weight: number) => ({ value, weight, contribution: value * weight });
  const factors = {
    relevance: f(relVal, w.relevance),
    effective_confidence: f(confVal, w.effective_confidence),
    evidence_strength: f(strVal, w.evidence_strength),
    file_overlap: f(fileVal, w.file_overlap),
    stage_match: f(stageVal, w.stage_match),
    contradiction_risk: f(contraVal, w.contradiction_risk),
  };

  const raw =
    factors.relevance.contribution +
    factors.effective_confidence.contribution +
    factors.evidence_strength.contribution +
    factors.file_overlap.contribution +
    factors.stage_match.contribution +
    factors.contradiction_risk.contribution;

  return { entry, score: Math.max(0, raw), factors };
}

export function computeBoostDeltas(
  packet: ScoredEntry[],
  cfg: { boost_cap: number; boost_scale: number },
): BoostDelta[] {
  const acc = new Map<string, { sum: number; ids: string[] }>();
  for (const p of packet) {
    const skill = (p.entry as { subject_skill?: string }).subject_skill;
    if (!skill) continue;
    const cur = acc.get(skill) ?? { sum: 0, ids: [] };
    cur.sum += p.score * cfg.boost_scale;
    cur.ids.push(String(p.entry.id));
    acc.set(skill, cur);
  }
  return [...acc.entries()].map(([skill, { sum, ids }]) => ({
    skill,
    delta: Math.min(cfg.boost_cap, sum),
    from_entries: ids,
  }));
}

function rankIndexByName(list: RecommendedSkill[]): Map<string, number> {
  const m = new Map<string, number>();
  list.forEach((s, i) => m.set(s.name, i));
  return m;
}

export function applyBoost(
  natural: RecommendedSkill[],
  deltas: BoostDelta[],
): { boosted: RecommendedSkill[]; disagreements: RankDisagreement[]; appliedBoosts: BoostDelta[] } {
  const deltaBy = new Map(deltas.map((d) => [d.skill, d]));
  const naturalIdx = rankIndexByName(natural);
  const naturalScore = new Map(natural.map((s) => [s.name, s.score]));

  // Decision D2: clamp every boosted score to the highest NATURAL score. SP6 v1
  // is boost-only (additive, positive — no demotion), so capping at the top
  // natural signal makes "boost, not override" structurally true: a boost can
  // reshuffle skills below the naturally-strongest and lift a weak one up to (at
  // most) parity, but can never push a skill past the strongest natural signal.
  const maxNatural = natural.length > 0 ? Math.max(...natural.map((s) => s.score)) : 0;
  const appliedByName = new Map<string, number>();

  const boosted = natural
    .map((s) => {
      const d = deltaBy.get(s.name) ?? deltaBy.get(s.surface.replace(/^\//, ''));
      if (!d) return { ...s };
      const clampedScore = Math.min(s.score + d.delta, maxNatural);
      appliedByName.set(d.skill, clampedScore - s.score);
      return { ...s, score: clampedScore };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const disagreements: RankDisagreement[] = [];
  boosted.forEach((s, boostedRank) => {
    const naturalRank = naturalIdx.get(s.name);
    if (naturalRank === undefined || naturalRank === boostedRank) return;
    const d = deltaBy.get(s.name) ?? deltaBy.get(s.surface.replace(/^\//, ''));
    disagreements.push({
      skill: s.name,
      natural_rank: naturalRank,
      boosted_rank: boostedRank,
      natural_score: naturalScore.get(s.name) ?? s.score,
      boosted_score: s.score,
      caused_by: d?.from_entries ?? [],
    });
  });

  // Enrich each delta with the post-clamp effective delta (AC#2 explainability).
  const appliedBoosts: BoostDelta[] = deltas.map((d) => {
    const applied = appliedByName.has(d.skill) ? appliedByName.get(d.skill)! : 0;
    return { ...d, applied_delta: applied, clamped: applied < d.delta - 1e-9 };
  });

  return { boosted, disagreements, appliedBoosts };
}
