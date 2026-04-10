# Nexus Release Channel Upgrade Closeout

Date: 2026-04-10
Status: `completed`
Plan: `docs/superpowers/plans/2026-04-09-nexus-release-channel-upgrade.md`

## Outcome

This milestone closed the first real Nexus release-based user upgrade model.

Nexus no longer treats repository head as the effective user upgrade contract.
The active upgrade path is now:

- published Nexus release discovery
- tagged `release.json` contract
- `/nexus-upgrade`
- managed install metadata and structured host update-state

User-visible upgrade behavior is now aligned with the Nexus product model:

- users upgrade Nexus releases, not upstream repos
- release detection is channel-based through `release_channel`
- managed installs are explicit and machine-readable
- repo-local vendored copies sync to the same published release as the managed
  global install

## Released Contract Changes

### Release and install truth

- `release.json` is now the machine-readable release contract for a published
  Nexus tag.
- `.nexus-install.json` is now the machine-readable install contract for managed
  installs.
- host update-state is now structured JSON under `~/.nexus/update-state/`.
- `nexus-update-check` resolves published releases instead of repository head.

### Managed install model

- managed install kinds are now explicit:
  - `managed_release`
  - `managed_vendored`
- legacy migration and source-checkout refusal are first-class states, not
  hidden heuristics.
- successful upgrades record `just-upgraded.json`.

### User-facing upgrade surface

- `/nexus-upgrade` now follows the release contract resolved by
  `nexus-update-check`.
- public docs and generated skill surface now describe the release-based upgrade
  model truthfully.
- the generated preamble now points to release-based `/nexus-upgrade` behavior
  instead of the old repo-head / future-roadmap wording.

### Maintainer publication guidance

- maintainer release publication guidance now exists in
  `docs/superpowers/runbooks/nexus-release-publish.md`.
- that runbook covers `release.json`, `VERSION`, `package.json.version`,
  release notes, tag creation, and GitHub Release publication.
- the runbook is maintainer guidance only and does not define governed
  lifecycle truth.

## Legacy Migration Behavior

The upgrade path is intentionally conservative.

- clean legacy git installs under known user install roots can migrate into
  managed release installs
- direct repo-local vendored installs can migrate into managed vendored installs
- repo-local git-backed `.claude/skills/nexus` installs are treated as source
  checkouts and refused
- source checkouts are maintained manually and are never silently upgraded
- vendored sync targets the same published release as the managed global install

## Rollback And Refusal Guarantees

- unsupported or invalid release metadata blocks the upgrade
- unsupported `release_channel` values are refused
- local `VERSION` and `.nexus-install.json` mismatches are refused
- dirty legacy git installs are refused before migration
- vendored git-backed checkouts are refused before primary destructive work
- failed primary installs restore the previous install from backup
- failed vendored sync restores the vendored copy when possible and preserves
  backup state if restore also fails
- failed upgrades do not write `just-upgraded.json`

## Verification Evidence

Full targeted regression gate completed for this milestone:

- `bun test test/nexus/*.test.ts`
  - pass
  - 184 passing, 0 failing
- `bun test browse/test/nexus-update-check.test.ts`
  - pass
  - 13 passing, 0 failing
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
  - pass
  - 434 passing, 0 failing, 225 skipped
- `bun run gen:skill-docs --host codex`
  - pass
- `git diff --check`
  - clean

Focused regression coverage in this milestone also proved:

- release manifest and install metadata schema locks
- structured host update-state behavior
- managed release install and rollback behavior
- legacy git migration safety
- vendored sync safety and backup handling
- release-surface routing and generated skill text alignment

## Remaining Deferred Work

- support for multiple active public release channels beyond `stable`
- broader live end-to-end upgrade dogfooding against published GitHub Releases
- removal of temporary compatibility bridges that are still retained only for
  downstream read compatibility
- future automation around maintainer release publication and release cadence

