# Track D-D2 RFC: Remove `vendor/upstream/` and absorption surface

**Status:** Draft for review.
**Author:** Surfaced from Phase 4 architecture audit on 2026-05-04.
**Parent plan:** `docs/architecture/phase-4-plan.md` § Phase 4.3.
**Predecessor:** Track D-D1 (rename adapters by lifecycle role) — not strictly required to land first.
**Successor:** Track D-D3 (Skill ecology v2) — independent, can run in parallel after this RFC.

---

## Goal

Complete the absorption thesis by deleting the `vendor/upstream/` snapshots and
the entire absorption surface (`lib/nexus/absorption/`,
`upstream-maintenance.ts`, `upstream-compat.ts`, `maintainer-loop.ts`). After
this RFC lands:

- PM Skill / GSD / Superpowers concepts are **fully native** to Nexus —
  there is no upstream snapshot to track, refresh, or cite.
- The codebase no longer carries a "two-axis" tension (lifecycle stage +
  absorbed-source). Only the lifecycle axis remains.
- Release flow is simpler: no post-publish maintainer-status refresh step.

## Non-goals

- **Renaming `adapters/{pm,gsd,superpowers}.ts`** — that's Track D-D1, separate
  PR. This RFC keeps the existing adapter file names; D1 renames them to
  `{discovery,planning,execution}.ts` afterwards.
- **Skill ecology upgrade** — Track D-D3, independent.
- **`release_channel` semantics changes** — `stable`/`candidate`/`nightly` user
  config keeps working unchanged. Only the post-publish maintainer-status step
  is removed.
- **`bun run skill:check` modifications** — `skill:check` does not depend on
  upstream snapshots. It survives the deletion unchanged.
- **`~/.nexus/config.yaml` schema changes** — no fields reference upstream;
  no user config migration needed.

## Current state

### Files to delete

| Path | LoC | Direct importers |
|------|-----|------------------|
| `vendor/upstream/` (1231 files) | n/a | hard-coded path strings only — no TS imports |
| `vendor/upstream-notes/` (~10 files) | n/a | hard-coded path strings only — no TS imports |
| `lib/nexus/absorption/` (~18 files) | ~150 | `stage-content/source-map.ts`, `stage-packs/source-map.ts`, `scripts/upstream-refresh.ts` |
| `lib/nexus/upstream-maintenance.ts` | 506 | `maintainer-loop.ts`, `release-publication.ts`, `repo-paths.ts`, `scripts/upstream-{check,refresh}.ts`, `bin/nexus-maintainer-check`, `test/nexus/upstream-maintenance.test.ts` |
| `lib/nexus/upstream-compat.ts` | 74 | (compat-alias verification helpers; check tests via grep before deletion) |
| `lib/nexus/maintainer-loop.ts` | 276 | `bin/nexus-maintainer-check` (dynamic import via env var) |
| `scripts/upstream-check.ts` | n/a | `npm run upstream:check` only |
| `scripts/upstream-refresh.ts` | n/a | `npm run upstream:refresh` only |
| `bin/nexus-maintainer-check` | n/a | `npm run maintainer:check` only |

### Files to modify (subtractive)

| Path | Change |
|------|--------|
| `lib/nexus/repo-paths.ts` | Remove re-exports of `UPSTREAM_SOURCE_ROOT`, `UPSTREAM_NOTES_SOURCE_ROOT`, `UPSTREAM_COMPAT_ROOT` from the now-deleted `upstream-maintenance.ts` |
| `lib/nexus/repo-taxonomy.ts` | Remove 4 taxonomy entries (`upstream`, `upstream-compat`, `upstream-notes`, `upstream-notes-compat`) at lines 345-380 + remove vendor facade entry at line 582-587 + remove `vendor` category description "Absorbed upstream snapshots..." at lines 89-93 |
| `lib/nexus/release-publication.ts` | Remove `MAINTAINER_STATUS_PATHS` constant (lines 34-37) and entire post-publish block (lines 206-248) that runs `maintainer:check` and stages `maintainer-status.*` |
| `lib/nexus/stage-content/source-map.ts` | Remove imports of 4 `*_SOURCE_MAP` arrays (lines 1-5); keep required `source_refs` fields as explicit empty arrays during Phase 2.1 |
| `lib/nexus/stage-packs/source-map.ts` | Remove imports of 4 `*_SOURCE_MAP` arrays (lines 1-4); keep required `source_refs` fields as explicit empty arrays during Phase 2.1 |
| `package.json` | Remove `upstream:check`, `upstream:refresh`, `maintainer:check` script entries |
| `README.md` | Rewrite lines 19-31 ("absorbed", "upstream maintenance", "Imported upstream repos", "Managed installs are recorded as `managed_release` or `managed_vendored`...vendored copies sync to the same published Nexus release") |
| `docs/skills.md` | Rewrite lines 1-17 ("absorbed internal capability sources", "Imported upstream repos") |
| `vendor/README.md` | Delete (facade also removed from `REPO_TAXONOMY_FACADES`) |

