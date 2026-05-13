// lib/nexus/learning/schema.ts
export const LEARNING_TYPES = ['pattern', 'pitfall', 'preference', 'architecture', 'tool'] as const;
export type LearningType = typeof LEARNING_TYPES[number];

export const EVIDENCE_TYPES = [
  'test-output', 'code-pattern', 'profile-data',
  'multi-run-observation', 'single-run-observation',
  'team-consensus', 'external-reference', 'speculation', 'unknown',
] as const;
export type EvidenceType = typeof EVIDENCE_TYPES[number];

export const LEARNING_SOURCES = [
  'observed', 'inferred', 'cross-model', 'user-stated',
  'team-consensus', 'external-reference', 'speculation', 'unknown',
] as const;
export type LearningSource = typeof LEARNING_SOURCES[number];

export const SUBJECT_STAGES = [
  'discover', 'frame', 'plan', 'handoff',
  'build', 'review', 'qa', 'ship', 'closeout', 'unknown',
] as const;
export type SubjectStage = typeof SUBJECT_STAGES[number];

export const SUPERSEDES_REASONS = [
  'correction', 'stale', 'contradiction', 'merged', 'scope-refined',
] as const;
export type SupersedesReason = typeof SUPERSEDES_REASONS[number];

export type MirrorMetadata = {
  origin: 'closeout';
  run_id: string;
  source_path: string;
};

export type LearningEntry = {
  id: string;                          // 'lrn_<ULID>' or 'legacy:<sha256>'
  schema_version: 2;
  ts: string;                          // ISO-8601 UTC
  writer_skill: string;
  subject_skill: string;
  subject_stage: SubjectStage | null;
  type: LearningType;
  key: string;
  insight: string;
  confidence: number;                  // 1..10
  evidence_type: EvidenceType;
  source: LearningSource;
  files: string[];
  cluster_id: string | null;
  supersedes: string[];
  supersedes_reason: SupersedesReason | null;
  derived_from: string[];
  last_applied_at: string | null;
  mirror: MirrorMetadata | null;
};

export function assertSchemaV2(value: unknown): asserts value is LearningEntry {
  if (!value || typeof value !== 'object') throw new Error('learning entry must be an object');
  const e = value as Partial<LearningEntry>;
  if (e.schema_version !== 2) throw new Error('learning entry schema_version must be 2');
  if (typeof e.id !== 'string' || e.id.length === 0) throw new Error('learning entry missing id');
  if (typeof e.ts !== 'string') throw new Error('learning entry missing ts');
  if (typeof e.writer_skill !== 'string' || e.writer_skill.length === 0) {
    throw new Error('learning entry missing writer_skill');
  }
  if (typeof e.subject_skill !== 'string' || e.subject_skill.length === 0) {
    throw new Error('learning entry missing subject_skill');
  }
  if (e.subject_stage !== null && !SUBJECT_STAGES.includes(e.subject_stage as SubjectStage)) {
    throw new Error('learning entry has invalid subject_stage');
  }
  if (!LEARNING_TYPES.includes(e.type as LearningType)) throw new Error('learning entry has invalid type');
  if (typeof e.key !== 'string' || e.key.length === 0) throw new Error('learning entry missing key');
  if (typeof e.insight !== 'string' || e.insight.length === 0) throw new Error('learning entry missing insight');
  if (
    typeof e.confidence !== 'number'
    || !Number.isInteger(e.confidence)
    || e.confidence < 1
    || e.confidence > 10
  ) {
    throw new Error('learning entry confidence must be integer in [1, 10]');
  }
  if (!EVIDENCE_TYPES.includes(e.evidence_type as EvidenceType)) {
    throw new Error('learning entry has invalid evidence_type');
  }
  if (!LEARNING_SOURCES.includes(e.source as LearningSource)) {
    throw new Error('learning entry has invalid source');
  }
  if (!Array.isArray(e.files)) throw new Error('learning entry files must be array');
  if (!Array.isArray(e.supersedes)) throw new Error('learning entry supersedes must be array');
  if (!Array.isArray(e.derived_from)) throw new Error('learning entry derived_from must be array');
  if (e.supersedes_reason !== null && !SUPERSEDES_REASONS.includes(e.supersedes_reason as SupersedesReason)) {
    throw new Error('learning entry has invalid supersedes_reason');
  }
}
