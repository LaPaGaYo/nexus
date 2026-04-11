# Upstream Refresh Candidate: gsd

Refreshed at: `2026-04-11T04:23:11.923Z`
Previous pinned commit: `caf337508fe9c84f4d1a0edb423b76b83f256e91`
New pinned commit: `295a5726dc6139f383acfc0dbef6b88d4ec94dfa`

## Changed upstream paths

- `upstream/gsd/agents/gsd-debugger.md`
- `upstream/gsd/bin/install.js`
- `upstream/gsd/docs/CONFIGURATION.md`
- `upstream/gsd/get-shit-done/bin/gsd-tools.cjs`
- `upstream/gsd/get-shit-done/bin/lib/config.cjs`
- `upstream/gsd/get-shit-done/bin/lib/core.cjs`
- `upstream/gsd/get-shit-done/bin/lib/init.cjs`
- `upstream/gsd/get-shit-done/bin/lib/milestone.cjs`
- `upstream/gsd/get-shit-done/bin/lib/phase.cjs`
- `upstream/gsd/get-shit-done/bin/lib/roadmap.cjs`
- `upstream/gsd/get-shit-done/bin/lib/state.cjs`
- `upstream/gsd/get-shit-done/references/common-bug-patterns.md`
- `upstream/gsd/get-shit-done/references/planning-config.md`
- `upstream/gsd/get-shit-done/workflows/complete-milestone.md`
- `upstream/gsd/get-shit-done/workflows/profile-user.md`
- `upstream/gsd/get-shit-done/workflows/ui-phase.md`
- `upstream/gsd/hooks/gsd-context-monitor.js`
- `upstream/gsd/tests/atomic-write.test.cjs`
- `upstream/gsd/tests/bug-1754-js-hook-guard.test.cjs`
- `upstream/gsd/tests/bug-1891-file-resolution.test.cjs`
- `upstream/gsd/tests/bug-1906-hook-relative-paths.test.cjs`
- `upstream/gsd/tests/bug-1908-uninstall-manifest.test.cjs`
- `upstream/gsd/tests/bug-1924-preserve-user-artifacts.test.cjs`
- `upstream/gsd/tests/bug-patterns-reference.test.cjs`
- `upstream/gsd/tests/config-field-docs.test.cjs`
- `upstream/gsd/tests/config-get-default.test.cjs`
- `upstream/gsd/tests/locking-bugs-1909-1916-1925-1927.test.cjs`
- `upstream/gsd/tests/milestone-regex-global.test.cjs`
- `upstream/gsd/tests/next-decimal-roadmap-scan.test.cjs`
- `upstream/gsd/tests/phase.test.cjs`

## Impacted `lib/nexus/absorption/*/source-map.ts` references

- none

## Likely affected stage-content areas

- none

## Likely affected stage-pack areas

- none

## Tests to rerun before review

- `bun test test/nexus/upstream-refresh.test.ts test/nexus/upstream-check.test.ts test/nexus/inventory.test.ts`

## Maintainer review outcome

- decision: `defer`
- rationale: the staged GSD delta changes imported source material, but the current Nexus source maps, stage-content bindings, and stage-pack bindings report no active absorbed boundary impact.
- release impact: none until a future absorption review changes Nexus-owned assets

## Guardrails

- Refresh stages imported source material and maintenance metadata only.
- Refresh does not edit absorption review logic, stage-content, stage-packs, release docs, or `VERSION`.
- Refresh uses the checked commit recorded in `upstream-notes/upstream-lock.json` as its target.
