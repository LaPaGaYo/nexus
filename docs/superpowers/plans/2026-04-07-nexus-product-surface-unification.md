# Nexus Product Surface Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nexus the primary product surface across package metadata, setup/install flows, generated host assets, and documentation while preserving Gstack compatibility internals where needed.

**Architecture:** Keep `lib/nexus/` and canonical `.planning/` artifacts unchanged as the governed truth layer, then unify the visible product surface in four layers: product identity constants, generated wrapper/preamble prose, host setup and namespace behavior, and top-level package/docs/install messaging. Gstack-compatible roots and binaries remain as compatibility substrate, but they stop owning the visible product language.

**Tech Stack:** Bun, TypeScript, bash setup/bin scripts, markdown docs, generated `SKILL.md`, Bun test

---

## Execution Base

This plan should execute from:

- branch: `codex/nexus-governed-runtime-completion`
- baseline: Milestone 6 complete

Do not begin implementation from `main`.

## Locked Rules

- canonical Nexus lifecycle commands remain unchanged
- `lib/nexus/` remains the only contract owner
- `.planning/` and canonical stage artifacts remain the only governed truth
- this milestone does not migrate `~/.gstack` to `~/.nexus`
- Gstack-compatible binaries and directories may remain functional as compatibility-only substrate
- the visible product surface must become Nexus-primary
- if host namespacing is shown to users, the primary namespace becomes `nexus-`
- legacy `gstack-*` names may remain as migration compatibility aliases, but not as the preferred surface
- CCB remains transport only
- lifecycle truth must not move into host state or setup scripts

## File Structure

### Existing Files To Modify

- `package.json`
- `README.md`
- `docs/skills.md`
- `setup`
- `bin/gstack-config`
- `bin/gstack-patch-names`
- `bin/gstack-relink`
- `bin/gstack-uninstall`
- `scripts/gen-skill-docs.ts`
- `scripts/resolvers/preamble.ts`
- `scripts/resolvers/codex-helpers.ts`
- `scripts/resolvers/types.ts`
- `upstream-notes/legacy-host-migration-history.md`
- `upstream-notes/absorption-status.md`
- `test/gen-skill-docs.test.ts`
- `test/skill-validation.test.ts`
- `test/relink.test.ts`
- `test/uninstall.test.ts`
- `test/nexus/claude-boundary.test.ts`
- `test/nexus/inventory.test.ts`

### New Files To Add

- `lib/nexus/product-surface.ts`
- `test/nexus/product-surface.test.ts`
- `bin/nexus-config`
- `bin/nexus-relink`
- `bin/nexus-uninstall`
- `bin/nexus-update-check`
- `docs/superpowers/closeouts/2026-04-07-nexus-product-surface-unification-closeout.md`

## Task 1: Freeze The Nexus Product-Surface Contract

**Files:**
- Create: `lib/nexus/product-surface.ts`
- Create: `test/nexus/product-surface.test.ts`
- Modify: `test/nexus/claude-boundary.test.ts`
- Modify: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Add failing tests for product-surface ownership**

Require:

- package and product display identity freeze to Nexus-primary values
- the preferred namespace freeze to `nexus`
- compatibility namespace freeze to `gstack`
- docs and generated host surfaces must not present Gstack as the product owner
- host-migration inventory still marks Gstack structures as compatibility or migration-only

- [ ] **Step 2: Run the targeted contract tests**

Run:

```bash
bun test test/nexus/product-surface.test.ts test/nexus/claude-boundary.test.ts test/nexus/inventory.test.ts
```

Expected:

- FAIL because the shared product-surface contract does not exist yet.

- [ ] **Step 3: Add the shared product-surface constants**

Define in `lib/nexus/product-surface.ts`:

- primary product name
- primary package name
- primary namespace prefix
- legacy compatibility namespace
- compatibility state-root markers

Keep the file descriptive only. It must not gain lifecycle authority.

- [ ] **Step 4: Re-run the targeted contract tests**

Run:

```bash
bun test test/nexus/product-surface.test.ts test/nexus/claude-boundary.test.ts test/nexus/inventory.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/product-surface.ts test/nexus/product-surface.test.ts test/nexus/claude-boundary.test.ts test/nexus/inventory.test.ts
git commit -m "feat: freeze nexus product surface contracts"
```

