# Nexus Live Release Dogfood Closeout

Date: 2026-04-10
Status: `completed`
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
- `bun test test/nexus/*.test.ts`
  - pass
  - 192 passing, 0 failing
- `bun test browse/test/nexus-update-check.test.ts`
  - pass
  - 15 passing, 0 failing
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
  - pass
  - 434 passing, 0 failing, 225 skipped
- `bun run gen:skill-docs --host codex`
  - pass
- `git diff --check`
  - clean
- `./bin/nexus-release-preflight`
  - pass
  - `READY 1.0.1 v1.0.1`
- repo-visible release artifacts now target:
  - `VERSION = 1.0.1`
  - `package.json.version = 1.0.1`
  - `release.json.tag = v1.0.1`
  - `docs/releases/2026-04-10-nexus-v1.0.1.md`

## Publish Evidence

- pushed tag: `v1.0.1`
- published GitHub Release:
  - `https://github.com/LaPaGaYo/nexus/releases/tag/v1.0.1`
  - published at `2026-04-11T03:30:23Z`
- `./bin/nexus-release-smoke`
  - pass
  - `READY 1.0.1 v1.0.1`

## Notes

- Any publish mismatch should be treated as a maintainer release error, not as
  governed runtime truth.
