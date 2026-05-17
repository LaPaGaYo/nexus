// lib/nexus/learning/decay.ts
import type { LearningEntry } from './schema';

/**
 * Recency decay — the single source of truth for time-decayed confidence.
 *
 * Replicates verbatim the rule previously inlined in bin/nexus-learnings-search:
 *   observed/inferred lose 1 point per 30 full days since `ts`; floored at 0;
 *   falsy confidence defaults to 5 before decay. Other sources do not decay.
 *
 * Sibling of strength.ts (SP1 Task 3): a shared primitive so SP6 ranking,
 * SP2 fitness, and nexus-learnings-search never reimplement and drift.
 */
const DAY_MS = 86_400_000;

export function computeEffectiveConfidence(
  entry: Pick<LearningEntry, 'confidence' | 'source' | 'ts'>,
  now: number = Date.now(),
): number {
  let conf = entry.confidence || 5;
  if (entry.source === 'observed' || entry.source === 'inferred') {
    const days = Math.floor((now - new Date(entry.ts).getTime()) / DAY_MS);
    conf = Math.max(0, conf - Math.floor(days / 30));
  }
  return conf;
}
