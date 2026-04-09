# Nexus Upstream Refresh And Upgrade Design

Date: 2026-04-09
Milestone: Nexus upstream refresh and user upgrade policy
Branch: `main`

## Goal

Define how Nexus should:

- monitor imported upstream sources for changes
- refresh upstream snapshots without letting them become runtime truth
- review and absorb useful upstream changes into Nexus-owned assets
- decide when an upstream-triggered absorption should produce a Nexus release
- surface Nexus upgrades to users through the existing upgrade path

This milestone is about operating policy and repo-visible contracts for upstream
maintenance. It is not about turning upstream repos into live runtime
dependencies.

## Scope

- define the maintainer workflow for:
  - upstream check
  - refresh candidate creation
  - absorption review
  - Nexus release gating
- define the user-facing workflow for:
  - update detection
  - upgrade prompting
  - manual and automatic Nexus upgrades
- define the repo-visible state needed to track upstream freshness and refresh
  decisions
- define retirement criteria for imported upstream repos once Nexus-owned assets
  are fully independent

## Non-Goals

- making upstream repos direct runtime dependencies
- allowing upstream repos to write governed state under `.planning/`
- making upstream updates automatically rewrite `lib/nexus/stage-content/` or
  `lib/nexus/stage-packs/`
- making users reason about PM Skills, GSD, Superpowers, or CCB as separate
  products
- changing the canonical Nexus lifecycle commands

## Core Decision

Nexus should automatically detect upstream changes, but it should not
automatically promote upstream changes into Nexus truth.

The correct chain is:

`upstream update -> refresh candidate -> Nexus absorption review -> Nexus release -> user upgrade`

The following shorter chain is not allowed:

`upstream update -> direct runtime truth -> direct user upgrade`

This preserves the existing product boundary:

- upstream repos are source material only
- Nexus-owned stage content and stage packs remain the active assets
- users only interact with Nexus releases

## Architecture

### 1. Two separate loops

Nexus should operate with two distinct update loops.

#### Maintainer loop

This loop is internal to the Nexus repo and should remain invisible to normal
users:

1. check upstream freshness
2. refresh imported snapshot candidates
3. review whether Nexus should absorb the changes
4. update Nexus-owned assets if approved
5. cut a Nexus release if Nexus behavior or assets materially changed

#### User loop

This loop is the only update surface users should normally see:

1. Nexus detects a newer Nexus version
2. Nexus prompts the user or auto-upgrades if configured
3. the user upgrades Nexus through `/nexus-upgrade` or automatic upgrade

Users should not be expected to know whether the release was triggered by PM
Skills, GSD, Superpowers, CCB compatibility work, or native Nexus work.

### 2. Upstream state model

The imported upstream repos under `upstream/` should remain pinned snapshots.

Nexus should add a machine-readable lock file:

- `upstream-notes/upstream-lock.json`

Each upstream record should include:

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

This file is not governed lifecycle truth. It is maintenance truth for upstream
freshness and absorption work.

The markdown inventories remain the human-readable layer:

- `upstream-notes/pm-skills-inventory.md`
- `upstream-notes/gsd-inventory.md`
- `upstream-notes/superpowers-inventory.md`
- `upstream-notes/ccb-inventory.md`

The lock file and markdown inventories must stay consistent.

### 3. Check policy

Nexus should support a repo-level upstream freshness check:

- `bun run upstream:check`

This command should:

- fetch the latest commit for each imported upstream repo
- compare it to the pinned commit in `upstream/README.md`, the inventories, and
  `source-map.ts`
- update `upstream-notes/upstream-lock.json`
- write a repo-visible summary:
  - `upstream-notes/update-status.md`

The summary should include, per upstream:

- current pinned commit
- latest remote commit
- ahead/behind state
- whether any currently active absorbed capabilities may be affected
- a triage recommendation:
  - `ignore`
  - `defer`
  - `review`
  - `refresh_now`

Check cadence should default to:

- scheduled or CI-driven daily checks for visibility
- weekly maintainer triage for absorption decisions

This means Nexus keeps current awareness without forcing noisy weekly refreshes.

### 4. Refresh candidate policy

Nexus should support a refresh-candidate workflow:

- `bun run upstream:refresh <name>`

This command should:

- refresh the imported snapshot at `upstream/<name>`
- update the pinned commit in `upstream/README.md`
- update `upstream-notes/upstream-lock.json`
- update the matching markdown inventory if the provenance changed
- write refresh notes to:
  - `upstream-notes/refresh-candidates/<name>.md`

