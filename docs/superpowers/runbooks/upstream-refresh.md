# Upstream Refresh Runbook

This runbook is maintainer-only for Nexus maintainers. It describes refresh maintenance, absorption review, and the release boundary. It is not governed lifecycle truth.

## When To Run `upstream:check`

Run `upstream:check` when you need a freshness snapshot for the imported upstreams:

- before reviewing a refresh candidate
- after upstream repos move and you want to know what changed
- when `upstream-notes/upstream-lock.json` looks stale
- before deciding whether an imported snapshot should be refreshed or ignored

`upstream:check` updates the maintenance lock and `upstream-notes/update-status.md`. It does not change Nexus-owned runtime assets.

After `upstream:check`, run the unified maintainer report:

```bash
bun run maintainer:check
```

Treat these as the maintainer report outputs:

- machine-readable: `upstream-notes/maintainer-status.json`
- human-readable: `upstream-notes/maintainer-status.md`

Those files are derived from repo-visible maintenance and release inputs. Console output, chat state, and GitHub workflow logs remain notification surfaces only.

## When To Run `upstream:refresh`

Run `upstream:refresh <name>` only after a maintainer decides the checked snapshot should be staged for review.

Use it when:

- the upstream has changed and you want a new refresh candidate
- the candidate needs a concrete diff against the pinned commit
- you want to stage the imported snapshot without changing Nexus-owned assets yet

Do not run it just because a check found a new upstream commit. A refresh candidate is maintainer work, not an automatic release trigger.

## How To Record An Absorption Decision

Record the review in the maintenance files, not in runtime state:

- update the candidate note under `upstream-notes/refresh-candidates/<name>.md`
- set `last_absorption_decision` in `upstream-notes/upstream-lock.json`
- keep `refresh_status` and candidate timestamps aligned with the candidate note
- mirror the review outcome in the matching upstream inventory and absorption-status review summary

Use one of these maintainer decisions:

- `ignore`
- `defer`
- `absorb_partial`
- `absorb_full`
- `reject`

These are maintainer decisions only. They do not by themselves change governed lifecycle truth. If no decision has been recorded yet, keep `last_absorption_decision` null and use the candidate note as the working maintainer review artifact until an outcome is recorded.

## When A Refresh Should Trigger A Nexus Release

Trigger a Nexus release only when the refresh changes Nexus-owned assets:

- `lib/nexus/absorption/`
- `lib/nexus/stage-content/`
- `lib/nexus/stage-packs/`
- any other Nexus-owned asset whose behavior is visible to users or execution

That includes cases where the refresh:

- changes runtime behavior
- changes stage content or stage packs in a user-visible or execution-visible way
- fixes a bug or regression by absorbing upstream changes into Nexus-owned assets
- updates provider compatibility seams that ship as part of Nexus

Provenance-only changes do not automatically trigger release:

- source-map or traceability edits that only update provenance
- lock, inventory, or candidate-note text that only records refresh metadata
- imported snapshot diffs that do not alter shipped Nexus-owned behavior

## When A Refresh Should Not Trigger A Nexus Release

Do not release when the refresh only changes imported source material or maintainer notes:

- upstream snapshots under `upstream/`
- `upstream-notes/` lock, inventory, or candidate notes
- maintainer absorption-review labels that do not alter Nexus-owned assets

Do not release for `ignore` or `defer` decisions unless a separate Nexus-owned asset also changed.

If the refresh does change Nexus-owned assets, re-run:

```bash
bun run maintainer:check
./bin/nexus-release-preflight
```

Do not jump straight from a refresh candidate to a publish decision without updating the maintainer report first.

## CCB Boundary

Treat CCB as compatibility infrastructure, not a full-retirement target.

- CCB refreshes are about transport and protocol compatibility
- CCB may require Nexus compatibility updates
- CCB does not become a retirement candidate in the same way as PM Skills, GSD, or Superpowers

That means a CCB snapshot refresh by itself does not require a Nexus release. A release is only required if Nexus-owned assets change.
