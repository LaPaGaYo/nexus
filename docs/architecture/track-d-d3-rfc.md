# Track D-D3 RFC: SkillRegistry, `nexus.skill.yaml`, and Intent-aware skill cooperation

**Status:** Active. Phase 1 (registry consolidation) landed via PR #57 + #60. Phase 3.2.a (schema + parser) landed via #91. Phase 3.2.b / 3.2.c / 3.2.d now have implementation briefs.

> **Historical context note (issue #148):** This document was authored
> against an earlier repository layout. Some commands and file paths
> below reference the pre-#142 flat `scripts/` layout — current paths
> live under `scripts/{build,skill,eval,repo,resolvers}/`. The contents
> are kept verbatim for provenance; substitute current paths when
> running commands from this document today.
**Author:** Surfaced from Phase 4 architecture audit on 2026-05-04. Last revised 2026-05-05 with Model γ framing + Δ1/Δ2 sub-phases (see Revision history below).
**Parent plan:** `docs/architecture/phase-4-plan.md` § Phase 4.3.
**Predecessor:** Track D-D2 (`docs/architecture/track-d-d2-rfc.md`) — independent; can land in any order.
**Companion:** Issue #43 (host scanner asymmetry) is a precursor — this RFC assumes #43 has unified the host enumeration.

**Decisions made (per Phase 4 plan discussion 2026-05-04):**
- **Routing model:** B + optional C — Router-aware lifecycle as the baseline, with `/nexus do <intent>` as an additional entry-point dispatcher.
- **Manifest format:** Separate `nexus.skill.yaml` file alongside `SKILL.md` (cleaner schema evolution; skill author manages two files).

**Revision history:**
- **2026-05-04 v1**: Initial draft.
- **2026-05-05 v2**: Added "Strategic framing: Model γ" section (skill router, not warehouse) following pre-D3 absorption audit. Restructured Phase 3.2 into 3.2.a (schema + parser, brief landed at `track-d-d3-phase-2-brief.md`) and 3.2.b (registry consumes manifests, brief pending). Added Phase 3.2.c (Δ1 first-party catalog) + 3.2.d (Δ2 installer convenience) per audit recommendations.
- **2026-05-06 v3**: Marked Phase 3.2.a landed; linked implementation briefs for Phase 3.2.b, 3.2.c, and 3.2.d.

---

## Goal

Realize the second half of the absorption thesis: PM Skill / GSD / Superpowers
concepts are native (D2 handles), AND Nexus actively **cooperates with
user-installed skills** instead of just listing them.

Concretely:

1. **Consolidate skill discovery** under a single `SkillRegistry` that
   replaces `lib/nexus/external-skills.ts` and the duplicated registries in
   `lib/nexus/skill-structure.ts`.
2. **Introduce `nexus.skill.yaml`** as an optional sidecar manifest carrying
   Nexus-specific metadata (lifecycle hooks, intent keywords, inputs/outputs).
3. **Stage-aware advisor (B)**: after each lifecycle stage completes, the
   advisor consults the registry for skills whose
   `applies_to.lifecycle_stages` contains that stage and surfaces them as
   enriched suggestions.
4. **`/nexus do <intent>` dispatcher (C)**: a new canonical command that
   classifies user intent (LLM-driven), matches against the registry, and
   routes to canonical lifecycle / external skill / refuse-with-reason.

## Non-goals

- **Removing `SKILL.md` frontmatter fields**. The existing schema
  (`name`, `description`, `version`, `allowed-tools`, `preamble-tier`,
  `benefits-from`, `sensitive`, `hooks`) is preserved unchanged. Nexus-specific
  routing metadata moves to the new `nexus.skill.yaml`.
- **Forcing all skills to provide `nexus.skill.yaml`**. The manifest is
  **optional**. Skills without it fall back to the current heuristic
  classification (regex on name/description for tags). New richer behavior
  only kicks in when the manifest exists.
- **Auto-routing without user confirmation**. The C dispatcher returns
  ranked candidates; the user (or host) confirms before any governed lifecycle
  command executes. Governance is preserved.
- **Rewriting SKILL.md generation pipeline**. `gen:skill-docs` and
  `discover-skills` continue to work as today. They will optionally consume
  `nexus.skill.yaml` for skills that have it (used to inject richer template
  context), but the core pipeline is unchanged.
- **Bundling user-facing third-party skills inside the Nexus repo**. Per
  Model γ (added v2), Nexus is a *router* not a *warehouse*; PM Skills /
  Superpowers / GSD / CCB skills install via their own marketplaces. See
  Strategic framing below.

---

## Strategic framing: Model γ (added 2026-05-05)

A pre-D3 absorption audit (run on PR #58 head) discovered a critical nuance
about the absorption thesis. The 9 lifecycle stages are absorbed natively
(`lib/nexus/stage-content/` + `lib/nexus/stage-packs/` — done via PR #58 and
predecessors). But the broader *user-facing skill libraries* — 47 PM skills,
14 Superpowers skills, ~24 GSD agents, 11 CCB skills — are NOT bundled in
Nexus. They install via independent channels (PM marketplace,
`claude-plugins-official`, GSD installer, CCB).

This RFC adopts **Model γ** as its strategic frame: Nexus is a *skill router
+ lifecycle harness*, NOT a skill warehouse. External skills installed by
the user become first-class citizens to Nexus's intent dispatch and advisor
surface — without ever being copied into the Nexus repo.

This is more humble and more achievable than "absorb every PM skill into
Nexus's bundle". Key implications:

- `nexus.skill.yaml` (Component 2) is the protocol that lets externally-
  installed skills participate in Nexus's router. Skill authors (Nexus or
  third party) write the manifest; Nexus's SkillRegistry reads it.
- The catalog of template manifests (Phase 3.2.c, Δ1 below) ships *examples*
  third-party skill authors can use — but Nexus does not own the bits.
- The optional installer (Phase 3.2.d, Δ2 below) shells out to the host's
  plugin manager rather than bundling skills inside Nexus.

Rejected alternatives:
- **Bundle PM/Superpowers/GSD skills into `skills/support/`** (Model α): would
  create a maintenance trap, contradict D2's deletion premise, and violate
  the vendor README's "second command surface" red line.
- **Replace upstream's plugin marketplaces with Nexus**: out of Nexus's scope
  and identity. Nexus is governance, not distribution.
- **Keep status quo with no manifest contract** (Model δ): forfeits all the
  intent-routing leverage that motivates Components 3 + 4.

Model γ is what makes D3 possible without re-creating the upstream-snapshot
pattern that D2 just removed.

---

## Current state (summary)

(For full detail see code-explorer report dated 2026-05-04.)

### Skill discovery surface

- `lib/nexus/external-skills.ts` (368 LOC) — runtime scanner. Walks 9 install
  roots, deduplicates, classifies by name into `nexus_canonical` /
  `nexus_support` / `external_installed`, ranks by tag overlap, emits
  `recommended_external_skills`.
- `lib/nexus/skill-structure.ts` — source-path routing + classification for
  the *generation* side. Has its own `SUPPORT_SKILL_NAMES` and
  `SAFETY_SKILL_NAMES` registries that **partially diverge** from
  `external-skills.ts` `NEXUS_SUPPORT_SKILLS`.
- `scripts/discover-skills.ts` — source-tree template discovery (different
  from runtime install-tree discovery; both have a function named
  `discoverSkillFiles`).
- `scripts/gen-skill-docs.ts` — `.tmpl` → host-specific `SKILL.md` rendering.

### Frontmatter actually parsed by the scanner

`parseSkillFrontmatter` (`external-skills.ts:133-154`) reads only `name` and
`description`. All other frontmatter fields (`version`, `allowed-tools`,
`preamble-tier`, `benefits-from`, `sensitive`, `hooks`) are silently ignored.
Tags are derived by regex against name+description.

### Existing kill-switch

`NEXUS_EXTERNAL_SKILLS=0` (`external-skills.ts:233`) disables the entire
external-skill recommendation surface. Must be preserved by SkillRegistry.

### CLI dispatch

`bin/nexus.ts` → `resolveRuntimeInvocation` → `resolveInvocation` →
`assertCanonicalLifecycleEntrypoint` (hard rejects unknown commands) →
`COMMAND_HANDLERS[command]`. Adding `do` requires it to land in
`documentedLifecycleEntrypoints()` AND get a handler in `COMMAND_HANDLERS`.

---

## Proposed architecture

### Component 1: `SkillRegistry`

A new module: `lib/nexus/skill-registry/`. Owns all skill discovery,
classification, and querying. Replaces `external-skills.ts` and consolidates
the duplicated support-skill registries in `skill-structure.ts`.

```ts
// lib/nexus/skill-registry/index.ts (interface sketch)

export interface SkillRecord {
  // Existing fields (preserved from InstalledSkillRecord)
  name: string;
  surface: string;                    // "/" + normalized name
  description: string | null;
  path: string;                        // absolute path to SKILL.md
  source_root: string;                 // install root the file was found under
  namespace: 'nexus_canonical' | 'nexus_support' | 'external_installed';
  tags: string[];                      // heuristic tags (preserved fallback)

  // New fields, populated only when nexus.skill.yaml is present
  manifest?: NexusSkillManifest;       // see nexus.skill.yaml schema below
  manifest_path?: string;              // absolute path to nexus.skill.yaml
}

export interface SkillRegistry {
  // Discovery
  discover(): Promise<SkillRecord[]>;  // scan all install roots, populate cache
  reload(): Promise<void>;              // re-discover, useful for tests

  // Querying
  list(): SkillRecord[];                // all known skills
  findByName(name: string): SkillRecord | null;
  findBySurface(surface: string): SkillRecord | null;

  // Stage-aware queries (B)
  findForLifecycleStage(
    stage: CanonicalCommandId,
    context?: VerificationMatrixRecord,
  ): SkillRecord[];

  // Intent-aware queries (C)
  matchIntent(intent: string): IntentMatchResult;
}

export interface IntentMatchResult {
  candidates: Array<{
    record: SkillRecord;
    score: number;          // 0.0 - 1.0
    matched_keywords: string[];
    reason: string;         // human-readable why this match
  }>;
  confident_match: SkillRecord | null;  // when score gap is large enough
}
```

**Key invariants:**
- Single source of truth for skill classification. Both runtime and generation
  pipelines consult the registry.
- `nexus_canonical` / `nexus_support` / `external_installed` namespaces are
  determined from a **single registry of canonical/support skill names**, not
  duplicated.
- `NEXUS_EXTERNAL_SKILLS=0` continues to disable external skill surfacing.

### Component 2: `nexus.skill.yaml` schema

A new optional sidecar file at the same level as `SKILL.md`. Format:

The implemented author-facing schema reference lives at
`docs/skill-manifest-schema.md`; the parser contract lives in
`lib/nexus/skill-registry/manifest-parser.ts`.

```yaml
# nexus.skill.yaml
# Schema version. Always 1 for this RFC. Future: bump for breaking changes.
schema_version: 1

# Lifecycle integration (powers B — router-aware advisor)
applies_to:
  lifecycle_stages:
    - build       # this skill is a useful next step after /build
    - qa
  triggers:
    # Free-text human descriptions; matched fuzzy against verification matrix
    - "design contract is approved"
    - "frame.design_impact in [material, structural]"
  blocked_by:
    # Optional: this skill should NOT be recommended if these conditions hold
    - "no design impact"

# Intent classification (powers C — /nexus do dispatcher)
intent:
  primary: "translate Figma design into production code"
  keywords:
    - figma
    - design
    - mockup
    - implement
  examples:
    # Sample user inputs that should route here
    - "implement this Figma design"
    - "turn the mockup into HTML"
    - "convert Figma to React components"

# Cooperation hints (optional, used for "you ran X, now Y might help")
inputs_from:
  - /design-shotgun        # this skill is a natural follow-up to design-shotgun
  - /frame                  # or after frame for design-bearing runs
outputs_to:
  - .planning/current/build/figma-implement.json
```

**Field semantics:**

- `schema_version: 1` — required. SkillRegistry treats unknown schema versions
  as "ignore manifest, fall back to heuristics".
- `applies_to.lifecycle_stages` — ordered list of canonical command IDs. Skill
  is a candidate for B-style suggestion after these stages complete.
- `applies_to.triggers` — free-text matched fuzzy against `VerificationMatrixRecord`
  fields and `CompletionAdvisorRecord.evidence_signal`. Higher specificity =
  higher score.
- `applies_to.blocked_by` — negative conditions; skill is suppressed when any
  match.
- `intent.primary` — the canonical "what does this skill do" sentence; used in
  C dispatcher's confidence scoring.
- `intent.keywords` — fast-path keyword matching; cheap pre-filter before LLM
  classification.
- `intent.examples` — sample user inputs; used both for documentation and
  (optionally) for few-shot learning by the C classifier.
- `inputs_from` / `outputs_to` — declarative skill graph; used for
  "Recommended after you ran X" / "Will write to Y" hints.

**Validation:** `lib/nexus/skill-registry/manifest-parser.ts` validates the
YAML against this schema. Invalid manifests are logged at WARN and the skill
falls back to no-manifest mode (heuristic classification only). This means
**malformed manifests don't break the system**; they just don't unlock the
new behavior.

### Component 3: Stage-aware advisor (B)

Today (`completion-advisor.ts:293-323`):

```
attachExternalInstalledSkillRecommendations(
  record,           // pre-built CompletionAdvisorRecord
  matrix,           // VerificationMatrixRecord
  externalSkills,   // pre-discovered InstalledSkillRecord[]
)
  → ranks externalSkills by tag overlap with stage + matrix context
  → appends top-3 to record.recommended_external_skills
```

After D3:

```
attachLifecycleAwareSkillRecommendations(
  record,           // CompletionAdvisorRecord
  matrix,           // VerificationMatrixRecord
  registry,         // SkillRegistry instance
  stage,            // CanonicalCommandId of just-completed stage
)
  → registry.findForLifecycleStage(stage, matrix)
  → for each candidate:
       - if has manifest with applies_to.lifecycle_stages.includes(stage): score boost
       - if applies_to.triggers fuzzy-match matrix: score boost
       - if applies_to.blocked_by matches: skip
       - else: fall back to current tag-overlap heuristic
  → top-3 surface as recommended_external_skills
```

**Key change:** the ranking is now **driven by manifest data when available**,
falling back to heuristics for skills without `nexus.skill.yaml`. Existing
external skills continue to work unchanged. New manifest-aware skills get
better recommendations.

### Component 4: `/nexus do <intent>` dispatcher (C)

A new canonical command. Hook points:

1. Add `'do'` to `command-manifest.ts` `CANONICAL_MANIFEST` (or to a new
   `META_COMMANDS` if we don't want it to count as a lifecycle stage).
2. Add `'do'` handler to `commands/index.ts` `COMMAND_HANDLERS`.
3. Implement `commands/do.ts` — the dispatcher.

**Dispatcher logic** (`commands/do.ts`):

```
runDo(ctx, intent: string):
  1. Pre-filter: registry.matchIntent(intent) using keyword + manifest data
     → returns ranked candidates
  2. If no candidates score above threshold:
       → emit "no skill matches this intent; suggest creating one"
       → return refuse status
  3. If single candidate scores >> rest (confident_match):
       → propose it; require user confirmation
       → on confirm: invoke target via existing CLI path
  4. If multiple candidates close in score:
       → present chooser via interaction_mode='recommended_choice'
       → host shows AskUserQuestion with candidates
       → user picks → invoke
  5. If LLM classifier is enabled (NEXUS_INTENT_LLM=1):
       → on ambiguous results, call out to LLM (Claude/Codex via existing
         adapter) for refined classification
       → merge LLM verdict with keyword scores
       → present to user
```

**Governance preservation:**
- `/nexus do` itself is non-governed (it's a routing pseudo-command).
- The skill it dispatches to **is** governed (canonical lifecycle commands)
  or **non-governed but tracked** (external installed skill invocations are
  logged to `.planning/<run>/do-history.json` for retro/audit).
- No skill is invoked without explicit user confirmation.

**LLM kill-switch:** `NEXUS_INTENT_LLM=0` disables the LLM classifier; the
dispatcher falls back to pure keyword matching. Useful for offline / cost-
constrained environments and tests.

---

## Migration path

### Existing skills (unchanged)

Skills without `nexus.skill.yaml`:
- Continue to be discovered by SkillRegistry.
- Get classified by current heuristics (regex on name/description).
- Surface in `recommended_external_skills` via current tag-overlap ranking
  (unchanged behavior).
- Get matched by `/nexus do` only via keyword overlap (no manifest
  intelligence).

### New skills (opt-in to manifest)

A skill author who wants richer integration:

1. Adds `nexus.skill.yaml` next to their `SKILL.md`.
2. Lists their `applies_to.lifecycle_stages`, `intent.keywords`, etc.
3. Reinstalls / re-runs `gen:skill-docs` (the manifest is copied to
   the host install root alongside the generated SKILL.md).
4. SkillRegistry picks up the manifest on next `discover()`.

**Forward compatibility:** `schema_version: 1` lets us evolve the schema.
SkillRegistry parsers treat unknown versions as "ignore manifest" — no hard
break for users on older Nexus.

### Built-in Nexus support skills

The 28 entries in `external-skills.ts:NEXUS_SUPPORT_SKILLS` (browse, simplify,
investigate, etc.) currently have no manifest. As part of D3 Phase 3.4, we
will write `nexus.skill.yaml` files for each, with realistic
`applies_to.lifecycle_stages` and `intent.keywords`. This:

- Validates the schema works in practice
- Provides "in-house" examples for user skill authors
- Improves recommendation quality for first-party skills

### Deprecating duplicated registries

The duplicated `NEXUS_SUPPORT_SKILLS` (in `external-skills.ts`) and
`SUPPORT_SKILL_NAMES` (in `skill-structure.ts`) are merged into a single
canonical registry inside `skill-registry/`. Both old constants are removed;
all callers (runtime + generation) consult the registry.

---

## Implementation phasing

D3 is the largest sub-track in Phase 4.3. Eight PRs in five phases. Each PR
keeps the system in a working state at HEAD.

### Phase 3.1 — SkillRegistry consolidation

**Goal:** Replace `external-skills.ts` with a `SkillRegistry` module. **No new
behavior**; just consolidation.

- Create `lib/nexus/skill-registry/` directory
- Define `SkillRegistry` interface and `SkillRecord` (extending current
  `InstalledSkillRecord`)
- Move discovery + classification logic from `external-skills.ts` into the
  registry
- Reconcile `NEXUS_SUPPORT_SKILLS` (external-skills.ts) and
  `SUPPORT_SKILL_NAMES` (skill-structure.ts) into a single canonical
  `NEXUS_SUPPORT_SKILL_NAMES` constant in `skill-registry/`
- Update `external-skills.ts` to be a thin compatibility shim that delegates
  to the registry (so existing callers don't break)
- Update `skill-structure.ts` to consume the registry's name set instead of
  its own duplicate
- Tests: existing `external-skills.test.ts` continues to pass; add new
  `skill-registry.test.ts` for the consolidated API

**Effort:** 4-5h. Mechanical move + dedupe + small interface design.

### Phase 3.2 — `nexus.skill.yaml` schema + cooperation surface

This phase has been **split into 4 sub-phases** (revised 2026-05-05) to keep
each PR small and reviewable. Each sub-phase has its own brief.

#### Phase 3.2.a — schema + parser only

**Goal:** Define the schema and add parsing. Registry does not yet read manifests.

**Brief:** `docs/architecture/track-d-d3-phase-2-brief.md` (committed)
**Issue:** #65 (closed by PR #91)

- Create `lib/nexus/skill-registry/manifest-schema.ts` with TypeScript types +
  `NEXUS_SKILL_MANIFEST_SCHEMA_VERSION = 1`
- Create `lib/nexus/skill-registry/manifest-parser.ts` with discriminated-union
  read result (`manifest | missing | invalid | parse_error | unsupported_version`)
- Tests: 12 enumerated cases (minimal valid, full, missing required, parse error, unknown version, etc.)
- Documentation: `docs/skill-manifest-schema.md` (human-facing spec for skill authors)

**Effort:** 4-6h. Schema design + parser + tests + docs.

#### Phase 3.2.b — SkillRegistry consumes manifests

**Goal:** Wire the schema into discovery + classification + ranking so Nexus
actually uses manifests when present.

**Brief:** `docs/architecture/track-d-d3-phase-2-2-brief.md`
**Issue:** #74

- Update `lib/nexus/skill-registry/discovery.ts` to read `nexus.skill.yaml`
  alongside `SKILL.md` and attach parsed manifest to `SkillRecord`
- Update `lib/nexus/skill-registry/classification.ts` to respect
  `manifest.classification.namespace`
- Update `lib/nexus/skill-registry/ranking.ts` to use
  `manifest.ranking.base_score` and `boosts[]`
- Backwards-compat: skills without manifest fall back to Phase 1 heuristics
- Tests: manifest present / absent / partial / invalid behavior at registry layer

**Effort:** 3-4h. Registry consumption + tests.

#### Phase 3.2.c — Δ1: first-party manifest catalog (audit recommendation)

**Goal:** Provide examples third-party skill authors can use to declare their
skills as Nexus-aware. Per Model γ, Nexus does not bundle but does publish
templates.

**Brief:** `docs/architecture/track-d-d3-phase-2-3-brief.md`
**Issue:** #75

- Create `docs/skill-manifests/` directory with template `nexus.skill.yaml`
  files for the 47 PM + 14 Superpowers skills + ~24 GSD agents (starter set)
- Build `bun run skill:manifest:suggest <skill-name>` script that reads a
  third-party `SKILL.md` and emits a stub manifest based on heuristics
- Documentation: how a skill author / marketplace adopts a manifest
- These are **published examples**, not shipped manifests — Nexus does not
  ship third-party skill content

**Effort:** 3-4h.

#### Phase 3.2.d — Δ2: opt-in installer convenience (audit recommendation)

**Goal:** Convenience flag on `nexus setup` that delegates to the host's
plugin manager for installing external skill bundles. Per Model γ, Nexus
does not host these skills — the installer is a thin shell-out.

**Brief:** `docs/architecture/track-d-d3-phase-2-4-brief.md`
**Issue:** #76

- Add `--with-pm-skills` / `--with-superpowers` / `--with-gsd` flags to
  `nexus setup`
- Per-host plugin manager invocation (claude / codex / gemini-cli)
- Failure modes: plugin manager absent / install fails / partial install
- Documentation for users

**Effort:** 3-4h.

### Phase 3.3 — Stage-aware advisor (B)

**Goal:** Wire the manifest data into completion-advisor's recommendation
flow.

- Add `findForLifecycleStage()` to SkillRegistry
- Implement `attachLifecycleAwareSkillRecommendations()` in
  `completion-advisor/resolver.ts` (or wherever lives post-#41 split)
- Replace existing `attachExternalInstalledSkillRecommendations` callers with
  the new function (or have the new function delegate to the old when no
  manifest data is available, so behavior degrades gracefully)
- Tests: skills with manifests get higher rank than skills without when both
  match the stage tags; `applies_to.blocked_by` correctly suppresses
  candidates

**Effort:** 3-4h. Logic + ranking + tests. Depends on #41 (completion-advisor
split) being done so the resolver is its own module.

### Phase 3.4 — Built-in skill manifests

**Goal:** Write `nexus.skill.yaml` for the 28 Nexus-native support skills.

- For each skill in `skills/support/`, `skills/safety/`: author a sensible
  manifest based on existing prose + observed lifecycle integration patterns
- Add `gen:skill-docs` step to copy `nexus.skill.yaml` to host install roots
  alongside generated `SKILL.md`
- Update `skill:check` to validate built-in manifests against the schema
- Tests: registry recognizes all 28 built-in skills with manifests; sample
  recommendations look reasonable

**Effort:** 4-6h. The manifest authoring is per-skill and requires judgement
calls; not purely mechanical. Spread across multiple PRs if too large.

### Phase 3.5 — `/nexus do <intent>` dispatcher (C)

**Goal:** Add the intent-routing pseudo-command.

- Add `'do'` to `command-manifest.ts` (decision: extend `CANONICAL_MANIFEST`
  or add a separate `META_COMMANDS` table — recommend the latter)
- Implement `commands/do.ts` with the dispatcher logic
- Implement `SkillRegistry.matchIntent(intent)` with keyword + manifest scoring
- Add LLM classifier path (gated by `NEXUS_INTENT_LLM`)
- Add `do-history.json` artifact write under `.planning/<run>/`
- Update `migration-safety.ts:assertCanonicalLifecycleEntrypoint` to allow
  `'do'` (or refactor the gate to check both lifecycle + meta sets)
- Tests: keyword-only matching; ambiguous case → chooser; refuse case →
  helpful error

**Effort:** 5-7h. New code + LLM integration + tests.

### Phase 3.6 — Documentation

**Goal:** Write the user-facing docs.

- New: `docs/skill-authoring.md` — how to author a `nexus.skill.yaml`
- New: `docs/intent-routing.md` — how `/nexus do` works, examples
- Update `README.md` Skill Surface section with cross-link to skill-authoring
- Update `docs/skills.md` to reflect post-D2 absorption + post-D3 skill
  cooperation reality
- Update `phase-4-plan.md` to mark Phase 4.3 D3 as ☑

**Effort:** 3-4h.

### Phase 3.7 — Optional: `external-skills.ts` compatibility shim removal

**Goal:** After Phase 3.3 is fully landed and stable for a while, remove the
compatibility shim.

- Delete `external-skills.ts` if all callers have migrated to
  `skill-registry/` (likely already done in 3.1)
- Confirm via `git grep -F "from './external-skills'"` zero matches

**Effort:** 30 min. Mechanical.

---

## Total effort estimate

| Phase | Effort | Risk | Status |
|-------|--------|------|--------|
| 3.1 — SkillRegistry consolidation | 4-5h | Medium | **✅ Done** (PR #57 + #60) |
| 3.2.a — Manifest schema + parser | 4-6h | Low | **Done** (#65 / PR #91) |
| 3.2.b — Registry consumes manifests | 3-4h | Medium | Brief ready (#74) |
| 3.2.c — Δ1: first-party manifest catalog | 3-4h | Low | Brief ready (#75) |
| 3.2.d — Δ2: opt-in installer | 3-4h | Low | Brief ready (#76) |
| 3.3 — Stage-aware advisor (B) | 3-4h | Medium | Brief pending (#77) |
| 3.4 — Built-in skill manifests (28) | 4-6h | Low | Brief pending (#78) |
| 3.5 — `/nexus do` dispatcher (C) | 5-7h | High | Brief pending (#79) |
| 3.6 — Documentation | 3-4h | Low | Brief pending (#80) |
| 3.7 — Compat shim removal | 30 min | Low | Brief pending (#81) |
| **Total (revised)** | **32-44h** | | ~10-15% complete |

**Effort delta vs v1**: +10-14h, driven by (a) schema-only sub-phase 3.2.a vs
combined "schema + register" in v1, and (b) two new sub-phases 3.2.c (Δ1
catalog) and 3.2.d (Δ2 installer) added per Model γ recommendation.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Manifest schema needs revision after first real use | High | Medium | `schema_version: 1` lets us evolve. Phase 3.4 (writing built-in manifests) is the natural moment to discover schema gaps before external authors adopt it. |
| LLM classifier is slow / costly / unreliable for `/nexus do` | Medium | Medium | `NEXUS_INTENT_LLM=0` env-var fallback to pure keyword matching. Keyword-only mode is a usable baseline. |
| `/nexus do` makes governance contract ambiguous | Medium | High | Dispatcher emits ranked candidates only; user always confirms before invocation. `/nexus do` is non-governed; the dispatched skill is governed (canonical) or tracked (external). All routing decisions land in `do-history.json`. |
| Duplicate registries diverge again after consolidation | Medium | Medium | Phase 3.1 has explicit deduplication step. Add a test: `expect(skillStructureSupportNames).toEqual(skillRegistrySupportNames)` to prevent regression. |
| `nexus.skill.yaml` copy step in `gen:skill-docs` breaks SKILL.md generation | Medium | Low | Phase 3.4 adds the copy with explicit unit test. Manifest is optional, so the gen pipeline gracefully handles its absence. |
| Existing `recommended_external_skills` consumers break | Medium | Medium | The field shape is preserved (backwards-compatible). New richer fields are additive. |
| Built-in skill manifests are wrong on first try | Medium | Low | Phase 3.4 is iterative; users can override and we revise. The cost of a wrong manifest is "less helpful recommendation", not a runtime error. |
| `/nexus do` LLM call leaks user data | Low | High | Default to local provider (no network calls) when `local_provider` mode is set. Document the data flow in `intent-routing.md`. |
| Schema versioning bug surfaces only after first migration | Low | Medium | Add forward-compat test: a `schema_version: 99` manifest should be silently ignored, not crash. |

---

## Acceptance criteria

D3 is complete when:

1. `lib/nexus/skill-registry/` exists; `lib/nexus/external-skills.ts` is
   either deleted or a thin compatibility shim.
2. There is a single canonical `NEXUS_SUPPORT_SKILL_NAMES` constant; both
   runtime and generation pipelines reference it.
3. `nexus.skill.yaml` schema is documented in `docs/skill-authoring.md`.
4. The 28 built-in support skills each have a valid `nexus.skill.yaml`.
5. SkillRegistry's `findForLifecycleStage()` is wired into completion-advisor;
   manifest-aware recommendations score higher than heuristic-only.
6. `bun run bin/nexus.ts do <intent>` works for at least 5 representative
   intent inputs (e.g. "implement Figma design", "do a security review",
   "run end-to-end QA").
7. `bun test test/nexus/skill-registry.test.ts` exists and covers: discovery,
   manifest parsing, intent matching, lifecycle-stage filtering, malformed
   manifest fallback, schema-version forward-compat.
8. `NEXUS_EXTERNAL_SKILLS=0` continues to disable external skills.
9. `NEXUS_INTENT_LLM=0` continues to allow `/nexus do` to work in
   keyword-only mode.
10. `docs/architecture/phase-4-plan.md` § Phase 4.3 D3 marked ☑.

---

## Open questions for review

These need explicit answers before Phase 3.1 starts.

### Question 1: Where does `'do'` live in the manifest?

| Option | Description |
|--------|-------------|
| **A** | Add `'do'` to `CANONICAL_MANIFEST` in `command-manifest.ts` |
| **B** | Add a new `META_COMMANDS` table; `'do'` is the first entry. `migration-safety.ts` checks both sets. |

**Recommendation: B** — `'do'` is structurally different from lifecycle stages
(it routes, it doesn't produce governed artifacts of its own). Treating it as
a meta-command keeps the lifecycle taxonomy clean.

### Question 2: When `/nexus do` confidently matches a canonical command (e.g., user says "ship it"), does it auto-execute or still ask?

| Option | Description |
|--------|-------------|
| **A** | Always ask — every candidate requires explicit confirmation. |
| **B** | Auto-execute only when confidence > threshold (e.g., 0.9) AND the candidate is canonical. |
| **C** | Configurable via `nexus-config set do_auto_execute true/false`. Default false (ask). |

**Recommendation: A** — Phase 3.5 is the first iteration of an LLM-driven
surface; conservatism on auto-execute prevents nasty surprises. Move to B/C
as a later RFC if user feedback says "it asks too much".

### Question 3: Should `nexus.skill.yaml` be in the skill source tree (`skills/`) or only in install roots?

| Option | Description |
|--------|-------------|
| **A** | Source: `skills/support/<name>/nexus.skill.yaml` exists and is checked in. Generation copies to install root. |
| **B** | Install-only: skill authors place `nexus.skill.yaml` next to the installed `SKILL.md`. Source tree has no manifest. |

**Recommendation: A** — for built-in skills, the manifest is part of the source.
For external user skills, both placement options work (the registry just looks
for manifest next to SKILL.md). Source-tree presence makes the manifest part
of the version-controlled skill definition.

### Question 4: `do-history.json` retention?

| Option | Description |
|--------|-------------|
| **A** | Per-run, like other `.planning/current/<run>/` artifacts. Cleared on next run. |
| **B** | Append-only across runs. Useful for retro / learning patterns. |
| **C** | Both — current run gets `current-do-history.json`; archive is `archive/do-history.jsonl`. |

**Recommendation: C** — current run gives explainability for that run; archive
gives long-term pattern data for `/learn` skill consumption.

---

## References

- `docs/architecture/phase-4-plan.md` — parent plan
- `docs/architecture/track-d-d2-rfc.md` — companion RFC (upstream removal)
- `docs/architecture/context-diagram.md` — system overview
- Code-explorer report (2026-05-04) — surface map this RFC was written against
- Issue #43 — host scanner asymmetry (precursor; #43 unifies the host
  enumeration that SkillRegistry consumes)
- `lib/nexus/external-skills.ts:1-368` — current scanner
- `lib/nexus/skill-structure.ts` — duplicated support-skill registry to merge
- `lib/nexus/types.ts:858-868` — `InstalledSkillRecord` definition
- `lib/nexus/completion-advisor.ts:293-323` — current advisor enrichment flow
- `lib/nexus/runtime-invocation.ts:67` — argv parsing, hook for `'do'`
- `lib/nexus/migration-safety.ts:7` — `assertCanonicalLifecycleEntrypoint`
- `lib/nexus/command-manifest.ts` — `CANONICAL_MANIFEST`,
  `documentedLifecycleEntrypoints`
- `bin/nexus.ts:66-92` — CLI entry + dispatch
- `scripts/gen-skill-docs.ts` — host-specific generation pipeline
- `scripts/discover-skills.ts` — source-tree discovery
- `skills/canonical/discover/SKILL.md.tmpl` — representative canonical
  frontmatter (for understanding what `nexus.skill.yaml` does NOT need to carry)
- `skills/support/browse/SKILL.md.tmpl` — representative support frontmatter
- `test/nexus/external-skills.test.ts` — reusable fixture style for
  `skill-registry.test.ts`
