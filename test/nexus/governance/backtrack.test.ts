// test/nexus/governance/backtrack.test.ts
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  BACKTRACK_EDGES,
  evaluateBacktrack,
  readBacktrackJustification,
  backtrackJustificationPath,
  type BacktrackJustification,
} from '../../../lib/nexus/governance/backtrack';

describe('BACKTRACK_EDGES (RFC item #3)', () => {
  test('encodes the early reverse spine (the RFC-named retreats)', () => {
    expect(BACKTRACK_EDGES.discover).toContain('frame'); // frame -> discover
    expect(BACKTRACK_EDGES.frame).toContain('plan'); // plan -> frame
    expect(BACKTRACK_EDGES.plan).toContain('handoff'); // handoff -> plan
  });
});

describe('evaluateBacktrack', () => {
  const j = (over: Partial<BacktrackJustification> = {}): BacktrackJustification => ({
    from: 'frame',
    to: 'discover',
    reason: 'framing disproven by a spike; re-discover the constraint surface',
    ...over,
  });

  test('recognized edge + valid justification → allowed', () => {
    const r = evaluateBacktrack('frame', 'discover', j());
    expect(r.allowed).toBe(true);
  });

  test('recognized edge but NO justification → not allowed (default stays forward-only)', () => {
    const r = evaluateBacktrack('frame', 'discover', null);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(/requires a recorded justification/i);
  });

  test('unrecognized edge (forward, or non-spine) → not allowed', () => {
    expect(evaluateBacktrack('discover', 'ship', j({ from: 'discover', to: 'ship' })).allowed).toBe(false);
  });

  test('justification edge must match the attempted transition', () => {
    const r = evaluateBacktrack('frame', 'discover', j({ from: 'plan', to: 'frame' }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(/does not match/i);
  });

  test('empty reason → not allowed (must record WHY)', () => {
    const r = evaluateBacktrack('frame', 'discover', j({ reason: '   ' }));
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toMatch(/non-empty reason/i);
  });
});

describe('readBacktrackJustification', () => {
  test('reads a valid justification at the canonical path', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'bt-'));
    try {
      mkdirSync(join(cwd, '.planning', 'current', 'discover'), { recursive: true });
      writeFileSync(
        join(cwd, backtrackJustificationPath('discover')),
        JSON.stringify({ from: 'frame', to: 'discover', reason: 're-discover' }),
      );
      const r = readBacktrackJustification(cwd, 'discover');
      expect(r?.from).toBe('frame');
      expect(r?.reason).toBe('re-discover');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('absent / malformed → null (fail-soft, never throws)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'bt-'));
    try {
      expect(readBacktrackJustification(cwd, 'discover')).toBeNull();
      mkdirSync(join(cwd, '.planning', 'current', 'discover'), { recursive: true });
      writeFileSync(join(cwd, backtrackJustificationPath('discover')), 'not json{');
      expect(readBacktrackJustification(cwd, 'discover')).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
