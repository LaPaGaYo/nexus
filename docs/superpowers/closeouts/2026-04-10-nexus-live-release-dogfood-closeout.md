# Nexus Live Release Dogfood Closeout

Date: 2026-04-10
Status: `in_progress`
Plan: `docs/superpowers/plans/2026-04-10-nexus-live-release-dogfood.md`

## Outcome

This milestone is converting the release-based upgrade model into a real
maintainer and user dogfood loop.

The local contract layer is now in place:

- `nexus-release-preflight` validates local version alignment before tagging
- `nexus-release-smoke` validates published GitHub Release state against local
  Nexus release truth
- `v1.0.1` release artifacts are prepared in-repo as the next publish target

## Pre-Publish Evidence

- `bun test test/nexus/release-publish.test.ts test/nexus/release-remote.test.ts test/nexus/release-contract.test.ts`
  - pass
  - 13 passing, 0 failing
- repo-visible release artifacts now target:
  - `VERSION = 1.0.1`
  - `package.json.version = 1.0.1`
  - `release.json.tag = v1.0.1`
  - `docs/releases/2026-04-10-nexus-v1.0.1.md`

## Pending Publish Evidence

The following evidence is intentionally deferred to Task 6 because it depends on
the real tag and GitHub Release existing:

- local preflight verdict from `./bin/nexus-release-preflight`
- pushed tag: `v1.0.1`
- published GitHub Release URL
- remote smoke verdict from `./bin/nexus-release-smoke`

## Notes

- This closeout stays `in_progress` until the actual `v1.0.1` release is
  published and the remote smoke passes.
- Any publish mismatch should be treated as a maintainer release error, not as
  governed runtime truth.
