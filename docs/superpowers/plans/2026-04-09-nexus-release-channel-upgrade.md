# Nexus Release Channel Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repo-sync Nexus user upgrades with a true release-based upgrade path rooted in published Nexus releases, explicit install metadata, structured host update state, and conservative migration from legacy installs.

**Architecture:** Freeze the release/install/update-state contracts in `lib/nexus/`, introduce a tagged `release.json` manifest and managed install metadata, rebuild `nexus-update-check` to resolve release candidates instead of branch head, and move `/nexus-upgrade` onto a Nexus-owned release installer with rollback, legacy migration, and vendored-copy sync. Keep the public command surface unchanged while retiring `origin/main` as the effective upgrade contract.

**Tech Stack:** Bun, TypeScript, executable bin helpers, JSON metadata files, generated skill docs, existing Nexus regression tests under `browse/test/` and `test/`

---

### Task 1: Freeze release, install, and update-state contracts

**Files:**
- Create: `release.json`
- Create: `lib/nexus/release-contract.ts`
- Create: `lib/nexus/install-metadata.ts`
- Create: `lib/nexus/update-state.ts`
- Modify: `bin/nexus-config`
- Create: `test/nexus/release-contract.test.ts`
- Create: `test/nexus/install-metadata.test.ts`

- [ ] **Step 1: Add the current tagged release manifest**

Create `release.json` at the repo root for the currently shipped version so the
new contract exists before runtime changes land.

The file should match:
- `VERSION`
- `package.json.version`
- `docs/releases/2026-04-08-nexus-v1.0.0.md`

- [ ] **Step 2: Freeze the release manifest model in code**

Add `lib/nexus/release-contract.ts` with:
- release manifest types
- supported channel types
- manifest validation helpers
- path helpers for `release.json`

Lock the first-cut remote channel surface to:
- `stable`

Keep `candidate` and `nightly` present only as reserved constants if needed by
tests or validation messaging.

- [ ] **Step 3: Freeze install metadata and host update-state models**

Add:
- `lib/nexus/install-metadata.ts`
- `lib/nexus/update-state.ts`

These modules should define:
- `.nexus-install.json` shape
- `~/.nexus/update-state/last-check.json`
- `~/.nexus/update-state/snooze.json`
- `~/.nexus/update-state/just-upgraded.json`
- supported install kinds and scopes
- read/write/validate helpers

- [ ] **Step 4: Extend config comments for channel awareness**

Update `bin/nexus-config` comments to document:
- `release_channel: stable`
- `auto_upgrade`
- `update_check`

Do not change existing keys or behavior in this task beyond documenting the new
key.

- [ ] **Step 5: Lock the new contracts with focused tests**

Add tests for:
- manifest schema validity
- version/tag/release note path consistency
- install metadata field validation
- update-state status enum validation

- [ ] **Step 6: Verify**

Run:
```bash
bun test test/nexus/release-contract.test.ts test/nexus/install-metadata.test.ts
```

Expected:
- all tests pass

- [ ] **Step 7: Commit**

```bash
git add release.json lib/nexus/release-contract.ts lib/nexus/install-metadata.ts lib/nexus/update-state.ts bin/nexus-config test/nexus/release-contract.test.ts test/nexus/install-metadata.test.ts
git commit -m "feat: freeze Nexus release upgrade contracts"
```

### Task 2: Rebuild `nexus-update-check` on release discovery

**Files:**
- Modify: `bin/nexus-update-check`
- Modify: `lib/nexus/release-contract.ts`
- Modify: `lib/nexus/install-metadata.ts`
- Modify: `lib/nexus/update-state.ts`
- Modify: `browse/test/nexus-update-check.test.ts`
- Create: `test/nexus/update-state.test.ts`

- [ ] **Step 1: Replace branch-head version discovery**

Update `bin/nexus-update-check` so it no longer derives upgrade availability
from:
- `raw.githubusercontent.com/.../main/VERSION`

The new flow should:
- resolve the configured `release_channel`
- discover the latest published release for that channel
- fetch and validate the candidate `release.json`
- compare candidate version/tag against local install metadata or `VERSION`

- [ ] **Step 2: Write structured host update-state**

Make `nexus-update-check` write:
- `last-check.json`
- `snooze.json`
- `just-upgraded.json`

Keep existing one-line outputs only as compatibility projections:
- `JUST_UPGRADED <old> <new>`
- `UPGRADE_AVAILABLE <old> <new>`

