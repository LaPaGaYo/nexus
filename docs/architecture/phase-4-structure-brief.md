# Phase 4.4 Structure Brief

Tracks issues #82, #83, and #85.

> **Historical context note (issue #148):** This brief was authored against
> an earlier repository layout. Some commands and file paths below reference
> the pre-#142 flat `scripts/` layout — current paths live under
> `scripts/{build,skill,eval,repo,resolvers}/`. The contents are kept verbatim
> for provenance; substitute current paths when running commands from this
> document today.

## Decisions

1. Keep `lib/nexus/` as the runtime namespace root.
   - `lib/` remains a deliberate package namespace, not a directory to drop or
     fold.
   - This avoids a broad public import churn if future sibling packages or
     shared helpers appear.
2. Split TypeScript CLI source out of `bin/`.
   - `bin/` is now for executable shims and built binaries.
   - `lib/nexus/cli/nexus.ts` owns the main Nexus CLI implementation.
   - `lib/nexus/cli/global-discover.ts` owns the global-discovery source.
3. Subdir flat `lib/nexus/` files by concern while keeping existing concern
   directories where they already made sense.
4. Mirror the `test/nexus/` tree by the same concerns so ownership is visible
   in code review.

## Runtime Layout

| Concern | Directory |
|---|---|
| CLI sources | `lib/nexus/cli/` |
| Lifecycle command handlers | `lib/nexus/commands/` |
| Adapters | `lib/nexus/adapters/` |
| Contracts and shared types | `lib/nexus/contracts/` |
| Governance and ledger | `lib/nexus/governance/` |
| IO, paths, taxonomy, compatibility | `lib/nexus/io/` |
| Runtime execution substrate | `lib/nexus/runtime/` |
| Observability and follow-on state | `lib/nexus/observability/` |
| Completion advisor | `lib/nexus/completion-advisor/` |
| Release and PR handoff | `lib/nexus/release/` |
| Review metadata and verification | `lib/nexus/review/` |
| Skill source taxonomy | `lib/nexus/skills/` |

## Source Mapping

| Old path | New path |
|---|---|
| `bin/nexus.ts` | `lib/nexus/cli/nexus.ts` |
| `bin/nexus-global-discover.ts` | `lib/nexus/cli/global-discover.ts` |
| `lib/nexus/cli-advisor.ts` | `lib/nexus/cli/advisor.ts` |
| `lib/nexus/types.ts` | `lib/nexus/contracts/types.ts` |
| `lib/nexus/command-manifest.ts` | `lib/nexus/contracts/command-manifest.ts` |
| `lib/nexus/contract-artifacts.ts` | `lib/nexus/contracts/artifacts.ts` |
| `lib/nexus/design-contract.ts` | `lib/nexus/contracts/design.ts` |
| `lib/nexus/deploy-contract.ts` | `lib/nexus/contracts/deploy.ts` |
| `lib/nexus/governance.ts` | `lib/nexus/governance/governance.ts` |
| `lib/nexus/ledger.ts` | `lib/nexus/governance/ledger.ts` |
| `lib/nexus/ledger-doctor.ts` | `lib/nexus/governance/ledger-doctor.ts` |
| `lib/nexus/ledger-schema.ts` | `lib/nexus/governance/ledger-schema.ts` |
| `lib/nexus/transitions.ts` | `lib/nexus/governance/transitions.ts` |
| `lib/nexus/artifacts.ts` | `lib/nexus/io/artifacts.ts` |
| `lib/nexus/compatibility-surface.ts` | `lib/nexus/io/compatibility-surface.ts` |
| `lib/nexus/host-roots.ts` | `lib/nexus/io/host-roots.ts` |
| `lib/nexus/install-metadata.ts` | `lib/nexus/io/install-metadata.ts` |
| `lib/nexus/migration-safety.ts` | `lib/nexus/io/migration-safety.ts` |
| `lib/nexus/repo-paths.ts` | `lib/nexus/io/repo-paths.ts` |
| `lib/nexus/repo-taxonomy.ts` | `lib/nexus/io/repo-taxonomy.ts` |
| `lib/nexus/shell-quote.ts` | `lib/nexus/io/shell-quote.ts` |
| `lib/nexus/status.ts` | `lib/nexus/io/status.ts` |
| `lib/nexus/update-state.ts` | `lib/nexus/io/update-state.ts` |
| `lib/nexus/validation-helpers.ts` | `lib/nexus/io/validation-helpers.ts` |
| `lib/nexus/ccb-runtime-state.ts` | `lib/nexus/runtime/ccb-runtime-state.ts` |
| `lib/nexus/command-runner.ts` | `lib/nexus/runtime/command-runner.ts` |
| `lib/nexus/conflicts.ts` | `lib/nexus/runtime/conflicts.ts` |
| `lib/nexus/execution-topology.ts` | `lib/nexus/runtime/execution-topology.ts` |
| `lib/nexus/run-bootstrap.ts` | `lib/nexus/runtime/run-bootstrap.ts` |
| `lib/nexus/runtime-cwd.ts` | `lib/nexus/runtime/cwd.ts` |
| `lib/nexus/runtime-invocation.ts` | `lib/nexus/runtime/invocation.ts` |
| `lib/nexus/workspace-substrate.ts` | `lib/nexus/runtime/workspace-substrate.ts` |
| `lib/nexus/closeout-follow-on-refresh.ts` | `lib/nexus/observability/closeout-follow-on-refresh.ts` |
| `lib/nexus/follow-on-evidence.ts` | `lib/nexus/observability/follow-on-evidence.ts` |
| `lib/nexus/learnings.ts` | `lib/nexus/observability/learnings.ts` |
| `lib/nexus/product-surface.ts` | `lib/nexus/observability/product-surface.ts` |
| `lib/nexus/retro-archive.ts` | `lib/nexus/observability/retro-archive.ts` |
| `lib/nexus/session-continuation-advice.ts` | `lib/nexus/observability/session-continuation-advice.ts` |
| `lib/nexus/support-surface.ts` | `lib/nexus/observability/support-surface.ts` |
| `lib/nexus/release-contract.ts` | `lib/nexus/release/contract.ts` |
| `lib/nexus/release-publication.ts` | `lib/nexus/release/publication.ts` |
| `lib/nexus/release-publish.ts` | `lib/nexus/release/publish.ts` |
| `lib/nexus/release-remote.ts` | `lib/nexus/release/remote.ts` |
| `lib/nexus/ship-pull-request.ts` | `lib/nexus/release/ship-pull-request.ts` |
| `lib/nexus/review-advisories.ts` | `lib/nexus/review/advisories.ts` |
| `lib/nexus/review-meta.ts` | `lib/nexus/review/meta.ts` |
| `lib/nexus/review-receipts.ts` | `lib/nexus/review/receipts.ts` |
| `lib/nexus/review-scope.ts` | `lib/nexus/review/scope.ts` |
| `lib/nexus/verification-matrix.ts` | `lib/nexus/review/verification-matrix.ts` |
| `lib/nexus/skill-structure.ts` | `lib/nexus/skills/structure.ts` |

`lib/nexus/completion-advisor.ts` became
`lib/nexus/completion-advisor/index.ts` so directory imports continue to work.

## Importer Update Strategy

All TypeScript importers were rewritten mechanically after `git mv` so relative
imports still resolve from the moved source or test path. Non-TypeScript runtime
entrypoint references were updated manually:

- `package.json` builds global discover from `lib/nexus/cli/global-discover.ts`
  and runs Nexus from `lib/nexus/cli/nexus.ts`.
- Generated Nexus skills now call `./bin/nexus <command>`.
- The retro skill source fallback for global discovery points at
  `lib/nexus/cli/global-discover.ts`.
- `scripts/repo-path-inventory.ts` imports taxonomy from
  `lib/nexus/io/repo-taxonomy.ts`.

## Test Coverage Preservation

- `test/nexus/` mirrors runtime concerns through subdirectories such as
  `cli/`, `commands/`, `contracts/`, `governance/`, `io/`, `runtime/`,
  `observability/`, `release/`, `review/`, `skills/`, and `stages/`.
- `test/global-discover.test.ts` remains outside `test/nexus/` because it
  tests a top-level installed helper surface, but it imports the moved source.
- `test/nexus/io/repo-taxonomy.test.ts` guards that no tracked `bin/*.ts`
  source entrypoint returns and that the concern directories stay present.
- `docs/architecture/repo-path-inventory.md` is regenerated from the moved tree.
