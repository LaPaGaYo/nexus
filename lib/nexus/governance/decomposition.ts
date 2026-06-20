// lib/nexus/governance/decomposition.ts
//
// RFC phase 1 — the decomposition step (docs/architecture/lifecycle-multimodality-rfc.md).
//
// A required, explicit "one problem or several?" record on the discover→frame
// boundary. The mono-modal lifecycle had no step that forced this question, so a
// brief conflating several problems (idea-brief Sources 1-6: Problems A/B/C) was
// scoped as one frame and the conflation surfaced only after six review passes.
//
// v1 is additive/backward-compatible: the gate fires only when a decomposition
// record is present (catching multi-problem and explicitly-empty records). An
// absent record proceeds as before — making the record hard-required for every
// frame is a follow-up that also teaches /discover to emit it (it would otherwise
// break every existing frame flow). `size_hint` is free-text until the lane
// taxonomy (RFC item #2) lands.
import { readFileSync } from 'fs';
import { join } from 'path';

export const DECOMPOSITION_RECORD_PATH = '.planning/current/discover/decomposition.json';

export interface DecompositionProblem {
  /** Stable slug, e.g. "streaming-parity". */
  id: string;
  /** One line: who hurts / what changes. */
  summary: string;
  /** Free-text size hint until the lane taxonomy (RFC item #2) binds a typed lane. */
  size_hint?: string;
}

export interface DecompositionRecord {
  problems: DecompositionProblem[];
}

export type DecompositionGateResult =
  | { ok: true; problems: DecompositionProblem[]; reason: null }
  | { ok: false; problems: DecompositionProblem[]; reason: string };

/**
 * Gate a frame on its decomposition record.
 *
 * - absent (null): ok — additive v1, backward-compatible (no decomposition declared).
 * - present but empty: NOT ok — an explicit empty record is a defect, not a silent default.
 * - exactly one problem: ok — the brief is atomic, proceed to frame it.
 * - more than one: NOT ok — split into independently-framed sub-problems and route each.
 */
export function evaluateDecompositionGate(record: DecompositionRecord | null): DecompositionGateResult {
  if (record === null) {
    return { ok: true, problems: [], reason: null };
  }
  const problems = Array.isArray(record.problems) ? record.problems : [];
  if (problems.length === 0) {
    return {
      ok: false,
      problems: [],
      reason: `decomposition record at ${DECOMPOSITION_RECORD_PATH} is present but empty: list the problem(s) explicitly, or remove the record`,
    };
  }
  if (problems.length > 1) {
    const ids = problems.map((p) => p.id).join(', ');
    return {
      ok: false,
      problems,
      reason: `multi-problem brief (${problems.length}: ${ids}): split into independently-framed sub-problems and route each through its own /frame`,
    };
  }
  return { ok: true, problems, reason: null };
}

/** Fail-soft reader for the discover-stage decomposition record. Never throws. */
export function readDecompositionRecord(cwd: string): DecompositionRecord | null {
  try {
    const raw = readFileSync(join(cwd, DECOMPOSITION_RECORD_PATH), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as DecompositionRecord).problems)) {
      return null;
    }
    return parsed as DecompositionRecord;
  } catch {
    return null;
  }
}
