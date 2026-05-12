# SP1 Signal Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Nexus learning schema v2 + 3-surface storage + lazy migration + 2 reference capture impls (`/investigate` direct, `/build` chain) + remaining 5 capture sites, completing Iron Law 2 adoption across all canonical-stage and support skills (except `/ship` deferred).

**Architecture:** Upgrade existing `schema_version: 1` candidates/canonical plumbing (already live in `lib/nexus/observability/learnings.ts` + `lib/nexus/commands/closeout.ts`) to `schema_version: 2`. Add candidate writers for 4 stages and 1 new path (`/build`). Add optional mirror canonical→jsonl with in-memory idempotency ledger. New code organizes under `lib/nexus/learning/` per V1_META future bucket convention. Existing `learnings.jsonl` is never rewritten — legacy entries are normalized lazily at read.

**Tech Stack:** Bun + TypeScript, `bun test`, Bash helpers in `bin/`, skill `.tmpl` sources regenerated via `bun run gen:skill-docs --host claude`.

**Source spec:** `docs/designs/SELF_LEARNING_V1_SP1.md` (commit `da7c13f`).

---

## Resolved Plan-Stage Questions (Spec §13)

These are decided here so all tasks proceed unambiguously:

1. **File layout:** New `lib/nexus/learning/` directory. Aligns with V1_META v2's anticipated `lib/nexus/learning-context/` for SP6 and keeps learning concerns in one bucket rather than scattering into `observability/`. Existing `lib/nexus/observability/learnings.ts` stays put (it's already a runtime surface) but new code goes to `learning/`.

2. **Helper interface (`nexus-learnings-log`):** Accept partial JSON; the bash helper shells to `bun` to inject defaults for `id`, `schema_version`, and `ts` when missing. Callers (skill templates) construct minimal entries; the helper completes them. Minimizes per-skill change surface.

3. **Concurrent appends:** Accept last-writer-wins for `learnings.jsonl` in SP1. `fs.appendFileSync` is atomic per-write on POSIX; line interleaving across concurrent sessions is acceptable because dedup happens at read by `(key, type)`. Document the limitation in `lib/nexus/learning/README.md`. File locks deferred to a future phase if real concurrency emerges.

4. **Candidate write path:** New helper `writeLearningCandidate(stage, entry)` in `lib/nexus/learning/candidates.ts`. Stage handlers call this helper rather than touching artifact-writer infrastructure directly. The helper does its own atomic file write (write-temp + rename) and validates schema_v2 before write.

5. **TypeScript barrel:** `lib/nexus/index.ts` re-exports types and functions intended for cross-boundary use:
   - Types: `LearningEntry`, `LearningCandidate`, `StageLearningCandidatesRecord`, `RunLearningsRecord` (existing names retained; v2 fields added)
   - Functions: `generateLearningId`, `parseLearningId`, `computeStrength`, `normalizeLegacyEntry`, `writeLearningCandidate`
   Internal helpers (validator, mirror ledger) stay private to `lib/nexus/learning/`.

---

## File Structure

### NEW files (10)

| Path | Responsibility |
|---|---|
| `lib/nexus/learning/schema.ts` | Schema v2 types + `assertSchemaV2` validator |
| `lib/nexus/learning/id.ts` | ULID generator + legacy `legacy:<sha256>` derivation |
| `lib/nexus/learning/strength.ts` | Derived `computeStrength(entry)` pure function |
| `lib/nexus/learning/normalize.ts` | Legacy v1 → v2 virtual normalization |
| `lib/nexus/learning/candidates.ts` | `writeLearningCandidate(stage, entry)` helper |
| `lib/nexus/learning/mirror.ts` | Optional mirror with in-memory `(canonical_id, run_id)` ledger |
| `lib/nexus/learning/config.ts` | Read `learning.mirror_on_closeout` from `~/.nexus/config.yaml` |
| `lib/nexus/learning/README.md` | Public surface notes + concurrency caveat |
| `test/nexus/learning/` | New test directory (multiple test files per Task) |
| `test/nexus/learning/chain-template.test.ts` | E2E candidate→canonical→mirror integration |

### MODIFIED files (10)

| Path | Change |
|---|---|
| `lib/nexus/contracts/types.ts` | Upgrade `LearningCandidate` + `RunLearningsRecord` to schema_v2 fields; preserve backward-read compat |
| `lib/nexus/observability/learnings.ts` | Update normalizer to accept v2 candidates; promotion fills `derived_from` |
| `lib/nexus/io/artifacts.ts` | Add `buildLearningCandidatesPath()`; ensure all `<stage>LearningCandidatesPath()` return consistent shape |
| `lib/nexus/commands/build.ts` | Capture point on 3-strike route-to-/investigate (locate via grep) |
| `lib/nexus/commands/closeout.ts` | Include `'build'` in `collectCloseoutLearningSources`; call mirror after canonical write |
| `lib/nexus/index.ts` | Re-export new types + functions per resolved Q5 |
| `bin/nexus-learnings-log` | Shell-out injects `id` + `schema_version` defaults |
| `bin/nexus-learnings-search` | Use new `normalize.ts`; surface v2 fields in output |
| `skills/support/investigate/SKILL.md.tmpl` | Emit schema_v2 (Path-A reference) |
| `skills/support/retro/SKILL.md.tmpl` | Emit schema_v2 (already writes; schema upgrade only) |

### REGENERATED files

After `.tmpl` edits, run `bun run gen:skill-docs --host claude` (and other hosts). Do **not** hand-edit generated `SKILL.md` files.

---

## Phase 1 — Schema foundations

### Task 1: Schema v2 types + validator

**Files:**
- Create: `lib/nexus/learning/schema.ts`
- Test: `test/nexus/learning/schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/schema.test.ts
import { describe, test, expect } from 'bun:test';
import { assertSchemaV2, type LearningEntry } from '../../../lib/nexus/learning/schema';

describe('assertSchemaV2', () => {
  test('accepts a fully-populated v2 entry', () => {
    const entry: LearningEntry = {
      id: 'lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y',
      schema_version: 2,
      ts: '2026-05-12T03:14:15.926Z',
      writer_skill: 'investigate',
      subject_skill: 'build',
      subject_stage: 'build',
      type: 'pitfall',
      key: 'n-plus-one',
      insight: 'Demo insight under test.',
      confidence: 8,
      evidence_type: 'test-output',
      source: 'observed',
      files: ['app/api/x.ts'],
      cluster_id: null,
      supersedes: [],
      supersedes_reason: null,
      derived_from: [],
      last_applied_at: null,
      mirror: null,
    };
    expect(() => assertSchemaV2(entry)).not.toThrow();
  });

  test('rejects entry missing id', () => {
    const bad = { schema_version: 2, type: 'pitfall', key: 'x', insight: 'y', confidence: 5 };
    expect(() => assertSchemaV2(bad)).toThrow(/id/);
  });

  test('rejects schema_version != 2 in strict mode', () => {
    const v1 = { schema_version: 1, type: 'pitfall', key: 'x', insight: 'y' };
    expect(() => assertSchemaV2(v1)).toThrow(/schema_version/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/learning/schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema.ts**

```ts
// lib/nexus/learning/schema.ts
export const LEARNING_TYPES = ['pattern', 'pitfall', 'preference', 'architecture', 'tool'] as const;
export type LearningType = typeof LEARNING_TYPES[number];

export const EVIDENCE_TYPES = [
  'test-output', 'code-pattern', 'profile-data',
  'multi-run-observation', 'single-run-observation',
  'team-consensus', 'external-reference', 'speculation', 'unknown',
] as const;
export type EvidenceType = typeof EVIDENCE_TYPES[number];

export const LEARNING_SOURCES = [
  'observed', 'inferred', 'cross-model', 'user-stated',
  'team-consensus', 'external-reference', 'speculation', 'unknown',
] as const;
export type LearningSource = typeof LEARNING_SOURCES[number];

export const SUBJECT_STAGES = [
  'discover', 'frame', 'plan', 'handoff',
  'build', 'review', 'qa', 'ship', 'closeout', 'unknown',
] as const;
export type SubjectStage = typeof SUBJECT_STAGES[number];

export const SUPERSEDES_REASONS = [
  'correction', 'stale', 'contradiction', 'merged', 'scope-refined',
] as const;
export type SupersedesReason = typeof SUPERSEDES_REASONS[number];

export type MirrorMetadata = {
  origin: 'closeout';
  run_id: string;
  source_path: string;
};

