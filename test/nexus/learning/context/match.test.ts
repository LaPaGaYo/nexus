// test/nexus/learning/context/match.test.ts
import { describe, test, expect } from 'bun:test';
import { fileOverlap, stageMatch, relevance, contradictionRisk } from '../../../../lib/nexus/learning/context/match';
import type { NormalizedEntry } from '../../../../lib/nexus/learning/normalize';

function e(over: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    id: 'lrn_x', ts: '2026-05-01T00:00:00Z', skill: 'investigate', type: 'pitfall',
    key: 'flaky-timeout', insight: 'increase the socket timeout for slow CI',
    confidence: 7, source: 'observed', files: ['lib/net/socket.ts'],
    subject_skill: 'investigate', subject_stage: 'build', evidence_type: 'single-run-observation',
    ...(over as object),
  } as NormalizedEntry;
}

describe('fileOverlap', () => {
  test('intersection over entry.files size (denominator = entry.files)', () => {
    expect(fileOverlap(['lib/net/socket.ts'], ['lib/net/socket.ts', 'a.ts'])).toBe(1);            // 1/1
    expect(fileOverlap(['lib/net/socket.ts', 'a.ts'], ['lib/net/socket.ts'])).toBe(0.5);          // 1/2
    expect(fileOverlap(['x.ts'], ['lib/net/socket.ts', 'y.ts'])).toBe(0);                          // 0/1
  });
  test('empty entry.files → 0', () => {
    expect(fileOverlap([], ['x.ts'])).toBe(0);
  });
});

describe('stageMatch', () => {
  test('exact = 1, immediately-adjacent = 0.5, distant = 0', () => {
    expect(stageMatch('build', 'build')).toBe(1);
    expect(stageMatch('build', 'handoff')).toBe(0.5); // idx3, adjacent to build idx4
    expect(stageMatch('build', 'review')).toBe(0.5);  // idx5, adjacent
    expect(stageMatch('build', 'plan')).toBe(0);      // idx2, 2 hops — NOT adjacent
    expect(stageMatch('build', 'closeout')).toBe(0);
    expect(stageMatch('build', undefined)).toBe(0);
  });
});

describe('relevance', () => {
  test('token overlap in [0,1], higher when key/insight share stage+file tokens', () => {
    const hi = relevance(e({ key: 'socket timeout', insight: 'build socket retries' }), {
      stage: 'build', changedFiles: ['lib/net/socket.ts'], skillNames: ['investigate'],
    });
    const lo = relevance(e({ key: 'unrelated', insight: 'nothing here', subject_skill: 'zzz' }), {
      stage: 'ship', changedFiles: ['docs/readme.md'], skillNames: ['design'],
    });
    expect(hi).toBeGreaterThan(lo);
    expect(hi).toBeLessThanOrEqual(1);
    expect(lo).toBeGreaterThanOrEqual(0);
  });
});

describe('contradictionRisk', () => {
  test('1 when entry id appears as another entry supersedes target', () => {
    const a = e({ id: 'lrn_a' });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    expect(contradictionRisk(a, [a, b])).toBe(1);
    expect(contradictionRisk(b, [a, b])).toBe(0);
  });
  test('0 when nothing supersedes it', () => {
    const a = e({ id: 'lrn_a' });
    expect(contradictionRisk(a, [a])).toBe(0);
  });
});
