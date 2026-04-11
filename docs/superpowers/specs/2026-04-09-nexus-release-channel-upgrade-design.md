# Nexus Release Channel Upgrade Design

Date: 2026-04-09
Milestone: Nexus release-based user upgrade model
Branch: `codex/nexus-release-channel-upgrade-design`

## Goal

Replace the current repo-sync user upgrade path with a real Nexus release
upgrade model.

Users should upgrade published Nexus releases, not synchronize to repository
head. Nexus must stay the only user-facing product surface while install,
release, and update semantics become explicit and machine-readable.

## Scope

- define the Nexus-owned release source of truth for user upgrades
- define the machine-readable release metadata shipped with each Nexus release
- define install metadata written into managed Nexus installs
- define the host-level update state used by `nexus-update-check`
- define migration from legacy git-based installs to managed release installs
- define vendored-copy sync semantics under the release model
- define rollback, refusal, and partial-failure behavior for `/nexus-upgrade`

## Non-Goals

- changing the canonical Nexus command surface
- changing governed lifecycle ownership under `lib/nexus/` and `.planning/`
- changing upstream refresh and absorption policy
- making CCB a release contract owner
- implementing multiple active public channels in the first cut
- designing a broad maintainer cleanup pass for old install helpers

## Problem Statement

The current user-facing semantics say "upgrade Nexus", but the implementation is
still tied to repository head:

- `bin/nexus-update-check` reads `VERSION` from `raw.githubusercontent.com/.../main/VERSION`
- `/nexus-upgrade` upgrades git installs by fetching origin and resetting to
  `origin/main`
- there is no machine-readable install metadata that says what release a user is
  actually running

This makes repository head the effective upgrade contract. That is not the final
Nexus product model.

## Core Decision

Nexus user upgrades must resolve from published Nexus releases, not from branch
head.

The new contract is:

`published Nexus release -> update check -> /nexus-upgrade -> managed install metadata`

The following contract is explicitly retired for normal users:

`origin/main -> raw VERSION -> git reset --hard origin/main`

Nexus still uses git branches and tags internally for development and release
production, but user upgrades consume published Nexus releases only.

## Architecture

### 1. Release truth model

User upgrade truth is split into three layers:

1. published release discovery
2. tagged release manifest
3. local install metadata

The authoritative sources are:

- release discovery source:
  - GitHub Releases metadata for the configured Nexus channel
- machine-readable release contract:
  - `release.json` at the tagged Nexus release root
- human-readable release notes:
  - `docs/releases/<date>-nexus-vX.Y.Z.md`

`main` is not a release source of truth. It remains maintainer/development
state only.

### 2. Channel model

Nexus adds an explicit release channel contract, but only one channel is active
in the first implementation:

- active:
  - `stable`
- reserved future values:
  - `candidate`
  - `nightly`

The user-facing config key is:

- `release_channel`

stored in:

- `~/.nexus/config.yaml`

If `release_channel` is absent, Nexus defaults to `stable`.

If `release_channel` is set to an unsupported value, `nexus-update-check` must:

- refuse to treat any remote result as valid
- write an error state to host update metadata
- emit no upgrade suggestion

This keeps channel semantics explicit instead of silently falling back.

### 3. Release manifest contract

Each published Nexus release must include a machine-readable manifest at the
repository root:

- `release.json`

This file becomes the canonical machine-readable release contract for that tag.

Minimum schema:

```json
{
  "schema_version": 1,
  "product": "nexus",
  "version": "1.1.0",
  "tag": "v1.1.0",
  "channel": "stable",
  "published_at": "2026-04-09T00:00:00Z",
  "release_notes_path": "docs/releases/2026-04-09-nexus-v1.1.0.md",
  "bundle": {
    "type": "tar.gz",
    "url": "https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.1.0.tar.gz"
  },
  "compatibility": {
    "upgrade_from_min_version": "1.0.0",
    "requires_setup": true
  }
}
```

Field rules:

- `product` must equal `nexus`
- `version` must equal local `VERSION` and `package.json.version` for that tag
- `tag` must equal the published git tag
- `channel` must match the release channel this tag is published to
- `release_notes_path` must point to the matching repo-visible release notes
- `bundle.url` must resolve to the exact installable release bundle
- `compatibility.upgrade_from_min_version` defines the minimum supported
  in-place upgrade source