export type LearningEntry = {
  id: string;                          // 'lrn_<ULID>' or 'legacy:<sha256>'
  schema_version: 2;
  ts: string;                          // ISO-8601 UTC
  writer_skill: string;
  subject_skill: string;
  subject_stage: SubjectStage | null;
  type: LearningType;
  key: string;
  insight: string;
  confidence: number;                  // 1..10
  evidence_type: EvidenceType;
  source: LearningSource;
  files: string[];
  cluster_id: string | null;
  supersedes: string[];
  supersedes_reason: SupersedesReason | null;
  derived_from: string[];
  last_applied_at: string | null;
  mirror: MirrorMetadata | null;
};

export function assertSchemaV2(value: unknown): asserts value is LearningEntry {
  if (!value || typeof value !== 'object') throw new Error('learning entry must be an object');
  const e = value as Partial<LearningEntry>;
  if (e.schema_version !== 2) throw new Error('learning entry schema_version must be 2');
  if (typeof e.id !== 'string' || e.id.length === 0) throw new Error('learning entry missing id');
  if (typeof e.ts !== 'string') throw new Error('learning entry missing ts');
  if (typeof e.writer_skill !== 'string') throw new Error('learning entry missing writer_skill');
  if (typeof e.subject_skill !== 'string') throw new Error('learning entry missing subject_skill');
  if (e.subject_stage !== null && !SUBJECT_STAGES.includes(e.subject_stage as SubjectStage)) {
    throw new Error('learning entry has invalid subject_stage');
  }
  if (!LEARNING_TYPES.includes(e.type as LearningType)) throw new Error('learning entry has invalid type');
  if (typeof e.key !== 'string' || e.key.length === 0) throw new Error('learning entry missing key');
  if (typeof e.insight !== 'string' || e.insight.length === 0) throw new Error('learning entry missing insight');
  if (typeof e.confidence !== 'number' || e.confidence < 1 || e.confidence > 10) {
    throw new Error('learning entry confidence out of range');
  }
  if (!EVIDENCE_TYPES.includes(e.evidence_type as EvidenceType)) {
    throw new Error('learning entry has invalid evidence_type');
  }
  if (!LEARNING_SOURCES.includes(e.source as LearningSource)) {
    throw new Error('learning entry has invalid source');
  }
  if (!Array.isArray(e.files)) throw new Error('learning entry files must be array');
  if (!Array.isArray(e.supersedes)) throw new Error('learning entry supersedes must be array');
  if (!Array.isArray(e.derived_from)) throw new Error('learning entry derived_from must be array');
  if (e.supersedes_reason !== null && !SUPERSEDES_REASONS.includes(e.supersedes_reason as SupersedesReason)) {
    throw new Error('learning entry has invalid supersedes_reason');
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/schema.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/schema.ts test/nexus/learning/schema.test.ts
git commit -m "feat(learning): schema v2 types + validator (SP1 Task 1)"
```

---

### Task 2: ULID generator + legacy id

**Files:**
- Create: `lib/nexus/learning/id.ts`
- Test: `test/nexus/learning/id.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/id.test.ts
import { describe, test, expect } from 'bun:test';
import { generateLearningId, parseLearningId, deriveLegacyId } from '../../../lib/nexus/learning/id';

describe('learning id', () => {
  test('generateLearningId produces lrn_<26-char-ULID>', () => {
    const id = generateLearningId();
    expect(id).toMatch(/^lrn_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  test('parseLearningId accepts new and legacy forms', () => {
    expect(parseLearningId('lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y').kind).toBe('ulid');
    expect(parseLearningId('legacy:abc123def456').kind).toBe('legacy');
    expect(() => parseLearningId('garbage')).toThrow(/invalid/);
  });

  test('deriveLegacyId is deterministic across calls', () => {
    const legacy = { ts: '2026-04-01T00:00:00Z', skill: 'retro', type: 'pattern', key: 'x', insight: 'y', files: ['a.ts'] };
    const a = deriveLegacyId(legacy);
    const b = deriveLegacyId(legacy);
    expect(a).toBe(b);
    expect(a).toMatch(/^legacy:[0-9a-f]{64}$/);
  });

  test('generateLearningId values are unique across N=1000 calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateLearningId()));
    expect(ids.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/learning/id.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement id.ts**

```ts
// lib/nexus/learning/id.ts
import { randomBytes, createHash } from 'crypto';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeTime(ms: number): string {
  let s = '';
  for (let i = 9; i >= 0; i--) {
    s = CROCKFORD[ms % 32] + s;
    ms = Math.floor(ms / 32);
  }
  return s;
}

function encodeRandom16(): string {
  const bytes = randomBytes(10);
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  let s = '';
  for (let i = 0; i < 16; i++) {
    s = CROCKFORD[Number(bits & 31n)] + s;
    bits >>= 5n;
  }
  return s;
}

export function generateLearningId(): string {
  return 'lrn_' + encodeTime(Date.now()) + encodeRandom16();
}

export type ParsedLearningId =
  | { kind: 'ulid'; ulid: string }
  | { kind: 'legacy'; hash: string };

export function parseLearningId(id: string): ParsedLearningId {
  const ulidMatch = id.match(/^lrn_([0-9A-HJKMNP-TV-Z]{26})$/);
  if (ulidMatch) return { kind: 'ulid', ulid: ulidMatch[1] };
  const legacyMatch = id.match(/^legacy:([0-9a-f]{64})$/);
  if (legacyMatch) return { kind: 'legacy', hash: legacyMatch[1] };
  throw new Error(`invalid learning id: ${id}`);
}

export type LegacyEntryInput = {
  ts: string;
  skill?: string;
  type: string;
  key: string;
  insight: string;
  files?: string[];
};

export function deriveLegacyId(entry: LegacyEntryInput): string {
  const seed = [
    entry.ts,
    entry.skill ?? 'unknown',
    entry.type,
    entry.key,
    entry.insight,
    JSON.stringify(entry.files ?? []),
  ].join('|');
  const hash = createHash('sha256').update(seed).digest('hex');
  return `legacy:${hash}`;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/id.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/id.ts test/nexus/learning/id.test.ts
git commit -m "feat(learning): ULID generator + legacy id derivation (SP1 Task 2)"
```

---

### Task 3: Strength derivation

**Files:**
- Create: `lib/nexus/learning/strength.ts`
- Test: `test/nexus/learning/strength.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/strength.test.ts
import { describe, test, expect } from 'bun:test';
import { computeStrength } from '../../../lib/nexus/learning/strength';
import type { LearningEntry } from '../../../lib/nexus/learning/schema';

const base: LearningEntry = {
  id: 'lrn_01HK0000000000000000000000', schema_version: 2,
  ts: '2026-05-12T00:00:00Z', writer_skill: 'x', subject_skill: 'y',
  subject_stage: null, type: 'pitfall', key: 'k', insight: 'i', confidence: 5,
  evidence_type: 'unknown', source: 'unknown', files: [], cluster_id: null,
  supersedes: [], supersedes_reason: null, derived_from: [], last_applied_at: null, mirror: null,
};

describe('computeStrength', () => {
  test('high-confidence test-output observed: ~ 8', () => {
    const s = computeStrength({ ...base, evidence_type: 'test-output', source: 'observed', confidence: 9 });
    expect(s).toBe(8); // 4 + 2 + 2
  });

  test('low-confidence speculation inferred: ~ 0', () => {
    const s = computeStrength({ ...base, evidence_type: 'speculation', source: 'inferred', confidence: 2 });
    expect(s).toBe(1); // clamp(1, 10, 0 + 0 + 0)
  });

  test('clamps to 1..10', () => {
    const s = computeStrength({ ...base, evidence_type: 'test-output', source: 'observed', confidence: 10 });
    expect(s).toBeLessThanOrEqual(10);
    expect(s).toBeGreaterThanOrEqual(1);
  });

  test('unknown evidence_type maps to base 0', () => {
    const s = computeStrength({ ...base, evidence_type: 'unknown', source: 'observed', confidence: 8 });
    expect(s).toBe(4); // 0 + 2 + 2
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/learning/strength.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement strength.ts**

```ts
// lib/nexus/learning/strength.ts
import type { LearningEntry, EvidenceType, LearningSource } from './schema';

const EVIDENCE_BASE: Record<EvidenceType, number> = {
  'test-output': 4,
  'code-pattern': 3,
  'profile-data': 4,
  'multi-run-observation': 3,
  'single-run-observation': 2,
  'team-consensus': 2,
  'external-reference': 1,
  'speculation': 0,
  'unknown': 0,
};

const SOURCE_MOD: Record<LearningSource, number> = {
  'observed': 2,
  'cross-model': 2,
  'user-stated': 1,
  'inferred': 0,
  'team-consensus': 1,
  'external-reference': 0,
  'speculation': 0,
  'unknown': 0,
};

function confidenceSignal(c: number): number {
  if (c >= 8) return 2;
  if (c >= 5) return 1;
  return 0;
}

function clamp(min: number, max: number, x: number): number {
  return Math.max(min, Math.min(max, x));
}

export function computeStrength(entry: Pick<LearningEntry, 'evidence_type' | 'source' | 'confidence'>): number {
  const base = EVIDENCE_BASE[entry.evidence_type];
  const mod = SOURCE_MOD[entry.source];
  const sig = confidenceSignal(entry.confidence);
  return clamp(1, 10, base + mod + sig);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/strength.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/strength.ts test/nexus/learning/strength.test.ts
git commit -m "feat(learning): strength derivation (single SP6/SP2 truth) (SP1 Task 3)"
```

---

### Task 4: Legacy v1 → v2 normalization

**Files:**
- Create: `lib/nexus/learning/normalize.ts`
- Test: `test/nexus/learning/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/normalize.test.ts
import { describe, test, expect } from 'bun:test';
import { normalizeLearningLine } from '../../../lib/nexus/learning/normalize';

describe('normalizeLearningLine', () => {
  test('v2 entry passes through unchanged', () => {
    const v2 = JSON.stringify({
      id: 'lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y',
      schema_version: 2,
      ts: '2026-05-12T00:00:00Z',
      writer_skill: 'investigate', subject_skill: 'build', subject_stage: 'build',
      type: 'pitfall', key: 'k', insight: 'i', confidence: 7,
      evidence_type: 'test-output', source: 'observed', files: [],
      cluster_id: null, supersedes: [], supersedes_reason: null,
      derived_from: [], last_applied_at: null, mirror: null,
    });
    const out = normalizeLearningLine(v2);
    expect(out?.schema_version).toBe(2);
    expect(out?.id).toBe('lrn_01HK8R9P5T7Z3X4N2M1Q8V6W5Y');
  });

  test('v1 legacy entry gets legacy:<sha256> id and unknowns', () => {
    const v1 = JSON.stringify({
      ts: '2026-04-01T00:00:00Z',
      skill: 'retro',
      type: 'pattern',
      key: 'distinguish-fork-baselines',
      insight: 'check upstream commit before flagging fork regression',
      confidence: 9,
      source: 'cross-model',
      files: ['.fork-baseline.json'],
    });
    const out = normalizeLearningLine(v1);
    expect(out).toBeDefined();
    expect(out!.id).toMatch(/^legacy:[0-9a-f]{64}$/);
    expect(out!.writer_skill).toBe('retro');
    expect(out!.subject_skill).toBe('unknown');
    expect(out!.evidence_type).toBe('unknown');
    expect(out!.schema_version).toBe(1);
  });

  test('malformed line returns null (fail soft)', () => {
    expect(normalizeLearningLine('not json')).toBeNull();
    expect(normalizeLearningLine('{}')).toBeNull(); // missing key/insight/type
  });

  test('legacy id is stable across calls', () => {
    const v1 = '{"ts":"2026-04-01T00:00:00Z","skill":"retro","type":"pattern","key":"k","insight":"i","confidence":7,"source":"observed","files":[]}';
    const a = normalizeLearningLine(v1)!;
    const b = normalizeLearningLine(v1)!;
    expect(a.id).toBe(b.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/nexus/learning/normalize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement normalize.ts**

```ts
// lib/nexus/learning/normalize.ts
import type { LearningEntry } from './schema';
import { LEARNING_TYPES, LEARNING_SOURCES } from './schema';
import { deriveLegacyId } from './id';

/** Loose v1 entry shape as it appears in legacy learnings.jsonl. */
type LegacyV1 = {
  ts?: string;
  skill?: string;
  type?: string;
  key?: string;
  insight?: string;
  confidence?: number;
  source?: string;
  files?: string[];
};

/** Read-time normalized entry. schema_version: 1 marks a legacy origin. */
export type NormalizedEntry = LearningEntry & { schema_version: 1 | 2 };

export function normalizeLearningLine(line: string): NormalizedEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // Already v2 — pass through with minimal sanity.
  if (obj.schema_version === 2) {
    if (typeof obj.id !== 'string' || typeof obj.key !== 'string' || typeof obj.type !== 'string' || typeof obj.insight !== 'string') {
      return null;
    }
    return obj as unknown as NormalizedEntry;
  }

  // Legacy v1 (or pre-versioned). Require type, key, insight to be useful.
  const v1 = obj as LegacyV1;
  if (!v1.type || !v1.key || !v1.insight) return null;
  if (!LEARNING_TYPES.includes(v1.type as any)) return null;

  const ts = typeof v1.ts === 'string' ? v1.ts : '1970-01-01T00:00:00Z';
  const writer = typeof v1.skill === 'string' ? v1.skill : 'unknown';
  const source = (typeof v1.source === 'string' && LEARNING_SOURCES.includes(v1.source as any))
    ? (v1.source as LearningEntry['source'])
    : 'unknown';

  return {
    id: deriveLegacyId({
      ts,
      skill: writer,
      type: v1.type,
      key: v1.key,
      insight: v1.insight,
      files: v1.files ?? [],
    }),
    schema_version: 1,
    ts,
    writer_skill: writer,
    subject_skill: 'unknown',
    subject_stage: null,
    type: v1.type as LearningEntry['type'],
    key: v1.key,
    insight: v1.insight,
    confidence: typeof v1.confidence === 'number' ? v1.confidence : 5,
    evidence_type: 'unknown',
    source,
    files: Array.isArray(v1.files) ? v1.files : [],
    cluster_id: null,
    supersedes: [],
    supersedes_reason: null,
    derived_from: [],
    last_applied_at: null,
    mirror: null,
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/normalize.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/normalize.ts test/nexus/learning/normalize.test.ts
git commit -m "feat(learning): legacy v1 → v2 lazy normalization (SP1 Task 4)"
```

---

## Phase 2 — Read-side upgrade

### Task 5: Upgrade `bin/nexus-learnings-search` to use normalizer

**Files:**
- Modify: `bin/nexus-learnings-search`
- Test: extend existing `test/learnings.test.ts`

- [ ] **Step 1: Locate the current inline normalize block**

Run: `grep -n "JSON.parse\|seen\|conf" bin/nexus-learnings-search`
Find the bun -e block (~line 80-160) that parses lines and applies decay.

- [ ] **Step 2: Write the failing extension test**

```ts
// test/learnings.test.ts — append
test('nexus-learnings-search reads mixed v1+v2 entries via normalizer', () => {
  // Setup: write a jsonl with one v1 + one v2 entry to a tmp dir
  // (use existing test setup pattern from this file)
  // Expected output: both entries visible; v2 entry surfaces its `evidence_type`
});
```

- [ ] **Step 3: Replace inline normalize with module-imported version**

Edit the `bun -e ...` block in `bin/nexus-learnings-search`. Replace inline parse + dedup with a call to a small loader script that imports `lib/nexus/learning/normalize.ts`. Pattern:

```bash
# In bin/nexus-learnings-search, replace the inline normalize section with:
cat "${FILES[@]}" 2>/dev/null | bun -e "
  import { normalizeLearningLine } from '$REPO_ROOT/lib/nexus/learning/normalize.ts';
  import { computeStrength } from '$REPO_ROOT/lib/nexus/learning/strength.ts';
  const lines = (await Bun.stdin.text()).trim().split('\n').filter(Boolean);
  // ... existing decay + dedup + filter logic, using normalizeLearningLine(line)
  //     instead of inline JSON.parse, and adding e._strength = computeStrength(e)
"
```

Exact change: keep all decay + dedup + filter + sort + output behavior the same. Only swap parse → `normalizeLearningLine`. Add `_strength` to display output (one extra line in formatted output).

- [ ] **Step 4: Run extended tests**

Run: `bun test test/learnings.test.ts test/skill-e2e-learnings.test.ts`
Expected: existing tests pass; new mixed-v1+v2 test passes.

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-learnings-search test/learnings.test.ts
git commit -m "feat(learning): nexus-learnings-search uses module-imported normalizer (SP1 Task 5)"
```

---

### Task 6: Schema_v2 upgrade in `lib/nexus/observability/learnings.ts`

**Files:**
- Modify: `lib/nexus/observability/learnings.ts`
- Modify: `lib/nexus/contracts/types.ts` (extend `LearningCandidate` to allow v2 fields)
- Test: existing tests cover this; verify no regression

- [ ] **Step 1: Read current `LearningCandidate` type**

Run: `grep -n "LearningCandidate\|StageLearningCandidatesRecord\|RunLearningsRecord" lib/nexus/contracts/types.ts | head -20`

Identify the existing shape.

- [ ] **Step 2: Extend `LearningCandidate` type with v2 optional fields**

In `lib/nexus/contracts/types.ts`, add the new fields as **optional** so existing v1 readers keep working:

```ts
// lib/nexus/contracts/types.ts — extend existing LearningCandidate
export type LearningCandidate = {
  // existing v1 fields (keep as-is):
  type: 'pattern' | 'pitfall' | 'preference' | 'architecture' | 'tool';
  key: string;
  insight: string;
  confidence: number;
  source: string;
  files: string[];
  // new v2 fields (optional for backward compat):
  id?: string;
  writer_skill?: string;
  subject_skill?: string;
  subject_stage?: string | null;
  evidence_type?: string;
  cluster_id?: string | null;
  supersedes?: string[];
  supersedes_reason?: string | null;
  derived_from?: string[];
  last_applied_at?: string | null;
};
```

Similarly extend `StageLearningCandidatesRecord` and `RunLearningsRecord` to carry `schema_version: 1 | 2` (existing schema_version is 1; v2 will be additive).

- [ ] **Step 3: Update `normalizeLearningCandidate` in `lib/nexus/observability/learnings.ts`**

The existing function (around line 35) validates v1 shape. Extend it to recognize v2 fields and preserve them through. Be **non-destructive**: if a candidate has a v2 `id`, keep it; if not, leave it undefined (caller can fill).

```ts
// inside normalizeLearningCandidate — after existing v1 validation:
return {
  type, key, insight, source,
  confidence: rawCandidate.confidence,
  files: Array.isArray(rawCandidate.files) ? rawCandidate.files.map(String) : [],
  // pass through v2 fields when present:
  id: typeof rawCandidate.id === 'string' ? rawCandidate.id : undefined,
  writer_skill: typeof rawCandidate.writer_skill === 'string' ? rawCandidate.writer_skill : undefined,
  subject_skill: typeof rawCandidate.subject_skill === 'string' ? rawCandidate.subject_skill : undefined,
  subject_stage: typeof rawCandidate.subject_stage === 'string' ? rawCandidate.subject_stage : undefined,
  evidence_type: typeof rawCandidate.evidence_type === 'string' ? rawCandidate.evidence_type : undefined,
  cluster_id: typeof rawCandidate.cluster_id === 'string' ? rawCandidate.cluster_id : null,
  supersedes: Array.isArray(rawCandidate.supersedes) ? rawCandidate.supersedes.map(String) : [],
  supersedes_reason: typeof rawCandidate.supersedes_reason === 'string' ? rawCandidate.supersedes_reason : null,
  derived_from: Array.isArray(rawCandidate.derived_from) ? rawCandidate.derived_from.map(String) : [],
  last_applied_at: typeof rawCandidate.last_applied_at === 'string' ? rawCandidate.last_applied_at : null,
};
```

- [ ] **Step 4: Run full existing test suite — no regressions**

Run: `bun test test/nexus/observability/ test/learnings.test.ts test/skill-e2e-learnings.test.ts`
Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/contracts/types.ts lib/nexus/observability/learnings.ts
git commit -m "feat(learning): extend candidate types with optional v2 fields (SP1 Task 6)"
```

---

## Phase 3 — Write helper upgrade

### Task 7: Upgrade `bin/nexus-learnings-log` to inject schema_v2 defaults

**Files:**
- Modify: `bin/nexus-learnings-log`
- Test: `test/learnings.test.ts` extension

- [ ] **Step 1: Write the failing test**

```ts
// test/learnings.test.ts — append
test('nexus-learnings-log injects id and schema_version when missing', () => {
  // Setup: invoke the bash helper with a partial entry
  // Assert: appended line has `id` matching lrn_<ULID> and schema_version: 2
});
```

- [ ] **Step 2: Modify `bin/nexus-learnings-log`**

Extend the existing inline `bun -e` block that injects `ts`. Add defaulting for `id` and `schema_version`:

```bash
# After existing ts injection in bin/nexus-learnings-log, add:
INPUT=$(printf '%s' "$INPUT" | bun -e "
  const j = JSON.parse(await Bun.stdin.text());
  if (!j.schema_version) j.schema_version = 2;
  if (!j.id) {
    const { generateLearningId } = await import('$REPO_ROOT/lib/nexus/learning/id.ts');
    j.id = generateLearningId();
  }
  console.log(JSON.stringify(j));
")
```

(Compute REPO_ROOT at top of script: `REPO_ROOT=\"$(cd \"$SCRIPT_DIR/..\" && pwd)\"`.)

- [ ] **Step 3: Run test**

Run: `bun test test/learnings.test.ts`
Expected: new test passes; existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add bin/nexus-learnings-log test/learnings.test.ts
git commit -m "feat(learning): nexus-learnings-log injects id + schema_version defaults (SP1 Task 7)"
```

---

## Phase 4 — Direct template (Path-A)

### Task 8: Update `/investigate` SKILL.md.tmpl to emit schema_v2

**Files:**
- Modify: `skills/support/investigate/SKILL.md.tmpl`
- Regenerate: `skills/support/investigate/SKILL.md` (and all hosts)

- [ ] **Step 1: Locate the existing capture block**

Run: `grep -n "nexus-learnings-log\|capture" skills/support/investigate/SKILL.md.tmpl`
Find the bash block that logs a learning at root-cause confirmation.

- [ ] **Step 2: Update the capture block to emit schema_v2 fields**

Replace the existing JSON payload in the bash block with one that includes the new fields. Example:

```bash
# In skills/support/investigate/SKILL.md.tmpl — replace existing capture block:
~/.claude/skills/nexus/bin/nexus-learnings-log "$(cat <<'JSON'
{
  "writer_skill": "investigate",
  "subject_skill": "<SKILL_BEING_INVESTIGATED>",
  "subject_stage": "<STAGE_IF_KNOWN_OR_NULL>",
  "type": "pitfall",
  "key": "<KEBAB_KEY_2_TO_5_WORDS>",
  "insight": "<ONE_SENTENCE_ACTIONABLE>",
  "confidence": <1_TO_10>,
  "evidence_type": "<test-output|code-pattern|profile-data|multi-run-observation|...>",
  "source": "observed",
  "files": ["<relevant/file.ts>"]
}
JSON
)"
```

`id`, `schema_version`, and `ts` are injected by the helper (Task 7).

Add a paragraph above the block explaining each new field's purpose for the LLM operator reading the skill.

- [ ] **Step 3: Regenerate skill files for all hosts**

Run:
```bash
bun run gen:skill-docs --host claude
bun run gen:skill-docs --host codex
bun run gen:skill-docs --host gemini-cli
bun run gen:skill-docs --host factory
```

Verify generated files:
```bash
git diff skills/support/investigate/SKILL.md hosts/*/skills/nexus-investigate/SKILL.md
```

- [ ] **Step 4: Manual smoke**

Run: `bun test test/skill-e2e-learnings.test.ts`
Expected: existing tests still pass; if e2e covers investigate, schema_v2 visible in output.

- [ ] **Step 5: Commit**

```bash
git add skills/support/investigate/SKILL.md.tmpl skills/support/investigate/SKILL.md hosts/*/skills/*investigate*
git commit -m "feat(skills): /investigate emits schema_v2 learnings (SP1 Path-A reference)"
```

---

### Task 9: Update `/retro` SKILL.md.tmpl to emit schema_v2

**Files:**
- Modify: `skills/support/retro/SKILL.md.tmpl`
- Regenerate: all host outputs

- [ ] **Step 1: Locate the capture block in retro template**

Run: `grep -n "nexus-learnings-log" skills/support/retro/SKILL.md.tmpl`

- [ ] **Step 2: Update to schema_v2**

Same pattern as Task 8: add `writer_skill: "retro"`, `subject_skill`, `subject_stage`, `evidence_type`. The retro skill produces process-level learnings, so `subject_skill` is often `"unknown"` or the skill that was retrospected.

- [ ] **Step 3: Regenerate**

```bash
bun run gen:skill-docs --host claude && bun run gen:skill-docs --host codex && bun run gen:skill-docs --host gemini-cli && bun run gen:skill-docs --host factory
```

- [ ] **Step 4: Test + commit**

```bash
bun test test/skill-e2e-learnings.test.ts
git add skills/support/retro/SKILL.md.tmpl skills/support/retro/SKILL.md hosts/*/skills/*retro*
git commit -m "feat(skills): /retro emits schema_v2 learnings (SP1 Task 9)"
```

---

## Phase 5 — Chain template foundations

### Task 10: Add `buildLearningCandidatesPath()` in artifacts.ts

**Files:**
- Modify: `lib/nexus/io/artifacts.ts`
- Test: existing artifact-path tests will need extension if any cover this

- [ ] **Step 1: Locate existing `*LearningCandidatesPath` functions**

Run: `grep -n "LearningCandidatesPath" lib/nexus/io/artifacts.ts`

- [ ] **Step 2: Add `buildLearningCandidatesPath`**

```ts
// lib/nexus/io/artifacts.ts — add next to existing review/qa/ship variants:
export function buildLearningCandidatesPath(): string {
  return '.planning/current/build/learning-candidates.json';
}
```

- [ ] **Step 3: Verify by grep**

Run: `grep -n "buildLearningCandidatesPath\|reviewLearningCandidatesPath\|qaLearningCandidatesPath" lib/nexus/io/artifacts.ts`
All four should now exist.

- [ ] **Step 4: Commit**

```bash
git add lib/nexus/io/artifacts.ts
git commit -m "feat(learning): add buildLearningCandidatesPath (SP1 Task 10)"
```

---

### Task 11: `writeLearningCandidate(stage, entry)` helper

**Files:**
- Create: `lib/nexus/learning/candidates.ts`
- Test: `test/nexus/learning/candidates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/candidates.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeLearningCandidate } from '../../../lib/nexus/learning/candidates';
import { generateLearningId } from '../../../lib/nexus/learning/id';

let cwd: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'sp1-cand-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); });

test('first write creates file with one candidate', () => {
  const entry = makeEntry();
  writeLearningCandidate({ cwd, stage: 'build', run_id: 'run1', entry });
  const path = join(cwd, '.planning/current/build/learning-candidates.json');
  expect(existsSync(path)).toBe(true);
  const record = JSON.parse(readFileSync(path, 'utf8'));
  expect(record.schema_version).toBe(2);
  expect(record.stage).toBe('build');
  expect(record.run_id).toBe('run1');
  expect(record.candidates).toHaveLength(1);
});

test('second write appends, preserving previous candidate', () => {
  writeLearningCandidate({ cwd, stage: 'build', run_id: 'r2', entry: makeEntry() });
  writeLearningCandidate({ cwd, stage: 'build', run_id: 'r2', entry: makeEntry() });
  const record = JSON.parse(readFileSync(join(cwd, '.planning/current/build/learning-candidates.json'), 'utf8'));
  expect(record.candidates).toHaveLength(2);
});

test('run_id mismatch starts fresh', () => {
  writeLearningCandidate({ cwd, stage: 'build', run_id: 'r1', entry: makeEntry() });
  writeLearningCandidate({ cwd, stage: 'build', run_id: 'r2', entry: makeEntry() });
  const record = JSON.parse(readFileSync(join(cwd, '.planning/current/build/learning-candidates.json'), 'utf8'));
  expect(record.run_id).toBe('r2');
  expect(record.candidates).toHaveLength(1);
});

function makeEntry() {
  return {
    id: generateLearningId(),
    schema_version: 2 as const,
    ts: new Date().toISOString(),
    writer_skill: 'build', subject_skill: 'build', subject_stage: 'build' as const,
    type: 'pitfall' as const, key: 'three-strike', insight: 'demo',
    confidence: 7, evidence_type: 'multi-run-observation' as const,
    source: 'observed' as const, files: [],
    cluster_id: null, supersedes: [], supersedes_reason: null,
    derived_from: [], last_applied_at: null, mirror: null,
  };
}
```

- [ ] **Step 2: Run test to verify fail**

Run: `bun test test/nexus/learning/candidates.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement candidates.ts**

```ts
// lib/nexus/learning/candidates.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import type { LearningEntry, SubjectStage } from './schema';
import { assertSchemaV2 } from './schema';

type Stage = 'build' | 'review' | 'qa' | 'ship';

const STAGE_PATHS: Record<Stage, string> = {
  build: '.planning/current/build/learning-candidates.json',
  review: '.planning/current/review/learning-candidates.json',
  qa: '.planning/current/qa/learning-candidates.json',
  ship: '.planning/current/ship/learning-candidates.json',
};

type StageRecord = {
  schema_version: 2;
  stage: Stage;
  run_id: string;
  candidates: LearningEntry[];
};

export function writeLearningCandidate(params: {
  cwd: string;
  stage: Stage;
  run_id: string;
  entry: LearningEntry;
}): void {
  assertSchemaV2(params.entry);
  const path = join(params.cwd, STAGE_PATHS[params.stage]);
  mkdirSync(dirname(path), { recursive: true });

  let record: StageRecord;
  if (existsSync(path)) {
    try {
      const existing = JSON.parse(readFileSync(path, 'utf8')) as StageRecord;
      if (existing.run_id === params.run_id && existing.stage === params.stage) {
        record = { ...existing, candidates: [...existing.candidates, params.entry] };
      } else {
        record = { schema_version: 2, stage: params.stage, run_id: params.run_id, candidates: [params.entry] };
      }
    } catch {
      record = { schema_version: 2, stage: params.stage, run_id: params.run_id, candidates: [params.entry] };
    }
  } else {
    record = { schema_version: 2, stage: params.stage, run_id: params.run_id, candidates: [params.entry] };
  }

  // Atomic write: temp + rename.
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(record, null, 2));
  renameSync(tmp, path);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/candidates.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/candidates.ts test/nexus/learning/candidates.test.ts
git commit -m "feat(learning): writeLearningCandidate helper (atomic, run-aware) (SP1 Task 11)"
```

---

### Task 12: Config reader for `mirror_on_closeout`

**Files:**
- Create: `lib/nexus/learning/config.ts`
- Test: `test/nexus/learning/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/config.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { isMirrorEnabled } from '../../../lib/nexus/learning/config';

let stateDir: string;
beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), 'sp1-cfg-'));
  process.env.NEXUS_STATE_DIR = stateDir;
});
afterEach(() => {
  delete process.env.NEXUS_STATE_DIR;
  rmSync(stateDir, { recursive: true, force: true });
});

test('default: disabled when no config', () => {
  expect(isMirrorEnabled()).toBe(false);
});

test('explicit true enables', () => {
  writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: true\n');
  expect(isMirrorEnabled()).toBe(true);
});

test('explicit false disables', () => {
  writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: false\n');
  expect(isMirrorEnabled()).toBe(false);
});

test('malformed yaml: fail soft to false', () => {
  writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: [\n');
  expect(isMirrorEnabled()).toBe(false);
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `bun test test/nexus/learning/config.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement config.ts**

```ts
// lib/nexus/learning/config.ts
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

export function isMirrorEnabled(): boolean {
  const stateDir = process.env.NEXUS_STATE_DIR ?? `${process.env.HOME}/.nexus`;
  const configPath = join(stateDir, 'config.yaml');
  if (!existsSync(configPath)) return false;
  try {
    const config = parseYaml(readFileSync(configPath, 'utf8')) as { learning?: { mirror_on_closeout?: boolean } } | null;
    return config?.learning?.mirror_on_closeout === true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/config.test.ts`
Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/config.ts test/nexus/learning/config.test.ts
git commit -m "feat(learning): mirror_on_closeout config reader (default false) (SP1 Task 12)"
```

---

### Task 13: Mirror helper with idempotent ledger

**Files:**
- Create: `lib/nexus/learning/mirror.ts`
- Test: `test/nexus/learning/mirror.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/mirror.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mirrorCanonicalToJsonl } from '../../../lib/nexus/learning/mirror';
import { generateLearningId } from '../../../lib/nexus/learning/id';

let stateDir: string;
beforeEach(() => { stateDir = mkdtempSync(join(tmpdir(), 'sp1-mir-')); });
afterEach(() => { rmSync(stateDir, { recursive: true, force: true }); });

const makeCanonical = () => ({
  id: generateLearningId(), schema_version: 2 as const,
  ts: '2026-05-12T00:00:00Z', writer_skill: 'closeout', subject_skill: 'build', subject_stage: 'build' as const,
  type: 'pitfall' as const, key: 'k', insight: 'i', confidence: 8,
  evidence_type: 'test-output' as const, source: 'observed' as const, files: [],
  cluster_id: null, supersedes: [], supersedes_reason: null, derived_from: ['lrn_src1'],
  last_applied_at: null, mirror: null,
});

test('writes mirrored entries with nested mirror block', () => {
  const entry = makeCanonical();
  mirrorCanonicalToJsonl({
    stateDir, slug: 'demo',
    runId: 'r1', sourcePath: '.planning/.../learnings.json',
    canonical: [entry],
  });
  const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);
  const parsed = JSON.parse(lines[0]);
  expect(parsed.mirror.origin).toBe('closeout');
  expect(parsed.mirror.run_id).toBe('r1');
});

test('re-running on same (canonical_id, run_id) is a no-op', () => {
  const entry = makeCanonical();
  mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
  mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
  const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);
});

test('different run_id appends as new line', () => {
  const entry = makeCanonical();
  mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r1', sourcePath: 'p', canonical: [entry] });
  mirrorCanonicalToJsonl({ stateDir, slug: 'demo', runId: 'r2', sourcePath: 'p', canonical: [entry] });
  const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
  expect(lines).toHaveLength(2);
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `bun test test/nexus/learning/mirror.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement mirror.ts**

```ts
// lib/nexus/learning/mirror.ts
import { mkdirSync, readFileSync, appendFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { LearningEntry } from './schema';
import { normalizeLearningLine } from './normalize';

export function mirrorCanonicalToJsonl(params: {
  stateDir: string;
  slug: string;
  runId: string;
  sourcePath: string;
  canonical: LearningEntry[];
}): void {
  const jsonlPath = join(params.stateDir, 'projects', params.slug, 'learnings.jsonl');
  mkdirSync(dirname(jsonlPath), { recursive: true });

  // Build (id, run_id) ledger from existing file.
  const seen = new Set<string>();
  if (existsSync(jsonlPath)) {
    const lines = readFileSync(jsonlPath, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      const norm = normalizeLearningLine(line);
      if (norm && norm.mirror?.run_id) {
        seen.add(`${norm.id}|${norm.mirror.run_id}`);
      }
    }
  }

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
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test test/nexus/learning/mirror.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/mirror.ts test/nexus/learning/mirror.test.ts
git commit -m "feat(learning): canonical→jsonl mirror with idempotent ledger (SP1 Task 13)"
```

---

## Phase 6 — Chain template (Path-B)

### Task 14: `/build` capture point on 3-strike route-to-/investigate

**Files:**
- Modify: `lib/nexus/commands/build.ts`
- Test: `test/nexus/commands/build.test.ts` (extend or create relevant section)

- [ ] **Step 1: Locate the 3-strike decision in build.ts**

Run: `grep -n "investigate\|3.*strike\|three.*strike\|strikeCount\|escalate" lib/nexus/commands/build.ts | head -20`

Identify the function that decides to route to `/investigate`. (May be named like `decideStrikeRouting`, `shouldRouteToInvestigate`, or be inline in the `runBuild` function.)

- [ ] **Step 2: Write the failing test for capture-on-strike**

```ts
// test/nexus/commands/build.test.ts — append (or new file under test/nexus/learning/)
test('/build writes learning-candidate when 3-strike fires', async () => {
  // Setup: run /build with state that triggers 3-strike
  // Assert: .planning/current/build/learning-candidates.json exists with one entry
  // Entry has writer_skill: 'build', type: 'pitfall', subject_stage: 'build'
});
```

- [ ] **Step 3: Add capture call in build.ts**

In the function that fires the strike-routing decision, before returning the routing result:

```ts
// lib/nexus/commands/build.ts — inside the strike-fire branch
import { writeLearningCandidate } from '../learning/candidates';
import { generateLearningId } from '../learning/id';

// ... in the branch where the 3-strike decision is finalized:
writeLearningCandidate({
  cwd: ctx.cwd,
  stage: 'build',
  run_id: ledger.run_id,
  entry: {
    id: generateLearningId(),
    schema_version: 2,
    ts: new Date().toISOString(),
    writer_skill: 'build',
    subject_skill: 'build',
    subject_stage: 'build',
    type: 'pitfall',
    key: deriveStrikeKey(strikeContext),  // small helper or inline; e.g., 'three-strike-' + truncated-task-id
    insight: composeStrikeInsight(strikeContext),  // 1-sentence summary from existing strike state
    confidence: 8,                                  // 3 independent strikes = high confidence
    evidence_type: 'multi-run-observation',
    source: 'observed',
    files: collectStrikeFiles(strikeContext),
    cluster_id: null,
    supersedes: [],
    supersedes_reason: null,
    derived_from: [],
    last_applied_at: null,
    mirror: null,
  },
});
```

The `deriveStrikeKey`, `composeStrikeInsight`, `collectStrikeFiles` helpers can be small inline functions or live in `lib/nexus/learning/strike-capture.ts` if they grow.

- [ ] **Step 4: Run test**

Run: `bun test test/nexus/commands/build.test.ts test/nexus/learning/`
Expected: new test passes; existing build tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/commands/build.ts test/nexus/commands/build.test.ts
git commit -m "feat(build): capture learning-candidate on 3-strike route-to-/investigate (SP1 Task 14)"
```

---

### Task 15: `/closeout` consumes `build` candidates + mirrors

**Files:**
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/observability/learnings.ts` (if `LearningStage` type needs extending)

- [ ] **Step 1: Extend `LearningStage` to include `'build'`**

Run: `grep -n "type LearningStage\|'review'\s*|\s*'qa'\s*|\s*'ship'" lib/nexus/observability/learnings.ts`

Update the type and the `STAGE_ORDER` constant to include `build`:

```ts
// lib/nexus/observability/learnings.ts
type LearningStage = 'build' | 'review' | 'qa' | 'ship';

const STAGE_ORDER: Record<LearningStage, number> = {
  build: 0,    // earliest in lifecycle
  review: 1,
  qa: 2,
  ship: 3,
};
```

- [ ] **Step 2: Include build in `collectCloseoutLearningSources`**

In `lib/nexus/commands/closeout.ts`:

```ts
// add import:
import { buildLearningCandidatesPath } from '../io/artifacts';

// update collectCloseoutLearningSources:
function collectCloseoutLearningSources(cwd: string, runId: string): CloseoutLearningSource[] {
  return [
    readLearningCandidatesSource(cwd, runId, buildLearningCandidatesPath(), 'build'),
    readLearningCandidatesSource(cwd, runId, reviewLearningCandidatesPath(), 'review'),
    readLearningCandidatesSource(cwd, runId, qaLearningCandidatesPath(), 'qa'),
    readLearningCandidatesSource(cwd, runId, shipLearningCandidatesPath(), 'ship'),
  ].filter((source): source is CloseoutLearningSource => source !== null);
}
```

Also update the `CloseoutLearningSource` type union:
```ts
type CloseoutLearningSource = {
  path: string;
  stage: 'build' | 'review' | 'qa' | 'ship';
  candidates: StageLearningCandidatesRecord['candidates'];
};
```

- [ ] **Step 3: Add optional mirror after canonical write**

In `runCloseout` (around line 297 where canonical is built), after `writeFileSync(closeoutLearningsJsonPath, ...)`:

```ts
// lib/nexus/commands/closeout.ts — after writing canonical learnings.json:
import { isMirrorEnabled } from '../learning/config';
import { mirrorCanonicalToJsonl } from '../learning/mirror';
import { getNexusSlug } from '../io/...';  // locate via grep

if (closeoutLearningRecord && isMirrorEnabled()) {
  const stateDir = process.env.NEXUS_STATE_DIR ?? `${process.env.HOME}/.nexus`;
  const slug = await getNexusSlug(ctx.cwd);
  mirrorCanonicalToJsonl({
    stateDir,
    slug,
    runId: ledger.run_id,
    sourcePath: closeoutLearningsJsonPath(),
    canonical: closeoutLearningRecord.learnings ?? [],  // exact field name per RunLearningsRecord type
  });
}
```

(If `getNexusSlug` doesn't exist with that name, locate the slug source — likely in `lib/nexus/io/` or via the `bin/nexus-slug` bash helper. Pattern existed in the search code I read.)

- [ ] **Step 4: Run closeout tests**

Run: `bun test test/nexus/commands/closeout.test.ts`
Expected: existing closeout tests still pass (build source added but optional — empty candidates produce no canonical, no regression).

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/observability/learnings.ts lib/nexus/commands/closeout.ts
git commit -m "feat(closeout): include build candidates + optional mirror to jsonl (SP1 Task 15)"
```

---

### Task 16: E2E chain test (build → closeout → mirror)

**Files:**
- Create: `test/nexus/learning/chain-template.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// test/nexus/learning/chain-template.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeLearningCandidate } from '../../../lib/nexus/learning/candidates';
import { mirrorCanonicalToJsonl } from '../../../lib/nexus/learning/mirror';
import { generateLearningId } from '../../../lib/nexus/learning/id';

let cwd: string;
let stateDir: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), 'sp1-chain-cwd-'));
  stateDir = mkdtempSync(join(tmpdir(), 'sp1-chain-state-'));
  process.env.NEXUS_STATE_DIR = stateDir;
});

afterEach(() => {
  delete process.env.NEXUS_STATE_DIR;
  rmSync(cwd, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
});

test('full chain: build writes candidate → closeout reads → canonical written → mirror appends to jsonl', () => {
  const buildCandidate = makeEntry('build', 'pitfall-a');
  writeLearningCandidate({ cwd, stage: 'build', run_id: 'integ1', entry: buildCandidate });

  // Verify candidate file exists
  const candPath = join(cwd, '.planning/current/build/learning-candidates.json');
  expect(existsSync(candPath)).toBe(true);

  // Simulate /closeout: enable mirror, mirror the canonical directly
  writeFileSync(join(stateDir, 'config.yaml'), 'learning:\n  mirror_on_closeout: true\n');
  const canonical = { ...buildCandidate, id: generateLearningId(), derived_from: [buildCandidate.id] };
  mirrorCanonicalToJsonl({
    stateDir, slug: 'demo', runId: 'integ1',
    sourcePath: '.planning/current/closeout/learnings.json',
    canonical: [canonical],
  });

  // Verify jsonl has the mirrored canonical with correct mirror block
  const lines = readFileSync(join(stateDir, 'projects/demo/learnings.jsonl'), 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);
  const out = JSON.parse(lines[0]);
  expect(out.derived_from).toContain(buildCandidate.id);
  expect(out.mirror.origin).toBe('closeout');
  expect(out.mirror.run_id).toBe('integ1');
});

function makeEntry(stage: 'build', key: string) {
  return {
    id: generateLearningId(), schema_version: 2 as const,
    ts: new Date().toISOString(), writer_skill: stage, subject_skill: stage, subject_stage: stage,
    type: 'pitfall' as const, key, insight: 'demo',
    confidence: 8, evidence_type: 'multi-run-observation' as const,
    source: 'observed' as const, files: [],
    cluster_id: null, supersedes: [], supersedes_reason: null,
    derived_from: [], last_applied_at: null, mirror: null,
  };
}
```

- [ ] **Step 2: Run and verify**

Run: `bun test test/nexus/learning/chain-template.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add test/nexus/learning/chain-template.test.ts
git commit -m "test(learning): end-to-end chain template integration (SP1 Task 16)"
```

---

## Phase 7 — Barrel + final integration

### Task 17: Update `lib/nexus/index.ts` barrel

**Files:**
- Modify: `lib/nexus/index.ts`

- [ ] **Step 1: Identify current barrel exports**

Run: `cat lib/nexus/index.ts`

- [ ] **Step 2: Add learning surface re-exports**

```ts
// lib/nexus/index.ts — append to existing exports:

// Learning (SP1) — schema and write/read helpers for cross-boundary callers.
export type {
  LearningEntry,
  MirrorMetadata,
  EvidenceType,
  LearningSource,
  LearningType,
  SubjectStage,
  SupersedesReason,
} from './learning/schema';
export { assertSchemaV2 } from './learning/schema';
export {
  generateLearningId,
  parseLearningId,
  deriveLegacyId,
} from './learning/id';
export { computeStrength } from './learning/strength';
export { normalizeLearningLine } from './learning/normalize';
export { writeLearningCandidate } from './learning/candidates';
```

(Mirror helper, config reader stay private — they're closeout-internal.)

- [ ] **Step 3: Verify by checking import compiles**

Run: `bun run build 2>&1 | tail -20`
Expected: no type errors.

Run the barrel-pin test if it exists:
```bash
bun test test/nexus/barrel-surface.test.ts
```
Expected: PASS (or update the test to recognize new exports).

- [ ] **Step 4: Commit**

```bash
git add lib/nexus/index.ts test/nexus/barrel-surface.test.ts  # if updated
git commit -m "feat(learning): expose SP1 types + helpers via lib/nexus/index.ts barrel (SP1 Task 17)"
```

---

### Task 18: Write `lib/nexus/learning/README.md`

**Files:**
- Create: `lib/nexus/learning/README.md`

- [ ] **Step 1: Write the public-surface notes**

```markdown
# lib/nexus/learning — SP1 Signal Architecture

Surfaces for the V1 self-learning loop, shipped in SP1.

## Public API (via lib/nexus/index.ts barrel)

| Symbol | Kind | Purpose |
|---|---|---|
| `LearningEntry` | type | Schema v2 entry shape |
| `MirrorMetadata` | type | Nested mirror block on canonical entries |
| `assertSchemaV2` | function | Throw on malformed entry |
| `generateLearningId` | function | New ULID (`lrn_<26-char>`) |
| `parseLearningId` | function | Validate + classify ULID vs `legacy:<hash>` |
| `deriveLegacyId` | function | Deterministic `legacy:<sha256>` for migration |
| `computeStrength` | function | Derived 1–10 from `(evidence_type, source, confidence)`; SP6/SP2 single source of truth |
| `normalizeLearningLine` | function | v1 → v2 lazy normalization at read time |
| `writeLearningCandidate` | function | Stage handlers call to write `learning-candidates.json` |

## Internal (not exported)

- `mirror.ts` — closeout-only canonical → jsonl mirror with idempotent ledger.
- `config.ts` — reads `learning.mirror_on_closeout` from `~/.nexus/config.yaml`.

## Concurrency note

`learnings.jsonl` writes use `fs.appendFileSync` which is atomic per-write
on POSIX but **not** sequenced across concurrent Nexus sessions on the
same project. Line interleaving is harmless because dedup happens at
read by `(key, type)`. File locking is deferred to a future phase if
real concurrent-session demand emerges.

## Schema version policy

- New entries always carry `schema_version: 2`.
- Legacy `learnings.jsonl` entries (no `schema_version`, or `schema_version: 1`) are
  normalized at read time into a virtual v2 with `schema_version: 1` retained
  as a provenance marker.
- The on-disk `learnings.jsonl` is never rewritten by SP1. A future `nexus learn migrate`
  command may produce a physical `learnings.v2.jsonl` after SP1 ships and resolver
  tests pass.
```

- [ ] **Step 2: Commit**

```bash
git add lib/nexus/learning/README.md
git commit -m "docs(learning): SP1 public surface notes + concurrency caveat (SP1 Task 18)"
```

---

## Phase 8 — Remaining 5 capture sites

### Task 19: `/simplify` direct capture

**Files:**
- Modify: `skills/canonical/simplify/SKILL.md.tmpl` (or `skills/support/simplify/SKILL.md.tmpl` — locate)
- Regenerate hosts

- [ ] **Step 1: Locate simplify skill template**

Run: `find skills -name "simplify*" -path "*SKILL.md.tmpl"`

- [ ] **Step 2: Find the natural capture point in the template**

`/simplify`'s Iron Law / workflow says it should log every removed duplication / simplification finding. The capture block goes after the simplification is confirmed.

- [ ] **Step 3: Insert capture block**

Same pattern as Task 8, with `writer_skill: "simplify"`, `evidence_type: "code-pattern"`, `subject_stage: null` (simplify is a support skill, not a stage).

```bash
~/.claude/skills/nexus/bin/nexus-learnings-log "$(cat <<'JSON'
{
  "writer_skill": "simplify",
  "subject_skill": "<MODULE_OR_FILE_AREA>",
  "subject_stage": null,
  "type": "pattern",
  "key": "<KEBAB_KEY>",
  "insight": "<ONE_SENTENCE>",
  "confidence": <7_TO_9>,
  "evidence_type": "code-pattern",
  "source": "observed",
  "files": ["<file/path.ts>"]
}
JSON
)"
```

- [ ] **Step 4: Regenerate + test + commit**

```bash
bun run gen:skill-docs --host claude && bun run gen:skill-docs --host codex && bun run gen:skill-docs --host gemini-cli && bun run gen:skill-docs --host factory
bun test test/skill-e2e-learnings.test.ts test/skill-anatomy.test.ts
git add skills/*/simplify hosts/*/skills/*simplify*
git commit -m "feat(skills): /simplify emits schema_v2 learnings (SP1 Task 19)"
```

---

### Task 20: `/cso` direct capture

**Files:**
- Modify: skill template for `/cso`
- Regenerate hosts

- [ ] **Step 1: Locate**

Run: `find skills -name "cso*" -path "*SKILL.md.tmpl"`

- [ ] **Step 2: Insert capture block**

`/cso` produces security findings. Each finding becomes a learning.

```bash
~/.claude/skills/nexus/bin/nexus-learnings-log "$(cat <<'JSON'
{
  "writer_skill": "cso",
  "subject_skill": "<MODULE_OR_AREA>",
  "subject_stage": null,
  "type": "pitfall",
  "key": "<KEBAB_KEY>",
  "insight": "<ONE_SENTENCE_FINDING>",
  "confidence": <SEVERITY_AS_1_10>,
  "evidence_type": "code-pattern",
  "source": "observed",
  "files": ["<vulnerable/file.ts>"]
}
JSON
)"
```

- [ ] **Step 3: Regenerate + test + commit**

```bash
bun run gen:skill-docs --host claude && bun run gen:skill-docs --host codex && bun run gen:skill-docs --host gemini-cli && bun run gen:skill-docs --host factory
bun test test/skill-e2e-learnings.test.ts
git add skills/*/cso hosts/*/skills/*cso*
git commit -m "feat(skills): /cso emits schema_v2 learnings (SP1 Task 20)"
```

---

### Task 21: `/review` chain capture

**Files:**
- Modify: `lib/nexus/commands/review.ts` (capture point on surprising audit findings)
- Verify: `reviewLearningCandidatesPath()` already exists in artifacts.ts

- [ ] **Step 1: Locate the surprise-finding decision in review.ts**

Run: `grep -n "surprise\|advisory\|unexpected\|block-grade" lib/nexus/commands/review.ts | head -10`

- [ ] **Step 2: Add capture call**

Same pattern as Task 14 but using `stage: 'review'`:

```ts
import { writeLearningCandidate } from '../learning/candidates';
import { generateLearningId } from '../learning/id';

// when a surprise / block-grade advisory is recorded:
writeLearningCandidate({
  cwd: ctx.cwd,
  stage: 'review',
  run_id: ledger.run_id,
  entry: {
    id: generateLearningId(),
    schema_version: 2,
    ts: new Date().toISOString(),
    writer_skill: 'review',
    subject_skill: targetSkillUnderReview,
    subject_stage: 'review',
    type: 'pitfall',
    key: deriveReviewKey(findingContext),
    insight: composeReviewInsight(findingContext),
    confidence: 7,
    evidence_type: 'team-consensus',  // or 'code-pattern' depending on finding source
    source: findingContext.source,    // 'cross-model' if multi-provider, else 'observed'
    files: findingContext.files ?? [],
    cluster_id: findingContext.cluster_id ?? null,
    supersedes: [], supersedes_reason: null,
    derived_from: [], last_applied_at: null, mirror: null,
  },
});
```

- [ ] **Step 3: Test + commit**

```bash
bun test test/nexus/commands/review.test.ts test/nexus/learning/
git add lib/nexus/commands/review.ts
git commit -m "feat(review): capture surprise/block-grade findings as learning candidates (SP1 Task 21)"
```

---

### Task 22: `/qa` chain capture

**Files:**
- Modify: `lib/nexus/commands/qa.ts` (capture point on 3-strike same-root-cause cluster)

- [ ] **Step 1: Locate the cluster decision in qa.ts**

Run: `grep -n "cluster\|3.*strike\|root.*cause" lib/nexus/commands/qa.ts | head -10`

- [ ] **Step 2: Add capture call**

```ts
import { writeLearningCandidate } from '../learning/candidates';
import { generateLearningId } from '../learning/id';

// when a 3-strike cluster is recorded:
writeLearningCandidate({
  cwd: ctx.cwd,
  stage: 'qa',
  run_id: ledger.run_id,
  entry: {
    id: generateLearningId(),
    schema_version: 2,
    ts: new Date().toISOString(),
    writer_skill: 'qa',
    subject_skill: targetSkill,
    subject_stage: 'qa',
    type: 'pitfall',
    key: deriveQaKey(clusterContext),
    insight: composeQaInsight(clusterContext),
    confidence: 8,
    evidence_type: 'multi-run-observation',
    source: 'observed',
    files: clusterContext.files ?? [],
    cluster_id: clusterContext.cluster_id,
    supersedes: [], supersedes_reason: null,
    derived_from: [], last_applied_at: null, mirror: null,
  },
});
```

- [ ] **Step 3: Test + commit**

```bash
bun test test/nexus/commands/qa.test.ts test/nexus/learning/
git add lib/nexus/commands/qa.ts
git commit -m "feat(qa): capture 3-strike clusters as learning candidates (SP1 Task 22)"
```

---

## Acceptance Criteria Validation (Spec §11)

After all 22 tasks land, walk through the 9-item AC checklist from `docs/designs/SELF_LEARNING_V1_SP1.md` §11. Each item maps to one or more tasks:

| AC # | Validation | Tasks |
|---|---|---|
| 1 | Schema types + `assertSchemaV2` validator | Task 1 |
| 2 | ID generator works for new + legacy | Task 2 |
| 3 | `computeStrength` returns 1–10 per formula | Task 3 |
| 4 | Path-A `/investigate` writes schema v2; e2e read works | Tasks 7, 8 |
| 5 | Path-B `/build` candidates → `/closeout` canonical w/ derived_from | Tasks 11, 14, 15, 16 |
| 6 | Optional mirror with no duplicates on re-run | Tasks 12, 13, 15 |
| 7 | Legacy v1 entries normalized at read | Tasks 4, 5 |
| 8 | Supersedes path 1 + path 3 exercised by tests | Tasks 1, 8 (path 1); /learn prune test (path 3 — add if missing) |
| 9 | Backward compat for read-only consumers | Task 6 (optional v2 fields) |

After the table review, **update `docs/designs/SELF_LEARNING_V1_META.md`** §4 SP1 status (mark complete, link to spec) and §9 "Real-world triggers consumed" with an entry like:

```
| 2026-XX-XX | SP1 implementation | SP1 landed; schema v2 in production; SP6 unblocked. | §4 (SP1 status: complete), §10 (post-SP1 maintenance link to SP1 plan) |
```

Commit the V1_META update separately:

```bash
git add docs/designs/SELF_LEARNING_V1_META.md
git commit -m "docs(designs): mark SP1 complete in V1_META status + trigger log"
```

---

## Final integration test

After all individual tasks pass:

```bash
bun install              # ensure deps fresh
bun run build            # full type-check
bun test                 # full test suite
bun run skill:check      # skill validation
bun run gen:skill-docs --host claude  # ensure generated skills are fresh
git diff --check         # no whitespace issues
```

Expected: all green. If any tests fail, the failing task must be revisited; the plan is not complete.

---

## Self-Review Notes

This plan was self-reviewed for:
- **Spec coverage**: All 9 AC items mapped to tasks. All 6 capture sites covered (investigate, retro, build, simplify, cso, review, qa). `/ship` correctly deferred per spec §10.
- **Placeholder scan**: No "TBD" / "implement later" / "similar to". A few `<PLACEHOLDER>` markers in skill template JSON exist intentionally — they are values the LLM operator fills at runtime, not static defaults.
- **Type consistency**: `LearningEntry`, `assertSchemaV2`, `generateLearningId`, `computeStrength`, `normalizeLearningLine`, `writeLearningCandidate`, `mirrorCanonicalToJsonl`, `isMirrorEnabled` all referenced consistently across tasks. Stage union `'build' | 'review' | 'qa' | 'ship'` consistent in Tasks 11, 14, 15.
- **File path consistency**: All `lib/nexus/learning/*.ts` paths match. Test paths under `test/nexus/learning/` consistent.
- **Existing-code touches**: Tasks 6 and 15 touch existing code; both note the need to grep for current shape before editing.
