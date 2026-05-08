# `lib/nexus/` - Nexus Runtime Core

`lib/nexus/` is the package namespace for the governed Nexus runtime. It owns
the lifecycle contract, state model, host adapters, CLI implementation, and
helper primitives that generated skill prose delegates to.

The top-level `lib/` directory intentionally remains a namespace root even
though `lib/nexus/` is currently its only child. Keeping the namespace avoids a
large public import churn if sibling packages or shared helpers are added later,
and it keeps every runtime import visibly Nexus-owned.

## Layout

| Path | Responsibility |
|---|---|
| `cli/` | TypeScript CLI sources, including `nexus.ts`, `global-discover.ts`, and terminal advisor rendering. `bin/` contains executable shims and built binaries only. |
| `commands/` | Canonical lifecycle command handlers and dispatcher. |
| `adapters/` | Provider adapters and prompt contracts for CCB, local providers, and lifecycle-role integrations. |
| `contracts/` | Shared type model, command manifest, schema-versioned artifact emitters, and design/deploy contracts. |
| `governance/` | Ledger, schema checks, transition invariants, and ledger diagnostics. |
| `io/` | Repo-relative paths, artifact path helpers, taxonomy, compatibility surfaces, host roots, install/update metadata, validation helpers, status IO, and shell quoting. |
| `runtime/` | Runtime cwd/invocation resolution, execution topology, command runner, conflict checks, CCB runtime state, run bootstrap, and workspace allocation. |
| `observability/` | Follow-on summaries, learnings, retro continuity, continuation advice, and product/support surface discovery. |
| `completion-advisor/` | Stage-completion advisor resolver/writer API. The directory has an `index.ts` so commands can import the concern as `../completion-advisor`. |
| `release/` | Release contract, publication/publish/remote smoke helpers, and PR handoff state. |
| `review/` | Review advisories, receipts, scope, metadata, and verification matrix. |
| `skills/` | Source taxonomy helpers for generated Nexus skills. |
| `skill-registry/` | Installed skill discovery, manifest parsing, classification, ranking, and routing records. |
| `intent-classifier/` | `/nexus do` free-form intent classification and dispatcher support. |
| `stage-content/` | Per-stage markdown content loaded into generated skills and runtime prompts. |
| `stage-packs/` | Per-stage prompt/context bundles handed to adapters. |
| `normalizers/` | Adapter result normalizers. |
| `telemetry/` | Local telemetry event schema and writer helpers. |

## Entry Points

- `bin/nexus` is the executable shim used by generated skills.
- `lib/nexus/cli/nexus.ts` is the TypeScript implementation behind that shim.
- `package.json` keeps `bun run nexus` pointed at `lib/nexus/cli/nexus.ts` for
  development.

## Conventions

- Keep command behavior in `commands/`; the CLI should parse, dispatch, and
  render only.
- Prefer type-only imports for shared shapes from `contracts/types.ts`.
- Push default cwd discovery to CLI entry points. Library functions should take
  an explicit `cwd` where practical.
- Use the strict JSON helpers in `io/validation-helpers.ts` when malformed
  artifacts should block; use lenient helpers only for optional or advisory
  reads.
- Keep generated skill prose delegating through `./bin/nexus <command>` rather
  than importing runtime modules directly.

## Tests

`test/nexus/` mirrors the runtime concerns with subdirectories such as
`test/nexus/cli/`, `test/nexus/governance/`, `test/nexus/io/`,
`test/nexus/runtime/`, `test/nexus/release/`, and `test/nexus/review/`.

## Related

- `docs/architecture/phase-4-structure-brief.md`
- `docs/architecture/repo-taxonomy-v2.md`
- `docs/architecture/post-audit-cleanup-plan.md`