- [ ] **Step 3: Add conservative local consistency checks**

Make the check refuse to suggest upgrades when:
- local `VERSION` and `.nexus-install.json` disagree
- configured channel is unsupported
- remote release metadata and `release.json` disagree
- the candidate manifest is missing required fields

Those cases should write structured error state instead of silently falling back
to branch-head behavior.

- [ ] **Step 4: Expand tests**

Update `browse/test/nexus-update-check.test.ts` and add `test/nexus/update-state.test.ts`
to cover:
- happy-path release discovery
- up-to-date path
- snooze handling
- unsupported channel refusal
- invalid remote manifest refusal
- local metadata/version mismatch refusal
- compatibility preservation of one-line output

- [ ] **Step 5: Verify**

Run:
```bash
bun test browse/test/nexus-update-check.test.ts test/nexus/update-state.test.ts test/nexus/release-contract.test.ts test/nexus/install-metadata.test.ts
```

Expected:
- all tests pass
- no test still depends on `main/VERSION` semantics

- [ ] **Step 6: Commit**

```bash
git add bin/nexus-update-check lib/nexus/release-contract.ts lib/nexus/install-metadata.ts lib/nexus/update-state.ts browse/test/nexus-update-check.test.ts test/nexus/update-state.test.ts
git commit -m "feat: resolve Nexus upgrades from releases"
```

### Task 3: Add a Nexus-owned release installer for `/nexus-upgrade`

**Files:**
- Create: `bin/nexus-upgrade-install`
- Modify: `nexus-upgrade/SKILL.md.tmpl`
- Modify: `nexus-upgrade/SKILL.md`
- Modify: `lib/nexus/release-contract.ts`
- Modify: `lib/nexus/install-metadata.ts`
- Modify: `lib/nexus/update-state.ts`
- Create: `test/nexus/nexus-upgrade-install.test.ts`

- [ ] **Step 1: Introduce a reusable installer helper**

Add `bin/nexus-upgrade-install` as the Nexus-owned helper that:
- resolves the candidate release
- downloads the release bundle
- validates `release.json`
- backs up the current install
- replaces the install
- runs `./setup`
- writes `.nexus-install.json`
- clears stale update-state on success

Do not let the skill template own the install logic inline anymore.

- [ ] **Step 2: Keep rollback and partial-write failure conservative**

Make the installer restore the previous install when any of these fail:
- bundle download
- bundle extraction
- `./setup`
- metadata write

Do not write `just-upgraded.json` unless install replacement, setup, and
metadata write all finish successfully.

- [ ] **Step 3: Update the skill template to call the installer**

Rewrite `nexus-upgrade/SKILL.md.tmpl` so `/nexus-upgrade`:
- keeps the same user-facing prompt flow
- uses `nexus-update-check` for candidate discovery
- invokes `bin/nexus-upgrade-install` for actual upgrade execution
- describes release/tag semantics truthfully

Regenerate `nexus-upgrade/SKILL.md` afterward.

- [ ] **Step 4: Add focused installer tests**

Add `test/nexus/nexus-upgrade-install.test.ts` to cover:
- happy-path managed release install
- rollback on setup failure
- rollback on metadata write failure
- no `just-upgraded.json` on failure

- [ ] **Step 5: Verify**

Run:
```bash
bun test test/nexus/nexus-upgrade-install.test.ts browse/test/nexus-update-check.test.ts
bun run gen:skill-docs --host codex
```

Expected:
- tests pass
- generated skill docs stay in sync with the new installer flow

- [ ] **Step 6: Commit**

```bash
git add bin/nexus-upgrade-install nexus-upgrade/SKILL.md.tmpl nexus-upgrade/SKILL.md lib/nexus/release-contract.ts lib/nexus/install-metadata.ts lib/nexus/update-state.ts test/nexus/nexus-upgrade-install.test.ts
git commit -m "feat: add release installer for nexus-upgrade"
```

### Task 4: Migrate legacy installs and sync vendored copies

**Files:**
- Modify: `bin/nexus-upgrade-install`
- Modify: `lib/nexus/install-metadata.ts`
- Modify: `test/nexus/nexus-upgrade-install.test.ts`
- Modify: `test/skill-e2e.test.ts`
- Modify: `test/skill-e2e-workflow.test.ts`