### Files to rewrite or delete (tests)

| Path | Treatment |
|------|-----------|
| `test/nexus/inventory.test.ts` | **Rewrite**. Currently asserts on `INVENTORIES` array of 5 vendor markdown files (lines 13-19), `existsSync(row.imported_path)` (line 138), and reads `vendor/upstream/README.md` + `upstream-lock.json` for cross-validation (lines 213-264). After D2: there's no inventory to validate. Either delete the test file entirely OR repurpose it to validate something else (e.g., `references/` taxonomy, but that may already be covered). **Recommendation: delete** — the value of "drift detection on a thing that no longer exists" is zero. |
| `test/nexus/upstream-maintenance.test.ts` | **Delete**. Entire file imports from `upstream-maintenance.ts`; nothing left to test. |
| `test/nexus/upstream-release-gate.test.ts` | **Partial delete**. Lines 1-68 contain conceptual tests on local logic functions — survive. Lines 70-95 read `vendor/upstream-notes/*.md` and assert phrase contents — delete those tests. Module split into "release gate behavior" (kept) and "upstream gate validation" (deleted). |

### Top-level compat symlinks to remove

`/Users/henry/Documents/nexus/upstream` → `vendor/upstream` and
`/Users/henry/Documents/nexus/upstream-notes` → `vendor/upstream-notes` are
recorded in `repo-taxonomy.ts` as compat aliases. Remove the symlinks (or the
script that creates them) and the taxonomy entries.

---

## What does NOT need to change

This is the simplification surface — things that are **independent of upstream**
even though their names suggest otherwise:

| Surface | Why it survives |
|---------|-----------------|
| `release_channel` config (`stable`, `candidate`, `nightly`) | Defines which published Nexus bundle channel users pull from. Independent of upstream snapshots. |
| `bun run skill:check` | Validates SKILL.md command syntax, anatomy rubric, taxonomy categories, template outputs, host-generated dirs, freshness. Zero upstream imports. |
| Skill `.tmpl` rendering pipeline | Resolves template variables from native `lib/nexus/stage-content/<stage>/` files. The absorbed `*_SOURCE_MAP` references are metadata-only (provenance annotations) — content is native. |
| `~/.nexus/config.yaml` schema | None of the 13 documented config keys reference upstream or absorption concepts. |
| `managed_release` / `managed_vendored` install modes | "Vendored" here means per-project copy of the Nexus install — not `vendor/upstream/`. Different concept, same word. The user-facing install/upgrade flow is unaffected. |
| `runtimes/` sidecar binaries (`browse`, `design`, `safety`) | No upstream dependencies. |
| `hosts/` per-host configs | No upstream dependencies. |
| `lib/nexus/adapters/{pm,gsd,superpowers}.ts` | Existing adapter files survive D2. They are renamed in D1, but the interface contract is unchanged. |

---

## Implementation phasing

This is a multi-PR change because the surface area touches deletes,
modifications, test rewrites, and documentation updates. Phasing minimizes
review risk by keeping each PR focused.

### Phase 2.1 — Sever runtime imports (preparation)

