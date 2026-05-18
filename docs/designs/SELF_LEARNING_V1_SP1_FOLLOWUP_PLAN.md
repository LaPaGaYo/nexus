# SP1 Follow-up: Shared Readers + Decay Primitive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 2 SP6-readiness contract gaps found in post-SP1 verification, by **behavior-preserving extraction** of already-existing logic into shared, barreled primitives — so SP6 (and existing callers) read learnings + compute recency-decay through ONE path with zero reimplementation/drift.

**Architecture:** Pure extraction, no new behavior. Gap 2: the 30-day confidence-decay rule lives only as inline JS-in-bash in `bin/nexus-learnings-search` → extract to `lib/nexus/learning/decay.ts` (mirrors the existing `strength.ts` shared-primitive pattern from SP1 Task 3). Gap 1: file-level readers for the 3 storage surfaces are trapped in `observability/learnings.ts` (unbarreled) + `closeout.ts` (private) + bash → consolidate the pure file-I/O layer into `lib/nexus/learning/read.ts`, then redirect existing callers so promotion logic and SP6 share one reader. Existing `closeout` + `nexus-learnings-search` tests staying green at every step is the proof of behavior preservation.

**Tech Stack:** Bun + TypeScript, `bun test`, Bash helper `bin/nexus-learnings-search`. Worktree `/Users/henry/Documents/nexus/.claude/worktrees/sp1-followup`, branch `sp1-followup-readers-decay`, forked from main `08e82a0` (SP1 merged).

**Source:** Post-SP1 SP6-readiness verification (this session). No spec doc — the verification *is* the spec; this plan is the executable form.

---

## Scope Check

Single coherent subsystem: "shared read/decay primitives for the learning module." 6 tasks, ≈ SP1 Tasks 10-13 footprint. Not multi-subsystem; one plan is correct.

## File Structure

### NEW

| Path | Responsibility |
|---|---|
| `lib/nexus/learning/decay.ts` | `computeEffectiveConfidence(entry, now?)` — the single recency-decay primitive (mirrors `strength.ts`) |
| `lib/nexus/learning/read.ts` | Pure file-level readers for the 3 surfaces (jsonl / stage-candidates / canonical / archive-walk). Imports `collectValidLearningCandidates` from `observability/learnings.ts` — does NOT duplicate the validator |
| `test/nexus/learning/decay.test.ts` | decay unit tests |
| `test/nexus/learning/read.test.ts` | reader unit tests |

### MODIFIED

| Path | Change |
|---|---|
| `bin/nexus-learnings-search` | Replace inline decay block with `decay.ts` import (Task B); replace inline archive-runs walk with `read.ts` `walkArchiveRunLearnings` (Task E) |
| `lib/nexus/commands/closeout.ts` | `readLearningCandidatesSource` delegates file-parse to `read.ts` `readStageCandidatesFile`; closeout's run_id/stage/schema gating stays in closeout (Task D) |
| `lib/nexus/index.ts` | Barrel decay + read public surface (Task F) |
| `test/nexus/barrel-surface.test.ts` | Extend positive pin (Task F) |

### Reader boundary (locked decision — do not redesign)

`read.ts` = **pure file I/O + parse + validate-candidates**. It returns the raw record (`StageLearningCandidatesRecord` / `RunLearningsRecord`) or `null`/`[]` on missing/malformed. It does **NOT** do closeout's run_id/stage/non-empty gating, and it does **NOT** touch `collectRunLearnings`/`renderRunLearningsMarkdown` (those are closeout promotion/dedup domain — OUT OF SCOPE, unchanged). closeout keeps its gating, layered on top of `read.ts`'s parse.

---

## Task A: `decay.ts` — shared recency-decay primitive

