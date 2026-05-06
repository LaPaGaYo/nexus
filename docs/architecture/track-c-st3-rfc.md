# Track C ST3 RFC: Move `CHANGELOG.md` / `TODOS.md` out of repo root

**Status:** Draft. **Decision pending — user must pick between Options A/B/C/D below before implementation.**

**Type:** Documentation + runtime path migration.

**Parent plan:** `docs/architecture/phase-4-plan.md` § Phase 4.4 ST3.
**Issue:** #84 (filed as "needs RFC first").

---

## Goal

Decide whether to move `CHANGELOG.md` and `TODOS.md` out of repo root, and if
so, where. Then specify the migration path (file moves + runtime references +
skill prose updates).

The "move?" question is not obvious — these files are runtime artifacts that
Nexus's skill generators read, not just documentation. A naive `git mv` to
`docs/` would break the resolver scripts that reference them by relative path.

---

## Current state

### File location

- `CHANGELOG.md` (~183 KB) — repo root
- `TODOS.md` (~33 KB) — repo root

### Runtime readers

These files are not just docs — they're **runtime input** to skill prose
generators:

| File | Reader | Purpose |
|---|---|---|
| `CHANGELOG.md` | `scripts/resolvers/utility.ts` | Skill prose tells contributors to "Read CHANGELOG.md header to know the format" — referenced by name |
| `TODOS.md` | `scripts/resolvers/preamble.ts` | If TODOS.md exists, append entry following format reference |
| `TODOS.md` | `scripts/resolvers/review.ts` | Read TODOS.md (if exists) during `/review` for branch-relevant items |
| `TODOS.md` | `scripts/resolvers/utility.ts` | Read TODOS.md during `/qa` for known bugs |

### Skill prose references

`grep` finds direct references to these filenames in:

- `skills/support/document-release/SKILL.md` (+ `.tmpl`)
- `skills/support/land-and-deploy/SKILL.md` (+ `.tmpl`)
- `skills/support/nexus-upgrade/SKILL.md` (+ `.tmpl`)
- `skills/support/cso/SKILL.md` (+ `.tmpl`)
- `skills/support/design-review/SKILL.md` (+ `.tmpl`)

Total: ~10+ skill files mention `CHANGELOG.md` or `TODOS.md` by name in
user-facing prose (instructions to the AI / human user).

### Repo taxonomy classification

Both files are listed in `lib/nexus/repo-taxonomy.ts` as `root` category with
`keep_in_place` move policy. Moving them changes the taxonomy.

---

## Problem statement: why consider moving?

Three motivations from `post-audit-cleanup-plan.md` ST3:

1. **Repo root creep**: root currently has 19 tracked files. Industry norm is
   ~10 max. Moving these two helps visual cleanliness.
2. **Semantic mismatch**: `CHANGELOG.md` is a release artifact (more akin to
   `docs/`), `TODOS.md` is a planning artifact (more akin to `.planning/` or
   `docs/`). Their location in root is a historical accident.
3. **Future-proofing**: as Phase 5+ workflows mature, root-only artifacts are
   harder to consume from sub-tools that operate on subdirectories.

Counter-arguments:

- Status quo works. Nothing is broken today.
- Both files are *git-tracked source of truth* — moving them risks tooling
  drift across CI / publishing scripts / external integrations.
- Many open-source projects keep CHANGELOG.md in root by convention. Users
  expect to find it there.

This RFC's job is to weigh these and make a recommendation.

---

## Options

### Option A: Stay in root (do nothing)

**What:** Reject the move. Keep status quo. Document in repo-taxonomy-v2.md
that `CHANGELOG.md` + `TODOS.md` are intentionally root-level by convention.

**Pros:**
- Zero migration work
- No tool/integration breakage risk
- Matches OSS convention (CHANGELOG.md in root)
- Skill prose doesn't need updates

**Cons:**
- Doesn't address ST3's stated motivation (root cleanup)
- TODOS.md location remains semantically odd

**Effort:** ~15 min (just document the decision).

### Option B: Move to `docs/`

**What:**
- `CHANGELOG.md` → `docs/CHANGELOG.md`
- `TODOS.md` → `docs/TODOS.md`

**Pros:**
- Clean root
- Both feel doc-like; `docs/` is plausible home
- Already tracked-by-Nexus location (familiar to skill prose)

