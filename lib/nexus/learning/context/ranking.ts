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
): { boosted: RecommendedSkill[]; disagreements: RankDisagreement[] } {
  const deltaBy = new Map(deltas.map((d) => [d.skill, d]));
  const naturalIdx = rankIndexByName(natural);
  const naturalScore = new Map(natural.map((s) => [s.name, s.score]));

  const boosted = natural
    .map((s) => {
      const d = deltaBy.get(s.name) ?? deltaBy.get(s.surface.replace(/^\//, ''));
      return d ? { ...s, score: s.score + d.delta } : { ...s };
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

  return { boosted, disagreements };
}
