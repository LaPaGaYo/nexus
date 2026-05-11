# Track D-D3 Phase 2 Brief: `nexus.skill.yaml` manifest schema

**Status:** Ready for implementation. Scope is the schema + parser/validator only — NOT registry consumption, NOT manifest authoring for built-in skills, NOT external installers. Those land in Phase 2.2/2.3/2.4 separately.

> **Historical context note (issue #148):** This document was authored
> against an earlier repository layout. Some commands and file paths
> below reference the pre-#142 flat `scripts/` layout — current paths
> live under `scripts/{build,skill,eval,repo,resolvers}/`. The contents
> are kept verbatim for provenance; substitute current paths when
> running commands from this document today.

**Type:** Greenfield design. No existing manifest schema; this is the first.

**Parent plan:** `docs/architecture/track-d-d3-rfc.md` § Phase 3.2.
**Predecessor:** D3 Phase 1 (PR #57 + #60 — SkillRegistry consolidation, just landed).
**Companion docs:** `track-d-d3-phase-1-brief.md`, `track-d-d2-rfc.md`.

---

## Goal

Define and implement `nexus.skill.yaml` — a sidecar manifest format that lets any
skill (Nexus-native or third-party) declare its routing intent, lifecycle stage
applicability, and metadata in a structured way that Nexus's intent router and
stage-aware advisor can consume.

When this lands, Nexus has the **schema contract** in place. Subsequent phases
(2.2 — Registry consumption; 2.3 — first-party manifest catalog; 2.4 —
installer convenience) build on top of it.

---

## Strategic framing: Model γ

A pre-D3 audit (this session) confirmed the **shape of upstream absorption**:

- 9 lifecycle stages absorbed natively (✅ done — `lib/nexus/stage-content/` + `stage-packs/`)
- 47 PM skills + 14 Superpowers skills + ~24 GSD agents + 11 CCB skills are **NOT bundled in Nexus** — they ship via independent install channels (PM marketplace, claude-plugins-official, GSD installer, CCB)

The audit recommended **Model γ**: Nexus is a *skill router + lifecycle harness*, not a skill warehouse. External skills installed by the user become first-class citizens to Nexus's intent dispatch and advisor surface — without ever being copied into the Nexus repo.

`nexus.skill.yaml` is the contract that makes Model γ work. It's the answer to:
"How does Nexus tell the difference between PM's `prd-development` skill and
Superpowers' `test-driven-development` skill, both installed by the user, when
the user types `/nexus do 'write a PRD'`?"

The skill author (Nexus or third party) writes `nexus.skill.yaml` next to their
`SKILL.md`. Nexus's SkillRegistry reads it. End of story.

Skills without `nexus.skill.yaml` continue to work via heuristic classification
(D3 Phase 1's existing logic). The manifest is an opt-in upgrade.

---

## Schema design

### Top-level shape

```yaml
schema_version: 1
name: prd-development
summary: Guide product managers through structured PRD creation.
intent_keywords:
  - write a PRD
  - product requirements document
  - PRD template
  - PRD structure
lifecycle_stages:
  - frame
  - plan
classification:
  namespace: external_installed   # or 'nexus_canonical' / 'nexus_support'
  category: product-management    # free-form, used for grouping in skill list
applies_to:
  hosts:
    - claude
    - codex
    - gemini-cli
  contexts:
    - solo
    - pair
inputs:
  - name: discovery_artifact
    description: Output from /discover, used as input to PRD framing
    optional: true
outputs:
  - name: prd_document
    description: Structured PRD markdown
    artifact: framing/prd.md
ranking:
  base_score: 5
  boosts:
    - context: stage:frame
      delta: 3
    - tag: code-review
      delta: -2   # negative — explicitly NOT for code review
provenance:
  author: PM Skills (Dean Peters)
  source_url: https://github.com/dpcjjj/pm-skills
  version: 2.4.1
  license: MIT
notes:
  - This skill is most effective after /discover has produced an initial idea brief.
```

### Field semantics

| Field | Required | Type | Purpose |
|---|---|---|---|
| `schema_version` | yes | int | Stamping. v1 today; future versions explicitly bump |
| `name` | yes | string | Canonical skill name (must match SKILL.md frontmatter) |
| `summary` | yes | string (≤200 chars) | Short description for intent router |
| `intent_keywords` | yes | string[] | Phrases that route a `/nexus do "..."` query to this skill |
| `lifecycle_stages` | optional | enum[] | Subset of `discover \| frame \| plan \| handoff \| build \| review \| qa \| ship \| closeout` |
| `classification.namespace` | optional | enum | `nexus_canonical` \| `nexus_support` \| `external_installed` |
| `classification.category` | optional | string | Free-form grouping label |
| `applies_to.hosts` | optional | string[] | Subset of supported host ids; empty = applies to all |
| `applies_to.contexts` | optional | string[] | Subset of `solo \| pair \| team`; empty = all |
| `inputs[]` | optional | object[] | Declared input artifacts (for advisor) |
| `outputs[]` | optional | object[] | Declared output artifacts (for advisor) |
| `ranking.base_score` | optional | int | Replaces heuristic base score from D3 Phase 1 ranking.ts |
| `ranking.boosts[]` | optional | object[] | Conditional score adjustments per context/tag |
| `provenance.*` | optional | object | Author/source/version metadata for cross-skill credit |
| `notes[]` | optional | string[] | User-facing prose surfaced by the advisor |

### Optionality philosophy

The schema is **deliberately permissive**. Only `schema_version`, `name`,
`summary`, and `intent_keywords` are required. Everything else is opt-in.

A minimal valid manifest:

```yaml
schema_version: 1
name: my-skill
summary: A skill that does a thing.
intent_keywords:
  - do the thing
```

Skills that want richer integration with stage-aware advisor or ranking can opt
into the more advanced fields. Skills with no manifest continue to work via
heuristic classification (Phase 1 logic).

### Schema versioning

`schema_version: 1` is stamped on every manifest. Forward-compat strategy:

- v1 readers must accept v1 manifests strictly.
- v1 readers that encounter v2 manifests warn (loudly) and fall through to
  heuristic classification rather than silently mis-parsing.
- Future v2 changes to the schema bump the version explicitly. Migration paths
  are written before bump.

This mirrors the ledger schema versioning pattern from PR #47
(`NEXUS_LEDGER_SCHEMA_VERSION`).

### File location convention

Manifests live **next to** their `SKILL.md`:

```
~/.claude/skills/prd-development/
├── SKILL.md
├── nexus.skill.yaml      ← the manifest
└── ... (other files)
```

This keeps the manifest with the skill content, so when the user updates the
skill via marketplace, the manifest comes along. Nexus's SkillRegistry walks
host install roots looking for both `SKILL.md` and `nexus.skill.yaml`.

---

## Implementation plan

### Files to create

```
lib/nexus/skill-registry/
├── manifest-schema.ts        ← TypeScript types + schema_version constant
├── manifest-parser.ts        ← YAML parse + validation
└── manifest-types.ts          ← exported public types

test/nexus/
└── skill-manifest.test.ts    ← validator tests

docs/
└── skill-manifest-schema.md  ← human-readable spec for skill authors
```

### `manifest-schema.ts`

Defines the **shape contract** as TypeScript types + the schema version constant:

```typescript
export const NEXUS_SKILL_MANIFEST_SCHEMA_VERSION = 1;

export interface NexusSkillManifest {
  schema_version: number;
  name: string;
  summary: string;
  intent_keywords: readonly string[];
  lifecycle_stages?: readonly NexusLifecycleStage[];
  classification?: NexusSkillClassification;
  applies_to?: NexusSkillAppliesTo;
  inputs?: readonly NexusSkillInputDecl[];
  outputs?: readonly NexusSkillOutputDecl[];
  ranking?: NexusSkillRankingHints;
  provenance?: NexusSkillProvenance;
  notes?: readonly string[];
}

// + supporting types for each nested object
```

### `manifest-parser.ts`

Reads a `nexus.skill.yaml` file from disk, parses YAML, validates against the
schema, returns a `Result` discriminated union:

```typescript
export type NexusSkillManifestReadResult =
  | { kind: 'manifest'; data: NexusSkillManifest }
  | { kind: 'missing' }       // file doesn't exist
  | { kind: 'invalid'; reason: string }   // YAML parsed but failed validation
  | { kind: 'parse_error'; reason: string }  // YAML didn't parse
  | { kind: 'unsupported_version'; found: number };  // schema_version > 1
```

This mirrors the `readCanonicalDeployContractResult` pattern from PR #55 — every
failure mode is a distinct discriminator, no silent collapse.

The validator is **strict on required fields** and **lenient on extras**:
unknown fields warn but don't fail. This lets future schema versions add fields
that v1 parsers ignore safely.

### Test coverage (in `test/nexus/skill-manifest.test.ts`)

Behaviors to cover:

1. **Minimal valid manifest** parses to `{ kind: 'manifest' }`.
2. **Full manifest with all fields** parses correctly, types resolve.
3. **Missing required field** (e.g., no `name`) → `{ kind: 'invalid', reason: ... }`.
4. **YAML syntax error** → `{ kind: 'parse_error' }`.
5. **`schema_version: 2`** → `{ kind: 'unsupported_version', found: 2 }`.
6. **Unknown field** (e.g., `foo: bar`) → still parses, but emit warning.
7. **`schema_version` missing** → `{ kind: 'invalid', reason: 'schema_version required' }`.
8. **Empty file** → `{ kind: 'parse_error' }` (not `missing` — file exists but empty).
9. **File doesn't exist at path** → `{ kind: 'missing' }`.
10. **`intent_keywords` empty array** → `{ kind: 'invalid', reason: 'at least one intent_keyword required' }`.
11. **Lifecycle stage outside enum** (e.g., `lifecycle_stages: [foo]`) → invalid.
12. **Classification.namespace outside enum** → invalid.

### Documentation: `docs/skill-manifest-schema.md`

Human-facing spec for skill authors. Includes:
- Full field reference (taken from § Schema design above)
- Migration story: "If you have a SKILL.md but no manifest, your skill still works. Add a manifest to opt into stage-aware routing."
- Common patterns: writing intent_keywords for natural-language dispatch, declaring lifecycle stages, ranking boosts
- Examples: a minimal skill, a complex stage-aware skill, an external skill
- FAQ: "Do I need a manifest for every skill?" (No), "Can I have multiple manifests?" (No, one per skill), "What if my SKILL.md says one name but my manifest says another?" (validation fails — they must match)

---

## Implementation procedure

### Step 1: Define types

Create `lib/nexus/skill-registry/manifest-schema.ts` with the full type set.
Export the `NEXUS_SKILL_MANIFEST_SCHEMA_VERSION = 1` constant.

### Step 2: Implement parser/validator

Create `lib/nexus/skill-registry/manifest-parser.ts`. Use `js-yaml` (or
existing YAML utility — check `package.json` to confirm what's available; if
nothing, propose adding `js-yaml`).

Validation logic:
1. Parse YAML → object (catch parse errors → `parse_error`)
2. Check `schema_version` exists and is a number (else → `invalid`)
3. Check `schema_version` ≤ 1 (else → `unsupported_version`)
4. Check required fields: `name`, `summary`, `intent_keywords` (non-empty array)
5. Check enums for `lifecycle_stages`, `classification.namespace`, `applies_to.hosts`/`.contexts`
6. Return appropriate `NexusSkillManifestReadResult`

### Step 3: Tests

Implement the 12 test cases above. Use temp directory fixtures (existing pattern from `skill-registry.test.ts`).

### Step 4: Documentation

Write `docs/skill-manifest-schema.md` with full field reference + examples.
Cross-reference from `docs/architecture/track-d-d3-rfc.md` § Component 2.

### Step 5: Verification

```bash
bun test test/nexus/skill-manifest.test.ts   # all green
bun run skill:check                           # unchanged (no manifests yet)
bunx tsc --noEmit                             # green
bun run repo:inventory:check                  # passes after regen
```

The new files must be tracked in inventory. Per recent pattern, regen the
inventory in the same PR.

### Step 6: Inventory regen

```bash
bun run scripts/repo-path-inventory.ts
```

---

## Acceptance criteria

This brief is complete when:

1. `lib/nexus/skill-registry/manifest-schema.ts` exists with all types + `NEXUS_SKILL_MANIFEST_SCHEMA_VERSION = 1`.
2. `lib/nexus/skill-registry/manifest-parser.ts` exists with `readNexusSkillManifest(path: string): NexusSkillManifestReadResult`.
3. `test/nexus/skill-manifest.test.ts` exists with at least the 12 cases above, all passing.
4. `docs/skill-manifest-schema.md` exists with field reference + 3+ examples.
5. `bun test` green.
6. `bun run skill:check` clean (no behavior change yet — manifests not consumed).
7. `bunx tsc --noEmit` green.
8. `repo-path-inventory.md` regenerated in the PR.
9. The 4 new files are reachable via `git grep -l "NexusSkillManifest"`.

---

## Out of scope (explicitly deferred)

These are **NOT** part of this brief:

- **Phase 2.2 (separate brief)**: SkillRegistry actually consumes manifests.
  - `discovery.ts` reads `nexus.skill.yaml` if present
  - `classification.ts` respects `manifest.classification.namespace`
  - `ranking.ts` uses `manifest.ranking.base_score` and `boosts[]`
- **Phase 2.3 (separate brief)**: First-party manifest contribution catalog.
  - `docs/skill-manifests/` containing template `nexus.skill.yaml` files for the 47 PM + 14 Superpowers skills (published examples, NOT shipped manifests)
  - `bun run skill:manifest:suggest <skill-name>` script that generates a stub manifest from a `SKILL.md`
- **Phase 2.4 (separate brief)**: `nexus setup` opt-in installer for external skills.
  - `--with-pm-skills` / `--with-superpowers` flags shell out to host's plugin manager
- **Phase 3 (separate brief)**: Stage-aware advisor that uses manifests.
- **Phase 4 (separate brief)**: Built-in `nexus.skill.yaml` for the 28 Nexus-native support + canonical skills.
- **Phase 5 (separate brief)**: `/nexus do` dispatcher.
- **Phase 6/7**: Documentation pass + shim removal.

This brief is **schema + validator + docs only**. Nothing reads the manifests yet.

---

## Effort estimate

**~4-6 hours** total:
- 30 min: schema types
- 1 hr: parser + validator
- 1.5 hr: tests (12 cases, fixtures)
- 1 hr: documentation page
- 30 min: inventory regen + verification

Smaller than D3 Phase 1 (which involved consolidating 3 modules). This is greenfield with limited surface.

---

## Risk register

| Risk | Mitigation |
|---|---|
| `js-yaml` not in dependencies | Confirm before starting; if not, add to `package.json` as part of this PR |
| Schema design too rigid (forces breaking changes later) | Keep all fields except 4 required ones optional; v2 is a future option |
| Schema design too permissive (manifests don't actually route well) | Phase 2.2 (consumption) will surface gaps; iterate |
| `intent_keywords` field shape drift | Lock down in v1 as `string[]`; phrase-matching logic lives in router (Phase 5), not in manifest |
| Manifest file naming collision (`.skill.yaml` vs `.skill.yml`) | Standard on `.yaml`. Reject `.yml` with a clear error message |

---

## Why Phase 2 must precede Phase 2.2/3/4/5

Phase 2.2-2.4 all *consume* the manifest. The schema must be defined and stable
before consumption logic is written, otherwise consumers force schema decisions
backwards from their use cases (which is how schemas get bad).

Once Phase 2 lands, Phase 2.2 (consumption), 2.3 (catalog), and 2.4
(installer) can land in any order — they're independent.

---

## Decision points (resolved before implementation)

| Decision | Resolution | Rationale |
|---|---|---|
| Use YAML, JSON, or TOML? | YAML | Human-edited; YAML is most readable for hand-authored configs. JSON is too noisy. TOML doesn't have great enum support. |
| Required vs optional fields | 4 required (`schema_version`, `name`, `summary`, `intent_keywords`); rest opt-in | Lower the bar for skill authors. Required fields are minimum needed for routing. |
| Strict vs lenient unknown fields | Lenient (warn, don't fail) | Future versions can add fields; v1 parsers shouldn't break |
| Where does the manifest live? | Co-located with `SKILL.md`: `<skill-dir>/nexus.skill.yaml` | Travels with skill content; survives marketplace updates |
| Schema versioning | `schema_version: 1` mandatory; future versions bump | Mirrors ledger pattern (PR #47) |
| File extension | `.yaml` (not `.yml`) | Standard chosen explicitly to avoid both-supported confusion |

---

## References

- `docs/architecture/track-d-d3-rfc.md` — parent RFC (§ Component 2: skill manifest)
- `docs/architecture/track-d-d3-phase-1-brief.md` — predecessor (SkillRegistry consolidation)
- `docs/architecture/phase-5-team-mode-plan.md` — Mode A/B/C constraints (manifest must work for solo Nexus user on non-Nexus team)
- `lib/nexus/skill-registry/` — where the new files live
- `lib/nexus/types.ts` — `NexusLifecycleStage` enum
- PR #47 — ledger schema versioning pattern (mirror this)
- PR #55 — discriminated union pattern for read results (mirror this)
- PR #57 / #60 — D3 Phase 1 (consolidation that this builds on)
- This session's pre-D3 audit — Model γ recommendation (manifest as cooperation surface, not absorption)

---

## Acceptance criteria for this brief itself

This document is complete when:

1. ✅ Schema defined with all field types
2. ✅ Field semantics table written
3. ✅ Optionality philosophy stated
4. ✅ Versioning strategy spelled out
5. ✅ File location convention chosen
6. ✅ Implementation procedure (6 steps) listed
7. ✅ Test coverage (12 cases) enumerated
8. ✅ Out-of-scope phases explicitly named (2.2/2.3/2.4/3/4/5/6/7)
9. ✅ Decision points resolved (no TODO placeholders)
10. ✅ References cross-link parent RFC + companion docs

This brief is ready for implementation by Codex (or human) without further design clarification.
