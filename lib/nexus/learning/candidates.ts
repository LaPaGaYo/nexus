// lib/nexus/learning/candidates.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import type { LearningEntry } from './schema';
import { assertSchemaV2 } from './schema';

type Stage = 'build' | 'review' | 'qa' | 'ship';

const STAGE_PATHS: Record<Stage, string> = {
  build: '.planning/current/build/learning-candidates.json',
  review: '.planning/current/review/learning-candidates.json',
  qa: '.planning/current/qa/learning-candidates.json',
  ship: '.planning/current/ship/learning-candidates.json',
};

type StageRecord = {
  schema_version: 2;
  stage: Stage;
  run_id: string;
  candidates: LearningEntry[];
};

export type WriteLearningCandidateInput = {
  cwd: string;
  stage: Stage;
  run_id: string;
  entry: LearningEntry;
};

export function writeLearningCandidate(params: WriteLearningCandidateInput): void {
  // Write-time gate: reject malformed entries before they hit disk.
  // Downstream consumers (closeout promotion, mirror, search) can trust shape.
  assertSchemaV2(params.entry);

  const path = join(params.cwd, STAGE_PATHS[params.stage]);
  mkdirSync(dirname(path), { recursive: true });

  // If an existing file matches the current run_id + stage, append; otherwise start fresh.
  let record: StageRecord;
  if (existsSync(path)) {
    try {
      const existing = JSON.parse(readFileSync(path, 'utf8')) as Partial<StageRecord>;
      if (
        existing.schema_version === 2
        && existing.stage === params.stage
        && existing.run_id === params.run_id
        && Array.isArray(existing.candidates)
      ) {
        record = {
          schema_version: 2,
          stage: params.stage,
          run_id: params.run_id,
          candidates: [...existing.candidates, params.entry],
        };
      } else {
        // Stale file from a different run — overwrite.
        record = freshRecord(params);
      }
    } catch {
      // Corrupt file — overwrite.
      record = freshRecord(params);
    }
  } else {
    record = freshRecord(params);
  }

  // Atomic write: temp + rename (POSIX rename is atomic on same filesystem).
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(record, null, 2));
  renameSync(tmp, path);
}

function freshRecord(params: WriteLearningCandidateInput): StageRecord {
  return {
    schema_version: 2,
    stage: params.stage,
    run_id: params.run_id,
    candidates: [params.entry],
  };
}
