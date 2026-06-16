// lib/nexus/learning/context/types.ts
import type { NormalizedEntry } from '../normalize';
import type { RecommendedSkill, CanonicalCommandId } from '../../contracts/types';

export type LearningContextStage = CanonicalCommandId;

export interface LearningContextInput {
  cwd: string;
  stage: LearningContextStage;
  runId: string;
  changedFiles: string[];
  naturalRanking: RecommendedSkill[];
  projectSlug: string;
  config?: LearningContextConfig;
  now?: number;
  home?: string;
}

export interface LearningContextWeights {
  relevance: number;
  effective_confidence: number;
  evidence_strength: number;
  file_overlap: number;
  stage_match: number;
  contradiction_risk: number; // penalty: expected NEGATIVE; scorer adds it directly to the weighted sum (positive factors sum to 1.0; this one does not participate in that invariant)
}

// snake_case config keys are intentional — they match the operator JSONC/YAML config file keys (LearningContextInput stays camelCase to mirror RecommendedSkill)
export interface LearningContextConfig {
  score_floor: number;
  max_entries: number;
  token_budget: number;
  boost_cap: number;
  boost_scale: number;
  weights: LearningContextWeights;
}

export interface FactorContribution {
  value: number;
  weight: number;
  contribution: number;
}

export interface ScoredEntry {
  entry: NormalizedEntry;
  score: number;
  factors: Record<keyof LearningContextWeights, FactorContribution>;
}

export interface BoostDelta {
  skill: string;
  /** Raw delta requested (Σ packet-entry scores × boost_scale, capped at boost_cap). */
  delta: number;
  from_entries: string[];
  /**
   * Decision D2: the effective delta actually added after clamping the boosted
   * score to the highest natural score (≤ delta). Set by applyBoost.
   */
  applied_delta?: number;
  /** True iff the relative-to-top clamp bound the boost (applied_delta < delta). */
  clamped?: boolean;
}

export interface RankDisagreement {
  skill: string;
  natural_rank: number;
  boosted_rank: number;
  natural_score: number;
  boosted_score: number;
  caused_by: string[];
}

export type ResolverStatus = 'ok' | 'degraded' | 'failed';

export interface LearningContextResult {
  boostedRanking: RecommendedSkill[];
  packet: ScoredEntry[];
  recordPath: string;
  status: ResolverStatus;
  warnings: string[];
}

export const DEFAULT_LEARNING_CONTEXT_CONFIG: LearningContextConfig = {
  score_floor: 0.15,
  max_entries: 12,
  token_budget: 1500,
  boost_cap: 5,
  boost_scale: 1.0,
  weights: {
    relevance: 0.30,
    effective_confidence: 0.25,
    evidence_strength: 0.20,
    file_overlap: 0.15,
    stage_match: 0.10,
    contradiction_risk: -0.5,
  },
};
