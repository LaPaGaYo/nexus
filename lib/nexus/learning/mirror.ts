// lib/nexus/learning/mirror.ts
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import type { LearningEntry } from './schema';
import { normalizeLearningLine } from './normalize';

export type MirrorCanonicalInput = {
  stateDir: string;
  slug: string;
  runId: string;
  sourcePath: string;
  canonical: LearningEntry[];
};

/**
 * Append canonical learnings to the durable jsonl log, gated by an in-memory
 * `(canonical_id, run_id)` ledger so re-running closeout never duplicates.
 *
 * Per SP1 spec §6 (Q4 = A + D + F):
 *  - A (opt-in): caller is responsible for checking `isMirrorEnabled()` before invocation.
 *    This helper does NOT re-check config; callers should treat it as "if you call, mirror happens."
 *  - D (nested mirror metadata): each mirrored entry carries `{ origin, run_id, source_path }`.
 *  - F (idempotent): existing jsonl is streamed once to build a `Set<canonical_id|run_id>`;
 *    new canonicals whose `(id, run_id)` already exists are skipped.
 *
 * Append-only: existing jsonl entries (legacy v1 or prior mirrors) are never rewritten.
 */
export function mirrorCanonicalToJsonl(params: MirrorCanonicalInput): void {
  const jsonlPath = join(params.stateDir, 'projects', params.slug, 'learnings.jsonl');
  mkdirSync(dirname(jsonlPath), { recursive: true });

  // Build (id, run_id) ledger from existing jsonl by streaming + normalizing.
  // Legacy v1 entries lack a mirror block — they contribute nothing to the ledger.
  const seen = new Set<string>();
  if (existsSync(jsonlPath)) {
    const existing = readFileSync(jsonlPath, 'utf8');
    for (const line of existing.split('\n')) {
      if (!line.trim()) continue;
      const norm = normalizeLearningLine(line);
      if (norm && norm.mirror && norm.mirror.run_id) {
        seen.add(`${norm.id}|${norm.mirror.run_id}`);
      }
    }
  }

  // Append each not-yet-mirrored canonical with the mirror metadata block.
  for (const entry of params.canonical) {
    const key = `${entry.id}|${params.runId}`;
    if (seen.has(key)) continue;
    const mirrored: LearningEntry = {
      ...entry,
      mirror: {
        origin: 'closeout',
        run_id: params.runId,
        source_path: params.sourcePath,
      },
    };
    appendFileSync(jsonlPath, JSON.stringify(mirrored) + '\n');
    seen.add(key);
  }
}