If release metadata from GitHub and `release.json` disagree, the release is not
upgrade-valid.

### 4. Local install metadata contract

Managed Nexus installs must carry machine-readable install metadata at the
install root:

- `.nexus-install.json`

Minimum schema:

```json
{
  "schema_version": 1,
  "product": "nexus",
  "install_kind": "managed_release",
  "install_scope": "global",
  "release_channel": "stable",
  "installed_version": "1.1.0",
  "installed_tag": "v1.1.0",
  "install_source": {
    "kind": "github_release",
    "repo": "LaPaGaYo/nexus",
    "bundle_url": "https://github.com/LaPaGaYo/nexus/archive/refs/tags/v1.1.0.tar.gz"
  },
  "last_upgrade_at": "2026-04-09T00:00:00Z",
  "migrated_from": {
    "install_kind": "legacy_git",
    "installed_version": "1.0.0"
  }
}
```

Locked fields:

- `install_kind`
  - allowed first-cut values:
    - `managed_release`
    - `managed_vendored`
    - `legacy_git`
    - `legacy_vendored`
    - `source_checkout`
- `install_scope`
  - allowed values:
    - `global`
    - `project`
- `installed_version`
  - must match local `VERSION`
- `installed_tag`
  - must match the installed release tag
- `release_channel`
  - must match the active channel for managed installs

This file is install truth, not governed lifecycle truth.

### 5. Host update state contract

Nexus host update state should move from ad-hoc plaintext files to structured
JSON under:

- `~/.nexus/update-state/last-check.json`
- `~/.nexus/update-state/snooze.json`
- `~/.nexus/update-state/just-upgraded.json`

These files are host-local operational state only. They are not repo-visible
governed truth and must not be treated as lifecycle artifacts.

#### `last-check.json`

Minimum fields:

```json
{
  "schema_version": 1,
  "status": "upgrade_available",
  "checked_at": "2026-04-09T00:00:00Z",
  "release_channel": "stable",
  "local_version": "1.0.0",
  "local_tag": "v1.0.0",
  "candidate_version": "1.1.0",
  "candidate_tag": "v1.1.0",
  "source": {
    "kind": "github_release",
    "repo": "LaPaGaYo/nexus"
  }
}
```

Allowed `status` values:

- `up_to_date`
- `upgrade_available`
- `snoozed`
- `disabled`
- `error`
- `invalid_remote`

#### `snooze.json`

Minimum fields:

```json
{
  "schema_version": 1,
  "release_channel": "stable",
  "candidate_version": "1.1.0",
  "candidate_tag": "v1.1.0",
  "snooze_level": 2,
  "snoozed_at": "2026-04-09T00:00:00Z",
  "expires_at": "2026-04-11T00:00:00Z"
}
```

#### `just-upgraded.json`

Minimum fields:

```json
{
  "schema_version": 1,
  "from_version": "1.0.0",
  "from_tag": "v1.0.0",
  "to_version": "1.1.0",
  "to_tag": "v1.1.0",
  "release_channel": "stable",
  "completed_at": "2026-04-09T00:00:00Z"
}
```

For compatibility with existing skill preambles, `nexus-update-check` may keep
the same one-line outputs:

- `JUST_UPGRADED <old> <new>`
- `UPGRADE_AVAILABLE <old> <new>`

But those outputs become projections from the structured JSON state, not the
other way around.

### 6. Update check flow

`bin/nexus-update-check` should resolve upgrades in this order:

1. resolve the local install root and local install metadata
2. resolve `release_channel` from config, defaulting to `stable`
3. discover the newest published release for that channel
4. fetch the candidate `release.json`
5. validate product, version, tag, channel, and compatibility fields
6. compare candidate release to local install metadata
7. write `last-check.json`
8. emit compatible one-line output if and only if the candidate is valid

If local `VERSION` and `.nexus-install.json` disagree, the check must end in
`status = "error"` and emit no upgrade suggestion.

