// lib/nexus/learning/context/ranking.ts
import { computeStrength } from '../strength';
import { computeEffectiveConfidence } from '../decay';
import type { NormalizedEntry } from '../normalize';
import { fileOverlap, stageMatch, relevance, contradictionRisk, type RelevanceCtx } from './match';
import type { LearningContextConfig, ScoredEntry } from './types';

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
  const confVal = computeEffectiveConfidence(entry, ctx.now || undefined) / 10;
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
