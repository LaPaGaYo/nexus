# Nexus Maintainer Automation Loop Closeout

Date: 2026-04-10
Status: `completed`
Plan: `docs/superpowers/plans/2026-04-10-nexus-maintainer-automation-loop.md`

## Outcome

Nexus now has one maintainer-only automation/report loop for upstream freshness,
refresh-candidate review, release readiness, and published-release repair.

The active contract is Nexus-owned throughout:

- `lib/nexus/maintainer-loop.ts` is the shared contract and next-action resolver
- `bin/nexus-maintainer-check` is the only executable maintainer entrypoint in this milestone
- `upstream-notes/maintainer-status.json` is the machine-readable maintainer report
- `upstream-notes/maintainer-status.md` is the human-readable maintainer report

This milestone did **not** grant automation authority to absorb upstream
changes, tag releases, or publish GitHub Releases automatically. It only makes
the current maintainer state and next action explicit from repo-visible inputs.

## Current Maintainer Report

The generated report at closeout time is intentionally conservative:

- `status`: `action_required`
- `next_action`: `review_refresh_candidate`
- pending refresh candidate: `pm-skills`
- behind upstream: `gsd`

That is the correct outcome for the current repository state. The new loop
surfaces maintainer work; it does not silently reconcile or auto-advance it.

## What Was Added

- shared maintainer loop status/next-action contract
- CLI writeback to repo-visible JSON and Markdown artifacts
- next-action ordering for:
  - published release repair
  - refresh-candidate review
  - upstream refresh
  - release preparation
  - release publication
- runbook alignment for upstream refresh and release publish
- schedule-friendly GitHub workflow that invokes the same Nexus CLI while
  explicitly remaining non-authoritative

## Verification Evidence

- `bun run maintainer:check`
  - `ACTION_REQUIRED review_refresh_candidate`
- `bun test test/nexus/maintainer-loop.test.ts test/nexus/maintainer-check-cli.test.ts test/nexus/upstream-check.test.ts test/nexus/release-publish.test.ts test/nexus/release-remote.test.ts test/nexus/product-surface.test.ts`
  - pass
  - 32 passing, 0 failing
- `bun run gen:skill-docs --host codex`
  - pass
- `git diff --check`
  - clean

## Deferred Work

- multi-channel public release support beyond `stable`
- compatibility-bridge cleanup after downstream readers no longer depend on the
  remaining compatibility fields
- any future automation that opens PRs, creates release drafts, or publishes
  releases automatically
