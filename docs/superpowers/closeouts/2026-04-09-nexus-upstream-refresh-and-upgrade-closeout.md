# Nexus Upstream Refresh And Upgrade Closeout

Date: 2026-04-09
Status: `completed`
Plan: `docs/superpowers/plans/2026-04-09-nexus-upstream-refresh-and-upgrade.md`

## Outcome

This milestone closed the first full Nexus-owned upstream maintenance and user
upgrade loop.

Nexus now distinguishes three layers clearly:

- Nexus is the only contract owner, lifecycle owner, and user-facing product
  surface.
- Imported upstream repos remain source material and maintainer inputs only.
- User upgrades flow through Nexus-owned upgrade paths, not through direct
  upstream repo handling.

The current implementation intentionally uses option 1 for upgrade semantics:

- users upgrade Nexus itself
- `/nexus-upgrade` and automatic upgrade are the only user-facing update paths
- git-based Nexus installs may sync the installed Nexus repo as the underlying
  implementation mechanism
- release/tag-based upgrade semantics remain future roadmap work after Nexus
  stabilizes

## What Was Added

### Maintainer-side upstream maintenance contract

- `lib/nexus/upstream-maintenance.ts` freezes the four tracked upstreams and
  their helper paths.
- `upstream-notes/upstream-lock.json` records the checked source snapshot and
  checked maintenance state.
- `upstream-notes/update-status.md`, `upstream-notes/absorption-status.md`, and
  `upstream/README.md` make maintenance state repo-visible.

### Refresh and review workflow

- `scripts/upstream-check.ts` plus `bun run upstream:check` verify freshness
  against pinned upstream metadata.
- `scripts/upstream-refresh.ts` plus `bun run upstream:refresh -- <name>`
  materialize a checked upstream commit, refuse dirty local state, preserve
  executable bits and symlinks, and stage review candidates safely.
- `upstream-notes/refresh-candidates/` provides the review landing zone for
  staged candidate snapshots and notes.

### Maintainer-only absorption and release gating

- Inventory files now carry the mandatory schema required for upstream mapping
  and review.
- Maintainer-only absorption decisions are documented separately from governed
  lifecycle truth.
- Release gating now distinguishes:
  - imported snapshot changes alone
  - provenance/source-map-only changes
  - Nexus-owned seam or stage-pack changes that require a Nexus release

### User-facing upgrade contract cleanup

- README and `docs/skills.md` now present a Nexus-only update policy.
- Existing installs are routed to `/nexus-upgrade` instead of raw `git pull`
  remediation paths.
- `nexus-upgrade/SKILL.md.tmpl` and `nexus-upgrade/SKILL.md` now describe the
  current truthful behavior: Nexus-only update flow, no direct imported-upstream
  repo absorption, and future release/tag semantics as roadmap only.
- Regression tests lock that user-facing contract in place.

## What Remains Maintainer-Only

- running `upstream:check` and interpreting freshness drift
- running `upstream:refresh` and reviewing staged candidate snapshots
- making absorption decisions such as `ignore`, `defer`, `absorb_partial`,
  `absorb_full`, or `reject`
- deciding whether Nexus-owned seam changes require a release
- direct imported-upstream repo handling
- any future release/tag-based upgrade implementation work

These paths are not user workflows and do not own governed lifecycle truth.

## What Users Now See

- Nexus remains the only visible product surface.
- Users are told to upgrade Nexus, not imported upstream repos.
- `/nexus-upgrade` and automatic upgrade are the only documented user-facing
  update paths.
- Existing global and repo-local installs now point back into the Nexus-owned
  upgrade flow instead of raw git commands.
- The upgrade helper explicitly states that imported upstream maintenance stays
  maintainer-only.

## Verification Evidence

- `bun test test/nexus/*.test.ts`
  - pass
  - 144 passing, 0 failing
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
  - pass
  - 434 passing, 0 failing, 225 skipped
- `bun run gen:skill-docs --host codex`
  - pass
- `git diff --check`
  - clean

Additional focused verification completed during the milestone:

- upstream refresh rollback, dirty-tree refusal, executable-bit preservation,
  and symlink preservation tests
- release-gate tests for imported snapshot vs Nexus-owned change classes
- product-surface and routing tests for the Nexus-only upgrade contract

## Known Follow-Up Work

- Implement option 2 later: release/tag-based Nexus upgrade semantics once the
  Nexus distribution model stabilizes.
- Add deeper runtime validation for the executed `/nexus-upgrade` path if the
  upgrade mechanism itself changes materially.
- Continue absorption review work through maintainer-owned upstream refresh
  cycles; imported upstream content still does not become governed truth until
  Nexus normalizes and ships it.