**Goal:** Remove all imports from `absorption/` and `upstream-maintenance.ts`
in modules that are NOT being deleted, so the deletion in Phase 2.3 has zero
import-graph fan-out.

**Changes:**

1. `lib/nexus/stage-content/source-map.ts` — replace `source_refs: PM_SOURCE_MAP[...]` etc. with required empty arrays. Missing `source_refs` should stay a type error.
2. `lib/nexus/stage-packs/source-map.ts` — same treatment.
3. `lib/nexus/repo-paths.ts` — drop the `UPSTREAM_*` re-exports.
4. `lib/nexus/release-publication.ts` — remove `MAINTAINER_STATUS_PATHS` and the post-publish block.
5. `lib/nexus/repo-taxonomy.ts` — remove the 4 upstream taxonomy entries and vendor facade entry.

**Tests:** existing `test/nexus/inventory.test.ts` and
`upstream-release-gate.test.ts` need to be marked `.skip()` for any test that
reads from `vendor/upstream*`. Don't delete the test files yet — that comes in
Phase 2.4.

**Verification:**
- `bunx tsc --noEmit` passes
- `bun test` passes (with skipped tests)
- `bun run repo:inventory:check` passes
- Manual: run `bun run bin/nexus.ts <stage>` for one stage and verify
  completion-advisor record is unaffected by the empty `source_refs`

**Estimated effort:** 3-4 hours.

### Phase 2.2 — Remove maintainer + upstream scripts

**Goal:** Delete the maintainer-loop pipeline and `upstream:*` scripts
without yet deleting the snapshots themselves.

**Changes:**

1. Delete `lib/nexus/upstream-maintenance.ts`, `lib/nexus/maintainer-loop.ts`, `lib/nexus/upstream-compat.ts`.
2. Delete `scripts/upstream-check.ts`, `scripts/upstream-refresh.ts`.
3. Delete `bin/nexus-maintainer-check`.
4. Remove `package.json` script entries: `upstream:check`, `upstream:refresh`, `maintainer:check`.
5. Delete `test/nexus/upstream-maintenance.test.ts`.

**Verification:**
- `bun test` passes
- `bun run build` passes
- `npm run` shows no orphaned upstream/maintainer scripts

**Estimated effort:** 2 hours.

### Phase 2.3 — Delete absorption surface

**Goal:** Remove the absorption module (now unimported).

**Changes:**

1. Delete `lib/nexus/absorption/` (entire directory, ~18 files).

**Verification:**
- `bun test` passes
- `bunx tsc --noEmit` passes
- `bun run build` passes

**Estimated effort:** 30 minutes (the directory is now isolated; should be a
one-shot deletion).

### Phase 2.4 — Delete vendor snapshots and rewrite tests

**Goal:** Remove the physical upstream tree and clean up tests.

**Changes:**

1. Delete `vendor/upstream/` (entire directory, 1231 files).
2. Delete `vendor/upstream-notes/` (entire directory).
3. Delete top-level compat symlinks `upstream` and `upstream-notes`.
4. Delete `vendor/README.md` (or rewrite if `vendor/` will hold other things).
5. Delete `test/nexus/inventory.test.ts` (the things it inventories no longer exist).
6. Rewrite `test/nexus/upstream-release-gate.test.ts` to keep only the conceptual local-logic tests (lines 1-68); delete the file-reading tests (lines 70-95).
7. Update `repo-taxonomy.ts` (or earlier, depending on phasing) to remove `vendor/{upstream,upstream-notes}` entries.

**Verification:**
- `bun test` passes
- `bun run build` passes
- `git status` shows no broken symlinks
- `find . -path './node_modules' -prune -o -name 'upstream-*' -print` returns nothing surprising

**Estimated effort:** 1 hour.

### Phase 2.5 — Documentation rewrite

**Goal:** Update narrative claims to reflect post-D2 reality.

**Changes (revised 2026-05-05 with audit-discovered additions):**

