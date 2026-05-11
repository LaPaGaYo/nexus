# Track D-D3 Phase 1 Brief: SkillRegistry consolidation

**Status:** Ready for implementation.

> **Historical context note (issue #148):** This document was authored
> against an earlier repository layout. Some commands and file paths
> below reference the pre-#142 flat `scripts/` layout — current paths
> live under `scripts/{build,skill,eval,repo,resolvers}/`. The contents
> are kept verbatim for provenance; substitute current paths when
> running commands from this document today.
**Type:** Refactor + dedupe. **No new behavior**; consolidates two parallel registries into one.
**Parent RFC:** `docs/architecture/track-d-d3-rfc.md` § Phase 3.1.
**Phase:** Phase 4.3 D3 Phase 1 (first of 7 phases in D3).

---

## Goal

Replace `lib/nexus/external-skills.ts` with a `SkillRegistry` module that becomes
the **single source of truth** for skill discovery and classification. This
consolidation:

1. Eliminates the duplicated `NEXUS_SUPPORT_SKILLS` (in `external-skills.ts`)
   vs `SUPPORT_SKILL_NAMES` (in `skill-structure.ts`) registries that have
   already drifted apart.
2. Sets up the structural foundation for Phase 3.2 (`nexus.skill.yaml` schema)
   and Phase 3.3 (stage-aware advisor).
3. Preserves the `NEXUS_EXTERNAL_SKILLS=0` env-var kill switch.

**This phase introduces no new behavior**. After Phase 1 lands, all existing
code paths produce identical output to today's `external-skills.ts`. The only
visible change is "skill discovery now happens through `SkillRegistry`" — the
classification, ranking, and recommendation surfaces are unchanged.

---

## Why this matters now

Two registries diverging is the kind of bug that grows silently. From the
code-explorer report:

> `external-skills.ts` maintains its own `NEXUS_SUPPORT_SKILLS` set (28 entries,
> lines 6-34) that is not derived from `skill-structure.ts`'s
> `SUPPORT_SKILL_NAMES`. The two lists are inconsistent — `external-skills.ts`
> merges safety skills into the support set and omits/includes `canary`
> differently. D3's `SkillRegistry` must reconcile these or the classification
> logic will diverge again.

Without consolidation, every D3 phase that touches skill classification has
to reason about two sources of truth.

---

## Surface map (verified by code-explorer 2026-05-04)

### Files to create

```
lib/nexus/skill-registry/
├── index.ts             # SkillRegistry interface + factory
├── types.ts             # SkillRecord (extends current InstalledSkillRecord shape)
├── discovery.ts         # walking install roots, parsing SKILL.md
├── classification.ts    # namespace classification (canonical/support/external)
├── ranking.ts           # rankExternalInstalledSkillsForAdvisor logic
└── support-skills.ts    # NEXUS_SUPPORT_SKILL_NAMES — single canonical constant
```

Plus:

```
test/nexus/skill-registry.test.ts   # new tests for the consolidated API
```

### Files to modify

| Path | Change |
|------|--------|
| `lib/nexus/external-skills.ts` | Becomes a **thin compatibility shim** that re-exports from `skill-registry/` (so existing callers don't break) — see "Compatibility shim" below. |
| `lib/nexus/skill-structure.ts` | Replace local `SUPPORT_SKILL_NAMES` with imports from `lib/nexus/skill-registry/support-skills.ts`. Same for `SAFETY_SKILL_NAMES` if applicable. |
| `lib/nexus/completion-advisor/writer.ts` | Update `discoverExternalInstalledSkills` and `attachExternalInstalledSkillRecommendations` imports if they move to the registry (likely keep the import paths — see Out of scope). |

### Files NOT to modify in this phase

- Skill prose `.tmpl` files — Phase 1 has zero impact on generation
- `scripts/gen-skill-docs.ts`, `scripts/discover-skills.ts` — Phase 1 doesn't touch generation
- Skill manifest files (`nexus.skill.yaml`) — that's Phase 3.2
- Stage-aware advisor logic — that's Phase 3.3
- `bin/nexus.ts` and `commands/index.ts` — Phase 1 has no CLI dispatch changes

---

## Detailed step-by-step procedure

### Step 1: Create the registry skeleton

```bash
mkdir -p lib/nexus/skill-registry
```

Create `lib/nexus/skill-registry/types.ts`:

```ts
import type { InstalledSkillNamespace } from '../types';

/**
 * Record shape produced by the registry. Identical to the existing
 * InstalledSkillRecord in lib/nexus/types.ts (preserved for backwards
 * compatibility). Phase 3.2 will optionally attach a `manifest` field here
 * when nexus.skill.yaml is present.
 */
export interface SkillRecord {
  name: string;
  surface: string;                    // "/" + normalized name
  description: string | null;
  path: string;                        // absolute path to SKILL.md
  source_root: string;                 // install root the file was found under
  namespace: InstalledSkillNamespace;
  tags: string[];
}

export interface SkillRegistryDiscoveryOptions {
  roots?: string[];           // explicit roots, OR
  cwd?: string;                // resolve roots from cwd + home
  home?: string;
}
```

Create `lib/nexus/skill-registry/support-skills.ts`:

```ts
/**
 * Canonical list of Nexus support skill names. Single source of truth.
 *
 * Reconciliation note: this list MERGES the previous duplicated registries:
 * - `NEXUS_SUPPORT_SKILLS` from lib/nexus/external-skills.ts (28 entries)
 * - `SUPPORT_SKILL_NAMES` + `SAFETY_SKILL_NAMES` from lib/nexus/skill-structure.ts
 *
 * After Phase 1 lands, both old constants are removed; all callers consume
 * NEXUS_SUPPORT_SKILL_NAMES directly.
 */
export const NEXUS_SUPPORT_SKILL_NAMES = [
  // ... merge the two lists, dedupe, sort alphabetically
  // (the contributor implementing this should produce the merged set
  //  by reading both files and taking the union)
] as const;

export type NexusSupportSkillName = (typeof NEXUS_SUPPORT_SKILL_NAMES)[number];

/**
 * Validation helper used by tests to assert the registry is the only source.
 */
export function assertNoDuplicateSupportRegistries(): void {
  // implementation: at module load time, verify external-skills.ts and
  // skill-structure.ts both consume NEXUS_SUPPORT_SKILL_NAMES (not their own
  // copy)
}
```

### Step 2: Move discovery logic

Create `lib/nexus/skill-registry/discovery.ts`. Move the contents of:

- `discoverExternalInstalledSkills` (currently `external-skills.ts:200+`)
- `discoverSkillFiles` (recursive directory walker)
- `parseSkillFrontmatter` (the YAML frontmatter parser)
- `defaultExternalSkillRoots` (or rename to `discoverHostInstallRoots` to be
  precise — paths come from `host-roots.ts`'s `HOST_SKILL_INSTALL_ROOTS`)

The functions can keep their current signatures for now. The compatibility
shim in Step 5 will re-export them under the old names.

### Step 3: Move classification logic

Create `lib/nexus/skill-registry/classification.ts`. Move:

- `classifyInstalledSkill` (currently `external-skills.ts:36-58`)
- `classifyNamespace` (the helper that maps name → `nexus_canonical | nexus_support | external_installed`)

Update `classifyNamespace` to consume `NEXUS_SUPPORT_SKILL_NAMES` from
`./support-skills.ts` (no longer the local set).

### Step 4: Move ranking logic

Create `lib/nexus/skill-registry/ranking.ts`. Move:

- `rankExternalInstalledSkillsForAdvisor`
- All scoring helpers (tag overlap, matrix context overlap, dedup)

### Step 5: Define the public registry interface in `index.ts`

```ts
// lib/nexus/skill-registry/index.ts
export type { SkillRecord, SkillRegistryDiscoveryOptions } from './types';
export { NEXUS_SUPPORT_SKILL_NAMES, type NexusSupportSkillName } from './support-skills';
export { discoverInstalledSkills } from './discovery';
export { classifyInstalledSkill, classifyNamespace } from './classification';
export { rankInstalledSkillsForAdvisor } from './ranking';

// Convenience: factory that returns a default-configured registry instance
// (Phase 1 keeps this minimal; Phase 3.2/3.3 will add manifest-aware methods)
export function createSkillRegistry(options?: SkillRegistryDiscoveryOptions) {
  return {
    discover: () => discoverInstalledSkills(options ?? {}),
    classify: classifyInstalledSkill,
    rank: rankInstalledSkillsForAdvisor,
  };
}
```

### Step 6: Convert `lib/nexus/external-skills.ts` to a compatibility shim

Replace the body of `lib/nexus/external-skills.ts` with re-exports:

```ts
/**
 * Compatibility shim for the pre-D3 external-skills surface.
 *
 * After D3 Phase 1, all skill discovery + classification + ranking lives in
 * lib/nexus/skill-registry/. This module re-exports the same names so existing
 * callers continue to work unchanged.
 *
 * D3 Phase 7 will delete this file after all callers are confirmed migrated.
 */

export {
  classifyInstalledSkill,
  classifyNamespace,
  discoverInstalledSkills as discoverExternalInstalledSkills,
  rankInstalledSkillsForAdvisor as rankExternalInstalledSkillsForAdvisor,
  // ... and any other symbols the old file exported
} from './skill-registry';

export type { SkillRecord as InstalledSkillRecord } from './skill-registry';
```

The `defaultExternalSkillRoots` function should be re-exported too (or the
shim can import it directly from `./host-roots.ts` since it's already
canonicalized there post-#43).

### Step 7: Update `lib/nexus/skill-structure.ts`

Find the local `SUPPORT_SKILL_NAMES` and `SAFETY_SKILL_NAMES` constants
(approximately lines 24-48). Replace with:

```ts
import { NEXUS_SUPPORT_SKILL_NAMES } from './skill-registry/support-skills';

// existing code that referenced SUPPORT_SKILL_NAMES now references
// NEXUS_SUPPORT_SKILL_NAMES
```

If `skill-structure.ts` had its own classification logic separate from
`external-skills.ts`, route it through `skill-registry/classification.ts`.

### Step 8: Add tests for the consolidated API

Create `test/nexus/skill-registry.test.ts`. Cover:

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createSkillRegistry,
  NEXUS_SUPPORT_SKILL_NAMES,
} from '../../lib/nexus/skill-registry';

describe('SkillRegistry — Phase 1 consolidation', () => {
  test('NEXUS_SUPPORT_SKILL_NAMES is the single source of truth', () => {
    // assert structure-side and external-side consumers all agree
  });

  test('discover() returns same shape as old discoverExternalInstalledSkills', () => {
    // mkdtemp fixture, write a fake SKILL.md, assert classification result
  });

  test('classify() handles canonical / support / external correctly', () => {
    // each branch
  });

  test('rank() respects NEXUS_EXTERNAL_SKILLS=0 kill switch', () => {
    // env-var test — should return empty array
  });

  test('shim continues to export discoverExternalInstalledSkills for backwards compat', () => {
    // import from external-skills.ts directly, verify identical result
  });
});
```

The existing `test/nexus/external-skills.test.ts` should continue to pass
without modification (because the shim preserves the API). If any test in that
file needs adjustment, that's a sign the shim isn't complete.

### Step 9: Verification

```bash
# Build verification
bun run build

# Test verification
bun test                                          # full suite passes
bun test test/nexus/skill-registry.test.ts        # new tests pass
bun test test/nexus/external-skills.test.ts       # existing tests pass via shim
bun test test/nexus/skill-structure.test.ts       # existing tests pass with new import

# Static verification
git grep -F "from './external-skills'" lib/      # check who imports from old path
git grep -F "NEXUS_SUPPORT_SKILLS" lib/          # should only appear in skill-registry
git grep -F "SUPPORT_SKILL_NAMES" lib/           # should only appear in skill-registry
```

Manual smoke test:

```bash
bun run bin/nexus.ts plan                          # advisor still recommends external skills
```

Verify `.planning/current/plan/completion-advisor.json` includes
`recommended_external_skills` field with same shape as before.

### Step 10: Regenerate inventory

```bash
bun run repo:inventory:check
```

This will update `docs/architecture/repo-path-inventory.md` to reflect the new
`lib/nexus/skill-registry/` directory.

---

## PR shape

- **Branch name**: `codex/track-d-d3-phase-1-skill-registry`
- **Commit subject**: `Track D-D3 Phase 1: consolidate skill discovery into SkillRegistry`
- **Commit body**:
  ```
  Replaces lib/nexus/external-skills.ts with lib/nexus/skill-registry/.
  external-skills.ts becomes a thin compatibility shim. Reconciles the
  duplicated NEXUS_SUPPORT_SKILLS (external-skills.ts) and
  SUPPORT_SKILL_NAMES (skill-structure.ts) into a single canonical
  NEXUS_SUPPORT_SKILL_NAMES constant.

  No behavior changes. Existing callers continue to work via the shim.
  Phase 3.2 (nexus.skill.yaml schema) and Phase 3.3 (stage-aware advisor)
  build on top of this consolidation.
  ```

---

## Acceptance criteria

Phase 1 is complete when:

1. `lib/nexus/skill-registry/` exists with the 6 source files listed above
2. `lib/nexus/external-skills.ts` is a thin compatibility shim (≤ 30 LOC)
3. `git grep -F "NEXUS_SUPPORT_SKILLS"` returns matches only in
   `lib/nexus/skill-registry/support-skills.ts` (and its single declaration)
4. `git grep -F "SUPPORT_SKILL_NAMES"` returns matches only in
   `lib/nexus/skill-registry/support-skills.ts` (renamed) and its callers
5. `bun test` passes (full suite green)
6. `bun run build` passes
7. `bun test test/nexus/external-skills.test.ts` still passes unmodified
8. `bun test test/nexus/skill-registry.test.ts` (new) passes with ≥ 4 test cases
9. `bun run bin/nexus.ts plan` produces identical
   `.planning/current/plan/completion-advisor.json`
   `recommended_external_skills` shape as pre-PR
10. `bun run repo:inventory:check` updated and passes

---

## Effort estimate

**~4-5 hours**. Mechanical move + dedupe + small interface design.

The biggest time sinks:
- Reconciling the two support-skill registries (requires reading both, taking
  union, deciding canonical alphabetical order)
- Verifying the shim re-exports cover every symbol the old file exported
- Running through all `git grep` verification commands

Can be split into 2 PRs if helpful: 1) registry creation + shim;
2) `skill-structure.ts` migration. Recommendation: single PR if size stays under
~600 LOC; split if it grows.

---

## Out of scope (do NOT do in Phase 1)

- **`nexus.skill.yaml` schema** — that's Phase 3.2
- **Stage-aware advisor changes** — that's Phase 3.3
- **Built-in skill manifests for the 28 support skills** — that's Phase 3.4
- **`/nexus do <intent>` dispatcher** — that's Phase 3.5
- **Documentation rewrites** — that's Phase 3.6
- **Removing the compatibility shim** — that's Phase 3.7

Stay scope-disciplined. Phase 1 is consolidation only; the registry's API
surface in this phase is functionally identical to today's `external-skills.ts`.

---

## References

- `docs/architecture/track-d-d3-rfc.md` § Phase 3.1 — full RFC context
- `docs/architecture/phase-4-plan.md` § Phase 4.3 D3 — parent plan
- `lib/nexus/external-skills.ts` — current scanner (368 LOC) becomes shim
- `lib/nexus/skill-structure.ts` — duplicated `SUPPORT_SKILL_NAMES` registry
- `lib/nexus/types.ts:858-868` — `InstalledSkillRecord` (preserved as `SkillRecord`)
- `lib/nexus/host-roots.ts` — `HOST_SKILL_INSTALL_ROOTS` (already canonicalized post-#43)
- `test/nexus/external-skills.test.ts` — existing tests should pass unchanged via shim
- Companion brief: `docs/architecture/track-d-d1-brief.md` (similar style for D1)
