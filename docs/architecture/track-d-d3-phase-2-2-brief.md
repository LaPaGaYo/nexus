# Track D-D3 Phase 2.2 Brief: SkillRegistry consumes `nexus.skill.yaml` manifests

**Status:** Ready for implementation. Scope: registry reads + consumes manifests. Schema + parser already exist (Phase 2.a, brief at `track-d-d3-phase-2-brief.md`).

> **Historical context note (issue #148):** This document was authored
> against an earlier repository layout. Some commands and file paths
> below reference the pre-#142 flat `scripts/` layout — current paths
> live under `scripts/{build,skill,eval,repo,resolvers}/`. The contents
> are kept verbatim for provenance; substitute current paths when
> running commands from this document today.

**Type:** Wire-up. The schema landed in Phase 2.a; this phase makes Nexus actually use it.

**Parent plan:** `docs/architecture/track-d-d3-rfc.md` § Phase 3.2.b.
**Predecessor:** D3 Phase 2.a (issue #65 — schema + parser landing).
**Issue:** #74.

---

## Goal

Wire `nexus.skill.yaml` manifest data into Nexus's three skill-registry
modules — `discovery.ts`, `classification.ts`, `ranking.ts` — so that skills
with manifests get richer routing/classification/ranking treatment, while
skills without manifests fall back to Phase 1's heuristics unchanged.

When this lands, the `SkillRegistry` is no longer a flat scanner — it's a
**manifest-aware skill router**, ready to be consumed by Phase 3 (advisor)
and Phase 5 (`/nexus do` dispatcher).

---

## Strategic framing

This is the moment Nexus stops treating `nexus.skill.yaml` as a *data type
on disk* and starts treating it as a *contract*. After this phase:

- Skill authors who add a manifest get **strictly better integration** than
  authors who don't (richer ranking, declared lifecycle stages, ranked
  per-context boosts).
- Skill authors who don't add a manifest **still work**. The router falls
  through to Phase 1's heuristic classification + ranking.
- Third-party skills (PM Skills, Superpowers, etc.) can opt-in by dropping a
  `nexus.skill.yaml` next to their `SKILL.md` — no change to Nexus needed.

Per Model γ (parent RFC § Strategic framing), this is what enables Nexus to
be a router-not-warehouse: the manifest is the cooperation surface.

---

## Surface map

### Files to modify

```
lib/nexus/skill-registry/
├── discovery.ts          ← read nexus.skill.yaml alongside SKILL.md
├── classification.ts     ← respect manifest.classification.namespace
├── ranking.ts            ← use manifest.ranking.base_score + boosts
├── types.ts              ← extend SkillRecord to carry the manifest
└── index.ts              ← re-export any new public types

test/nexus/
└── skill-registry.test.ts  ← add manifest-aware test cases
```

### Files NOT to modify

- `lib/nexus/skill-registry/manifest-schema.ts` (Phase 2.a) — frozen contract
- `lib/nexus/skill-registry/manifest-parser.ts` (Phase 2.a) — frozen contract
- `lib/nexus/skill-registry/support-skills.ts` — unchanged; built-in support
  list isn't affected by manifest consumption
- `lib/nexus/external-skills.ts` (Phase 1 compat shim) — unchanged
- Any consumer outside `skill-registry/` (advisor, `/nexus do` dispatcher)
  — those land in Phase 3 / Phase 5 separately

---

## Implementation procedure

### Step 1: Extend `SkillRecord` to carry the manifest

In `types.ts`:

```typescript
import type { NexusSkillManifest } from './manifest-schema';

export interface SkillRecord {
  // ... existing fields (name, description, install_root, etc.)

  /**
   * Parsed manifest from nexus.skill.yaml co-located with SKILL.md.
   * undefined if the manifest didn't exist or failed to parse.
   *
   * Consumers should treat undefined as "no Nexus-aware metadata declared"
   * and fall through to heuristics.
   */
  manifest?: NexusSkillManifest;
}
```

The field is **optional** — that's the whole backwards-compat story.

### Step 2: Update `discovery.ts` to read manifests

For each skill discovered, look for `nexus.skill.yaml` alongside `SKILL.md`.
The discovery layer owns the filename convention: `.yaml` is canonical, and
`nexus.skill.yml` is skipped even if present.

```typescript
import { readNexusSkillManifest } from './manifest-parser';

// Inside the existing skill-discovery walk, after locating SKILL.md path:
const skillDir = dirname(skillMdPath);
const manifestPath = join(skillDir, 'nexus.skill.yaml');
const legacyYmlManifestPath = join(skillDir, 'nexus.skill.yml');

if (existsSync(legacyYmlManifestPath)) {
  logForDebugging(
    `ignored ${legacyYmlManifestPath}; rename to nexus.skill.yaml for Nexus manifest discovery`,
  );
}

const manifestResult = readNexusSkillManifest(manifestPath);

let manifest: NexusSkillManifest | undefined;
if (manifestResult.kind === 'manifest') {
  manifest = manifestResult.data;

  // Sanity check: manifest.name must match SKILL.md frontmatter name
  if (manifest.name !== record.name) {
    logForDebugging(
      `manifest name '${manifest.name}' != skill name '${record.name}' at ${manifestPath}; ignoring manifest`,
    );
    manifest = undefined;
  }
} else if (manifestResult.kind === 'invalid' || manifestResult.kind === 'parse_error') {
  logForDebugging(
    `failed to read manifest at ${manifestPath}: ${manifestResult.reason}; falling back to heuristics`,
  );
  // manifest stays undefined
}
// missing | unsupported_version: silently fall through to heuristics

return { ...record, manifest };
```

Key behaviors:
- `kind: 'manifest'` → attach data + sanity-check name match
- `kind: 'invalid'` / `'parse_error'` → log warning + fall through (don't crash)
- `kind: 'missing'` → silent fallthrough (most skills won't have a manifest)
- `kind: 'unsupported_version'` → silent fallthrough + log warning
- Name mismatch → log + ignore manifest (skill still discoverable)
- `nexus.skill.yml` next to `SKILL.md` → debug log with "rename to .yaml"
  guidance and no manifest load. The parser has no path responsibility;
  discovery does.

#### Additional path-policy behavior

If `nexus.skill.yml` exists next to `SKILL.md`, discovery must skip it, emit a
debug log that tells the author to rename to `.yaml`, and continue with
`record.manifest === undefined`. This belongs in discovery rather than the
parser because the parser receives a path chosen by its caller and does not own
filesystem naming policy.

### Step 3: Update `classification.ts` to respect declared namespace

When a skill has `manifest.classification.namespace`, prefer that over the
heuristic classification:

```typescript
export function classifySkill(record: SkillRecord): SkillNamespace {
  // Manifest-declared namespace wins
  if (record.manifest?.classification?.namespace) {
    return record.manifest.classification.namespace;
  }

  // Fall through to existing heuristic classification (Phase 1 logic)
  return classifyByHeuristics(record);
}
```

The heuristic path is preserved unchanged. The manifest path is purely
additive.

### Step 4: Update `ranking.ts` to use manifest hints

When a skill has `manifest.ranking`, use those values instead of (or in
addition to) heuristic scoring:

```typescript
export function scoreSkill(
  record: SkillRecord,
  context: RankingContext,
): number {
  let score: number;

  if (record.manifest?.ranking?.base_score !== undefined) {
    score = record.manifest.ranking.base_score;
  } else {
    score = computeHeuristicBaseScore(record, context);
  }

  // Apply manifest-declared boosts
  if (record.manifest?.ranking?.boosts) {
    for (const boost of record.manifest.ranking.boosts) {
      if (boostMatchesContext(boost, context)) {
        score += boost.delta;
      }
    }
  }

  return score;
}

function boostMatchesContext(
  boost: NexusSkillRankingBoost,
  context: RankingContext,
): boolean {
  // Boost shapes from the schema:
  //   { context: 'stage:frame', delta: 3 }
  //   { tag: 'code-review', delta: -2 }
  // Implement matchers for each shape
  if (boost.context && context.stage && `stage:${context.stage}` === boost.context) {
    return true;
  }
  if (boost.tag && context.tags?.includes(boost.tag)) {
    return true;
  }
  return false;
}
```

Open question to resolve in implementation:
- Should manifest `base_score` **replace** heuristic, or **bias toward**
  heuristic? Recommend replace (manifest is authoritative when present).
- Should boost deltas stack with heuristic boosts, or replace them?
  Recommend stack (lets manifest authors layer on top of heuristics).

### Step 5: Tests in `test/nexus/skill-registry.test.ts`

Add the following test cases (mirror existing test patterns; use temp dir
fixtures):

#### Discovery tests

1. **Manifest present and valid** — discovers skill with `record.manifest`
   populated.
2. **Manifest absent** — discovers skill with `record.manifest === undefined`,
   no warning emitted.
3. **Manifest invalid YAML** — discovers skill with `record.manifest ===
   undefined`, debug log emitted.
4. **Manifest name mismatch** — discovers skill, manifest ignored, debug log
   emitted.
5. **Manifest unsupported version (`schema_version: 2`)** — discovers skill,
   manifest ignored, debug log emitted.

#### Classification tests

6. **Manifest declares `nexus_canonical`** — `classifySkill()` returns
   `'nexus_canonical'` regardless of name.
7. **No manifest** — `classifySkill()` falls through to heuristic, returns
   the heuristic result.
8. **Manifest declares unknown namespace string** — should never reach this
   case (parser rejects in Phase 2.a), but if it does, fall through to
   heuristic.

#### Ranking tests

9. **Manifest `base_score: 5`** — `scoreSkill()` returns 5 (plus boosts).
10. **No manifest** — falls through to heuristic base score.
11. **Manifest boost `{ context: 'stage:frame', delta: 3 }` matches stage** —
    score increased by 3 in `frame` stage context.
12. **Boost doesn't match context** — score unchanged.
13. **Multiple boosts** — they stack (additively).

#### Additional discovery test from #74 review comment

14. **Legacy `.yml` manifest path** - `nexus.skill.yml` next to `SKILL.md` is
    skipped, `record.manifest === undefined`, and a debug log contains "rename
    to .yaml". No runtime path should treat `.yml` as active manifest metadata.

### Step 6: Verify

```bash
bun test test/nexus/skill-registry.test.ts   # all green
bun test                                      # all green
bun run skill:check                           # clean
bunx tsc --noEmit                             # green
bun run scripts/repo-path-inventory.ts        # regen + commit
```

### Step 7: Documentation

Update `docs/skill-manifest-schema.md` (created in Phase 2.a) to add a
section: "How Nexus consumes the manifest". Describe what each field does
to discovery / classification / ranking.

---

## Acceptance criteria

This brief is complete when:

1. `SkillRecord` carries optional `manifest` field.
2. `discovery.ts` reads `nexus.skill.yaml` and attaches result to
   `SkillRecord`. Discriminated union failure modes are handled (no crashes;
   debug logs on real failures).
3. `classification.ts` respects `manifest.classification.namespace` when
   present; falls through to heuristic otherwise.
4. `ranking.ts` uses `manifest.ranking.base_score` + `boosts[]` when present;
   falls through to heuristic otherwise.
5. Discovery skips `nexus.skill.yml` with a debug log containing "rename to
   .yaml"; the manifest is not loaded from the legacy extension.
6. Test cases above (14 enumerated) all pass.
7. `bun test` green; `bun run skill:check` clean; `bunx tsc --noEmit` green.
8. `docs/skill-manifest-schema.md` updated with consumption section.
9. `docs/architecture/repo-path-inventory.md` regenerated.
10. No regression in Phase 1 behavior for skills without manifest.

---

## Out of scope (deferred)

- **Phase 3 (advisor)** — the stage-aware advisor that presents skills to
  the user. Lives in `completion-advisor/`, consumes the registry's enriched
  output. Separate brief.
- **Phase 4 (built-in manifests)** — authoring 28+ `nexus.skill.yaml` files
  for Nexus-native support skills. Separate brief; depends on this phase.
- **Phase 5 (`/nexus do` dispatcher)** — intent-routing pseudo-command.
  Consumes registry's `intent_keywords` index. Separate brief.

This phase makes the registry **manifest-aware**. Consumers come later.

---

## Effort estimate

**~3-4 hours** total:
- 30 min: `SkillRecord` extension + types
- 45 min: discovery wire-up (manifest read + name sanity-check)
- 45 min: classification + ranking integration
- 60-90 min: tests (13 cases + fixtures)
- 30 min: documentation update
- 15 min: inventory regen + verification

Smaller than Phase 2.a (which had to design schema + parser + 12 tests + new
docs file). This phase is **pure wire-up** with the schema already frozen.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Manifest read I/O on every discovery slows boot | The `readNexusSkillManifest` calls are O(skill_count) — same shape as the existing SKILL.md read. Profile if perceived slow; add caching only if needed. |
| Skills with malformed manifests crash discovery | Discriminated union from Phase 2.a returns failure modes; this phase logs and falls through. Existing test #3 above pins this. |
| Manifest-declared namespace conflicts with heuristic | Test #6 above fixes the precedence: manifest wins. |
| Author writes manifest with wrong skill name | Test #4 above logs + ignores. Manifest doesn't break discoverability. |
| Boost shape evolves in v2 schema | `manifest.ranking?.boosts` is optional + array-shaped; v1 boosts are pure (`context` / `tag`); v2 can add new shapes without breaking v1 readers. |

---

## Decision points (resolved before implementation)

| Decision | Resolution | Rationale |
|---|---|---|
| Manifest `base_score`: replace or bias-toward heuristic? | Replace | Manifest is authoritative when author declared it |
| Manifest `boosts`: stack with heuristics or replace? | Stack | Manifest authors layer on top of heuristics; they don't have to redeclare them |
| Name mismatch: fail or fall back? | Fall back (manifest ignored) | Preserves discoverability; logs the issue |
| Unknown namespace value: fail or fall back? | Should never reach (parser rejects); if reached, fall back | Defense in depth |
| Manifest at non-canonical path (e.g., `nexus.skill.yml`)? | Reject in discovery, not parser | Discovery owns filesystem naming policy; it logs "rename to .yaml" and skips `.yml`. |

---

## References

- `docs/architecture/track-d-d3-rfc.md` § Phase 3.2.b (parent)
- `docs/architecture/track-d-d3-phase-2-brief.md` (Phase 2.a — predecessor; defines the schema this consumes)
- `docs/architecture/track-d-d3-phase-1-brief.md` (Phase 1 — registry consolidation; the heuristic path stays for backwards-compat)
- `docs/skill-manifest-schema.md` (created in Phase 2.a; needs update in Step 7 above)
- Issue #65 (Phase 2.a — must land first)
- Issue #74 (this brief implements)

---

## Acceptance criteria for this brief itself

This document is complete when:

1. ✅ Surface map (files to modify / not modify)
2. ✅ 7-step implementation procedure
3. ✅ 14 enumerated test cases
4. ✅ Acceptance criteria (10 items)
5. ✅ Out-of-scope deferrals named (Phase 3 / Phase 4 / Phase 5)
6. ✅ Decision points resolved
7. ✅ Risk register
8. ✅ References cross-link parent RFC + predecessor brief

This brief is ready for implementation by Codex (or human) without further
design clarification.