**Files:**
- Create: `lib/nexus/learning/decay.ts`
- Test: `test/nexus/learning/decay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/decay.test.ts
import { describe, test, expect } from 'bun:test';
import { computeEffectiveConfidence } from '../../../lib/nexus/learning/decay';

const DAY = 86_400_000;
function entry(over: Partial<{ confidence: number; source: string; ts: string }> = {}) {
  return {
    confidence: 8,
    source: 'observed' as const,
    ts: new Date(0).toISOString(),
    ...over,
  } as { confidence: number; source: 'observed' | 'inferred' | 'cross-model' | 'user-stated' | 'team-consensus' | 'external-reference' | 'speculation' | 'unknown'; ts: string };
}

describe('computeEffectiveConfidence', () => {
  test('observed decays 1pt per 30 full days', () => {
    const now = 75 * DAY; // 75 days → floor(75/30) = 2 lost
    expect(computeEffectiveConfidence(entry({ confidence: 8, source: 'observed', ts: new Date(0).toISOString() }), now)).toBe(6);
  });

  test('inferred decays the same way', () => {
    const now = 60 * DAY; // floor(60/30) = 2
    expect(computeEffectiveConfidence(entry({ confidence: 9, source: 'inferred', ts: new Date(0).toISOString() }), now)).toBe(7);
  });

  test('non observed/inferred sources do NOT decay', () => {
    const now = 365 * DAY;
    for (const s of ['cross-model', 'user-stated', 'team-consensus', 'external-reference', 'speculation', 'unknown'] as const) {
      expect(computeEffectiveConfidence(entry({ confidence: 7, source: s, ts: new Date(0).toISOString() }), now)).toBe(7);
    }
  });

  test('exactly 30 days = 1pt lost; 29 days = 0 lost', () => {
    expect(computeEffectiveConfidence(entry({ confidence: 5, source: 'observed', ts: new Date(0).toISOString() }), 30 * DAY)).toBe(4);
    expect(computeEffectiveConfidence(entry({ confidence: 5, source: 'observed', ts: new Date(0).toISOString() }), 29 * DAY)).toBe(5);
  });

  test('floors at 0, never negative', () => {
    expect(computeEffectiveConfidence(entry({ confidence: 2, source: 'observed', ts: new Date(0).toISOString() }), 365 * DAY)).toBe(0);
  });

  test('missing/zero confidence defaults to 5 before decay', () => {
    expect(computeEffectiveConfidence(entry({ confidence: 0, source: 'team-consensus', ts: new Date(0).toISOString() }), 0)).toBe(5);
    // 0 confidence + observed + 60 days → 5 then floor(60/30)=2 → 3
    expect(computeEffectiveConfidence(entry({ confidence: 0, source: 'observed', ts: new Date(0).toISOString() }), 60 * DAY)).toBe(3);
  });

  test('now defaults to Date.now() when omitted', () => {
    const recent = new Date(Date.now() - 5 * DAY).toISOString();
    expect(computeEffectiveConfidence(entry({ confidence: 6, source: 'observed', ts: recent }))).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./test/nexus/learning/decay.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement decay.ts**

```ts
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
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test ./test/nexus/learning/decay.test.ts`
Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/learning/decay.ts test/nexus/learning/decay.test.ts
git commit -m "feat(learning): extract recency-decay as shared primitive (SP1-followup Task A)"
```

---

## Task B: redirect `nexus-learnings-search` to `decay.ts`

**Files:**
- Modify: `bin/nexus-learnings-search`

- [ ] **Step 1: Capture green baseline**

Run: `bun test ./test/learnings.test.ts ./test/skill-e2e-learnings.test.ts`
Record pass counts (must be identical after this task — behavior-preserving).

- [ ] **Step 2: Locate the inline decay block**

Run: `grep -n "Apply confidence decay\|_effectiveConfidence\|86400000\|computeStrength" bin/nexus-learnings-search`

The block reads (inside the `bun -e` heredoc, after `normalizeLearningLine`):

```js
  // Apply confidence decay: observed/inferred lose 1pt per 30 days
  let conf = e.confidence || 5;
  if (e.source === 'observed' || e.source === 'inferred') {
    const days = Math.floor((now - new Date(e.ts).getTime()) / 86400000);
    conf = Math.max(0, conf - Math.floor(days / 30));
  }
  e._effectiveConfidence = conf;
```

The heredoc already imports siblings, e.g.:
`const { computeStrength } = await import('${SCRIPT_ROOT}/lib/nexus/learning/strength.ts');`

- [ ] **Step 3: Add the decay import + replace the inline block**

Add to the imports area of the `bun -e` heredoc (next to the existing `normalize`/`strength` imports):

```js
const { computeEffectiveConfidence } = await import('${SCRIPT_ROOT}/lib/nexus/learning/decay.ts');
```

Replace the 7-line inline decay block above with:

```js
  e._effectiveConfidence = computeEffectiveConfidence(e, now);
```

Leave everything else (the `_crossProject` line, `_strength = computeStrength(e)`, dedup, sort, output) untouched.