## Task 2: Make Generated Wrapper And Preamble Surface Nexus-Primary

**Files:**
- Modify: `scripts/gen-skill-docs.ts`
- Modify: `scripts/resolvers/preamble.ts`
- Modify: `scripts/resolvers/codex-helpers.ts`
- Modify: `scripts/resolvers/types.ts`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`

- [ ] **Step 1: Add failing tests for generated Nexus-primary surface**

Require:

- generated wrapper frontmatter and body prose present Nexus as the product
- generated external-host names prefer `nexus-*` when namespacing is used
- preamble copy references Nexus rather than Gstack as the product
- CLAUDE guidance remains Nexus-owned discovery help only

- [ ] **Step 2: Run the targeted generator and wrapper tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/nexus/claude-boundary.test.ts
```

Expected:

- FAIL because generator and preamble output still use Gstack-primary wording and names.

- [ ] **Step 3: Rework generator and preamble output**

Implement:

- Nexus-primary external host naming
- Nexus-primary frontmatter descriptions
- Nexus-primary preamble prompts for update, telemetry, proactive behavior, and routing help
- unchanged governed routing semantics

Keep compatibility binary invocations working even if the visible copy changes.

- [ ] **Step 4: Regenerate host docs**

Run:

```bash
bun run gen:skill-docs --host codex
```

Expected:

- succeeds and rewrites generated host assets with Nexus-primary surface language.

- [ ] **Step 5: Re-run the targeted tests**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/nexus/claude-boundary.test.ts
```

Expected:

- PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/gen-skill-docs.ts scripts/resolvers/preamble.ts scripts/resolvers/codex-helpers.ts scripts/resolvers/types.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts test/nexus/claude-boundary.test.ts .agents/skills
git commit -m "feat: make generated nexus wrappers and preamble surface primary"
```

## Task 3: Rework Namespace And Relink Behavior Around Nexus-Primary Names

**Files:**
- Modify: `setup`
- Modify: `bin/gstack-patch-names`
- Modify: `bin/gstack-relink`
- Modify: `bin/gstack-config`
- Modify: `test/relink.test.ts`
- Modify: `test/gen-skill-docs.test.ts`

- [ ] **Step 1: Add failing tests for Nexus-primary namespacing**

Require:

- namespaced installs prefer `nexus-*`
- flat installs still use flat canonical names
- legacy `gstack-*` links can remain as compatibility aliases where required
- patch-name behavior writes `nexus-*` as the preferred generated `name:` field when namespacing is on
- setup and relink output describe Nexus rather than Gstack as the product

- [ ] **Step 2: Run the targeted namespace tests**

Run:

```bash
bun test test/relink.test.ts test/gen-skill-docs.test.ts
```

Expected:

- FAIL because relink and patch-name behavior still prefer `gstack-*`.

- [ ] **Step 3: Update setup, relink, and patch-name flows**

Implement:

- Nexus-primary namespace handling
- compatibility cleanup logic for old `gstack-*` symlinks
- setup-time wording that explains Nexus-first behavior
- continued compatibility with existing migration-era config values

- [ ] **Step 4: Re-run the targeted namespace tests**

Run:

```bash
bun test test/relink.test.ts test/gen-skill-docs.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add setup bin/gstack-patch-names bin/gstack-relink bin/gstack-config test/relink.test.ts test/gen-skill-docs.test.ts
git commit -m "feat: prefer nexus namespace in host setup and relink"
```

## Task 4: Add Nexus-Branded Host Entry Points And Keep Compatibility Wrappers

**Files:**
- Create: `bin/nexus-config`
- Create: `bin/nexus-relink`
- Create: `bin/nexus-uninstall`
- Create: `bin/nexus-update-check`
- Modify: `bin/gstack-uninstall`
- Modify: `setup`
- Modify: `test/uninstall.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for Nexus-branded host helpers**

Require:

- Nexus-branded helper entrypoints exist
- uninstall help and setup guidance show Nexus-primary usage
- Gstack helper entrypoints continue to work as compatibility shims
- uninstall behavior still preserves non-Gstack tools and optional state retention

- [ ] **Step 2: Run the targeted host-helper tests**

Run:

```bash
bun test test/uninstall.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because Nexus-branded helper entrypoints do not exist yet.

