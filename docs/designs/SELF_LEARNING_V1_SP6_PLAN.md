# SP6 LearningContext Read-Side v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only `LearningContextResolver` that, at completion-advisor build time, reads the 3 SP1 learning surfaces via the barreled SP1-followup contract, ranks matched learnings into a bounded packet, applies a bounded additive boost to `stageAwareAdvisor`'s `recommended_skills`, and writes a full explainability record — meeting all 5 meta-spec ACs by construction.

**Architecture:** New pure-core + thin-I/O module `lib/nexus/learning/context/` (resolver / ranking / packet / record). Resolver runs lazily and synchronously inside `buildCompletionAdvisorWrite` (writer.ts), wraps `stageAwareAdvisor`'s natural `RecommendedSkill[]`, and degrades to the unmodified natural ranking on any failure. Spec: `docs/designs/SELF_LEARNING_V1_SP6.md` (`c642084`).

**Tech Stack:** Bun + TypeScript, `bun test`. Consumes barreled `lib/nexus` exports + `stageAwareAdvisor` (`lib/nexus/completion-advisor/stage-aware-advisor.ts`) + `projectSlugFromCwd` (`lib/nexus/telemetry`).

**Execution:** Subagent-driven in a fresh worktree off current `main` HEAD, branch `sp6-learning-context`. Per-task implementer + spec-review + code-quality-review. Tasks 1–8 are TDD (new code). Task 9 is behavior-preservation-gated (existing advisor tests stay green). Commit per task.

---

## File Structure

### NEW

| Path | Responsibility |
|---|---|
| `lib/nexus/learning/context/types.ts` | All SP6 interfaces + the operator-config defaults constant |
| `lib/nexus/learning/context/ranking.ts` | Pure: `STRENGTH_MAX`, factor normalizers, `scoreEntry`, `computeBoostDeltas` |
| `lib/nexus/learning/context/packet.ts` | Pure: `capPacket` (score-floor → dual-cap) |
| `lib/nexus/learning/context/match.ts` | Pure: `fileOverlap`, `stageMatch`, `relevance`, `contradictionRisk` helpers |
| `lib/nexus/learning/context/record.ts` | `buildLearningContextRecord` (pure) + `writeLearningContextRecord` (sole write) |
| `lib/nexus/learning/context/resolver.ts` | `resolveLearningContext` orchestration + degrade-to-natural guard |
| `lib/nexus/learning/context/index.ts` | Module barrel (re-exports the public surface) |
| `test/nexus/learning/context/ranking.test.ts` | ranking unit tests |
| `test/nexus/learning/context/packet.test.ts` | packet unit tests |
| `test/nexus/learning/context/match.test.ts` | match-helper unit tests |
| `test/nexus/learning/context/record.test.ts` | record builder/writer tests |
| `test/nexus/learning/context/resolver.test.ts` | resolver integration tests (tmp dirs) |
| `test/nexus/learning/context/acceptance.test.ts` | one test per AC (#1–#5 traceability) |

### MODIFIED

| Path | Change |
|---|---|
| `lib/nexus/completion-advisor/writer.ts` | Wrap the `stageAwareAdvisor` call at lines 47–52 with the resolver (additive, fallback-on-failure) |
| `lib/nexus/index.ts` | Barrel the SP6 public surface |
| `test/nexus/barrel-surface.test.ts` | Extend positive pin |
| `docs/designs/SELF_LEARNING_V1_META.md` | §4 SP6 row + §9 trigger log on ship |

---

## Task 1: Module scaffold — types + config defaults

**Files:**
- Create: `lib/nexus/learning/context/types.ts`
- Test: `test/nexus/learning/context/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/context/types.test.ts
import { describe, test, expect } from 'bun:test';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';

describe('DEFAULT_LEARNING_CONTEXT_CONFIG', () => {
  test('positive factor weights sum to exactly 1.0', () => {
    const w = DEFAULT_LEARNING_CONTEXT_CONFIG.weights;
    const sum = w.relevance + w.effective_confidence + w.evidence_strength + w.file_overlap + w.stage_match;
    expect(sum).toBeCloseTo(1.0, 10);
  });
  test('cap + floor + boost defaults match the spec', () => {
    const c = DEFAULT_LEARNING_CONTEXT_CONFIG;
    expect(c.score_floor).toBe(0.15);
    expect(c.max_entries).toBe(12);
    expect(c.token_budget).toBe(1500);
    expect(c.boost_cap).toBe(5);
    expect(c.boost_scale).toBe(1.0);
    expect(c.weights.contradiction_risk).toBe(-0.5);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL (module not found)**

Run: `bun test ./test/nexus/learning/context/types.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement `types.ts`**

```ts
// lib/nexus/learning/context/types.ts
import type { NormalizedEntry } from '../normalize';
import type { RecommendedSkill, CanonicalCommandId } from '../../contracts/types';

export type LearningContextStage = CanonicalCommandId;

export interface LearningContextInput {
  cwd: string;
  stage: LearningContextStage;
  runId: string;
  changedFiles: string[];
  naturalRanking: RecommendedSkill[];
  projectSlug: string;
  /** Optional override; defaults to DEFAULT_LEARNING_CONTEXT_CONFIG. */
  config?: LearningContextConfig;
  /** Injectable now() + home for deterministic tests. */
  now?: number;
  home?: string;
}

export interface LearningContextWeights {
  relevance: number;
  effective_confidence: number;
  evidence_strength: number;
  file_overlap: number;
  stage_match: number;
  /** Penalty (negative). */
  contradiction_risk: number;
}

export interface LearningContextConfig {
  score_floor: number;
  max_entries: number;
  token_budget: number;
  boost_cap: number;
  boost_scale: number;
  weights: LearningContextWeights;
}

export interface FactorContribution {
  value: number;
  weight: number;
  contribution: number;
}

export interface ScoredEntry {
  entry: NormalizedEntry;
  score: number;
  factors: Record<keyof LearningContextWeights, FactorContribution>;
}

export interface BoostDelta {
  skill: string;
  delta: number;
  from_entries: string[];
}

export interface RankDisagreement {
  skill: string;
  natural_rank: number;
  boosted_rank: number;
  natural_score: number;
  boosted_score: number;
  caused_by: string[];
}

export type ResolverStatus = 'ok' | 'degraded' | 'failed';

export interface LearningContextResult {
  boostedRanking: RecommendedSkill[];
  packet: ScoredEntry[];
  recordPath: string;
  status: ResolverStatus;
  warnings: string[];
}

export const DEFAULT_LEARNING_CONTEXT_CONFIG: LearningContextConfig = {
  score_floor: 0.15,
  max_entries: 12,
  token_budget: 1500,
  boost_cap: 5,
  boost_scale: 1.0,
  weights: {
    relevance: 0.30,
    effective_confidence: 0.25,
    evidence_strength: 0.20,
    file_overlap: 0.15,
    stage_match: 0.10,
    contradiction_risk: -0.5,
  },
};
```

- [ ] **Step 4: Run test, verify PASS**

Run: `bun test ./test/nexus/learning/context/types.test.ts`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/context/types.ts test/nexus/learning/context/types.test.ts
git commit -m "feat(sp6): LearningContext types + config defaults (SP6 Task 1)"
```

---

## Task 2: `match.ts` — pure matching helpers

**Files:**
- Create: `lib/nexus/learning/context/match.ts`
- Test: `test/nexus/learning/context/match.test.ts`

Stage adjacency order is the canonical lifecycle from the spec §6:
`discover → frame → plan → handoff → build → review → qa → closeout` plus `ship` between `qa` and `closeout` (canonical order: discover, frame, plan, handoff, build, review, qa, ship, closeout).

- [ ] **Step 1: Write the failing test**

```ts
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
  test('intersection over entry.files size (denominator = entry.files = first arg)', () => {
    expect(fileOverlap(['lib/net/socket.ts'], ['lib/net/socket.ts', 'a.ts'])).toBe(1);   // 1/1
    expect(fileOverlap(['lib/net/socket.ts', 'a.ts'], ['lib/net/socket.ts'])).toBe(0.5); // 1/2
    expect(fileOverlap(['x.ts'], ['lib/net/socket.ts', 'y.ts'])).toBe(0);                 // 0/1
  });
  test('empty entry.files → 0', () => {
    expect(fileOverlap([], ['x.ts'])).toBe(0);
  });
});