- [ ] **Step 4: Run tests — must match baseline exactly**

Run: `bun test ./test/learnings.test.ts ./test/skill-e2e-learnings.test.ts`
Expected: identical pass counts to Step 1 (no behavior change — same decay math, now shared).

Also smoke: `NEXUS_STATE_DIR=$(mktemp -d) bin/nexus-learnings-search; echo "exit:$?"` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-learnings-search
git commit -m "refactor(learning): nexus-learnings-search uses shared decay primitive (SP1-followup Task B)"
```

---

## Task C: `read.ts` — shared file-level readers

**Files:**
- Create: `lib/nexus/learning/read.ts`
- Test: `test/nexus/learning/read.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/nexus/learning/read.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  readLearningsJsonl,
  readStageCandidatesFile,
  readCanonicalLearningsFile,
  walkArchiveRunLearnings,
} from '../../../lib/nexus/learning/read';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'sp1fu-read-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('readLearningsJsonl', () => {
  test('reads + normalizes lines, skips malformed (fail-soft)', () => {
    const p = join(dir, 'learnings.jsonl');
    writeFileSync(p, [
      JSON.stringify({ ts: '2026-04-01T00:00:00Z', skill: 'retro', type: 'pattern', key: 'k1', insight: 'i1', confidence: 7, source: 'observed', files: [] }),
      'not json',
      '',
      JSON.stringify({ ts: '2026-04-02T00:00:00Z', skill: 'investigate', type: 'pitfall', key: 'k2', insight: 'i2', confidence: 8, source: 'observed', files: [] }),
    ].join('\n'));
    const out = readLearningsJsonl(p);
    expect(out).toHaveLength(2);
    expect(out.map(e => e.key).sort()).toEqual(['k1', 'k2']);
  });

  test('missing file → []', () => {
    expect(readLearningsJsonl(join(dir, 'nope.jsonl'))).toEqual([]);
  });
});

describe('readStageCandidatesFile', () => {
  test('reads a valid v2 stage record', () => {
    const p = join(dir, 'learning-candidates.json');
    writeFileSync(p, JSON.stringify({
      schema_version: 2, run_id: 'r1', stage: 'build', generated_at: '2026-05-12T00:00:00Z',
      candidates: [{ type: 'pitfall', key: 'k', insight: 'i', confidence: 7, source: 'observed', files: [] }],
    }));
    const rec = readStageCandidatesFile(p);
    expect(rec?.schema_version).toBe(2);
    expect(rec?.stage).toBe('build');
    expect(rec?.candidates).toHaveLength(1);
  });

  test('missing file → null', () => {
    expect(readStageCandidatesFile(join(dir, 'nope.json'))).toBeNull();
  });

  test('malformed json → null (fail-soft)', () => {
    const p = join(dir, 'bad.json');
    writeFileSync(p, '{ not valid');
    expect(readStageCandidatesFile(p)).toBeNull();
  });
});

describe('readCanonicalLearningsFile', () => {
  test('reads a canonical run-learnings record', () => {
    const p = join(dir, 'learnings.json');
    writeFileSync(p, JSON.stringify({
      schema_version: 2, run_id: 'r1', generated_at: '2026-05-12T00:00:00Z',
      source_candidates: ['build'],
      learnings: [{ type: 'pitfall', key: 'k', insight: 'i', confidence: 8, source: 'observed', files: [], origin_stage: 'build' }],
    }));
    const rec = readCanonicalLearningsFile(p);
    expect(rec?.run_id).toBe('r1');
    expect(rec?.learnings).toHaveLength(1);
  });

  test('missing/malformed → null', () => {
    expect(readCanonicalLearningsFile(join(dir, 'nope.json'))).toBeNull();
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, 'nope');
    expect(readCanonicalLearningsFile(bad)).toBeNull();
  });
});

