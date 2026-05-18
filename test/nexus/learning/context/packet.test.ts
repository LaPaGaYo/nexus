// test/nexus/learning/context/packet.test.ts
import { describe, test, expect } from 'bun:test';
import { capPacket, estimateEntryTokens } from '../../../../lib/nexus/learning/context/packet';
import type { ScoredEntry } from '../../../../lib/nexus/learning/context/types';

function s(id: string, score: number, insightLen = 20): ScoredEntry {
  return {
    entry: { id, key: id, insight: 'x'.repeat(insightLen) } as ScoredEntry['entry'],
    score,
    factors: {} as ScoredEntry['factors'],
  };
}

describe('capPacket', () => {
  test('drops entries below score_floor', () => {
    const out = capPacket([s('a', 0.5), s('b', 0.10), s('c', 0.149)], { score_floor: 0.15, max_entries: 12, token_budget: 99999 });
    expect(out.packet.map((p) => p.entry.id)).toEqual(['a']);
    expect(out.dropped.below_floor).toBe(2);
  });

  test('max_entries cap applies to top-scored survivors', () => {
    const many = Array.from({ length: 20 }, (_, i) => s(`e${i}`, 0.9 - i * 0.01));
    const out = capPacket(many, { score_floor: 0.15, max_entries: 12, token_budget: 999999 });
    expect(out.packet).toHaveLength(12);
    expect(out.dropped.over_cap).toBe(8);
    expect(out.packet[0].score).toBeGreaterThanOrEqual(out.packet[11].score);
  });

  test('token_budget binds before max_entries when entries are large', () => {
    const big = Array.from({ length: 12 }, (_, i) => s(`b${i}`, 0.9, 4000));
    const out = capPacket(big, { score_floor: 0.15, max_entries: 12, token_budget: 1500 });
    expect(out.packet).toHaveLength(1);
    expect(out.packet[0].entry.id).toBe('b0');
    expect(out.dropped.over_cap).toBe(11);
  });
});

describe('estimateEntryTokens', () => {
  test('is ceil(serialized key+insight length / 4), deterministic and floored at 1', () => {
    expect(estimateEntryTokens(s('k', 0.5, 16))).toBe(10); // {"key":"k","insight":"xxxxxxxxxxxxxxxx"} = 40 chars → ceil(40/4)
    expect(estimateEntryTokens(s('', 0.5, 0))).toBeGreaterThanOrEqual(1); // floor-at-1
  });
});
