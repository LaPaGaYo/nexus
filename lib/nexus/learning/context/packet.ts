// lib/nexus/learning/context/packet.ts
import type { ScoredEntry } from './types';

export interface PacketLimits {
  score_floor: number;
  max_entries: number;
  token_budget: number;
}

export interface CappedPacket {
  packet: ScoredEntry[];
  dropped: { below_floor: number; over_cap: number };
}

/** Deterministic, dependency-free token estimate (~4 chars/token). */
export function estimateEntryTokens(s: ScoredEntry): number {
  const e = s.entry as { key?: string; insight?: string };
  const serialized = JSON.stringify({ key: e.key ?? '', insight: e.insight ?? '' });
  return Math.max(1, Math.ceil(serialized.length / 4));
}

export function capPacket(scored: ScoredEntry[], limits: PacketLimits): CappedPacket {
  const aboveFloor = scored.filter((s) => s.score >= limits.score_floor);
  const belowFloor = scored.length - aboveFloor.length;

  const sorted = [...aboveFloor].sort(
    (a, b) => b.score - a.score || String(a.entry.id).localeCompare(String(b.entry.id)),
  );

  const packet: ScoredEntry[] = [];
  let tokens = 0;
  for (const s of sorted) {
    if (packet.length >= limits.max_entries) break;
    const t = estimateEntryTokens(s);
    if (tokens + t > limits.token_budget) break;
    packet.push(s);
    tokens += t;
  }

  return {
    packet,
    dropped: { below_floor: belowFloor, over_cap: aboveFloor.length - packet.length },
  };
}
