# Track D-D3 Phase 3 Brief: stage-aware advisor

**Status:** Ready for implementation. Scope: query SkillRegistry by lifecycle stage and surface relevant skills in completion-advisor records. Schema (Phase 2.a, PR #91) and registry consumption (Phase 2.b, #74) must land first; built-in manifests (Phase 4, #78) recommended but not strictly required.

**Type:** New module + writer integration. Behavioral change: completion records grow a `recommended_skills` array.

**Parent plan:** `docs/architecture/track-d-d3-rfc.md` § Phase 3.3 (Component 3: stage-aware advisor (B)).
**Predecessors:**
- Phase 2.a: PR #91 ✅ landed — schema + parser
- Phase 2.b: brief at `track-d-d3-phase-2-2-brief.md`, issue #74 — registry consumes manifests
- Phase 4: brief at `track-d-d3-phase-4-brief.md`, issue #78 — 28 native manifests authored

**Issue:** #77.

---

## Goal

After every stage write (`/build`, `/review`, `/qa`, etc.), the completion-advisor consults the SkillRegistry for skills whose `manifest.lifecycle_stages` contains the just-completed stage, ranks them, and surfaces the top-N as `recommended_skills` in the artifact record.

When this lands:
- User completing `/build` sees in the advisor record: "Next, consider `/qa` (canonical) or `simplify` (support, score 7)"
- The recommendations are **manifest-driven** (no heuristic guessing) for skills with manifests
- Skills without manifests still appear via Phase 1 heuristic fallback (degraded but functional)
- Cross-stage skills (e.g., `simplify` declared `[build, review]`) appear in both stages
- This is the **user-facing payoff** of the entire D3 track — the moment Nexus actively cooperates with the skill ecosystem instead of just listing skills

---

## Strategic framing

Phase 1 made the registry exist. Phase 2.a made the manifest contract explicit. Phase 2.b made the registry read manifests. Phase 4 wrote manifests for Nexus's own skills.

**Phase 3 is where it all becomes user-visible.** Until this lands, the user has no way to feel the upgrade — the registry is enriched but nothing surfaces it.

This brief is intentionally **conservative on scope**: only the stage-completion advisor path. The richer `/nexus do "..."` dispatcher (Phase 5) consumes the same registry data but operates pre-stage, and is a separate brief.

---

## Surface map

### Files to create

```
lib/nexus/completion-advisor/
└── stage-aware-advisor.ts   ← new module
```

### Files to modify

```
lib/nexus/completion-advisor/
├── writer.ts                ← integrate stage-aware-advisor at write time
└── ... (resolver.ts and other files unchanged)

lib/nexus/types.ts            ← add RecommendedSkill type to advisor record schema
```

### Files NOT to modify

- `lib/nexus/skill-registry/*` — frozen; this phase only **consumes** the registry API
- `lib/nexus/completion-advisor/resolver.ts` — read-side; advisor is write-side
- `lib/nexus/completion-advisor.ts` (thin shim) — re-exports automatically pick up new exports
- Stage-pack files in `lib/nexus/stage-packs/` — this phase doesn't touch stage-pack contracts

---

## Data flow

```
[stage write happens]
       │
       ▼
writer.ts (existing)
  ├─ writes the stage artifact
  ├─ calls completion-advisor builder (existing)
  └─ NEW: calls stageAwareAdvisor(stage, context)
            │
            ▼
       stage-aware-advisor.ts
         ├─ skillRegistry.findForLifecycleStage(stage, context)  ← Phase 2.b API
         ├─ filter by score threshold
         ├─ apply surface budget (top N)
         ├─ format each as { name, surface, why_relevant, score }
         └─ return RecommendedSkill[]
                       │
                       ▼
       writer.ts merges into completion record:
         { ...record, recommended_skills: RecommendedSkill[] }
                       │
                       ▼
       (advisor record written to .planning/<run>/<stage>/advisor.json)
```

The advisor module is a **pure function** of (stage, context) → suggestions. No I/O of its own. Easy to test with mocked registry.

---

## Schema additions

### `RecommendedSkill` (in `lib/nexus/types.ts`)

```typescript
export interface RecommendedSkill {
  /** Canonical skill name (matches SKILL.md frontmatter). */
  name: string;

  /** Slash-form for display: "/qa" or "/cso". */
  surface: string;

  /** Manifest namespace, propagated for clients. */
  namespace: NexusSkillNamespace;

  /** Manifest summary or fallback (heuristic-derived for skills without manifests). */
  summary: string;

  /** Why this stage triggered this skill: human-readable. */
  why_relevant: string;

  /** Final ranking score (post manifest boosts). */
  score: number;

  /** Whether this came from a manifest (true) or heuristic fallback (false). */
  manifest_backed: boolean;
}
```

### Advisor record extension

Add field to the existing completion-advisor record type:

```typescript
export interface CompletionAdvisorRecord {
  // ... existing fields (run_id, stage, status, etc.)

  /**
   * Stage-aware skill recommendations populated by stage-aware-advisor.
   * Empty array when no skills match the stage or when the registry is unavailable.
   * Sorted by score descending.
   */
  recommended_skills?: RecommendedSkill[];
}
```

The field is **optional** for backwards compatibility — existing readers that don't know about it ignore it cleanly. Phase 4.4 cleanup (or a later doc-pass phase) can mark the field "always present after Phase 3" and remove the optional marker.

---

## Implementation procedure

### Step 1: Add types

`lib/nexus/types.ts`:
- Add `RecommendedSkill` interface
- Extend `CompletionAdvisorRecord` with optional `recommended_skills`
- Export the new types

### Step 2: Implement `stageAwareAdvisor()`

Create `lib/nexus/completion-advisor/stage-aware-advisor.ts`:

```typescript
import type { NexusLifecycleStage } from '../types';
import type { SkillRegistry, SkillRecord } from '../skill-registry';
import type { RecommendedSkill } from '../types';

export interface StageAwareAdvisorOptions {
  registry: SkillRegistry;
  stage: NexusLifecycleStage;
  context: {
    runId: string;
    /** Free-form tags from the just-completed stage's frontmatter (e.g., 'security', 'design'). */
    tags?: string[];
    /** Operator persona — currently always 'solo'; reserved for Phase 5 team mode. */
    persona?: 'solo';
  };
  /** Top-N to surface. Default 5. */
  limit?: number;
  /** Minimum score to include. Default 1 (filter out base-rank-0 noise). */
  minScore?: number;
}

export function stageAwareAdvisor(opts: StageAwareAdvisorOptions): RecommendedSkill[] {
  const { registry, stage, context, limit = 5, minScore = 1 } = opts;

  const candidates = registry.findForLifecycleStage(stage, {
    runId: context.runId,
    tags: context.tags ?? [],
    stage,
  });

  return candidates
    .filter((c) => c.score >= minScore)
    .slice(0, limit)
    .map((c) => toRecommendedSkill(c, stage));
}

function toRecommendedSkill(record: SkillRecord, stage: NexusLifecycleStage): RecommendedSkill {
  const manifestBacked = record.manifest !== undefined;
  return {
    name: record.name,
    surface: `/${record.name}`,
    namespace: record.namespace,
    summary: record.manifest?.summary ?? record.description ?? '',
    why_relevant: deriveWhyRelevant(record, stage),
    score: record.score ?? 0,
    manifest_backed: manifestBacked,
  };
}

function deriveWhyRelevant(record: SkillRecord, stage: NexusLifecycleStage): string {
  const stages = record.manifest?.lifecycle_stages;
  if (stages && stages.includes(stage)) {
    return `Declared as relevant to ${stage} stage in nexus.skill.yaml.`;
  }
  return `Heuristic match (no manifest) for ${stage} stage.`;
}
```

**Design notes**:
- Pure function over registry API — no I/O, no globals, no env reads
- Default budget = 5 skills (configurable)
- Default minScore = 1 (filter out heuristic noise)
- Returns empty array if no candidates — caller handles "no suggestions" naturally
- `manifest_backed: false` is honest about heuristic fallback for unmanifested skills

### Step 3: Wire into `writer.ts`

Find the end-of-stage write logic in `writer.ts`. After the existing record is built but before persistence:

```typescript
// existing
const record = buildStageRecord(...);

// NEW
import { stageAwareAdvisor } from './stage-aware-advisor';
import { getSkillRegistry } from '../skill-registry';

const recommendations = stageAwareAdvisor({
  registry: getSkillRegistry(),
  stage,
  context: {
    runId: ctx.runId,
    tags: stageFrontmatter.tags ?? [],
  },
});

const enriched = { ...record, recommended_skills: recommendations };

// existing write path
writeAdvisorRecord(enriched);
```

`getSkillRegistry()` is the singleton accessor exposed by `lib/nexus/skill-registry/index.ts` (Phase 1).

### Step 4: Test cases (in `test/nexus/stage-aware-advisor.test.ts`)

#### Behavior tests

1. **Single matching skill** — registry has 1 skill with `lifecycle_stages: [build]`; advisor returns it for stage `build`.

2. **Multiple matching skills** — 3 skills declare `build`; all 3 returned, sorted by score descending.

3. **Cross-stage skill** — skill declares `[build, review]`; appears in both stages' advisor calls.

4. **Non-matching skill excluded** — skill declares `[discover]`; does NOT appear in `build` advisor call.

5. **No-manifest fallback** — skill has SKILL.md but no nexus.skill.yaml; appears with `manifest_backed: false` and `why_relevant` says "heuristic match".

6. **Score threshold** — set `minScore: 5`; skills with score 3 excluded; skills with score 7 included.

7. **Surface budget** — registry has 10 matching skills; with `limit: 3`, only top 3 returned.

8. **Empty registry** — registry has 0 skills; advisor returns `[]`.

9. **Empty matching set** — registry has skills but none for stage; advisor returns `[]`.

#### Integration tests (with mock writer)

10. **`writer.ts` populates `recommended_skills`** — invoke writer for a `build` stage write; assert resulting record has `recommended_skills` array.

11. **Empty recommendations are persisted as `[]`** — even when no candidates, the field is present (not omitted) so consumers know "no recommendations" vs "didn't run".

#### Schema tests

12. **`RecommendedSkill` shape** — every field present and typed correctly per the schema interface.

### Step 5: Documentation

Update `docs/skill-manifest-schema.md` (created in Phase 2.a; updated in 2.b) to add:
- Section on how stage-aware advisor consumes the manifest's `lifecycle_stages` field
- Worked example: a skill author declaring `[build, review]` and what the advisor does with it

### Step 6: Verification

```bash
bun test test/nexus/stage-aware-advisor.test.ts   # all 12 cases pass
bun test test/nexus/completion-advisor.test.ts    # existing tests still pass (writer integration)
bun test                                           # all green
bun run skill:check                                # clean
bun run scripts/repo-path-inventory.ts             # regen + commit
```

---

## Acceptance criteria

This brief is complete when:

1. ✅ `lib/nexus/completion-advisor/stage-aware-advisor.ts` exists with `stageAwareAdvisor()` exported
2. ✅ `lib/nexus/types.ts` extended with `RecommendedSkill` + `CompletionAdvisorRecord.recommended_skills`
3. ✅ `writer.ts` calls advisor at end-of-stage write
4. ✅ `test/nexus/stage-aware-advisor.test.ts` exists with at least 12 enumerated cases, all passing
5. ✅ Existing `completion-advisor.test.ts` unchanged + still passing (advisor field is optional add)
6. ✅ Empty `recommended_skills` arrays correctly persist (not undefined)
7. ✅ `manifest_backed: false` correctly populated for heuristic-fallback skills
8. ✅ `bun test` green
9. ✅ `bun run skill:check` clean
10. ✅ `repo-path-inventory.md` regenerated
11. ✅ Documentation page updated with stage-aware advisor behavior

---

## Out of scope (deferred)

- **`/nexus do <intent>` dispatcher** (Phase 5) — pre-stage routing; consumes registry differently
- **External skill manifest catalog** (Phase 2.3 / Δ1) — separate brief
- **Persona-aware advisor** (Phase 5 team mode) — currently `persona: 'solo'` is the only supported value; pair/team logic is parked
- **LLM-mediated relevance scoring** — heuristic + manifest scores only; no LLM in advisor path
- **Surface in user-visible host output** — this phase populates the artifact record; how Claude/Codex/Gemini hosts surface it to the user is a separate UI concern (potentially Phase 6 docs)
- **Cross-stage history awareness** — advisor is stateless across stage transitions; history-aware ranking (e.g., "user already ran simplify, don't suggest again") is future work
- **Adversarial test against bad manifests** — Phase 2.a parser already filters those out before they reach the registry

---

## Effort estimate

**~3-4 hours** total:
- 30 min: types extension
- 60 min: `stage-aware-advisor.ts` module
- 30 min: `writer.ts` integration
- 60-90 min: 12 test cases (with fixtures + mock registry)
- 30 min: documentation update
- 15 min: inventory regen + verification

Smaller than Phase 4 (which had ~37 manifests to author). This phase is **glue + testing** with the schema and registry already frozen.

---

## Risk register

| Risk | Mitigation |
|---|---|
| `getSkillRegistry()` singleton not initialized at writer time | Initialize lazily on first call; if registry not loaded, return `[]` (no recommendations) — empty graceful fallback |
| Tests for #91-blocked behavior fail because Phase 2.a parser changes | Pin manifest test fixtures to v1 schema; regen if Phase 2.a evolves |
| Score thresholds produce too many / too few suggestions in practice | Defaults are conservative (limit 5, minScore 1); easy to tune in a follow-up |
| `manifest_backed: false` for heuristic-derived skills creates inconsistent rankings | Phase 2.b's heuristic ranking still produces meaningful scores; the boolean is a transparency signal, not a ranking input |
| Tests rely on Phase 4 manifest content but Phase 4 isn't merged yet | Use **mock manifests** in tests instead of real Phase 4 manifests; Phase 3 is testable independently of Phase 4's content |
| `recommended_skills` field shape changes when Phase 5 dispatcher needs it | Field is optional; Phase 5 can extend without breaking Phase 3 readers |

---

## Decision points (resolved before implementation)

| Decision | Resolution | Rationale |
|---|---|---|
| Where lives the advisor? | `lib/nexus/completion-advisor/stage-aware-advisor.ts` | Closest to writer integration; advisor IS part of completion-advisor surface |
| Surface budget default | 5 | Empirical; 3 too few when stage has multiple genuinely relevant skills (e.g., `build`); 10+ noisy |
| Score threshold default | 1 | Filters base-rank-0 heuristic noise without losing manifest-declared 0-score skills (manifests give explicit base scores) |
| Empty `recommended_skills` representation | Empty array `[]`, not omitted | Distinguishes "advisor ran, no candidates" from "advisor didn't run" |
| Sync vs async advisor | Sync | Advisor is pure data transform; no I/O; sync is simpler and matches writer's existing flow |
| Persona awareness | Not yet — `solo` only | Parked in Phase 5 team mode; advisor signature accepts `persona` field already so no future API break |
| Field optionality on advisor record | Optional | Backwards-compat for existing readers; can be made required in a future phase |
| Wire into Phase 1 fallback heuristic? | Yes, transparently | Skills without manifest still appear via Phase 1 ranking; `manifest_backed: false` tags them honestly |

---

## References

- `docs/architecture/track-d-d3-rfc.md` § Phase 3.3 (Component 3: stage-aware advisor — parent)
- `docs/architecture/track-d-d3-phase-2-brief.md` (Phase 2.a — schema; predecessor)
- `docs/architecture/track-d-d3-phase-2-2-brief.md` (Phase 2.b — registry consumption; predecessor)
- `docs/architecture/track-d-d3-phase-4-brief.md` (Phase 4 — manifests; recommended predecessor)
- `lib/nexus/skill-registry/index.ts` (Phase 1 — `findForLifecycleStage()` API used here)
- `lib/nexus/completion-advisor/writer.ts` (integration point)
- `lib/nexus/completion-advisor/resolver.ts` (Phase 2 of #41 — sibling, untouched)
- Issue #77 (this brief implements)
- Issue #74 (Phase 2.b — must land first)
- Issue #65 (Phase 2.a — done via PR #91)
- Issue #78 (Phase 4 — recommended but not strictly required)

---

## Acceptance criteria for this brief itself

This document is complete when:

1. ✅ Goal stated with concrete behavioral outcome
2. ✅ Strategic framing (this is where D3 becomes user-visible)
3. ✅ Surface map (files to create / modify / NOT modify)
4. ✅ Data flow diagram with module boundaries
5. ✅ Schema additions specified (`RecommendedSkill` + `CompletionAdvisorRecord` extension)
6. ✅ 6-step implementation procedure
7. ✅ 12 enumerated test cases
8. ✅ Acceptance criteria (11 items)
9. ✅ Out-of-scope deferrals named (Phase 5 dispatcher, persona, LLM, etc.)
10. ✅ Effort estimate broken down per step
11. ✅ Decision points resolved (8 items)
12. ✅ Risk register
13. ✅ References cross-link parent RFC + 3 predecessor briefs

This brief is ready for implementation by Codex (or human) without further design clarification, **provided** Phase 2.b (#74) lands first. Phase 4 (#78) is recommended but not strictly required — tests use mock manifests.
