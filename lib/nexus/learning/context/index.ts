// lib/nexus/learning/context/index.ts
export { resolveLearningContext } from './resolver';
export { scoreEntry, computeBoostDeltas, applyBoost, STRENGTH_MAX } from './ranking';
export { capPacket, estimateEntryTokens } from './packet';
export { buildLearningContextRecord, writeLearningContextRecord } from './record';
export { fileOverlap, stageMatch, relevance, contradictionRisk } from './match';
export {
  DEFAULT_LEARNING_CONTEXT_CONFIG,
  type LearningContextInput, type LearningContextResult, type LearningContextConfig,
  type ScoredEntry, type BoostDelta, type RankDisagreement,
} from './types';
export type { LearningContextRecord } from './record';