1. `README.md` lines 19-31 — rewrite the "absorbed", "upstream maintenance", "Imported upstream repos" sections. New narrative: PM Skill / GSD / Superpowers concepts are native Nexus capabilities; release flow is independent of any upstream tracking.
2. `docs/skills.md` lines 1-17 — same rewrite.
3. `docs/architecture/post-audit-cleanup-plan.md` — add a closing note that D2 has landed, retiring the "Future work" section about deep external-skill cooperation (move that to Track D-D3 RFC).
4. `docs/architecture/phase-4-plan.md` — mark Phase 4.3 D2 as ☑.

**Audit-discovered additions** (not in original RFC scope; surfaced during the
pre-D2 audit on 2026-05-05):

5. `docs/superpowers/runbooks/upstream-refresh.md` — **DELETE entirely**. The runbook describes a tool (`scripts/upstream-refresh.ts`) that no longer exists post-2.2.
6. `docs/superpowers/runbooks/nexus-release-publish.md` — audit for any `vendor/upstream*` references; prune as needed.
7. `docs/architecture/repo-taxonomy-v2.md` — prune `vendor/upstream*` mentions at lines 51-90 + 223 (audit-identified specific lines).
8. `setup` script line 746 — remove the `-path "$nexus_dir/vendor/upstream"` find-prune exclusion (becomes dead code post-2.4).

**Verification:**
- `git grep -i "absorbed from upstream"` returns nothing (or only intentional historical references)
- `git grep "vendor/upstream"` returns nothing in source code (only intentional references in track-d-d2-rfc.md / phase-4-plan.md as historical record)
- `git grep "upstream-refresh"` returns nothing in scripts / runbooks (the deleted tool + its runbook are gone)
- README narrative reads coherently

**Estimated effort:** ~2-3 hours (mostly editing). +30-45 min for audit-discovered additions = total 2.5-3.5h.

---

## Total effort estimate

| Phase | Effort | Risk |
|-------|--------|------|
| 2.1 — Sever runtime imports | 3-4h | Low (mechanical, tsc-checked) |
| 2.2 — Remove maintainer scripts | 2h | Low |
| 2.3 — Delete absorption surface | 30min | Very low (no importers) |
| 2.4 — Delete vendor snapshots + tests | 1h | Low |
| 2.5 — Documentation rewrite (incl. audit additions) | 2.5-3.5h | Low (no runtime impact) |
| **Total** | **~9-12h** | |