- [ ] **Step 3: Add Nexus-branded wrappers and update uninstall/setup messaging**

Implement:

- thin Nexus-branded wrapper scripts that delegate to current compatibility implementations
- Nexus-primary help text and setup references
- unchanged uninstall behavior and state-retention semantics

- [ ] **Step 4: Re-run the targeted host-helper tests**

Run:

```bash
bun test test/uninstall.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-config bin/nexus-relink bin/nexus-uninstall bin/nexus-update-check bin/gstack-uninstall setup test/uninstall.test.ts test/nexus/product-surface.test.ts
git commit -m "feat: add nexus branded host helper entrypoints"
```

## Task 5: Reframe Package Metadata, README, And Skills Docs Around Nexus

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/skill-validation.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Add failing tests for Nexus-primary package and docs**

Require:

- package metadata uses Nexus-primary identity
- README presents Nexus from the first screen
- docs/skills presents Nexus as the only product surface
- utility and compatibility guidance are clearly secondary

- [ ] **Step 2: Run the targeted package/docs tests**

Run:

```bash
bun test test/skill-validation.test.ts test/nexus/product-surface.test.ts
```

Expected:

- FAIL because package metadata and top-level docs still present Gstack as the product.

- [ ] **Step 3: Rewrite package/docs surface**

Implement:

- Nexus-primary `package.json` name and description
- README quick start and install surface centered on Nexus
- compatibility sections that clearly demote Gstack-specific guidance
- docs/skills framing that keeps lifecycle and capability ownership intact

- [ ] **Step 4: Re-run the targeted package/docs tests**

Run:

```bash
bun test test/skill-validation.test.ts test/nexus/product-surface.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md docs/skills.md test/skill-validation.test.ts test/nexus/product-surface.test.ts
git commit -m "docs: reframe package and docs around nexus"
```

## Task 6: Align Inventories, Run Full Regression, And Close Out The Milestone

**Files:**
- Modify: `upstream-notes/legacy-host-migration-history.md`
- Modify: `upstream-notes/absorption-status.md`
- Create: `docs/superpowers/closeouts/2026-04-07-nexus-product-surface-unification-closeout.md`

- [ ] **Step 1: Update migration inventories**

Record:

- which host surfaces are now Nexus-primary
- which Gstack helpers remain compatibility-only
- what still remains for a later state-root or helper-name migration

- [ ] **Step 2: Run Nexus regression**

Run:

```bash
bun test test/nexus/*.test.ts
```

Expected:

- PASS.

- [ ] **Step 3: Run host and install regression**

Run:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts
```

Expected:

- PASS.

- [ ] **Step 4: Regenerate host docs and verify formatting**

Run:

```bash
bun run gen:skill-docs --host codex
git diff --check
```

Expected:

- generation succeeds
- `git diff --check` is clean

- [ ] **Step 5: Write the closeout**

Summarize:

- Nexus now owns the visible product surface
- Gstack remains only as compatibility substrate where still required
- governed runtime truth remained unchanged
- verification evidence for package, setup, docs, generator, relink, uninstall, and Nexus regression

- [ ] **Step 6: Commit**

```bash
git add upstream-notes/legacy-host-migration-history.md upstream-notes/absorption-status.md docs/superpowers/closeouts/2026-04-07-nexus-product-surface-unification-closeout.md
git commit -m "docs: close out nexus product surface unification"
```

## Spec Coverage Check

This plan covers the spec sections for:

- package and install identity
- generated host skill identity
- preamble and CLAUDE guidance
- README and docs reframe
- utility and compatibility surface rules
- verification and migration inventory updates

The intentionally deferred items remain deferred:

- full `~/.gstack` to `~/.nexus` migration
- deletion of all Gstack compatibility helpers
- lifecycle contract changes

## Execution Recommendation

Recommended execution order:

1. freeze product-surface contract
2. generator and preamble branding
3. namespace and relink behavior
4. Nexus-branded host wrappers
5. package/docs rewrite
6. inventories, regression, and closeout

This order keeps the visible surface changes consistent while minimizing the risk of
breaking current installs.
