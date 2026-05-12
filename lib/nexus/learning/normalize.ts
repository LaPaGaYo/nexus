// lib/nexus/learning/normalize.ts
import type { LearningEntry } from './schema';
import { LEARNING_TYPES, LEARNING_SOURCES } from './schema';
import { deriveLegacyId } from './id';

/** Loose v1 entry shape as it appears in legacy learnings.jsonl. */
type LegacyV1 = {
  ts?: string;
  skill?: string;
  type?: string;
  key?: string;
  insight?: string;
  confidence?: number;
  source?: string;
  files?: string[];
};

/** Read-time normalized entry. schema_version: 1 marks a legacy origin. */
export type NormalizedEntry = LearningEntry & { schema_version: 1 | 2 };

export function normalizeLearningLine(line: string): NormalizedEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // Already v2 — pass through with minimal sanity.
  if (obj.schema_version === 2) {
    if (typeof obj.id !== 'string' || typeof obj.key !== 'string' || typeof obj.type !== 'string' || typeof obj.insight !== 'string') {
      return null;
    }
    return obj as unknown as NormalizedEntry;
  }

  // Legacy v1 (or pre-versioned). Require type, key, insight to be useful.
  const v1 = obj as LegacyV1;
  if (!v1.type || !v1.key || !v1.insight) return null;
  if (!LEARNING_TYPES.includes(v1.type as any)) return null;

  const ts = typeof v1.ts === 'string' ? v1.ts : '1970-01-01T00:00:00Z';
  const writer = typeof v1.skill === 'string' ? v1.skill : 'unknown';
  const source = (typeof v1.source === 'string' && LEARNING_SOURCES.includes(v1.source as any))
    ? (v1.source as LearningEntry['source'])
    : 'unknown';

  return {
    id: deriveLegacyId({
      ts,
      skill: writer,
      type: v1.type,
      key: v1.key,
      insight: v1.insight,
      files: v1.files ?? [],
    }),
    schema_version: 1,
    ts,
    writer_skill: writer,
    subject_skill: 'unknown',
    subject_stage: null,
    type: v1.type as LearningEntry['type'],
    key: v1.key,
    insight: v1.insight,
    confidence: typeof v1.confidence === 'number' ? v1.confidence : 5,
    evidence_type: 'unknown',
    source,
    files: Array.isArray(v1.files) ? v1.files : [],
    cluster_id: null,
    supersedes: [],
    supersedes_reason: null,
    derived_from: [],
    last_applied_at: null,
    mirror: null,
  };
}