describe('stageMatch', () => {
  // lifecycle idx: discover0 frame1 plan2 handoff3 build4 review5 qa6 ship7 closeout8
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
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `bun test ./test/nexus/learning/context/match.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `match.ts`**

```ts
// lib/nexus/learning/context/match.ts
import { basename } from 'path';
import type { NormalizedEntry } from '../normalize';
import type { LearningContextStage } from './types';

const LIFECYCLE_ORDER: LearningContextStage[] = [
  'discover', 'frame', 'plan', 'handoff', 'build', 'review', 'qa', 'ship', 'closeout',
];

/** |changedFiles ∩ entry.files| / |entry.files|, 0 when entry.files empty. */
export function fileOverlap(entryFiles: string[], changedFiles: string[]): number {
  if (!entryFiles || entryFiles.length === 0) return 0;
  const changed = new Set(changedFiles);
  let hit = 0;
  for (const f of entryFiles) if (changed.has(f)) hit += 1;
  return hit / entryFiles.length;
}

/** 1 exact, 0.5 immediately adjacent in canonical lifecycle, else 0. */
export function stageMatch(ctxStage: LearningContextStage, subjectStage: string | undefined): number {
  if (!subjectStage) return 0;
  if (subjectStage === ctxStage) return 1;
  const ci = LIFECYCLE_ORDER.indexOf(ctxStage);
  const si = LIFECYCLE_ORDER.indexOf(subjectStage as LearningContextStage);
  if (ci < 0 || si < 0) return 0;
  return Math.abs(ci - si) === 1 ? 0.5 : 0;
}

function tokens(s: string): Set<string> {
  return new Set(
    (s || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

export interface RelevanceCtx {
  stage: LearningContextStage;
  changedFiles: string[];
  skillNames: string[];
}

/** Jaccard of entry {key,insight,subject_skill} tokens vs ctx {stage, file basenames, skill names}. */
export function relevance(entry: NormalizedEntry, ctx: RelevanceCtx): number {
  const left = tokens(
    [entry.key, entry.insight, (entry as { subject_skill?: string }).subject_skill ?? ''].join(' '),
  );
  const right = tokens(
    [ctx.stage, ...ctx.changedFiles.map((f) => basename(f)), ...ctx.skillNames].join(' '),
  );
  if (left.size === 0 || right.size === 0) return 0;
  let inter = 0;
  for (const t of left) if (right.has(t)) inter += 1;
  const union = left.size + right.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 1 if any other entry in the set supersedes this entry's id; else 0. */
export function contradictionRisk(entry: NormalizedEntry, all: NormalizedEntry[]): number {
  const id = entry.id;
  if (!id) return 0;
  for (const other of all) {
    if (other === entry) continue;
    const sup = (other as { supersedes?: string[] }).supersedes;
    if (Array.isArray(sup) && sup.includes(id)) return 1;
  }
  return 0;
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `bun test ./test/nexus/learning/context/match.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/context/match.ts test/nexus/learning/context/match.test.ts
git commit -m "feat(sp6): pure matching helpers — fileOverlap/stageMatch/relevance/contradictionRisk (SP6 Task 2)"
```

---

## Task 3: `ranking.ts` — STRENGTH_MAX + scoreEntry

**Files:**
- Create: `lib/nexus/learning/context/ranking.ts`
- Test: `test/nexus/learning/context/ranking.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/context/ranking.test.ts
import { describe, test, expect } from 'bun:test';
import { STRENGTH_MAX, scoreEntry } from '../../../../lib/nexus/learning/context/ranking';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';
import type { NormalizedEntry } from '../../../../lib/nexus/learning/normalize';

const NOW = Date.UTC(2026, 4, 1); // fixed, deterministic — no wall-clock dependence

function e(over: Partial<NormalizedEntry> = {}): NormalizedEntry {
  return {
    id: 'lrn_x', ts: new Date(NOW).toISOString(), writer_skill: 'investigate', type: 'pitfall',
    key: 'socket timeout', insight: 'build socket retries on slow ci',
    confidence: 8, source: 'observed', files: ['lib/net/socket.ts'],
    subject_skill: 'investigate', subject_stage: 'build', evidence_type: 'test-output',
    ...(over as object),
  } as NormalizedEntry;
}
const ctx = { stage: 'build' as const, changedFiles: ['lib/net/socket.ts'], skillNames: ['investigate'], now: NOW };

describe('STRENGTH_MAX', () => {
  test('is the max possible computeStrength output (8), derived not hardcoded into the formula', () => {
    expect(STRENGTH_MAX).toBe(8);
  });
});

describe('scoreEntry', () => {
  test('returns score in [0,1] with per-factor contributions summing to score', () => {
    const r = scoreEntry(e(), [e()], ctx, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
    const sum =
      r.factors.relevance.contribution +
      r.factors.effective_confidence.contribution +
      r.factors.evidence_strength.contribution +
      r.factors.file_overlap.contribution +
      r.factors.stage_match.contribution +
      r.factors.contradiction_risk.contribution;
    expect(sum).toBeCloseTo(r.score, 10);
  });

  test('contradiction penalty pushes a WEAK superseded entry below the score floor', () => {
    // weak on every positive factor (no relevance/file/stage match, low conf, weak evidence)
    const a = e({
      id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz',
      subject_stage: 'closeout', files: [], confidence: 2,
      source: 'speculation', evidence_type: 'speculation',
    });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.factors.contradiction_risk.value).toBe(1);
    expect(r.score).toBeLessThan(DEFAULT_LEARNING_CONTEXT_CONFIG.score_floor);
  });

  test('clamps at 0 (never negative even with full contradiction penalty)', () => {
    const a = e({ id: 'lrn_a', key: 'zzz', insight: 'zzz', subject_skill: 'zzz', subject_stage: 'closeout', files: [], confidence: 1, source: 'speculation', evidence_type: 'speculation' });
    const b = e({ id: 'lrn_b', supersedes: ['lrn_a'] } as Partial<NormalizedEntry>);
    const r = scoreEntry(a, [a, b], { ...ctx, changedFiles: [], skillNames: [] }, DEFAULT_LEARNING_CONTEXT_CONFIG);
    expect(r.score).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `bun test ./test/nexus/learning/context/ranking.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `ranking.ts` (scoreEntry only; boost in Task 5)**

```ts
// lib/nexus/learning/context/ranking.ts
import { computeStrength } from '../strength';
import { computeEffectiveConfidence } from '../decay';
import type { NormalizedEntry } from '../normalize';
import { fileOverlap, stageMatch, relevance, contradictionRisk, type RelevanceCtx } from './match';
import type { LearningContextConfig, ScoredEntry } from './types';

/**
 * Max possible computeStrength output — derived (not a magic literal) by
 * evaluating computeStrength on the strongest synthetic entry. If the SP1
 * strength tables change, this re-derives automatically.
 */
export const STRENGTH_MAX: number = computeStrength({
  evidence_type: 'test-output',
  source: 'observed',
  confidence: 10,
});

export interface RankCtx extends RelevanceCtx {
  now?: number;
}

export function scoreEntry(
  entry: NormalizedEntry,
  all: NormalizedEntry[],
  ctx: RankCtx,
  config: LearningContextConfig,
): ScoredEntry {
  const w = config.weights;

  const relVal = relevance(entry, ctx);
  const confVal = computeEffectiveConfidence(entry, ctx.now) / 10;
  const strVal = computeStrength(entry) / STRENGTH_MAX;
  const fileVal = fileOverlap(entry.files ?? [], ctx.changedFiles);
  const stageVal = stageMatch(ctx.stage, (entry as { subject_stage?: string }).subject_stage);
  const contraVal = contradictionRisk(entry, all);

  const f = (value: number, weight: number) => ({ value, weight, contribution: value * weight });
  const factors = {
    relevance: f(relVal, w.relevance),
    effective_confidence: f(confVal, w.effective_confidence),
    evidence_strength: f(strVal, w.evidence_strength),
    file_overlap: f(fileVal, w.file_overlap),
    stage_match: f(stageVal, w.stage_match),
    contradiction_risk: f(contraVal, w.contradiction_risk),
  };

  const raw =
    factors.relevance.contribution +
    factors.effective_confidence.contribution +
    factors.evidence_strength.contribution +
    factors.file_overlap.contribution +
    factors.stage_match.contribution +
    factors.contradiction_risk.contribution;

  return { entry, score: Math.max(0, raw), factors };
}
```

- [ ] **Step 4: Run test, verify PASS**

Run: `bun test ./test/nexus/learning/context/ranking.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/context/ranking.ts test/nexus/learning/context/ranking.test.ts
git commit -m "feat(sp6): scoreEntry weighted linear sum + derived STRENGTH_MAX (SP6 Task 3)"
```

---

## Task 4: `packet.ts` — score-floor + dual cap

**Files:**
- Create: `lib/nexus/learning/context/packet.ts`
- Test: `test/nexus/learning/context/packet.test.ts`

Token estimate for an entry: `Math.ceil(JSON.stringify({key,insight}).length / 4)` (≈4 chars/token — a deterministic, dependency-free estimate; documented as an estimate, not exact tokenization).

- [ ] **Step 1: Write the failing test**

```ts
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
    expect(out.packet.length).toBeLessThan(12);
    expect(out.dropped.over_cap).toBeGreaterThan(0);
  });
});

describe('estimateEntryTokens', () => {
  test('is ceil(serialized key+insight length / 4) and > 0', () => {
    expect(estimateEntryTokens(s('k', 0.5, 16))).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

Run: `bun test ./test/nexus/learning/context/packet.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packet.ts`**

```ts
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
```

- [ ] **Step 4: Run test, verify PASS**

Run: `bun test ./test/nexus/learning/context/packet.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/context/packet.ts test/nexus/learning/context/packet.test.ts
git commit -m "feat(sp6): capPacket score-floor + dual cap (SP6 Task 4)"
```

---

## Task 5: `ranking.ts` — bounded additive boost

**Files:**
- Modify: `lib/nexus/learning/context/ranking.ts`
- Test: `test/nexus/learning/context/ranking.test.ts` (extend)

- [ ] **Step 1: Add failing tests**

Append to `test/nexus/learning/context/ranking.test.ts`:

```ts
import { computeBoostDeltas, applyBoost } from '../../../../lib/nexus/learning/context/ranking';
import type { ScoredEntry } from '../../../../lib/nexus/learning/context/types';
import type { RecommendedSkill } from '../../../../lib/nexus/contracts/types';

function packetEntry(id: string, subjectSkill: string, score: number): ScoredEntry {
  return {
    entry: { id, key: id, insight: id, subject_skill: subjectSkill } as ScoredEntry['entry'],
    score,
    factors: {} as ScoredEntry['factors'],
  };
}
function rs(name: string, score: number): RecommendedSkill {
  return { name, surface: `/${name}`, namespace: 'external_installed', summary: '', why_relevant: '', score, manifest_backed: false } as RecommendedSkill;
}

describe('computeBoostDeltas', () => {
  test('sums packet entry scores per subject_skill, scaled, capped at boost_cap', () => {
    const deltas = computeBoostDeltas(
      [packetEntry('l1', 'investigate', 0.8), packetEntry('l2', 'investigate', 0.9), packetEntry('l3', 'simplify', 0.2)],
      { boost_cap: 5, boost_scale: 1.0 },
    );
    const inv = deltas.find((d) => d.skill === 'investigate')!;
    expect(inv.delta).toBeCloseTo(1.7, 10);
    expect(inv.from_entries.sort()).toEqual(['l1', 'l2']);
    expect(deltas.find((d) => d.skill === 'simplify')!.delta).toBeCloseTo(0.2, 10);
  });
  test('caps the per-skill delta at boost_cap', () => {
    const deltas = computeBoostDeltas(
      Array.from({ length: 10 }, (_, i) => packetEntry(`x${i}`, 'investigate', 1)),
      { boost_cap: 5, boost_scale: 1.0 },
    );
    expect(deltas[0].delta).toBe(5);
  });
});

describe('applyBoost', () => {
  test('adds delta to matching RecommendedSkill score and re-sorts (stable, name tiebreak)', () => {
    const natural = [rs('design', 5), rs('investigate', 4), rs('simplify', 4)];
    const { boosted, disagreements } = applyBoost(natural, [{ skill: 'investigate', delta: 2, from_entries: ['l1'] }]);
    expect(boosted[0].name).toBe('investigate'); // 4+2=6 > 5
    expect(boosted[0].score).toBe(6);
    expect(disagreements.length).toBeGreaterThan(0);
    expect(disagreements[0].skill).toBe('investigate');
    expect(disagreements[0].natural_rank).toBe(1);
    expect(disagreements[0].boosted_rank).toBe(0);
  });
  test('no delta application leaves order identical and yields zero disagreements', () => {
    const natural = [rs('a', 5), rs('b', 3)];
    const { boosted, disagreements } = applyBoost(natural, []);
    expect(boosted.map((s) => s.name)).toEqual(['a', 'b']);
    expect(disagreements).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify the new tests FAIL**

Run: `bun test ./test/nexus/learning/context/ranking.test.ts`
Expected: FAIL — `computeBoostDeltas`/`applyBoost` not exported.

- [ ] **Step 3: Append to `ranking.ts`**

```ts
// --- appended to lib/nexus/learning/context/ranking.ts ---
import type { RecommendedSkill } from '../../contracts/types';
import type { ScoredEntry, BoostDelta, RankDisagreement } from './types';

export function computeBoostDeltas(
  packet: ScoredEntry[],
  cfg: { boost_cap: number; boost_scale: number },
): BoostDelta[] {
  const acc = new Map<string, { sum: number; ids: string[] }>();
  for (const p of packet) {
    const skill = (p.entry as { subject_skill?: string }).subject_skill;
    if (!skill) continue;
    const cur = acc.get(skill) ?? { sum: 0, ids: [] };
    cur.sum += p.score * cfg.boost_scale;
    cur.ids.push(String(p.entry.id));
    acc.set(skill, cur);
  }
  return [...acc.entries()].map(([skill, { sum, ids }]) => ({
    skill,
    delta: Math.min(cfg.boost_cap, sum),
    from_entries: ids,
  }));
}

function rankIndexByName(list: RecommendedSkill[]): Map<string, number> {
  const m = new Map<string, number>();
  list.forEach((s, i) => m.set(s.name, i));
  return m;
}

export function applyBoost(
  natural: RecommendedSkill[],
  deltas: BoostDelta[],
): { boosted: RecommendedSkill[]; disagreements: RankDisagreement[] } {
  const deltaBy = new Map(deltas.map((d) => [d.skill, d]));
  const naturalIdx = rankIndexByName(natural);
  const naturalScore = new Map(natural.map((s) => [s.name, s.score]));

  const boosted = natural
    .map((s) => {
      const d = deltaBy.get(s.name) ?? deltaBy.get(s.surface.replace(/^\//, ''));
      return d ? { ...s, score: s.score + d.delta } : { ...s };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const disagreements: RankDisagreement[] = [];
  boosted.forEach((s, boostedRank) => {
    const naturalRank = naturalIdx.get(s.name);
    if (naturalRank === undefined || naturalRank === boostedRank) return;
    const d = deltaBy.get(s.name) ?? deltaBy.get(s.surface.replace(/^\//, ''));
    disagreements.push({
      skill: s.name,
      natural_rank: naturalRank,
      boosted_rank: boostedRank,
      natural_score: naturalScore.get(s.name) ?? s.score,
      boosted_score: s.score,
      caused_by: d?.from_entries ?? [],
    });
  });

  return { boosted, disagreements };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `bun test ./test/nexus/learning/context/ranking.test.ts`
Expected: all PASS (Task 3 + Task 5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/context/ranking.ts test/nexus/learning/context/ranking.test.ts
git commit -m "feat(sp6): bounded additive boost + rank-disagreement detection (SP6 Task 5)"
```

---

## Task 6: `record.ts` — explainability record (build + write)

**Files:**
- Create: `lib/nexus/learning/context/record.ts`
- Test: `test/nexus/learning/context/record.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/context/record.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildLearningContextRecord, writeLearningContextRecord } from '../../../../lib/nexus/learning/context/record';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';

const base = {
  stage: 'build' as const, runId: 'r1', projectSlug: 'demo',
  config: DEFAULT_LEARNING_CONTEXT_CONFIG, status: 'ok' as const, warnings: [] as string[],
  packet: [{ entry: { id: 'lrn_a', key: 'k', insight: 'i', subject_skill: 'investigate' }, score: 0.8,
    factors: { relevance: { value: 0.5, weight: 0.3, contribution: 0.15 },
      effective_confidence: { value: 0.8, weight: 0.25, contribution: 0.2 },
      evidence_strength: { value: 0.5, weight: 0.2, contribution: 0.1 },
      file_overlap: { value: 0, weight: 0.15, contribution: 0 },
      stage_match: { value: 1, weight: 0.1, contribution: 0.1 },
      contradiction_risk: { value: 0, weight: -0.5, contribution: 0 } } } ] as any,
  dropped: { below_floor: 3, over_cap: 1 },
  boosts: [{ skill: 'investigate', delta: 0.8, from_entries: ['lrn_a'] }],
  disagreements: [{ skill: 'investigate', natural_rank: 2, boosted_rank: 0, natural_score: 4, boosted_score: 4.8, caused_by: ['lrn_a'] }],
};

describe('buildLearningContextRecord', () => {
  test('schema_version 1, includes limits/packet factors/boosts/disagreements', () => {
    const rec = buildLearningContextRecord({ ...base, generatedAt: '2026-05-18T00:00:00Z' });
    expect(rec.schema_version).toBe(1);
    expect(rec.stage).toBe('build');
    expect(rec.limits.score_floor).toBe(0.15);
    expect(rec.packet[0].factors.relevance.contribution).toBe(0.15);
    expect(rec.rank_disagreements).toHaveLength(1);
    expect(rec.dropped.below_floor).toBe(3);
  });
  test('empty disagreements serialize as [] not omitted', () => {
    const rec = buildLearningContextRecord({ ...base, disagreements: [], generatedAt: 't' });
    expect(rec.rank_disagreements).toEqual([]);
  });
});

describe('writeLearningContextRecord', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sp6-rec-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('writes .planning/current/<stage>/learning-context.json and returns path', () => {
    const rec = buildLearningContextRecord({ ...base, generatedAt: 't' });
    const p = writeLearningContextRecord(dir, 'build', rec);
    expect(p).toBe(join(dir, '.planning', 'current', 'build', 'learning-context.json'));
    expect(existsSync(p)).toBe(true);
    expect(JSON.parse(readFileSync(p, 'utf8')).run_id).toBe('r1');
  });

  test('write failure does not throw — returns the intended path', () => {
    const rec = buildLearningContextRecord({ ...base, generatedAt: 't' });
    // unwritable parent: a file where a directory is expected
    const p = writeLearningContextRecord('/dev/null/nope', 'build', rec);
    expect(typeof p).toBe('string');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `bun test ./test/nexus/learning/context/record.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `record.ts`**

```ts
// lib/nexus/learning/context/record.ts
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type {
  LearningContextConfig, ScoredEntry, BoostDelta, RankDisagreement,
  ResolverStatus, LearningContextStage,
} from './types';

export interface BuildRecordInput {
  stage: LearningContextStage;
  runId: string;
  projectSlug: string;
  config: LearningContextConfig;
  status: ResolverStatus;
  warnings: string[];
  packet: ScoredEntry[];
  dropped: { below_floor: number; over_cap: number };
  boosts: BoostDelta[];
  disagreements: RankDisagreement[];
  generatedAt: string;
}

export interface LearningContextRecord {
  schema_version: 1;
  generated_at: string;
  stage: LearningContextStage;
  run_id: string;
  project_slug: string;
  resolver: { status: ResolverStatus; warnings: string[] };
  limits: LearningContextConfig;
  packet: Array<{
    id: string; source_path?: string; subject_skill?: string; score: number;
    factors: ScoredEntry['factors'];
  }>;
  dropped: { below_floor: number; over_cap: number };
  boosts: BoostDelta[];
  rank_disagreements: RankDisagreement[];
}

export function buildLearningContextRecord(input: BuildRecordInput): LearningContextRecord {
  return {
    schema_version: 1,
    generated_at: input.generatedAt,
    stage: input.stage,
    run_id: input.runId,
    project_slug: input.projectSlug,
    resolver: { status: input.status, warnings: input.warnings },
    limits: input.config,
    packet: input.packet.map((p) => ({
      id: String(p.entry.id),
      source_path: (p.entry as { source_path?: string }).source_path,
      subject_skill: (p.entry as { subject_skill?: string }).subject_skill,
      score: p.score,
      factors: p.factors,
    })),
    dropped: input.dropped,
    boosts: input.boosts,
    rank_disagreements: input.disagreements,
  };
}

/** Sole writer. Fail-soft: never throws; returns the intended path regardless. */
export function writeLearningContextRecord(
  cwd: string,
  stage: LearningContextStage,
  record: LearningContextRecord,
): string {
  const path = join(cwd, '.planning', 'current', stage, 'learning-context.json');
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(record, null, 2) + '\n');
  } catch {
    // evidence write is best-effort; advisor must not be blocked by it
  }
  return path;
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `bun test ./test/nexus/learning/context/record.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/context/record.ts test/nexus/learning/context/record.test.ts
git commit -m "feat(sp6): learning-context.json record builder + fail-soft writer (SP6 Task 6)"
```

---

## Task 7: `resolver.ts` + module barrel — orchestration with degrade-to-natural guard

**Files:**
- Create: `lib/nexus/learning/context/resolver.ts`
- Create: `lib/nexus/learning/context/index.ts`
- Test: `test/nexus/learning/context/resolver.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/context/resolver.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveLearningContext } from '../../../../lib/nexus/learning/context/resolver';
import type { RecommendedSkill } from '../../../../lib/nexus/contracts/types';

function rs(name: string, score: number): RecommendedSkill {
  return { name, surface: `/${name}`, namespace: 'external_installed', summary: '', why_relevant: '', score, manifest_backed: false } as RecommendedSkill;
}
let cwd: string; let home: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'sp6-r-')); home = mkdtempSync(join(tmpdir(), 'sp6-h-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); });

function writeJsonl(slug: string, lines: object[]) {
  const dir = join(home, '.nexus', 'projects', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'learnings.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
}

const natural = [rs('design', 5), rs('investigate', 3)];

describe('resolveLearningContext', () => {
  test('no learnings → boosted equals natural, status ok, record written', () => {
    const r = resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: [], naturalRanking: natural, projectSlug: 'demo' });
    expect(r.boostedRanking.map((s) => s.name)).toEqual(natural.map((s) => s.name));
    expect(r.status).toBe('ok');
    expect(existsSync(r.recordPath)).toBe(true);
  });

  test('a strong on-topic learning for "investigate" boosts it and records disagreement', () => {
    writeJsonl('demo', [{
      id: 'lrn_1', schema_version: 2, ts: new Date().toISOString(),
      writer_skill: 'investigate', subject_skill: 'investigate', subject_stage: 'build',
      type: 'pitfall', key: 'socket timeout build', insight: 'investigate socket timeout on build',
      confidence: 9, evidence_type: 'test-output', source: 'observed', files: ['lib/net/socket.ts'],
      cluster_id: null, supersedes: [], supersedes_reason: null, derived_from: [],
      last_applied_at: null, mirror: null,
    }]);
    const r = resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: ['lib/net/socket.ts'], naturalRanking: natural, projectSlug: 'demo' });
    expect(r.packet.length).toBeGreaterThan(0);
    const rec = JSON.parse(readFileSync(r.recordPath, 'utf8'));
    expect(rec.boosts.some((b: { skill: string }) => b.skill === 'investigate')).toBe(true);
  });

  test('malformed jsonl line → degraded status + warning + still returns ranking', () => {
    const dir = join(home, '.nexus', 'projects', 'demo'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'learnings.jsonl'), 'not json\n');
    const r = resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: [], naturalRanking: natural, projectSlug: 'demo' });
    expect(['ok', 'degraded']).toContain(r.status);
    expect(r.boostedRanking.map((s) => s.name)).toEqual(natural.map((s) => s.name));
  });

  test('catastrophic failure (bad config type) → status failed, natural ranking returned', () => {
    const r = resolveLearningContext({
      cwd, home, stage: 'build', runId: 'r1', changedFiles: [], naturalRanking: natural, projectSlug: 'demo',
      config: { weights: null } as unknown as undefined,
    });
    expect(r.status).toBe('failed');
    expect(r.boostedRanking).toEqual(natural);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `bun test ./test/nexus/learning/context/resolver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `resolver.ts`**

```ts
// lib/nexus/learning/context/resolver.ts
import { join } from 'path';
import { homedir } from 'os';
import {
  readLearningsJsonl, readStageCandidatesFile, readCanonicalLearningsFile, walkArchiveRunLearnings,
} from '../../index';
import type { NormalizedEntry } from '../normalize';
import { scoreEntry, computeBoostDeltas, applyBoost } from './ranking';
import { capPacket } from './packet';
import { buildLearningContextRecord, writeLearningContextRecord } from './record';
import {
  DEFAULT_LEARNING_CONTEXT_CONFIG, type LearningContextInput, type LearningContextResult,
  type ScoredEntry,
} from './types';

function gatherEntries(input: LearningContextInput, home: string, warnings: string[]): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  const jsonlPath = join(home, '.nexus', 'projects', input.projectSlug, 'learnings.jsonl');
  try { out.push(...readLearningsJsonl(jsonlPath)); }
  catch (e) { warnings.push(`jsonl read failed: ${(e as Error).message}`); }

  try {
    const canon = readCanonicalLearningsFile(join(input.cwd, '.planning', 'current', 'closeout', 'learnings.json'));
    if (canon) out.push(...(canon.learnings as unknown as NormalizedEntry[]));
  } catch (e) { warnings.push(`canonical read failed: ${(e as Error).message}`); }

  try {
    const stageRec = readStageCandidatesFile(
      join(input.cwd, '.planning', 'current', input.stage, 'learning-candidates.json'),
    );
    if (stageRec) out.push(...(stageRec.candidates as unknown as NormalizedEntry[]));
  } catch (e) { warnings.push(`stage candidates read failed: ${(e as Error).message}`); }

  try { for (const r of walkArchiveRunLearnings(input.cwd)) out.push(...(r.learnings as unknown as NormalizedEntry[])); }
  catch (e) { warnings.push(`archive walk failed: ${(e as Error).message}`); }

  return out;
}

export function resolveLearningContext(input: LearningContextInput): LearningContextResult {
  const home = input.home ?? homedir();
  const config = input.config ?? DEFAULT_LEARNING_CONTEXT_CONFIG;
  const warnings: string[] = [];
  const stage = input.stage;

  try {
    if (!config || !config.weights || typeof config.weights.relevance !== 'number') {
      throw new Error('invalid learning_context config');
    }
    const all = gatherEntries(input, home, warnings);
    const skillNames = input.naturalRanking.map((s) => s.name);
    const ctx = { stage, changedFiles: input.changedFiles, skillNames, now: input.now };

    const scored: ScoredEntry[] = all.map((e) => scoreEntry(e, all, ctx, config));
    const { packet, dropped } = capPacket(scored, {
      score_floor: config.score_floor, max_entries: config.max_entries, token_budget: config.token_budget,
    });

    const boosts = computeBoostDeltas(packet, { boost_cap: config.boost_cap, boost_scale: config.boost_scale });
    const { boosted, disagreements } = applyBoost(input.naturalRanking, boosts);

    const status = warnings.length > 0 ? 'degraded' : 'ok';
    const record = buildLearningContextRecord({
      stage, runId: input.runId, projectSlug: input.projectSlug, config, status, warnings,
      packet, dropped, boosts, disagreements,
      generatedAt: new Date(input.now ?? Date.now()).toISOString(),
    });
    const recordPath = writeLearningContextRecord(input.cwd, stage, record);
    return { boostedRanking: boosted, packet, recordPath, status, warnings };
  } catch (e) {
    const failPath = join(input.cwd, '.planning', 'current', stage, 'learning-context.json');
    try {
      const rec = buildLearningContextRecord({
        stage, runId: input.runId, projectSlug: input.projectSlug,
        config: config ?? DEFAULT_LEARNING_CONTEXT_CONFIG,
        status: 'failed', warnings: [...warnings, `resolver failed: ${(e as Error).message}`],
        packet: [], dropped: { below_floor: 0, over_cap: 0 }, boosts: [], disagreements: [],
        generatedAt: new Date(input.now ?? Date.now()).toISOString(),
      });
      writeLearningContextRecord(input.cwd, stage, rec);
    } catch { /* never let evidence-write block degrade path */ }
    return {
      boostedRanking: input.naturalRanking, packet: [], recordPath: failPath,
      status: 'failed', warnings: [...warnings, `resolver failed: ${(e as Error).message}`],
    };
  }
}
```

- [ ] **Step 4: Implement `index.ts` (module barrel)**

```ts
// lib/nexus/learning/context/index.ts
export { resolveLearningContext } from './resolver';
export { scoreEntry, computeBoostDeltas, applyBoost, STRENGTH_MAX } from './ranking';
export { capPacket, estimateEntryTokens } from './packet';
export { buildLearningContextRecord, writeLearningContextRecord } from './record';
export { fileOverlap, stageMatch, relevance, contradictionRisk } from './match';
export {
  DEFAULT_LEARNING_CONTEXT_CONFIG,
  type LearningContextInput, type LearningContextResult, type LearningContextConfig,
  type ScoredEntry, type BoostDelta, type RankDisagreement,
} from './types';
export type { LearningContextRecord } from './record';
```

- [ ] **Step 5: Run, verify PASS**

Run: `bun test ./test/nexus/learning/context/resolver.test.ts`
Expected: all PASS.

- [ ] **Step 6: Build clean (no import cycle: context → index barrel is feature→barrel, but barrel must not import context yet — Task 8)**

Run: `bun run build 2>&1 | tail -3`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/learning/context/resolver.ts lib/nexus/learning/context/index.ts test/nexus/learning/context/resolver.test.ts
git commit -m "feat(sp6): LearningContextResolver orchestration + degrade-to-natural guard (SP6 Task 7)"
```

---

## Task 8: AC-traceability tests

**Files:**
- Test: `test/nexus/learning/context/acceptance.test.ts`

- [ ] **Step 1: Write the AC tests**

```ts
// test/nexus/learning/context/acceptance.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveLearningContext } from '../../../../lib/nexus/learning/context/resolver';
import { DEFAULT_LEARNING_CONTEXT_CONFIG } from '../../../../lib/nexus/learning/context/types';
import type { RecommendedSkill } from '../../../../lib/nexus/contracts/types';

function rs(n: string, s: number): RecommendedSkill {
  return { name: n, surface: `/${n}`, namespace: 'external_installed', summary: '', why_relevant: '', score: s, manifest_backed: false } as RecommendedSkill;
}
let cwd: string; let home: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'sp6-ac-')); home = mkdtempSync(join(tmpdir(), 'sp6-ach-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); rmSync(home, { recursive: true, force: true }); });
function seed(n: number) {
  const dir = join(home, '.nexus', 'projects', 'demo'); mkdirSync(dir, { recursive: true });
  const lines = Array.from({ length: n }, (_, i) => JSON.stringify({
    id: `lrn_${i}`, schema_version: 2, ts: new Date().toISOString(),
    writer_skill: 'investigate', subject_skill: 'investigate', subject_stage: 'build',
    type: 'pitfall', key: `build socket timeout ${i}`, insight: `investigate build socket timeout case ${i}`,
    confidence: 9, evidence_type: 'test-output', source: 'observed', files: ['lib/net/socket.ts'],
    cluster_id: null, supersedes: [], supersedes_reason: null, derived_from: [],
    last_applied_at: null, mirror: null,
  }));
  writeFileSync(join(dir, 'learnings.jsonl'), lines.join('\n'));
}
const natural = [rs('design', 5), rs('investigate', 3)];
const call = (extra = {}) => resolveLearningContext({ cwd, home, stage: 'build', runId: 'r1', changedFiles: ['lib/net/socket.ts'], naturalRanking: natural, projectSlug: 'demo', ...extra });

describe('SP6 acceptance criteria', () => {
  test('AC#1 packet cap — never exceeds max_entries', () => {
    seed(50);
    const r = call();
    expect(r.packet.length).toBeLessThanOrEqual(DEFAULT_LEARNING_CONTEXT_CONFIG.max_entries);
  });
  test('AC#2 explainable — every packet entry records factor value/weight/contribution', () => {
    seed(3);
    const r = call();
    const rec = JSON.parse(readFileSync(r.recordPath, 'utf8'));
    for (const p of rec.packet) {
      for (const k of ['relevance', 'effective_confidence', 'evidence_strength', 'file_overlap', 'stage_match', 'contradiction_risk']) {
        expect(p.factors[k]).toHaveProperty('value');
        expect(p.factors[k]).toHaveProperty('weight');
        expect(p.factors[k]).toHaveProperty('contribution');
      }
    }
  });
  test('AC#3 fail-soft — malformed entry does not crash; status degraded/ok, ranking returned', () => {
    const dir = join(home, '.nexus', 'projects', 'demo'); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'learnings.jsonl'), '{bad json\n{"also":bad}\n');
    const r = call();
    expect(r.boostedRanking.length).toBe(natural.length);
    expect(['ok', 'degraded']).toContain(r.status);
  });
  test('AC#4 disagreement recorded iff ordering differs', () => {
    seed(5);
    const r = call();
    const rec = JSON.parse(readFileSync(r.recordPath, 'utf8'));
    const orderChanged = r.boostedRanking.map((s) => s.name).join() !== natural.map((s) => s.name).join();
    expect(rec.rank_disagreements.length > 0).toBe(orderChanged);
  });
  test('AC#5 no mutation — resolver writes only learning-context.json under .planning/current/<stage>', () => {
    seed(2);
    const r = call();
    expect(r.recordPath).toBe(join(cwd, '.planning', 'current', 'build', 'learning-context.json'));
    // protected paths never created by the resolver
    for (const p of ['SKILL.md.tmpl', 'Nexus.md', 'CLAUDE.md', 'AGENTS.md']) {
      expect(() => readFileSync(join(cwd, p))).toThrow();
    }
  });
});
```

- [ ] **Step 2: Run, verify PASS**

Run: `bun test ./test/nexus/learning/context/acceptance.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 3: Commit**

```bash
git add test/nexus/learning/context/acceptance.test.ts
git commit -m "test(sp6): AC#1–#5 traceability tests (SP6 Task 8)"
```

---

## Task 9: Wire resolver into `writer.ts` (behavior-preservation-gated)

**Files:**
- Modify: `lib/nexus/completion-advisor/writer.ts`

- [ ] **Step 1: Capture green baseline**

Run: `bun test ./test/nexus/observability/stage-aware-advisor.test.ts ./test/nexus/observability/completion-advisor.test.ts ./test/nexus/observability/completion-advisor/resolver.test.ts ./test/nexus/cli/advisor.test.ts`
Record exact pass/skip/fail counts — MUST be identical after this task.

- [ ] **Step 2: Add a fail-soft changedFiles helper + wire the resolver**

In `lib/nexus/completion-advisor/writer.ts`, add imports near the existing ones:

```ts
import { execFileSync } from 'child_process';
import { resolveLearningContext } from '../learning/context';
import { projectSlugFromCwd } from '../telemetry';
```

Add this helper near `detectStageReEntry` (bottom of file):

```ts
/** Best-effort changed-file list for relevance/file-overlap. [] on any failure. */
function changedFilesForRun(cwd: string): string[] {
  try {
    const out = execFileSync('git', ['-C', cwd, 'diff', '--name-only', 'HEAD'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
```

Replace the existing block at lines 47–52:

```ts
  if (installedSkills.length > 0) {
    record.recommended_skills = stageAwareAdvisor({
      skills: installedSkills,
      stage: record.stage,
    });
  }
```

with:

```ts
  if (installedSkills.length > 0) {
    const naturalRanking = stageAwareAdvisor({
      skills: installedSkills,
      stage: record.stage,
    });
    const lc = resolveLearningContext({
      cwd,
      stage: record.stage,
      runId: record.run_id,
      changedFiles: changedFilesForRun(cwd),
      naturalRanking,
      projectSlug: projectSlugFromCwd(cwd),
      home: options.home,
    });
    record.recommended_skills = lc.boostedRanking;
  }
```

Rationale: additive — when there are no learnings, `resolveLearningContext`
returns `boostedRanking` deep-equal to `naturalRanking` (Task 7 test proves
this); on any resolver failure it returns the unmodified `naturalRanking`
(`status:'failed'`). The advisor record's `recommended_skills` is therefore
behavior-identical to before whenever the learning store is empty/unreadable.

- [ ] **Step 3: Re-run the baseline suites — MUST match Step 1 exactly**

Run: `bun test ./test/nexus/observability/stage-aware-advisor.test.ts ./test/nexus/observability/completion-advisor.test.ts ./test/nexus/observability/completion-advisor/resolver.test.ts ./test/nexus/cli/advisor.test.ts`
Expected: pass/skip/fail counts byte-identical to Step 1. If any advisor test now fails, the wiring is not behavior-preserving for the empty-store case — STOP, fix, do not commit.

- [ ] **Step 4: Add an explicit wiring behavior-preservation test**

Append to `test/nexus/observability/stage-aware-advisor.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join as pjoin } from 'path';
import { buildCompletionAdvisorWrite } from '../../../lib/nexus/completion-advisor/writer';

test('SP6 wiring is additive: empty learning store ⇒ recommended_skills unchanged vs stageAwareAdvisor', () => {
  const cwd = mkdtempSync(pjoin(tmpdir(), 'sp6-wire-'));
  const home = mkdtempSync(pjoin(tmpdir(), 'sp6-wire-h-'));
  try {
    const skills = [
      { name: 'investigate', surface: '/investigate', namespace: 'external_installed', tags: [], path: '/x', description: 'build debugging', manifest: undefined },
    ] as unknown as Parameters<typeof buildCompletionAdvisorWrite>[1]['installedSkills'];
    const record = {
      run_id: 'r1', stage: 'build', stage_outcome: 'ok', interaction_mode: 'interactive',
      requires_user_choice: false, primary_next_actions: [],
    } as unknown as Parameters<typeof buildCompletionAdvisorWrite>[0];
    const natural = stageAwareAdvisor({ skills: skills as never, stage: 'build' });
    buildCompletionAdvisorWrite(record, { cwd, home, installedSkills: skills });
    expect((record as { recommended_skills?: unknown[] }).recommended_skills).toEqual(natural);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
```

Run: `bun test ./test/nexus/observability/stage-aware-advisor.test.ts`
Expected: all PASS including the new wiring test.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/completion-advisor/writer.ts test/nexus/observability/stage-aware-advisor.test.ts
git commit -m "feat(sp6): wire LearningContextResolver into completion-advisor writer (additive, fallback-on-failure) (SP6 Task 9)"
```

---

## Task 10: Barrel the SP6 public surface + pin

**Files:**
- Modify: `lib/nexus/index.ts`
- Modify: `test/nexus/barrel-surface.test.ts`

- [ ] **Step 1: Add to the barrel learning section**

In `lib/nexus/index.ts`, after the existing `export { ... } from './learning/read';` line, add:

```ts
export {
  resolveLearningContext,
  DEFAULT_LEARNING_CONTEXT_CONFIG,
} from './learning/context';
export type {
  LearningContextInput,
  LearningContextResult,
  LearningContextConfig,
} from './learning/context';
```

(No import cycle: `learning/context/resolver.ts` imports the 4 readers from
`../../index`; `index.ts` re-exporting `learning/context` is the same
barrel→feature→barrel shape SP1-followup already uses for `learning/read`. Verify
build stays clean in Step 3.)

- [ ] **Step 2: Extend the barrel-surface positive pin**

In `test/nexus/barrel-surface.test.ts`, add `'resolveLearningContext'` and
`'DEFAULT_LEARNING_CONTEXT_CONFIG'` to the `EXPECTED_VALUE_EXPORTS` list
(the runtime `key in nexus` value-export pin), alongside the existing
`computeEffectiveConfidence`/reader entries. Add `LearningContextInput`,
`LearningContextResult`, `LearningContextConfig` to the compile-time
`_BarrelTypePin` tuple + `import type` block (same mechanism Task F of
SP1-followup established for type-only re-exports). Leave the negative pin
(`isMirrorEnabled`/`mirrorCanonicalToJsonl`) unchanged.

- [ ] **Step 3: Build + barrel + full learning-context suite**

Run: `bun run build 2>&1 | tail -3`
Run: `bun test ./test/nexus/barrel-surface.test.ts ./test/nexus/learning/context/`
Expected: build clean; barrel pin green; full SP6 suite green.

- [ ] **Step 4: Full regression sweep**

Run: `bun test ./test/nexus/ 2>&1 | tail -4`
Expected: 0 fail. (Local `nexus local_provider mode` claude-subagent tests may
fail in a nested Claude Code session — that is the PR #160 guard, environmental,
green on CI; confirm via the merge-commit CI like SP1-followup, not local count.)

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/index.ts test/nexus/barrel-surface.test.ts
git commit -m "feat(sp6): barrel resolveLearningContext + config/types for consumers (SP6 Task 10)"
```

---

## Task 11: Meta-spec update on ship

**Files:**
- Modify: `docs/designs/SELF_LEARNING_V1_META.md`

- [ ] **Step 1: Update §4 SP6 row + status line**

In `docs/designs/SELF_LEARNING_V1_META.md`, change the §4 status line
(currently "SP1 complete … SP4 + SP6 now unblocked") to record SP6 v1 landed,
and append a row to the §9 trigger log:

```
| 2026-05-18 | SP6 v1 implemented (branch sp6-learning-context) | Read-only LearningContextResolver wired to completion-advisor (stageAwareAdvisor → recommended_skills). All 5 ACs met by construction. Other 3 consumers deferred to SP6.1; SP2 now unblocked (per glaocon V1 feedback: starts after SP6 ships to production). | §4 (SP6 → v1 landed; SP2 trigger now live), §9 (this row) |
```

Also update the §4 SP6 row's Trigger cell note and the status sentence to
"SP6 v1 landed 2026-05-18; SP6.1 (remaining 3 consumers) + SP2 are next."

- [ ] **Step 2: Commit**

```bash
git add docs/designs/SELF_LEARNING_V1_META.md
git commit -m "docs(self-learning): record SP6 v1 landed in meta-spec §4/§9 (SP6 Task 11)"
```

---

## Self-Review

**1. Spec coverage:**
- §2 AC#1 → Task 4 (`capPacket`) + Task 8 AC#1 test.
- §2 AC#2 → Task 6 (`buildLearningContextRecord` factors) + Task 8 AC#2 test.
- §2 AC#3 → Task 7 (degrade guard, fail-soft reads) + Task 8 AC#3 test.
- §2 AC#4 → Task 5 (`applyBoost` disagreements) + Task 8 AC#4 test.
- §2 AC#5 → Task 6 (single writer path) + Task 8 AC#5 test.
- §3 ranking model → Tasks 2+3 (factors + weighted sum).
- §3 boost mechanism → Task 5; BOOST_CAP=5 default in Task 1.
- §5 data flow → Task 7 orchestration; §4a seam → Task 9 (writer.ts:47–52).
- §6 weights/STRENGTH_MAX → Task 1 (defaults) + Task 3 (derived STRENGTH_MAX).
- §7 record schema → Task 6.
- §8 layered error handling → Task 7 guard + Task 6 fail-soft write.
- §9 behavior-preservation → Task 9 baseline gate + explicit test.
- §11 meta-spec update → Task 11.
No spec section is unaddressed.

**2. Placeholder scan:** No "TBD"/"similar to"/"add error handling"/bare prose
steps — every code step carries complete code; every command has expected output.

**3. Type consistency:** `LearningContextInput`/`LearningContextResult`/
`LearningContextConfig`/`ScoredEntry`/`BoostDelta`/`RankDisagreement` defined
once in Task 1 and used unchanged in Tasks 3/5/6/7/10. `scoreEntry`,
`computeBoostDeltas`, `applyBoost`, `capPacket`, `buildLearningContextRecord`,
`writeLearningContextRecord`, `resolveLearningContext` signatures consistent
across definition (Tasks 2–7) and barrel (Task 10). `STRENGTH_MAX` derived in
Task 3, asserted = 8 in its test. `RecommendedSkill` is the existing
`contracts/types` shape throughout. Resolver reads via the SP1-followup barrel
(`../../index`) consistently.

**4. Behavior-preservation discipline:** Task 9 (the only modify-existing task)
has a Step-1 baseline capture + Step-3 "must match exactly" gate + an explicit
empty-store equality test — the SP1-followup-proven pattern.
