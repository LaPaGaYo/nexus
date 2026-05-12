// lib/nexus/learning/strength.ts
import type { LearningEntry, EvidenceType, LearningSource } from './schema';

const EVIDENCE_BASE: Record<EvidenceType, number> = {
  'test-output': 4,
  'code-pattern': 3,
  'profile-data': 4,
  'multi-run-observation': 3,
  'single-run-observation': 2,
  'team-consensus': 2,
  'external-reference': 1,
  'speculation': 0,
  'unknown': 0,
};

const SOURCE_MOD: Record<LearningSource, number> = {
  'observed': 2,
  'cross-model': 2,
  'user-stated': 1,
  'inferred': 0,
  'team-consensus': 1,
  'external-reference': 0,
  'speculation': 0,
  'unknown': 0,
};

function confidenceSignal(c: number): number {
  if (c >= 8) return 2;
  if (c >= 5) return 1;
  return 0;
}

function clamp(min: number, max: number, x: number): number {
  return Math.max(min, Math.min(max, x));
}

export function computeStrength(entry: Pick<LearningEntry, 'evidence_type' | 'source' | 'confidence'>): number {
  const base = EVIDENCE_BASE[entry.evidence_type];
  const mod = SOURCE_MOD[entry.source];
  const sig = confidenceSignal(entry.confidence);
  return clamp(1, 10, base + mod + sig);
}