This is roughly half my earlier estimate of 10-15h because `skill:check`
doesn't need replacement, `~/.nexus/config.yaml` doesn't need migration, and
skill prose templates need no rewrites. The map-the-surface phase before this
RFC saved real implementation time.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking change for users with vendored installs | Low | Medium | `managed_vendored` install mode is per-project Nexus copy, not `vendor/upstream/` — names are confusingly close but unrelated. Vendored installs continue to work normally. |
| Hidden import we missed | Medium | Medium | Phase 2.1 mechanical sever + tsc check catches any direct import. Hidden dynamic imports (string-evaluated) would survive — Phase 2.2 explicitly removes the only known dynamic-import case (`bin/nexus-maintainer-check`). |
| Test coverage regression | Medium | Low | `test/nexus/inventory.test.ts` deletion removes tests that validate things no longer existing (zero coverage value). Other tests survive. |
| `release_channel` confusion in user config | Low | Low | Field semantics unchanged. If users have legacy `~/.nexus/config.yaml` referencing maintainer state, those keys are silently ignored. |
| External tooling expects `vendor/upstream/` to exist | Low | Medium | We don't ship anything that documents this path as a public API. Documentation and skill prose don't reference it. Users running `vendor/upstream/...` paths in their own scripts would break — but this is internal Nexus state, not a user contract. |
| `CHANGELOG.md` continuity | Low | Very low | This RFC's deletion is one entry. Historical commits referencing absorbed upstream remain; that's correct (history shouldn't be revised). |
| Branch coordination during rollout | Medium | Medium | If contributors have in-flight branches based on pre-D2 main, they'll need rebasing. Coordinate with active PR authors before starting Phase 2.1. |

---

## Decision points

These need explicit answers before Phase 2.1 starts.

### Decision 1: Aggressiveness of `repo-path-inventory.md` regeneration

`docs/architecture/repo-path-inventory.md` is auto-generated. After D2, it will
shrink significantly (no `vendor/upstream*` rows, no upstream taxonomy facades).

| Option | Description |
|--------|-------------|
| Regenerate per-phase | Each PR (2.1, 2.2, ...) regenerates inventory; expect one inventory churn per phase |
| Regenerate only at the end | Don't touch inventory until Phase 2.4 / 2.5; tolerate stale entries during phases |

**Recommendation:** Regenerate per-phase. This avoids one massive last-minute
inventory diff and surfaces any taxonomy regression early.

### Decision 2: `vendor/` directory after D2

After D2, `vendor/` is empty. Two options:

| Option | Description |
|--------|-------------|
| Delete `vendor/` | Aggressive; signals "no vendored code in this repo" |
| Keep `vendor/` (empty) | Conservative; preserves the namespace for future vendoring |

**Recommendation:** **Delete**. Nexus uses `runtimes/` for separately-shipped
binaries; nothing in the architecture suggests a need for `vendor/`. If a
future need arises, recreate cleanly.

### Decision 3: `lib/nexus/stage-{content,packs}/source-map.ts` `source_refs` field

After absorption deletion, `source_refs` is empty. Two options:

| Option | Description |
|--------|-------------|
| Remove the field | Cleaner type definitions; less code after all consumers are retired |
| Keep as empty array | Preserves the schema and makes "no upstream refs" explicit |

**Recommendation for Phase 2.1:** **Keep as empty array**. This preserves the
contract while runtime imports are severed, and prevents missing-field bugs from
collapsing into silent empty results. Removing the field can be reconsidered
after the upstream-refresh and absorption surfaces are deleted.

---

## Acceptance criteria

D2 is complete when:

1. `git ls-files | grep -E '^(vendor/(upstream|upstream-notes)|lib/nexus/(absorption|upstream-)|scripts/upstream-)' ` returns zero results.
2. `bun test` passes (with deleted tests removed, not just skipped).
3. `bun run build` passes.
4. `bunx tsc --noEmit` passes.
5. `git grep -i "absorbed from upstream"` returns zero source-file matches (historical commit messages excluded).
6. `git grep "vendor/upstream"` returns zero source-file matches.
7. `npm run` lists no upstream/maintainer scripts.
8. `README.md` and `docs/skills.md` no longer claim upstream is "source material".
9. `docs/architecture/repo-path-inventory.md` reflects post-D2 state with no orphaned upstream rows.
10. The post-publish flow in `release-publication.ts` no longer commits maintainer-status files.

---

## References

- `docs/architecture/phase-4-plan.md` — parent plan
- `docs/architecture/context-diagram.md` — system overview that surfaced this need
- `docs/architecture/post-audit-cleanup-plan.md` — Phase 4 origin (now superseded by phase-4-plan.md for D2 details)
- Companion RFC: `docs/architecture/track-d-d3-rfc.md` — Skill ecology v2 (independent, can run in parallel after D1 lands)
- `lib/nexus/upstream-maintenance.ts` — primary deletion target (506 LoC)
- `lib/nexus/absorption/` — primary deletion target (~18 files)
- README narrative claims to rewrite: README.md:19-31, docs/skills.md:1-17

---

## Open questions for review

1. Should D2 land before or after D1 (rename adapters)? **Recommendation: D1 first** — renaming adapters is purely cosmetic and reduces D2's diff cognitive load (one less mental axis when reading the D2 PRs).

2. Should we batch Phase 2.1-2.5 into fewer PRs? **Recommendation: keep them separate** — each PR has different risk profiles; separating them keeps git log legible and review focused.

3. Should the vendored snapshots be **archived** (e.g., to a separate dead-storage repo) before deletion? **Recommendation: no** — git history preserves them; recreating them from history is one `git checkout <pre-D2-sha>` away if ever needed. Archiving adds operational burden.

4. Should we add a CHANGELOG.md entry summarizing D2 for users? **Recommendation: yes** — this is a meaningful internal architecture change that future contributors should be able to understand from the changelog. Even though no user-facing API changes, the conceptual shift ("Nexus is fully native, no upstream") is worth documenting.