The refresh candidate is still not Nexus truth.

Its purpose is only to stage and describe a possible absorption.

The refresh notes should include:

- files changed in the upstream snapshot
- which `lib/nexus/absorption/*/source-map.ts` entries point into changed areas
- which Nexus-owned stage content or stage packs might need review
- whether any tests should be re-run before review

### 5. Absorption review gate

After a refresh candidate exists, Nexus should explicitly decide whether to
absorb it.

Possible outcomes:

- `ignore`
- `defer`
- `absorb_partial`
- `absorb_full`
- `reject`

The decision should be recorded in:

- `upstream-notes/refresh-candidates/<name>.md`
- `upstream-notes/upstream-lock.json`

Only approved absorption work may modify:

- `lib/nexus/absorption/`
- `lib/nexus/stage-content/`
- `lib/nexus/stage-packs/`
- Nexus-owned docs, templates, and skill content

This is the key boundary:

- upstream refresh changes imported source material
- absorption review changes Nexus-owned assets

### 6. Release gate

An upstream refresh should trigger a Nexus release only when one of these is
true:

- Nexus-owned runtime behavior changed
- Nexus-owned stage content changed in a user-visible or execution-visible way
- provider compatibility changes require a new Nexus release
- a bug or regression in the current Nexus release is fixed through absorption

An upstream refresh should not trigger a Nexus release when:

- only imported snapshots changed
- review concluded `ignore` or `defer`
- provenance records changed but no active Nexus asset changed

This means the release gate belongs to Nexus, not to the upstream repo.

### 7. User-visible upgrade path

The user-facing update surface should remain Nexus-only.

Existing active mechanisms:

- `bin/nexus-update-check`
- `/nexus-upgrade`
- `~/.nexus/config.yaml` with `auto_upgrade` and `update_check`

The user experience should be:

1. user runs any normal Nexus command
2. Nexus checks whether a newer Nexus version exists
3. if so, Nexus prompts or auto-upgrades
4. the user upgrades Nexus, not upstream repos

Users should never need to:

- pull `upstream/pm-skills`
- pull `upstream/gsd`
- pull `upstream/superpowers`
- pull `upstream/claude-code-bridge`
- decide whether an upstream refresh should be absorbed

That is maintainer responsibility only.

### 8. Auto-upgrade boundary

Automatic Nexus upgrades are acceptable only at the Nexus-release layer.

They are not acceptable at the upstream-refresh layer.

This keeps `auto_upgrade` safe:

- it may install a published Nexus release
- it may not silently mutate imported upstream snapshots or absorbed assets on a
  user's machine

### 9. CCB special case

CCB is not an absorbed product surface in the same way as PM Skills, GSD, or
Superpowers.

For CCB:

- upstream checks should focus on transport compatibility and protocol drift
- refresh candidates may require Nexus compatibility updates
- CCB should remain an external transport/runtime dependency
- CCB should not be treated as a candidate for full upstream retirement

This creates two retirement classes:

- `pm-skills`, `gsd`, `superpowers`:
  full retirement from imported upstream snapshots is a valid long-term target
- `claude-code-bridge`:
  controlled external dependency is the long-term target

## Retirement Criteria

Nexus may retire an imported upstream repo only when all of the following are
true:

- active Nexus-owned stage content no longer reads that upstream snapshot
- active Nexus-owned stage packs no longer read that upstream snapshot
- the relevant `lib/nexus/absorption/*/source-map.ts` entries preserve adequate
  provenance
- inventories and absorption history capture the source lineage
- tests and docs do not require the imported upstream repo to exist

When these conditions are met, Nexus may:

- remove `upstream/<name>`
- keep inventory, source maps, and absorption history
- optionally archive the full snapshot on an archive branch or tag

This is how Nexus ultimately sheds upstream weight without losing lineage.

## Success Criteria

- a repo-visible `upstream-lock.json` contract exists
- `upstream:check` and `upstream:refresh` are defined as Nexus-maintained
  workflows
- the maintainer loop and user loop are explicitly separated in repo docs
- release gating is tied to Nexus-owned asset changes, not raw upstream updates
- user upgrades remain Nexus-only through `nexus-update-check` and
  `/nexus-upgrade`
- retirement criteria are explicit for PM Skills, GSD, Superpowers, and CCB
