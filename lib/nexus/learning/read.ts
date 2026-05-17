// lib/nexus/learning/read.ts
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { StageLearningCandidatesRecord, RunLearningsRecord } from '../contracts/types';
import { collectValidLearningCandidates } from '../observability/learnings';
import { normalizeLearningLine, type NormalizedEntry } from './normalize';

/** Read a learnings.jsonl file → normalized entries; malformed lines skipped (fail-soft). */
export function readLearningsJsonl(absPath: string): NormalizedEntry[] {
  if (!existsSync(absPath)) return [];
  const out: NormalizedEntry[] = [];
  for (const line of readFileSync(absPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = normalizeLearningLine(line);
    if (e) out.push(e);
  }
  return out;
}

/**
 * Read a stage learning-candidates.json file → record, or null on missing/malformed.
 * Pure parse: candidates validated via collectValidLearningCandidates. Does NOT
 * apply closeout's run_id/stage/non-empty gating (that stays in closeout).
 */
export function readStageCandidatesFile(absPath: string): StageLearningCandidatesRecord | null {
  if (!existsSync(absPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(absPath, 'utf8')) as Partial<StageLearningCandidatesRecord>;
    if (raw.schema_version !== 1 && raw.schema_version !== 2) return null;
    if (typeof raw.run_id !== 'string' || typeof raw.stage !== 'string') return null;
    return {
      schema_version: raw.schema_version,
      run_id: raw.run_id,
      stage: raw.stage,
      generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : '',
      candidates: collectValidLearningCandidates(raw.candidates),
    };
  } catch {
    return null;
  }
}

/** Read a canonical closeout learnings.json → record, or null on missing/malformed. */
export function readCanonicalLearningsFile(absPath: string): RunLearningsRecord | null {
  if (!existsSync(absPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(absPath, 'utf8')) as Partial<RunLearningsRecord>;
    if (raw.schema_version !== 1 && raw.schema_version !== 2) return null;
    if (typeof raw.run_id !== 'string' || !Array.isArray(raw.learnings)) return null;
    return {
      schema_version: raw.schema_version,
      run_id: raw.run_id,
      generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : '',
      source_candidates: Array.isArray(raw.source_candidates) ? raw.source_candidates.map(String) : [],
      learnings: raw.learnings as RunLearningsRecord['learnings'],
    };
  } catch {
    return null;
  }
}

/** Walk .planning/archive/runs/<run>/closeout/learnings.json under repoRoot. */
export function walkArchiveRunLearnings(repoRoot: string): RunLearningsRecord[] {
  const runsDir = join(repoRoot, '.planning', 'archive', 'runs');
  if (!existsSync(runsDir)) return [];
  const out: RunLearningsRecord[] = [];
  for (const entry of readdirSync(runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rec = readCanonicalLearningsFile(join(runsDir, entry.name, 'closeout', 'learnings.json'));
    if (rec) out.push(rec);
  }
  return out;
}