**Cons:**
- Many CI / release tools assume `CHANGELOG.md` in root (e.g., `gh release
  create --notes-file CHANGELOG.md`, GitHub Releases auto-link, etc.)
- Skill prose needs updates in ~10 files
- Resolvers need path updates (`scripts/resolvers/*.ts`)
- Breaking change for any external integration

**Effort:** ~2-3h (move + 10+ prose updates + 3 resolver updates + tests + docs).

### Option C: Move to `.planning/`

**What:**
- `CHANGELOG.md` → keep in root (it's a release artifact for external readers)
- `TODOS.md` → `.planning/TODOS.md` (it's a planning artifact, internal)

**Pros:**
- Splits semantic concerns: release artifact stays public-facing; planning
  artifact joins planning surface
- Less-risky than full move (CHANGELOG.md unaffected)
- TODOS.md fits `.planning/` ergonomically

**Cons:**
- Inconsistent (only one file moves)
- `.planning/` is currently lifecycle-stage scoped; TODOS.md is cross-stage
- Skill prose still needs ~5+ files updated
- Resolvers still need path updates

**Effort:** ~1.5-2h.

### Option D: Move CHANGELOG to `docs/`, leave TODOS in root

**What:**
- `CHANGELOG.md` → `docs/CHANGELOG.md`
- `TODOS.md` → keep in root

**Pros:**
- Treats CHANGELOG as docs (release notes are documentation)
- TODOS stays accessible to the resolvers without path changes

**Cons:**
- Same tooling-breakage risk as Option B for CHANGELOG
- Inconsistent decision (only one file moves)
- Doesn't address TODOS being semantically odd in root

**Effort:** ~1.5-2h.

---

## Recommendation

> **TODO — needs Henry's call.** This RFC's purpose is to surface the
> decision; the recommendation below is a strawman.

**Strawman recommendation: Option A (stay in root) with documentation.**

Rationale:

1. **OSS convention strongly favors CHANGELOG.md in root.** GitHub auto-links
   it on release pages; many tools assume the path. Moving creates
   integration drag that has no clear payoff.
2. **TODOS.md's "internal vs external" framing is weak.** Both files are
   tracked in git and visible to all readers. The distinction between
   "planning artifact" and "release artifact" is mostly cosmetic.
3. **Cost/benefit**: Option A is 15 min vs 2-3h for Option B with no
   functional improvement.
4. **Repo root creep is real but Phase 4 has bigger fish.** ST3's "root has
   19 files" is a static observation — closing more polish issues (ST2/4/7/8)
   reduces creep without touching this.

If the user feels strongly about cleanup: **Option C** (move only TODOS.md
to `.planning/`) is the highest-payoff move with manageable risk.

---

## Implementation plan (assuming Option B chosen)

This section is conditional. If user picks Option A, only the doc-update
sub-bullets apply. If C or D, scope back accordingly.

### Step 1: Move files

```bash
git mv CHANGELOG.md docs/CHANGELOG.md
git mv TODOS.md docs/TODOS.md
```

### Step 2: Update runtime resolvers

Edit `scripts/resolvers/utility.ts`:
- Replace `CHANGELOG.md` → `docs/CHANGELOG.md` (or use a constant)
- Replace `TODOS.md` → `docs/TODOS.md`

Edit `scripts/resolvers/preamble.ts`:
- Replace `TODOS.md` → `docs/TODOS.md`

Edit `scripts/resolvers/review.ts`:
- Replace `TODOS.md` → `docs/TODOS.md`

Consider extracting paths to a shared constant in `lib/nexus/repo-paths.ts`:
```typescript
export const CHANGELOG_PATH = 'docs/CHANGELOG.md';
export const TODOS_PATH = 'docs/TODOS.md';
```

### Step 3: Update skill prose (10+ files)

Skills that reference these filenames in prose need updating. Touch both
`SKILL.md` and `SKILL.md.tmpl` for each:

- `skills/support/document-release/SKILL.md{,.tmpl}` — 4+ refs to CHANGELOG.md
- `skills/support/land-and-deploy/SKILL.md{,.tmpl}` — 1 ref to CHANGELOG.md
- `skills/support/nexus-upgrade/SKILL.md{,.tmpl}` — 1 ref to CHANGELOG.md
- `skills/support/cso/SKILL.md{,.tmpl}` — 1 ref to TODOS.md
- `skills/support/design-review/SKILL.md{,.tmpl}` — 4+ refs to TODOS.md

Regenerate via `bun run gen:skill-docs --host codex` (and other hosts).

### Step 4: Update repo taxonomy

Edit `lib/nexus/repo-taxonomy.ts`:
- Move `CHANGELOG.md`, `TODOS.md` entries from `root` category to `docs`
- Update move_policy from `keep_in_place` to `compat_required` (if backwards-
  compat symlink in root) or simply remove (if hard cut)

### Step 5: Decide compat strategy

Two options:
- **Hard cut**: Just move the files. Any external tool referencing root-level
  paths breaks. Document in CHANGELOG.md (the moved one!).
- **Compat symlinks**: Add `CHANGELOG.md` and `TODOS.md` symlinks in root
  pointing to `docs/`. Tools keep working; gradual migration. Plan to remove
  symlinks after ~6 months.

Recommend **compat symlinks** for at least 1 release cycle.

### Step 6: Update README

If README links to CHANGELOG.md by relative path, update.

### Step 7: Verify

```bash
bun test                                                          # green
bunx tsc --noEmit                                                 # green
bun run skill:check                                               # clean
bun run repo:inventory:check                                      # regen + green
git grep -F "'CHANGELOG.md'" -- lib/ scripts/                    # zero (or only repo-paths.ts constant)
git grep -F "'TODOS.md'" -- lib/ scripts/                        # zero
git grep -F "CHANGELOG.md" -- skills/                            # zero (post-regen)
git grep -F "TODOS.md" -- skills/                                # zero (post-regen)
```

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GitHub auto-link breakage | High (Option B/D) | Medium | Compat symlink + announce in CHANGELOG |
| External CI / release tools break | Medium | High | Compat symlink; survey integrations first |
| Skill prose `.tmpl` regen drift | Medium | Low | `bun run skill:check` catches stale files |
| Resolver paths missed | Low | High | `git grep` verification step |
| Existing `.planning/` workflows break (Option C) | Low | Medium | Test resolvers on a sample milestone |
| User confusion on root → docs/ change | Medium | Low | Document in CHANGELOG; pin migration note |

---

## Decision points (resolved before implementation)

| Decision | Status | Notes |
|---|---|---|
| Move at all? (A vs B/C/D) | **Pending user** | This RFC's central question |
| Move target if yes (B/C/D) | Pending user | Depends on first decision |
| Compat symlinks? | Strawman: yes for 1 release cycle | Reduce break-radius |
| Path constants in `lib/nexus/repo-paths.ts`? | Strawman: yes | Centralize for future moves |
| Hard cut vs gradual? | Strawman: gradual via symlinks | OSS-friendly |

---

## Acceptance criteria

This RFC is **complete** when:

1. ✅ Current state documented (file location, runtime readers, skill prose
   references, taxonomy classification)
2. ✅ Problem statement with motivations + counter-arguments
3. ✅ 4 options with pros / cons / effort
4. ✅ Strawman recommendation
5. ✅ Implementation plan for each option
6. ✅ Risk register
7. ⏳ **User picks an option** (A/B/C/D) — this RFC freezes after that

The implementation issue (#84) becomes actionable only after the user picks.

---

## References

- `docs/architecture/post-audit-cleanup-plan.md` Phase 4 ST3 (original mention)
- `docs/architecture/phase-4-plan.md` Phase 4.4 (queues this RFC)
- `docs/architecture/phase-4-backlog.md` issue #84 entry (status: needs RFC first)
- `lib/nexus/repo-taxonomy.ts` (current classification)
- `scripts/resolvers/{preamble,review,utility}.ts` (runtime readers)
- `skills/support/{document-release,land-and-deploy,nexus-upgrade,cso,design-review}` (prose references)

---

## Open questions for review

1. **Convention vs cleanliness**: How much weight should we give "OSS root
   convention" vs "Nexus root creep"? If 19 files in root is acceptable, the
   move adds nothing.

2. **Symbol vs path**: Should the move come with introducing
   `lib/nexus/repo-paths.ts` constants for these paths regardless of the
   final decision? That alone is a useful abstraction (one place to change
   when a future move happens).

3. **Should ST3 wait until after Phase 4?** This is polish; D2/D3 main work is
   higher leverage. If the answer is "stay in root for now, revisit in 6
   months", the RFC freezes as Option A immediately.

4. **TODO migration support**: If TODOS.md moves (Options B/C), do we need a
   first-run migration that detects pre-move repos and offers to move
   automatically? Or just hard-cut and document?
