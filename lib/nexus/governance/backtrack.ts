// lib/nexus/governance/backtrack.ts
//
// RFC item #3 — legal, recorded backward transitions
// (docs/architecture/lifecycle-multimodality-rfc.md, Hole 3 + addition D).
//
// The lifecycle is forward-only by default; `frame -> discover` and the like
// throw, which forced the operator-attested fabrication workaround. This makes
// evidence-driven retreat a first-class, RECORDED primitive: a backward edge is
// legal only when accompanied by a non-empty justification, so retreat is honest
// and auditable rather than illegal-or-faked.
//
// v1 ships the pure primitive + wires the flagship `frame -> discover` through
// discover.ts. The other early edges (`plan -> frame`, `handoff -> plan`) are
// recognized here; their command-guard wiring (via assertLegalTransition) is a
// documented follow-on.
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CanonicalCommandId } from '../contracts/types';

/**
 * Legal recorded backward edges, keyed by TARGET stage → the stages it may be
 * re-entered FROM (with justification). The reverse of the early forward spine
 * (discover→frame→plan→handoff); does not duplicate the existing forward-legal
 * fix-cycle edges (review/qa→build) which are plain `legal_predecessors`.
 */
export const BACKTRACK_EDGES: Partial<Record<CanonicalCommandId, CanonicalCommandId[]>> = {
  discover: ['frame'],
  frame: ['plan'],
  plan: ['handoff'],
};

export interface BacktrackJustification {
  from: CanonicalCommandId;
  to: CanonicalCommandId;
  /** WHY the retreat is warranted — the recorded, auditable rationale. */
  reason: string;
  /** Stamped by the command when the recorded transition is accepted. */
  recorded_at?: string;
}

export type BacktrackEvaluation =
  | { allowed: true; justification: BacktrackJustification }
  | { allowed: false; reason: string };

/** Canonical location of the justification record for a backward transition to `to`. */
export function backtrackJustificationPath(to: CanonicalCommandId): string {
  return `.planning/current/${to}/backtrack-justification.json`;
}

/**
 * A backward transition `from -> to` is legal only when (a) it is a recognized
 * backward edge AND (b) a justification is recorded whose edge matches and whose
 * reason is non-empty. Otherwise forward-only stands.
 */
export function evaluateBacktrack(
  from: CanonicalCommandId,
  to: CanonicalCommandId,
  justification: BacktrackJustification | null,
): BacktrackEvaluation {
  const allowedFrom = BACKTRACK_EDGES[to] ?? [];
  if (!allowedFrom.includes(from)) {
    return { allowed: false, reason: `${from} -> ${to} is not a recognized backward transition` };
  }
  if (!justification) {
    return {
      allowed: false,
      reason: `backward transition ${from} -> ${to} requires a recorded justification at ${backtrackJustificationPath(to)}`,
    };
  }
  if (justification.from !== from || justification.to !== to) {
    return {
      allowed: false,
      reason: `justification edge (${justification.from} -> ${justification.to}) does not match the attempted transition (${from} -> ${to})`,
    };
  }
  if (typeof justification.reason !== 'string' || justification.reason.trim().length === 0) {
    return { allowed: false, reason: 'backward transition justification must include a non-empty reason' };
  }
  return { allowed: true, justification };
}

/** Fail-soft reader for the backward-transition justification record. Never throws. */
export function readBacktrackJustification(
  cwd: string,
  to: CanonicalCommandId,
): BacktrackJustification | null {
  try {
    const parsed = JSON.parse(readFileSync(join(cwd, backtrackJustificationPath(to)), 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const j = parsed as BacktrackJustification;
    if (typeof j.from !== 'string' || typeof j.to !== 'string' || typeof j.reason !== 'string') {
      return null;
    }
    return j;
  } catch {
    return null;
  }
}
