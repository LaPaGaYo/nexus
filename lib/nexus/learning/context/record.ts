// lib/nexus/learning/context/record.ts
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type {
  LearningContextConfig, ScoredEntry, BoostDelta, RankDisagreement,
  ResolverStatus, LearningContextStage,
} from './types';

export interface BuildRecordInput {
  stage: LearningContextStage;
  runId: string;
  projectSlug: string;
  config: LearningContextConfig;
  status: ResolverStatus;
  warnings: string[];
  packet: ScoredEntry[];
  dropped: { below_floor: number; over_cap: number; superseded: number };
  boosts: BoostDelta[];
  disagreements: RankDisagreement[];
  generatedAt: string;
}

export interface LearningContextRecord {
  schema_version: 1;
  generated_at: string;
  stage: LearningContextStage;
  run_id: string;
  project_slug: string;
  resolver: { status: ResolverStatus; warnings: string[] };
  limits: LearningContextConfig;
  packet: Array<{
    id: string; source_path?: string; subject_skill?: string; score: number;
    factors: ScoredEntry['factors'];
  }>;
  dropped: { below_floor: number; over_cap: number; superseded: number };
  boosts: BoostDelta[];
  rank_disagreements: RankDisagreement[];
}

export function buildLearningContextRecord(input: BuildRecordInput): LearningContextRecord {
  return {
    schema_version: 1,
    generated_at: input.generatedAt,
    stage: input.stage,
    run_id: input.runId,
    project_slug: input.projectSlug,
    resolver: { status: input.status, warnings: input.warnings },
    limits: input.config,
    packet: input.packet.map((p) => ({
      id: String(p.entry.id),
      source_path: (p.entry as { source_path?: string }).source_path,
      subject_skill: (p.entry as { subject_skill?: string }).subject_skill,
      score: p.score,
      factors: p.factors,
    })),
    dropped: input.dropped,
    boosts: input.boosts,
    rank_disagreements: input.disagreements,
  };
}

/** Sole writer. Fail-soft: never throws; returns the intended path regardless. */
export function writeLearningContextRecord(
  cwd: string,
  stage: LearningContextStage,
  record: LearningContextRecord,
): string {
  const path = join(cwd, '.planning', 'current', stage, 'learning-context.json');
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(record, null, 2) + '\n');
  } catch {
    // evidence write is best-effort; advisor must not be blocked by it
  }
  return path;
}
