# Track D-D3 Phase 4 Brief: built-in `nexus.skill.yaml` manifests for Nexus-native skills

**Status:** Ready for implementation. Scope: write structured manifests for every Nexus-native skill in `skills/{canonical,safety,support,root}/`. Schema (Phase 2.a) and registry consumption (Phase 2.b) must land first.

**Type:** Authoring + light tooling. Mostly per-skill manifest content; one cross-cutting test ensures every native skill has a manifest.

**Parent plan:** `docs/architecture/track-d-d3-rfc.md` § Phase 3.4.
**Predecessors:**
- Phase 2.a: `track-d-d3-phase-2-brief.md` (#65) — defines schema + parser
- Phase 2.b: brief at `track-d-d3-phase-2-2-brief.md` (#74) — wires registry to read manifests

**Issue:** #78.

---

## Goal

Author `nexus.skill.yaml` for **all 37 Nexus-native skills** so the SkillRegistry can route intent to native skills via declared keywords + lifecycle stage tags, no longer relying on heuristic classification.

When this lands:
- Every native skill is structurally classified (no heuristic guesswork)
- Stage-aware advisor (Phase 3) has ground-truth lifecycle mappings to test against
- `/nexus do "..."` dispatcher (Phase 5) has a real intent-keyword index over Nexus's own skills
- Third-party skill authors can use these as templates for their own manifests

---

## Strategic framing: dogfooding Model γ

Per parent RFC's Model γ: Nexus is a *router + lifecycle harness*, not a skill warehouse. But that doesn't mean Nexus's *own* skills should escape the manifest contract.

This phase **dogfoods** the manifest format by writing manifests for every Nexus-native skill. If the schema is missing fields needed by Nexus's own skills, we discover that during this phase — before external authors adopt it.

This is the *natural moment to validate the schema*. The audit (in #65 brief) recommended Phase 4 happen before Phase 3 (advisor) precisely so advisor tests can use real manifest data instead of mocks.

---

## Surface map: 37 skills to manifest

Inventory from current `skills/` tree:

### Canonical (9) — lifecycle stages

```
skills/canonical/discover/
skills/canonical/frame/
skills/canonical/plan/
skills/canonical/handoff/
skills/canonical/build/
skills/canonical/review/
skills/canonical/qa/
skills/canonical/ship/
skills/canonical/closeout/
```

Each maps **1-to-1** with a `NexusLifecycleStage`. Manifest:
- `classification.namespace: nexus_canonical`
- `lifecycle_stages: [<single matching stage>]`
- `intent_keywords` derived from the stage's purpose (discover → "explore an idea", "scope a problem"; frame → "write a PRD", "scope requirements"; etc.)

### Safety (4) — guardrails

```
skills/safety/careful/   — destructive command warnings
skills/safety/freeze/    — directory-scoped edit lock
skills/safety/guard/     — combined careful + freeze
skills/safety/unfreeze/  — clear freeze
```

Manifest:
- `classification.namespace: nexus_safety` (note: this is a NEW namespace value, not in the existing schema enum — see § Schema validation below)
- `lifecycle_stages` empty (these are cross-stage guardrails)
- `intent_keywords` for activation phrases ("freeze edits to X", "I'm about to do something destructive")

### Support (23) — non-lifecycle helpers

Grouped by sub-category for authoring sanity:

| Sub-category | Skills |
|---|---|
| Engineering discipline | `investigate`, `simplify`, `learn`, `retro` |
| Browser / web | `browse`, `connect-chrome`, `setup-browser-cookies` |
| Design | `design-consultation`, `design-html`, `design-review`, `design-shotgun`, `plan-design-review` |
| Deploy / release | `deploy`, `setup-deploy`, `land`, `land-and-deploy`, `nexus-upgrade`, `document-release` |
| QA / monitoring | `qa-only`, `canary`, `benchmark` |
| Security | `cso` |
| Multi-host | `codex` |

Manifest:
- `classification.namespace: nexus_support`
- `lifecycle_stages` populated per skill (e.g., `investigate` → `[build, qa]`; `cso` → `[review, qa, ship]`; `land-and-deploy` → `[ship]`)
- `intent_keywords` derived from skill description

### Root (1)

```
skills/root/nexus/   — Nexus workflow harness entrypoint
```

Manifest:
- `classification.namespace: nexus_root` (also a NEW namespace value)
- `lifecycle_stages` empty
- `intent_keywords: ["nexus status", "what's the nexus state"]`

### Aliases (4) — NOT manifested

```
skills/aliases/autoplan/         → /plan
skills/aliases/office-hours/     → /discover
skills/aliases/plan-ceo-review/  → /frame
skills/aliases/plan-eng-review/  → /frame
```

Aliases are transitional compatibility shims. **They do not get standalone manifests** — they redirect to the canonical command they alias. The aliases' redirect target is the canonical skill, which already has a manifest.

---

## Schema validation: namespace enum extension

Phase 2.a (#65) defined `classification.namespace` as a closed enum. Original brief listed:
- `nexus_canonical`
- `nexus_support`
- `external_installed`

For Phase 4 we need to add:
- `nexus_safety` (4 safety skills)
- `nexus_root` (1 root skill)

**Decision:** Extend the enum in a small Phase 2.a follow-up PR (~5 LOC change to `manifest-schema.ts` + 1 test). This must land BEFORE Phase 4's authoring, otherwise the parser rejects safety/root manifests as `invalid`.

Alternative: classify safety/root as `nexus_support` and use a `category` field for finer grouping. **Recommend NOT this** — namespace is the authoritative axis for routing, so separating safety/root makes the dispatcher's job clearer (e.g., `/nexus do "freeze"` should route to `nexus_safety`, never confused with `nexus_support`).

The 5-LOC enum extension is the cleaner path.

---

## Authoring procedure

### Step 1: Land the namespace enum extension (precondition)

Small PR to `lib/nexus/skill-registry/manifest-schema.ts`:

```typescript
export const NEXUS_SKILL_NAMESPACES = [
  'nexus_canonical',
  'nexus_support',
  'nexus_safety',     // NEW
  'nexus_root',       // NEW
  'external_installed',
] as const;
```

Plus update parser validation + 1 test. Issue #65 (Phase 2.a) likely already merged by the time Phase 4 starts; this is a follow-up PR not strictly part of Phase 4 but blocking it.

### Step 2: Author manifests in 4 batches

Batch by category to minimize cognitive load + review surface:

**Batch A: Canonical (9)** — `skills/canonical/<name>/nexus.skill.yaml`
- Most important; advisor (Phase 3) routes via these
- Author together (single PR) since they share lifecycle mapping pattern

**Batch B: Safety (4)** — `skills/safety/<name>/nexus.skill.yaml`
- Smaller; combine with Batch A or separate PR

**Batch C: Support (23)** — `skills/support/<name>/nexus.skill.yaml`
- Largest batch; consider splitting by sub-category (eng / browser / design / deploy / qa / security / multi-host) into 2-3 PRs

**Batch D: Root (1)** — `skills/root/nexus/nexus.skill.yaml`
- Trivial; fold into any other batch

Recommended PR shape: **2-3 PRs total** (Batch A+B+D combined; Batch C split if reviewer finds it large).

### Step 3: Per-skill manifest content

For each skill, the author follows this template:

```yaml
schema_version: 1
name: <matches SKILL.md frontmatter name>
summary: <≤200 chars; pulls from SKILL.md description, condensed>
intent_keywords:
  - <3-8 phrases that route /nexus do "..." to this skill>
lifecycle_stages:
  - <subset of canonical stages this skill applies to; empty for non-stage skills>
classification:
  namespace: <nexus_canonical | nexus_support | nexus_safety | nexus_root>
  category: <free-form sub-grouping; from § Surface map table above>
applies_to:
  hosts: []   # empty = all hosts; populate only if host-specific
  contexts: []  # empty = all contexts (solo / pair / team)
provenance:
  author: Nexus
  version: <SKILL.md frontmatter version>
```

**Authoring guidance per field:**

- **`name`**: must equal `SKILL.md` frontmatter `name`. Phase 2.b (#74) name-mismatch check enforces this.
- **`summary`**: pull from SKILL.md description, condense to ≤200 chars. Single-sentence preferred.
- **`intent_keywords`**: 3-8 phrases. Mix of (a) the verb form ("write a PRD"), (b) the noun form ("PRD template"), (c) the situation ("when stakeholders disagree on scope"). Generated by reading the SKILL.md prose for natural-language usage hints.
- **`lifecycle_stages`**: for canonical skills, single matching stage. For support skills, the stages where the skill is most useful (e.g., `investigate` → `[build, qa]`; `simplify` → `[build, review]`). For safety/root, empty.
- **`category`**: from § Surface map table; see grouping above.
- **`applies_to.hosts`**: empty by default. Only populate if a skill is host-specific (e.g., a hypothetical `claude-only-feature` would be `[claude]`).

### Step 4: Cross-cutting test

Add `test/nexus/skill-manifests.test.ts`:

```typescript
import { discoverSkillFiles } from '../../lib/nexus/skill-registry/discovery';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

describe('every Nexus-native skill has a manifest', () => {
  const nativeRoots = [
    'skills/canonical',
    'skills/safety',
    'skills/support',
    'skills/root',
  ];

  for (const root of nativeRoots) {
    test(`${root}: every skill dir contains nexus.skill.yaml`, () => {
      const skills = discoverSkillFiles([root]);
      const missing = skills.filter(s => {
        const skillDir = dirname(s);
        return !existsSync(join(skillDir, 'nexus.skill.yaml'));
      });
      expect(missing).toEqual([]);
    });
  }

  test('aliases/ explicitly excluded from manifest requirement', () => {
    // Aliases redirect to canonical; they do not have standalone manifests.
    // This test exists as a guardrail: if a future aliases/<name>/ contains
    // nexus.skill.yaml, the test should fail to surface the inconsistency.
    const aliases = discoverSkillFiles(['skills/aliases']);
    const withManifest = aliases.filter(s => {
      const skillDir = dirname(s);
      return existsSync(join(skillDir, 'nexus.skill.yaml'));
    });
    expect(withManifest).toEqual([]);
  });

  test('every manifest has matching SKILL.md name', () => {
    // Phase 2.b discovery already enforces this at runtime via debug log.
    // This test is a build-time gate.
    // Iterate all manifests, parse, compare manifest.name vs SKILL.md frontmatter name.
    // Implementation TBD by author.
  });
});
```

### Step 5: Validation pipeline (skill:check)

Update `bun run skill:check` to:
1. Read every Nexus-native skill's manifest
2. Validate via `readNexusSkillManifest()` (Phase 2.a parser)
3. Fail if any return `invalid` / `parse_error` / `unsupported_version`
4. Pass through `manifest === missing` only for `skills/aliases/`

Existing `skill:check` already validates SKILL.md anatomy. This adds manifest validation alongside.

### Step 6: gen:skill-docs co-authoring

If `nexus.skill.yaml` ships in install roots alongside `SKILL.md`, `gen:skill-docs` (template renderer) needs to copy the manifest to the same install path as the rendered SKILL.md. Add a step:

```bash
# In gen:skill-docs pipeline:
# Already copies SKILL.md
# Add: if nexus.skill.yaml exists next to template, copy it to install root
```

---

## Acceptance criteria

This brief is complete when:

1. Namespace enum extended (`nexus_safety`, `nexus_root`) — Phase 2.a follow-up PR
2. **37 manifests authored** across canonical (9), safety (4), support (23), root (1)
3. Every manifest validates via Phase 2.a parser
4. Cross-cutting test enforces "every native skill has a manifest"
5. Aliases explicitly excluded with passing guardrail test
6. `skill:check` validates manifests
7. `gen:skill-docs` copies manifests to install roots
8. Phase 1 SkillRegistry tests still pass (no regression)
9. Phase 2.b registry consumption tests still pass (manifests are read + classified correctly)
10. `bun test` green; `bunx tsc --noEmit` green; `bun run skill:check` clean

---

## Out of scope (deferred)

- **Phase 3 (advisor)** — uses these manifests but is a separate brief
- **Phase 5 (`/nexus do` dispatcher)** — uses `intent_keywords` for routing, separate brief
- **Phase 2.c (catalog Δ1)** — template manifests for 47 PM + 14 Superpowers external skills, separate brief
- **Phase 2.d (installer Δ2)** — `nexus setup --with-pm-skills`, separate brief
- **External skill manifests in Nexus repo** — per Model γ, Nexus does NOT bundle third-party skill manifests; they live in their own repos (PM marketplace, Superpowers plugin, etc.)
- **Manifest-driven host install** — copying manifests to host install roots happens via `gen:skill-docs` co-authoring (Step 6), not as a separate dedicated mechanism

---

## Effort estimate

**~6-8 hours** total, **plus ~30 min for namespace enum extension** as Phase 2.a follow-up:

| Activity | Effort |
|---|---|
| Step 1 (namespace enum extension) | 30 min (separate PR) |
| Step 2 Batch A (canonical 9 manifests) | 1.5-2h |
| Step 2 Batch B (safety 4) + Batch D (root 1) | 30-45 min |
| Step 2 Batch C (support 23, split into 2-3 PRs) | 2-3h |
| Step 4 (cross-cutting tests) | 45 min |
| Step 5 (skill:check integration) | 30 min |
| Step 6 (gen:skill-docs co-authoring) | 30 min |
| Verification + inventory regen | 30 min |

Authoring time is dominated by **summary + intent_keywords** generation per skill — these require reading each SKILL.md and writing meaningful prose, not template-fill.

If split across PRs:
- PR-1: namespace enum (#65 follow-up)
- PR-2: canonical + safety + root + cross-cutting test (~3h)
- PR-3: support eng+browser+design subset (~1.5h)
- PR-4: support deploy+qa+security+multi-host (~1.5h)
- PR-5: skill:check + gen:skill-docs integration (~1h)

---

## Risk register

| Risk | Mitigation |
|---|---|
| Namespace enum extension blocks all 37 authoring PRs | Land enum extension first; canonical/support PRs depend on it |
| `intent_keywords` quality varies wildly across skills | Authoring guidance Step 3 sets a 3-8 keyword floor + provides type hints (verb / noun / situation); review for keyword diversity |
| Manifest drift from SKILL.md content | Phase 2.b name-mismatch check catches name drift; `skill:check` catches structural drift; cross-cutting test catches "manifest missing" |
| 37 PRs is too many | Bundle into 4-5 PRs by batch (per Step 2); each batch is internally cohesive |
| `gen:skill-docs` copy step missed | Step 6 explicit; Phase 2.a brief flagged this in its risk register too |
| Authors over-tag `lifecycle_stages` (claim a skill applies to all 9 stages when it really applies to 2) | Review pass: assert most support skills have ≤3 stages; flag any ≥5 for re-evaluation |

---

## Decision points (resolved before implementation)

| Decision | Resolution | Rationale |
|---|---|---|
| Combine canonical + safety + root in one PR? | Yes (Batch A+B+D) | Together = 14 manifests, manageable review surface |
| Split support into multiple PRs? | Yes, 2-3 PRs by sub-category | 23 manifests in one PR is unwieldy; sub-category split is natural |
| Aliases get manifests? | No — they redirect | Manifest is per skill, not per command alias |
| New namespace values vs reuse `nexus_support`? | New values (`nexus_safety`, `nexus_root`) | Routing distinction matters; safety guardrails behave differently from generic support |
| `intent_keywords` from SKILL.md auto-derived or hand-written? | Hand-written | Auto-derivation produces low-quality keywords; this is the rare authoring task humans should do |
| Manifest stays with template (`SKILL.md.tmpl` location) or only at install root? | Both — co-located with `.tmpl`, copied to install root via `gen:skill-docs` | Template repo is source of truth; install root is consumed at runtime |

---

## References

- `docs/architecture/track-d-d3-rfc.md` § Phase 3.4 (parent)
- `docs/architecture/track-d-d3-phase-2-brief.md` (Phase 2.a — schema definition; predecessor)
- `docs/architecture/track-d-d3-phase-2-2-brief.md` (Phase 2.b — registry consumption; predecessor)
- `docs/skill-manifest-schema.md` (Phase 2.a output — author-facing spec)
- `skills/{canonical,safety,support,root}/` — the targets (37 skills)
- Issue #78 (this brief implements)
- Issue #65 (Phase 2.a — must land first)
- Issue #74 (Phase 2.b — must land first)

---

## Acceptance criteria for this brief itself

This document is complete when:

1. ✅ 37-skill inventory enumerated by category
2. ✅ Namespace enum extension flagged + scope defined
3. ✅ Per-skill template provided
4. ✅ Authoring guidance per field (Step 3)
5. ✅ Batching strategy (Step 2) for PR shape
6. ✅ Cross-cutting test (Step 4) sketched
7. ✅ skill:check + gen:skill-docs integration (Steps 5-6)
8. ✅ Effort estimate broken down per batch
9. ✅ Risk register
10. ✅ Decision points resolved
11. ✅ References cross-link parent RFC + 2 predecessor briefs

This brief is ready for implementation by Codex (or human) without further design clarification, **provided** the 5-LOC namespace enum extension lands first.
