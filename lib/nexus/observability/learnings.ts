import type {
  LearningCandidate,
  RunLearningsRecord,
  StageLearningCandidatesRecord,
} from '../contracts/types';
import { LEARNING_SOURCES, LEARNING_TYPES } from '../contracts/types';

type LearningStage = 'review' | 'qa' | 'ship';

type CandidateInput = {
  path: string;
  stage: LearningStage;
  candidates: LearningCandidate[];
};

type WinnerCandidate = LearningCandidate & {
  origin_stage: LearningStage;
  source_index: number;
  candidate_index: number;
  stage_rank: number;
};

const STAGE_ORDER: Record<LearningStage, number> = {
  review: 0,
  qa: 1,
  ship: 2,
};

function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

function normalizeLearningCandidate(candidate: unknown): LearningCandidate | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const rawCandidate = candidate as Partial<LearningCandidate> & { files?: unknown; [key: string]: unknown };
  const type = typeof rawCandidate.type === 'string' ? rawCandidate.type.trim() : '';
  const key = typeof rawCandidate.key === 'string' ? rawCandidate.key.trim() : '';
  const insight = typeof rawCandidate.insight === 'string' ? rawCandidate.insight.trim() : '';
  const source = typeof rawCandidate.source === 'string' ? rawCandidate.source.trim() : '';

  if (
    !isOneOf(type, LEARNING_TYPES)
    || !key
    || !insight
    || typeof rawCandidate.confidence !== 'number'
    || !Number.isFinite(rawCandidate.confidence)
    || !isOneOf(source, LEARNING_SOURCES)
    || !Array.isArray(rawCandidate.files)
    || rawCandidate.files.some((file) => typeof file !== 'string')
  ) {
    return null;
  }

  return {
    type,
    key,
    insight,
    confidence: rawCandidate.confidence,
    source,
    files: rawCandidate.files
      .map((file) => file.trim())
      .filter((file) => file.length > 0),
    // pass through v2 fields when present:
    ...(typeof rawCandidate.id === 'string' ? { id: rawCandidate.id } : {}),
    ...(typeof rawCandidate.writer_skill === 'string' ? { writer_skill: rawCandidate.writer_skill } : {}),
    ...(typeof rawCandidate.subject_skill === 'string' ? { subject_skill: rawCandidate.subject_skill } : {}),
    ...(typeof rawCandidate.subject_stage === 'string' || rawCandidate.subject_stage === null
      ? { subject_stage: rawCandidate.subject_stage ?? null }
      : {}),
    ...(typeof rawCandidate.evidence_type === 'string' ? { evidence_type: rawCandidate.evidence_type } : {}),
    ...(typeof rawCandidate.cluster_id === 'string' || rawCandidate.cluster_id === null
      ? { cluster_id: rawCandidate.cluster_id ?? null }
      : {}),
    ...(Array.isArray(rawCandidate.supersedes)
      ? { supersedes: (rawCandidate.supersedes as unknown[]).map(String) }
      : {}),
    ...(typeof rawCandidate.supersedes_reason === 'string' || rawCandidate.supersedes_reason === null
      ? { supersedes_reason: rawCandidate.supersedes_reason ?? null }
      : {}),
    ...(Array.isArray(rawCandidate.derived_from)
      ? { derived_from: (rawCandidate.derived_from as unknown[]).map(String) }
      : {}),
    ...(typeof rawCandidate.last_applied_at === 'string' || rawCandidate.last_applied_at === null
      ? { last_applied_at: rawCandidate.last_applied_at ?? null }
      : {}),
  };
}

export function collectValidLearningCandidates(candidates: unknown): LearningCandidate[] {
  if (!Array.isArray(candidates)) {
    return [];
  }

  const validCandidates: LearningCandidate[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeLearningCandidate(candidate);
    if (normalized) {
      validCandidates.push(normalized);
    }
  }

  return validCandidates;
}

function compareWinnerCandidates(left: WinnerCandidate, right: WinnerCandidate): number {
  if (left.stage_rank !== right.stage_rank) {
    return left.stage_rank - right.stage_rank;
  }

  if (left.source_index !== right.source_index) {
    return left.source_index - right.source_index;
  }

  return left.candidate_index - right.candidate_index;
}

function learningTypeLabel(type: (typeof LEARNING_TYPES)[number]): string {
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
}

export function collectRunLearnings(input: {
  runId: string;
  generatedAt: string;
  candidates: CandidateInput[];
}): RunLearningsRecord {
  const winners = new Map<string, WinnerCandidate>();

  for (const [sourceIndex, source] of input.candidates.entries()) {
    for (const [candidateIndex, candidate] of collectValidLearningCandidates(source.candidates).entries()) {
      const entry: WinnerCandidate = {
        ...candidate,
        origin_stage: source.stage,
        source_index: sourceIndex,
        candidate_index: candidateIndex,
        stage_rank: STAGE_ORDER[source.stage],
      };
      const key = `${candidate.type}|${candidate.key}`;
      const existing = winners.get(key);

      if (!existing || compareWinnerCandidates(existing, entry) < 0) {
        winners.set(key, entry);
      }
    }
  }

  const learnings = Array.from(winners.values())
    .sort((left, right) => {
      return left.type.localeCompare(right.type) || left.key.localeCompare(right.key);
    })
    .map(({ source_index: _sourceIndex, candidate_index: _candidateIndex, stage_rank: _stageRank, ...learning }) => learning);

  return {
    schema_version: 1,
    run_id: input.runId,
    generated_at: input.generatedAt,
    source_candidates: input.candidates.map((source) => source.path),
    learnings,
  };
}

export function renderRunLearningsMarkdown(record: RunLearningsRecord): string {
  const grouped = new Map<LearningCandidate['type'], Array<RunLearningsRecord['learnings'][number]>>();

  for (const learning of record.learnings) {
    const bucket = grouped.get(learning.type) ?? [];
    bucket.push(learning);
    grouped.set(learning.type, bucket);
  }

  const lines: string[] = [
    '# Run Learnings',
    '',
    `- Run: ${record.run_id}`,
    `- Generated at: ${record.generated_at}`,
    `- Source candidates: ${record.source_candidates.length}`,
    '',
  ];

  for (const [type, learnings] of grouped) {
    lines.push(`## ${learningTypeLabel(type)}`, '');

    for (const learning of learnings) {
      lines.push(
        `- **${learning.key}** (${learning.origin_stage}, confidence ${learning.confidence}/10, ${learning.source})`,
        `  ${learning.insight}${learning.files.length ? ` (files: ${learning.files.join(', ')})` : ''}`,
      );
    }

    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function hasLearningCandidates(record: StageLearningCandidatesRecord | null | undefined): boolean {
  return Boolean(record?.candidates.length);
}