- [ ] **Step 1: Detect legacy installs explicitly**

Teach the installer to distinguish:
- managed release installs
- managed vendored installs
- legacy git installs in standard user roots
- repo-local vendored installs
- source checkouts that should be refused

- [ ] **Step 2: Make migration conservative**

For legacy git installs:
- migrate only from known user install roots
- refuse if tracked or untracked local modifications exist
- do not stash or auto-merge
- rewrite successful migrations into managed release installs

For source checkouts:
- refuse and explain that development clones are maintained manually

- [ ] **Step 3: Keep vendored sync on the same published release**

When a repo-local vendored copy exists:
- sync it to the exact release installed in the primary root
- write `.nexus-install.json` in the vendored copy
- block on partial sync failure and restore the vendored backup

- [ ] **Step 4: Extend skill-level regression tests**

Update `test/skill-e2e.test.ts` and `test/skill-e2e-workflow.test.ts` so the
upgrade skill examples and assertions cover:
- release-based managed installs
- legacy migration refusal paths
- vendored sync messaging
- no residual `origin/main` upgrade semantics

- [ ] **Step 5: Verify**

Run:
```bash
bun test test/nexus/nexus-upgrade-install.test.ts test/skill-e2e.test.ts test/skill-e2e-workflow.test.ts
```

Expected:
- all tests pass
- legacy migration and vendored sync stay conservative

- [ ] **Step 6: Commit**

```bash
git add bin/nexus-upgrade-install lib/nexus/install-metadata.ts test/nexus/nexus-upgrade-install.test.ts test/skill-e2e.test.ts test/skill-e2e-workflow.test.ts
git commit -m "feat: migrate legacy Nexus installs conservatively"
```

### Task 5: Update public docs and release publication guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `scripts/resolvers/preamble.ts`
- Modify: `test/skill-routing-e2e.test.ts`
- Create: `docs/superpowers/runbooks/nexus-release-publish.md`

- [ ] **Step 1: Update user-facing docs**

Change `README.md` and `docs/skills.md` so they describe:
- release-based upgrade detection
- `release_channel`
- managed installs and vendored sync
- the continued rule that users upgrade Nexus, not upstream repos

- [ ] **Step 2: Update skill preamble routing text**

Adjust `scripts/resolvers/preamble.ts` so the generated preambles point to the
new release-based `/nexus-upgrade` behavior instead of the current "future
roadmap" wording.

- [ ] **Step 3: Add a maintainer release runbook**

Create `docs/superpowers/runbooks/nexus-release-publish.md` covering:
- `release.json`
- `VERSION`
- `package.json.version`
- release notes
- tag creation
- GitHub Release publication

Keep this as maintainer guidance, not governed lifecycle truth.

- [ ] **Step 4: Update routing regressions**

Update `test/skill-routing-e2e.test.ts` so the generated skill surface now
expects release-based upgrade semantics and no longer expects the old "future
roadmap" sentence.

- [ ] **Step 5: Verify**

Run:
```bash
bun test test/skill-routing-e2e.test.ts test/gen-skill-docs.test.ts
bun run gen:skill-docs --host codex
```

Expected:
- docs/preamble regressions pass
- generated output matches the updated runtime contract

- [ ] **Step 6: Commit**

```bash
git add README.md docs/skills.md scripts/resolvers/preamble.ts test/skill-routing-e2e.test.ts docs/superpowers/runbooks/nexus-release-publish.md
git commit -m "docs: publish Nexus release upgrade guidance"
```

### Task 6: Run the end-to-end regression gate

**Files:**
- Modify: `docs/superpowers/closeouts/2026-04-09-nexus-release-channel-upgrade-closeout.md`

- [ ] **Step 1: Run the targeted regression suite**

Run:
```bash
bun test test/nexus/*.test.ts
bun test browse/test/nexus-update-check.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
bun run gen:skill-docs --host codex
git diff --check
```

Expected:
- tests pass
- generated skills are current
- no formatting errors remain

- [ ] **Step 2: Write the closeout**

Create `docs/superpowers/closeouts/2026-04-09-nexus-release-channel-upgrade-closeout.md`
with:
- outcome summary
- released contract changes
- legacy migration behavior
- rollback/refusal guarantees
- verification evidence
- remaining deferred work

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-09-nexus-release-channel-upgrade-closeout.md
git commit -m "docs: close out release-based Nexus upgrade milestone"
```
