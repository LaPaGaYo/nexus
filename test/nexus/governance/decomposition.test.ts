// test/nexus/governance/decomposition.test.ts
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  evaluateDecompositionGate,
  readDecompositionRecord,
  DECOMPOSITION_RECORD_PATH,
  type DecompositionRecord,
} from '../../../lib/nexus/governance/decomposition';

describe('evaluateDecompositionGate (RFC phase 1)', () => {
  test('single explicit problem → ok, proceeds', () => {
    const r: DecompositionRecord = { problems: [{ id: 'p1', summary: 'one thing' }] };
    const g = evaluateDecompositionGate(r);
    expect(g.ok).toBe(true);
    expect(g.problems).toHaveLength(1);
  });

  test('multi-problem brief → not ok, enumerates sub-problems', () => {
    const r: DecompositionRecord = {
      problems: [
        { id: 'a', summary: 'streaming parity' },
        { id: 'b', summary: 'lifecycle re-entry' },
      ],
    };
    const g = evaluateDecompositionGate(r);
    expect(g.ok).toBe(false);
    expect(g.problems.map((p) => p.id)).toEqual(['a', 'b']);
    expect(g.reason).toContain('split');
  });

  test('present-but-empty record → not ok (explicit emptiness is a defect, not a default)', () => {
    const g = evaluateDecompositionGate({ problems: [] });
    expect(g.ok).toBe(false);
    expect(g.reason).toMatch(/empty/i);
  });

  test('absent record (null) → ok in v1 (additive, backward-compatible; hard-required deferred)', () => {
    const g = evaluateDecompositionGate(null);
    expect(g.ok).toBe(true);
    expect(g.problems).toEqual([]);
  });
});

describe('readDecompositionRecord', () => {
  test('reads a valid record from the canonical discover path', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'decomp-'));
    try {
      mkdirSync(join(cwd, '.planning', 'current', 'discover'), { recursive: true });
      writeFileSync(
        join(cwd, DECOMPOSITION_RECORD_PATH),
        JSON.stringify({ problems: [{ id: 'p1', summary: 's', size_hint: 'bounded' }] }),
      );
      const r = readDecompositionRecord(cwd);
      expect(r?.problems).toHaveLength(1);
      expect(r?.problems[0].size_hint).toBe('bounded');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('absent file → null (fail-soft)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'decomp-'));
    try {
      expect(readDecompositionRecord(cwd)).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('malformed json → null (fail-soft, never throws)', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'decomp-'));
    try {
      mkdirSync(join(cwd, '.planning', 'current', 'discover'), { recursive: true });
      writeFileSync(join(cwd, DECOMPOSITION_RECORD_PATH), 'not json{');
      expect(readDecompositionRecord(cwd)).toBeNull();
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
