# Nexus Upstream Refresh And Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Nexus-owned upstream maintenance loop that checks imported sources, stages refresh candidates, gates absorption work, and keeps user-visible upgrades tied only to published Nexus releases.

**Architecture:** Introduce a machine-readable upstream lock contract under `upstream-notes/`, implement `upstream:check` and `upstream:refresh` as Nexus-owned scripts, and keep release/upgrade semantics separated so users only see Nexus versions while maintainers manage upstream freshness internally. Reuse existing inventories, absorption source maps, and `nexus-update-check` / `/nexus-upgrade` rather than inventing a second update system.

**Tech Stack:** Bun, TypeScript, Markdown inventories, JSON lock file, existing Nexus tests under `test/nexus/`

---

### Task 1: Freeze upstream maintenance contracts

**Files:**
- Create: `lib/nexus/upstream-maintenance.ts`
- Create: `upstream-notes/upstream-lock.json`
- Create: `upstream-notes/update-status.md`
- Modify: `upstream/README.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `test/nexus/inventory.test.ts`
- Create: `test/nexus/upstream-maintenance.test.ts`

- [ ] **Step 1: Define the maintenance contract in code**

Add a Nexus-owned maintenance module that exports:
- upstream names: `pm-skills`, `gsd`, `superpowers`, `claude-code-bridge`
- the current repo URLs and pinned commits
- the allowed refresh statuses and absorption decisions
- helpers for locating the matching inventory file and imported path

- [ ] **Step 2: Create the initial lock file**

Write `upstream-notes/upstream-lock.json` with one record per upstream:
- `name`
- `repo_url`
- `imported_path`
- `pinned_commit`
- `last_checked_commit`
- `last_checked_at`
- `behind_count`
- `refresh_status`
- `last_refresh_candidate_at`
- `last_absorption_decision`
- `active_absorbed_capabilities`
- `notes`

Initialize the file from the currently pinned commits already documented in:
- `upstream/README.md`
- `lib/nexus/absorption/*/source-map.ts`

- [ ] **Step 3: Add a repo-visible status stub**

Create `upstream-notes/update-status.md` with an initial “no checks run yet” status block so the path exists before the first check command writes a live report.

- [ ] **Step 4: Update docs to acknowledge the new contract**

Update `upstream/README.md` and `upstream-notes/absorption-status.md` so they mention:
- `upstream-lock.json` as maintenance truth
- `update-status.md` as the human-readable freshness summary
- imported upstreams remain source material only

- [ ] **Step 5: Lock the contract with tests**

Add `test/nexus/upstream-maintenance.test.ts` and extend `test/nexus/inventory.test.ts` to verify:
- `upstream-lock.json` exists and contains the four current upstreams
- lock records match the repo URLs and pinned commits in `upstream/README.md`
- `update-status.md` exists
- no lock record declares imported upstreams as runtime truth

- [ ] **Step 6: Verify**

Run:
```bash
bun test test/nexus/upstream-maintenance.test.ts test/nexus/inventory.test.ts
```

Expected:
- all tests pass

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/upstream-maintenance.ts upstream-notes/upstream-lock.json upstream-notes/update-status.md upstream/README.md upstream-notes/absorption-status.md test/nexus/upstream-maintenance.test.ts test/nexus/inventory.test.ts
git commit -m "feat: add upstream maintenance contracts"
```

### Task 2: Implement `upstream:check`

**Files:**
- Create: `scripts/upstream-check.ts`
- Modify: `package.json`
- Modify: `upstream-notes/update-status.md`
- Modify: `upstream-notes/upstream-lock.json`
- Modify: `lib/nexus/upstream-maintenance.ts`
- Create: `test/nexus/upstream-check.test.ts`

- [ ] **Step 1: Add the package script**

Add a new package script:
- `"upstream:check": "bun run scripts/upstream-check.ts"`

- [ ] **Step 2: Implement the check script**

`scripts/upstream-check.ts` should:
- read the upstream contract from `lib/nexus/upstream-maintenance.ts`
- fetch the latest remote commit for each upstream repo
- compare it to the pinned commit in `upstream-notes/upstream-lock.json`
- compute `behind_count` when possible
- update `last_checked_commit`, `last_checked_at`, and `behind_count`
- write a fresh summary into `upstream-notes/update-status.md`

The summary should include, per upstream:
- pinned commit
- latest checked commit
- behind count
- current active absorbed capabilities
- triage recommendation:
  - `ignore`
  - `defer`
  - `review`
  - `refresh_now`

- [ ] **Step 3: Keep it maintenance-only**

Make sure the script does not:
- modify `lib/nexus/stage-content/`
- modify `lib/nexus/stage-packs/`
- modify `.planning/`
- alter `VERSION`

- [ ] **Step 4: Add tests**

Add `test/nexus/upstream-check.test.ts` to cover:
- parsing of pinned commit vs latest commit
- status markdown generation
- lock file updates
- triage recommendations for:
  - unchanged upstream
  - behind upstream
  - missing remote result

- [ ] **Step 5: Verify**

Run:
```bash
bun test test/nexus/upstream-check.test.ts test/nexus/upstream-maintenance.test.ts test/nexus/inventory.test.ts
bun run upstream:check
```

Expected:
- tests pass
- `upstream-notes/update-status.md` is rewritten in a stable format
- `upstream-notes/upstream-lock.json` updates only maintenance fields

- [ ] **Step 6: Commit**

```bash
git add scripts/upstream-check.ts package.json upstream-notes/update-status.md upstream-notes/upstream-lock.json lib/nexus/upstream-maintenance.ts test/nexus/upstream-check.test.ts
git commit -m "feat: add upstream freshness checks"
```

### Task 3: Implement `upstream:refresh`

**Files:**
- Create: `scripts/upstream-refresh.ts`
- Create: `upstream-notes/refresh-candidates/.gitkeep`
- Modify: `package.json`
- Modify: `upstream-notes/upstream-lock.json`
- Modify: `upstream/README.md`
- Create: `test/nexus/upstream-refresh.test.ts`

- [ ] **Step 1: Add the package script**

Add:
- `"upstream:refresh": "bun run scripts/upstream-refresh.ts"`

- [ ] **Step 2: Implement refresh-candidate staging**

`scripts/upstream-refresh.ts` should accept one upstream name and:
- refresh `upstream/<name>` to the latest checked commit
- update the pinned commit in `upstream-notes/upstream-lock.json`
- update the matching pinned commit entry in `upstream/README.md`
- create or overwrite:
  - `upstream-notes/refresh-candidates/<name>.md`

The refresh-candidate note should include:
- previous pinned commit
- new pinned commit
- changed upstream paths
- impacted `lib/nexus/absorption/*/source-map.ts` references
- likely affected stage-content / stage-pack areas
- a placeholder absorption decision section with:
  - `ignore`
  - `defer`
  - `absorb_partial`
  - `absorb_full`
  - `reject`

- [ ] **Step 3: Keep refresh separate from absorption**

Explicitly prevent the refresh script from:
- editing `lib/nexus/absorption/`
- editing `lib/nexus/stage-content/`
- editing `lib/nexus/stage-packs/`
- changing `VERSION` or release docs

It should only stage the candidate and update maintenance metadata.

- [ ] **Step 4: Add tests**

Add `test/nexus/upstream-refresh.test.ts` to cover:
- valid upstream name refresh
- invalid upstream name rejection
- candidate note creation
- `upstream/README.md` pinned commit rewrite
- lock file refresh metadata updates
- proof that no Nexus-owned stage assets are edited

- [ ] **Step 5: Verify**

Run:
```bash
bun test test/nexus/upstream-refresh.test.ts test/nexus/upstream-check.test.ts test/nexus/inventory.test.ts
bun run upstream:refresh pm-skills
```

Expected:
- tests pass
- a refresh-candidate note appears at `upstream-notes/refresh-candidates/pm-skills.md`
- no stage-content or stage-pack files are modified

- [ ] **Step 6: Commit**

```bash
git add scripts/upstream-refresh.ts package.json upstream-notes/refresh-candidates/.gitkeep upstream-notes/upstream-lock.json upstream/README.md test/nexus/upstream-refresh.test.ts
git commit -m "feat: add upstream refresh candidate workflow"
```

### Task 4: Add absorption review and release-gate records

**Files:**
- Modify: `upstream-notes/upstream-lock.json`
- Modify: `upstream-notes/pm-skills-inventory.md`
- Modify: `upstream-notes/gsd-inventory.md`
- Modify: `upstream-notes/superpowers-inventory.md`
- Modify: `upstream-notes/ccb-inventory.md`
- Modify: `upstream-notes/absorption-status.md`
- Create: `docs/superpowers/runbooks/upstream-refresh.md`
- Create: `test/nexus/upstream-release-gate.test.ts`

- [ ] **Step 1: Document the absorption review outcomes**

Extend the inventories and absorption status docs so they can reflect:
- `ignore`
- `defer`
- `absorb_partial`
- `absorb_full`
- `reject`

These decisions should be clearly marked as maintainer decisions, not governed lifecycle truth.

- [ ] **Step 2: Add the maintainer runbook**

Create `docs/superpowers/runbooks/upstream-refresh.md` covering:
- when to run `upstream:check`
- when to run `upstream:refresh`
- how to record an absorption decision
- when a refresh should trigger a Nexus release
- when it should not

- [ ] **Step 3: Lock the release gate in tests**

Add `test/nexus/upstream-release-gate.test.ts` to verify:
- release is required only when Nexus-owned assets change
- imported snapshot changes alone are insufficient
- CCB is treated as compatibility infrastructure, not a full-retirement target

- [ ] **Step 4: Verify**

Run:
```bash
bun test test/nexus/upstream-release-gate.test.ts test/nexus/inventory.test.ts test/nexus/upstream-maintenance.test.ts
```

Expected:
- tests pass
- docs and inventories consistently separate refresh candidates from released Nexus behavior

- [ ] **Step 5: Commit**

```bash
git add upstream-notes/upstream-lock.json upstream-notes/pm-skills-inventory.md upstream-notes/gsd-inventory.md upstream-notes/superpowers-inventory.md upstream-notes/ccb-inventory.md upstream-notes/absorption-status.md docs/superpowers/runbooks/upstream-refresh.md test/nexus/upstream-release-gate.test.ts
git commit -m "docs: add upstream absorption review and release gate"
```

### Task 5: Lock the user-visible upgrade policy

**Files:**
- Modify: `README.md`
- Modify: `nexus-upgrade/SKILL.md.tmpl`
- Modify: `nexus-upgrade/SKILL.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`
- Modify: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Clarify the user contract**

Update `README.md` and `docs/skills.md` so users are told:
- upstream maintenance is handled by Nexus maintainers
- users upgrade Nexus versions, not upstream repos
- `/nexus-upgrade` and automatic upgrade remain the only user-facing update path

- [ ] **Step 2: Tighten `/nexus-upgrade` wording**

Update `nexus-upgrade/SKILL.md.tmpl` so it explicitly says:
- it upgrades published Nexus releases
- it does not pull or absorb upstream repos directly
- upstream refresh work is maintainer-only

Regenerate the generated skill output if needed so `nexus-upgrade/SKILL.md` stays aligned.

- [ ] **Step 3: Extend product-surface checks**

Update tests so the Nexus surface is locked to:
- Nexus-only update language
- no user-facing instruction to pull `upstream/*`
- no claim that upstream refresh itself upgrades user installs

- [ ] **Step 4: Verify**

Run:
```bash
bun test test/nexus/product-surface.test.ts test/skill-routing-e2e.test.ts test/nexus/upstream-release-gate.test.ts
bun run gen:skill-docs --host codex
```

Expected:
- tests pass
- generated skill docs stay in sync

- [ ] **Step 5: Commit**

```bash
git add README.md nexus-upgrade/SKILL.md.tmpl nexus-upgrade/SKILL.md docs/skills.md test/nexus/product-surface.test.ts test/skill-routing-e2e.test.ts
git commit -m "docs: clarify user-facing upstream upgrade policy"
```

### Task 6: Regression and closeout

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-09-nexus-upstream-refresh-and-upgrade-closeout.md`

- [ ] **Step 1: Run the full targeted regression**

Run:
```bash
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
bun run gen:skill-docs --host codex
git diff --check
```

Expected:
- Nexus maintenance tests pass
- product surface and inventory regressions pass
- generated skills remain valid
- no formatting drift remains

- [ ] **Step 2: Write the closeout**

Create `docs/superpowers/closeouts/2026-04-09-nexus-upstream-refresh-and-upgrade-closeout.md` with:
- what was added
- what remains maintainer-only
- what users now see
- verification evidence
- known follow-up work, if any

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-09-nexus-upstream-refresh-and-upgrade-closeout.md
git commit -m "docs: close out upstream refresh and upgrade milestone"
```