describe('walkArchiveRunLearnings', () => {
  test('collects every .planning/archive/runs/*/closeout/learnings.json', () => {
    const a = join(dir, '.planning/archive/runs/run-a/closeout');
    const b = join(dir, '.planning/archive/runs/run-b/closeout');
    mkdirSync(a, { recursive: true });
    mkdirSync(b, { recursive: true });
    writeFileSync(join(a, 'learnings.json'), JSON.stringify({ schema_version: 2, run_id: 'a', generated_at: 't', source_candidates: [], learnings: [] }));
    writeFileSync(join(b, 'learnings.json'), JSON.stringify({ schema_version: 2, run_id: 'b', generated_at: 't', source_candidates: [], learnings: [] }));
    const recs = walkArchiveRunLearnings(dir);
    expect(recs.map(r => r.run_id).sort()).toEqual(['a', 'b']);
  });

  test('no archive dir → []', () => {
    expect(walkArchiveRunLearnings(join(dir, 'empty'))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test ./test/nexus/learning/read.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement read.ts**

```ts
// lib/nexus/learning/read.ts
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { StageLearningCandidatesRecord, RunLearningsRecord } from '../contracts/types';
import { collectValidLearningCandidates } from '../observability/learnings';
import { normalizeLearningLine, type NormalizedEntry } from './normalize';

/** Read a learnings.jsonl file → normalized entries; malformed lines skipped (fail-soft). */
export function readLearningsJsonl(absPath: string): NormalizedEntry[] {
  if (!existsSync(absPath)) return [];
  const out: NormalizedEntry[] = [];
  for (const line of readFileSync(absPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const e = normalizeLearningLine(line);
    if (e) out.push(e);
  }
  return out;
}

/**
 * Read a stage learning-candidates.json file → record, or null on missing/malformed.
 * Pure parse: candidates validated via collectValidLearningCandidates. Does NOT
 * apply closeout's run_id/stage/non-empty gating (that stays in closeout).
 */
export function readStageCandidatesFile(absPath: string): StageLearningCandidatesRecord | null {
  if (!existsSync(absPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(absPath, 'utf8')) as Partial<StageLearningCandidatesRecord>;
    if (raw.schema_version !== 1 && raw.schema_version !== 2) return null;
    if (typeof raw.run_id !== 'string' || typeof raw.stage !== 'string') return null;
    return {
      schema_version: raw.schema_version,
      run_id: raw.run_id,
      stage: raw.stage,
      generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : '',
      candidates: collectValidLearningCandidates(raw.candidates),
    };
  } catch {
    return null;
  }
}

/** Read a canonical closeout learnings.json → record, or null on missing/malformed. */
export function readCanonicalLearningsFile(absPath: string): RunLearningsRecord | null {
  if (!existsSync(absPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(absPath, 'utf8')) as Partial<RunLearningsRecord>;
    if (raw.schema_version !== 1 && raw.schema_version !== 2) return null;
    if (typeof raw.run_id !== 'string' || !Array.isArray(raw.learnings)) return null;
    return {
      schema_version: raw.schema_version,
      run_id: raw.run_id,
      generated_at: typeof raw.generated_at === 'string' ? raw.generated_at : '',
      source_candidates: Array.isArray(raw.source_candidates) ? raw.source_candidates.map(String) : [],
      learnings: raw.learnings as RunLearningsRecord['learnings'],
    };
  } catch {
    return null;
  }
}

/** Walk .planning/archive/runs/<run>/closeout/learnings.json under repoRoot. */
export function walkArchiveRunLearnings(repoRoot: string): RunLearningsRecord[] {
  const runsDir = join(repoRoot, '.planning', 'archive', 'runs');
  if (!existsSync(runsDir)) return [];
  const out: RunLearningsRecord[] = [];
  for (const runName of readdirSync(runsDir)) {
    const rec = readCanonicalLearningsFile(join(runsDir, runName, 'closeout', 'learnings.json'));
    if (rec) out.push(rec);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `bun test ./test/nexus/learning/read.test.ts`
Expected: all PASS.

- [ ] **Step 5: Confirm no import cycle / build clean**

Run: `bun run build 2>&1 | tail -3`
Expected: clean. (`read.ts` → `observability/learnings.ts` is feature→observability, one-way; `observability/learnings.ts` does not import `lib/nexus/learning/read`.)

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/learning/read.ts test/nexus/learning/read.test.ts
git commit -m "feat(learning): shared file-level readers for 3 storage surfaces (SP1-followup Task C)"
```

---

## Task D: redirect `closeout.ts` file-parse to `read.ts`

**Files:**
- Modify: `lib/nexus/commands/closeout.ts`

- [ ] **Step 1: Capture green baseline**

Run: `bun test ./test/nexus/commands/closeout.test.ts ./test/nexus/commands/closeout-followon.test.ts`
Record pass counts (must be identical after — behavior-preserving).

- [ ] **Step 2: Add import + delegate the parse**

In `lib/nexus/commands/closeout.ts` add to imports:

```ts
import { readStageCandidatesFile } from '../learning/read';
```

`readLearningCandidatesSource` currently does: `existsSync` → `JSON.parse(readFileSync)` → `collectValidLearningCandidates(record.candidates)` → gate on `schema_version 1|2 && run_id===runId && stage===stage && candidates.length>0`. Replace the file-read + parse + candidate-validate portion with a `readStageCandidatesFile` call; KEEP the closeout-domain gating (run_id / stage / non-empty) in closeout:

```ts
function readLearningCandidatesSource(
  cwd: string,
  runId: string,
  path: string,
  stage: CloseoutLearningSource['stage'],
): CloseoutLearningSource | null {
  const record = readStageCandidatesFile(join(cwd, path));
  if (
    record === null
    || record.run_id !== runId
    || record.stage !== stage
    || record.candidates.length === 0
  ) {
    return null;
  }
  return { path, stage, candidates: record.candidates };
}
```

The `schema_version 1|2` allowlist + `collectValidLearningCandidates` now live once, in `read.ts`. closeout keeps its run/stage/non-empty gate. Remove the now-unused `existsSync`/`readFileSync`/`collectValidLearningCandidates` imports from closeout **only if** nothing else in closeout uses them (grep first — `collectRunLearnings`/`renderRunLearningsMarkdown` are still used; `readFileSync`/`existsSync` may be used elsewhere — leave those imports intact if so).

- [ ] **Step 3: Run tests — must match baseline exactly**

Run: `bun test ./test/nexus/commands/closeout.test.ts ./test/nexus/commands/closeout-followon.test.ts ./test/nexus/learning/`
Expected: closeout pass counts identical to Step 1; learning suite green.

- [ ] **Step 4: Build clean**

Run: `bun run build 2>&1 | tail -3`

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/commands/closeout.ts
git commit -m "refactor(closeout): delegate candidate file-parse to shared read.ts (SP1-followup Task D)"
```

---

## Task E: redirect `nexus-learnings-search` archive-walk to `read.ts`

**Files:**
- Modify: `bin/nexus-learnings-search`

> **ACCEPTED CONVERGENCE (decided post-spec-review).** Unlike Tasks B and D,
> Task E is *not* byte-for-byte behavior-preserving on every input. The prior
> inline bash archive reader did a raw `JSON.parse` with **no validation**;
> routing through the shared `walkArchiveRunLearnings` → `readCanonicalLearningsFile`
> adds the canonical `schema_version ∈ {1,2}` + string-`run_id` gate. A
> pre-versioned or `run_id`-less archive file the old path would have ingested
> is now intentionally dropped. This was reviewed and **explicitly accepted as
> the patch's intended anti-drift convergence**: archive ingestion now shares
> the exact validated contract closeout and SP6 use, eliminating the weaker
> second parse path (the whole purpose of this patch). Practical impact is nil
> — real Nexus archives are always closeout-written with `schema_version` +
> `run_id`. Two further incidental deltas are accepted as practically
> unreachable under Nexus run-id semantics: (D2) sort key is the JSON `run_id`
> not the dir name — equal under closeout's `run_id === <dir name>` invariant;
> (D3) `run`-vs-`run-1` ASCII edge — Nexus run ids are unique timestamp/ULID
> values, never a bare `run` adjacent to `run-1`. All proven-equivalent paths
> (a–h, incl. archive-only/no-jsonl, empty, malformed, field mapping, the
> guard change) are unchanged. The convergence + invariants are recorded as a
> runtime-visible comment at the call site in `bin/nexus-learnings-search`.

- [ ] **Step 1: Capture green baseline**

Run: `bun test ./test/learnings.test.ts ./test/skill-e2e-learnings.test.ts`
Record pass counts.

- [ ] **Step 2: Locate the inline archive-runs walk**

Run: `grep -n "archive/runs\|closeout/learnings.json\|archive" bin/nexus-learnings-search`

It currently finds + reads `.planning/archive/runs/*/closeout/learnings.json` inline (bash `find` and/or JS in the heredoc), merging canonical archive entries into the search pool.

- [ ] **Step 3: Replace with `walkArchiveRunLearnings` import**

In the `bun -e` heredoc imports area, add:

```js
const { walkArchiveRunLearnings } = await import('${SCRIPT_ROOT}/lib/nexus/learning/read.ts');
```

Replace the inline archive discovery+read with a call to `walkArchiveRunLearnings(<repo root the script already computes>)`, feeding the returned `RunLearningsRecord[]`'s `learnings` entries into the same downstream pool the inline code fed (preserve the exact merge point + ordering). Do not change dedup/sort/output.

- [ ] **Step 4: Run tests — must match baseline exactly**

Run: `bun test ./test/learnings.test.ts ./test/skill-e2e-learnings.test.ts`
Expected: identical pass counts to Step 1.

Smoke with a fixture archive run if the test infra has one; otherwise the existing e2e covers the merge path.

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-learnings-search
git commit -m "refactor(learning): nexus-learnings-search uses shared archive-walk reader (SP1-followup Task E)"
```

---

## Task F: barrel decay + read surface

**Files:**
- Modify: `lib/nexus/index.ts`
- Modify: `test/nexus/barrel-surface.test.ts`

- [ ] **Step 1: Add to the barrel learning section**

In `lib/nexus/index.ts`, after the existing `export { writeLearningCandidate } from './learning/candidates';` line:

```ts
export { computeEffectiveConfidence } from './learning/decay';
export {
  readLearningsJsonl,
  readStageCandidatesFile,
  readCanonicalLearningsFile,
  walkArchiveRunLearnings,
} from './learning/read';
```

(No new types to export — `read.ts` returns existing `StageLearningCandidatesRecord`/`RunLearningsRecord` from `contracts/types` and `NormalizedEntry` from `normalize`, all already barreled or re-exported.)

- [ ] **Step 2: Extend the barrel-surface positive pin**

Run: `grep -n "writeLearningCandidate\|computeStrength\|shouldBePresent\|positive" test/nexus/barrel-surface.test.ts | head`

Add the 5 new symbols (`computeEffectiveConfidence`, `readLearningsJsonl`, `readStageCandidatesFile`, `readCanonicalLearningsFile`, `walkArchiveRunLearnings`) to the positive-pin list alongside the existing learning exports. Leave the negative pin (`isMirrorEnabled`, `mirrorCanonicalToJsonl` NOT exported) unchanged — those stay internal.

- [ ] **Step 3: Build + barrel test**

Run: `bun run build 2>&1 | tail -3`
Run: `bun test ./test/nexus/barrel-surface.test.ts ./test/nexus/learning/`
Expected: build clean; barrel pin + learning suite green.

- [ ] **Step 4: Full regression sweep**

Run: `bun test ./test/nexus/ 2>&1 | tail -4`
Expected: 0 fail (820+ green — the SP1 baseline plus the new decay/read tests).

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/index.ts test/nexus/barrel-surface.test.ts
git commit -m "feat(learning): barrel decay + read shared primitives for SP6 (SP1-followup Task F)"
```

---

## Self-Review

**Spec coverage:** Gap 2 (decay) → Tasks A+B. Gap 1 (readers) → Tasks C+D+E. Barrel/SP6-consumability → Task F. Both verification gaps fully covered.

**Placeholder scan:** No "TBD"/"similar to"/"add error handling". Tasks B and E say "preserve the exact merge point + ordering" — that is a behavior-preservation instruction, with the green-baseline test as the objective check, not a placeholder.

**Type consistency:** `computeEffectiveConfidence(entry: Pick<LearningEntry,'confidence'|'source'|'ts'>, now?: number): number` — consistent A↔B↔F. `readStageCandidatesFile → StageLearningCandidatesRecord | null`, `readCanonicalLearningsFile → RunLearningsRecord | null`, `readLearningsJsonl → NormalizedEntry[]`, `walkArchiveRunLearnings → RunLearningsRecord[]` — consistent C↔D↔E↔F. `read.ts` imports `collectValidLearningCandidates` from `observability/learnings` (not duplicated), matching the locked reader-boundary decision.

**Behavior-preservation discipline:** Redirect tasks B and D are byte-for-byte behavior-preserving (Step-1 green-baseline + Step-4 "must match exactly", proven by unchanged existing tests AND adversarial branch-by-branch spec review). Task E is behavior-preserving on every reachable Nexus path but deliberately *converges* archive ingestion onto the shared validated canonical reader — see the ACCEPTED CONVERGENCE note in Task E. This was surfaced by adversarial spec review (not hidden), escalated as a decision, and accepted because the validation-tightening *is* the anti-drift goal of this patch; it is documented at both the plan and runtime-comment surface.