If discovery succeeds but `release.json` is missing or invalid, the check must
end in `status = "invalid_remote"` and emit no upgrade suggestion.

This prevents "available" from silently implying "installable".

### 7. Upgrade execution flow

`/nexus-upgrade` becomes a release installer, not a repo synchronizer.

The new flow is:

1. resolve local install metadata or detect a legacy install shape
2. resolve the requested release channel
3. resolve and validate the candidate release manifest
4. download the candidate release bundle into a temporary directory
5. verify `release.json`, `VERSION`, and bundle contents match
6. backup the current install
7. replace the install with the candidate bundle
8. run `./setup`
9. write `.nexus-install.json`
10. sync a repo-local vendored copy if applicable
11. write `just-upgraded.json` and clear stale snooze/check state
12. summarize release notes and continue

The installer must never use:

- `git fetch origin`
- `git reset --hard origin/main`
- raw branch-head `VERSION` as the install candidate

### 8. Legacy install migration

The first release-based implementation must explicitly support migration from
the current user install shapes.

Supported migration sources:

- standard global git installs under `~/.claude/skills/nexus`
- standard global git installs under `~/.nexus/repos/nexus`
- repo-local vendored installs under `.claude/skills/nexus`

Migration rules:

- known user install roots without `.nexus-install.json` are treated as legacy
  installs, not as trusted managed installs
- successful migration rewrites the install into a managed release bundle
- successful migration removes git semantics from the user install path
- successful migration writes `.nexus-install.json`

Refusal rules:

- if a legacy git install has local tracked or untracked modifications,
  `/nexus-upgrade` must refuse migration instead of stashing or auto-merging
- if the install root looks like a development checkout rather than a managed
  user install, `/nexus-upgrade` must refuse and explain that source checkouts
  are maintained manually

This is the cutover from "live repo clone" to "managed Nexus product install".

### 9. Vendored copy sync

Repo-local vendored copies remain supported, but they no longer inherit from
repository head.

The contract is:

- primary install resolves the release candidate
- repo-local vendored copy syncs to that exact same release bundle
- vendored copy writes its own `.nexus-install.json`
- vendored copy remains a project-distributed snapshot of a published Nexus
  release

Vendored sync must never:

- pull directly from `main`
- infer version only from copied files without install metadata
- become the authority for release availability

### 10. Failure and rollback semantics

Upgrade flow must remain conservative.

If any of the following fail:

- candidate discovery
- manifest validation
- bundle download
- bundle extraction
- `./setup`
- `.nexus-install.json` write
- vendored sync write

then Nexus must:

- restore the previous install from backup
- leave the install in the pre-upgrade version
- avoid writing `just-upgraded.json`
- write `last-check.json` with `status = "error"` and enough context to explain
  what failed

Partial write failure rule:

If manifest validation succeeds conceptually but canonical install writeback is
incomplete or only partially applied, the upgrade is treated as failed. Nexus
must restore the old install and must not advance the installed version marker.

This mirrors the same conservative model already used for governed stage
writeback.

### 11. Release publication contract

Nexus maintainers should publish releases in this order:

1. update `VERSION`
2. update `package.json.version`
3. write `release.json`
4. write `docs/releases/<date>-nexus-vX.Y.Z.md`
5. tag the release as `vX.Y.Z`
6. publish the GitHub Release for that tag

User upgrade discovery begins only after the published release and tagged
`release.json` are both available.

This keeps release availability tied to a real published Nexus release, not
branch movement.

## Success Criteria

- normal users can upgrade Nexus without any dependency on `origin/main`
- `nexus-update-check` resolves release availability from published release
  metadata and tagged manifests
- managed installs carry explicit `.nexus-install.json` metadata
- legacy user installs migrate conservatively to managed release installs
- vendored copies sync to the same published release as the primary install
- invalid or partial upgrades roll back cleanly and do not partially advance
  version state
- branch head is no longer the de facto user upgrade contract

## Deferred Work

- activating additional public channels beyond `stable`
- changing the public `/nexus-upgrade` prompt contract
- redesigning developer-maintainer workflows for source checkouts
- removing every compatibility branch from the current upgrade implementation in
  the same milestone
