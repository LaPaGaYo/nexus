# lib/nexus/learning — SP1 Signal Architecture

Surfaces for the V1 self-learning loop, shipped in SP1.

## Public API (via lib/nexus/index.ts barrel)

| Symbol | Kind | Purpose |
|---|---|---|
| `LearningEntry` | type | Schema v2 entry shape (19 fields) |
| `MirrorMetadata` | type | Nested mirror block on mirrored canonical entries |
| `EvidenceType` / `SubjectStage` / `SupersedesReason` | type | Schema v2 enums |
| `assertSchemaV2` | function | Throw on malformed entry (write-time gate) |
| `generateLearningId` | function | New ULID (`lrn_<26-char>`) |
| `parseLearningId` | function | Validate + classify ULID vs `legacy:<sha256>` |
| `deriveLegacyId` | function | Deterministic `legacy:<sha256>` for migration |
| `ParsedLearningId` / `LegacyEntryInput` | type | Inputs/outputs for the id helpers |
| `computeStrength` | function | Derived 1–10 from `(evidence_type, source, confidence)`; SP6/SP2 single source of truth |
| `normalizeLearningLine` | function | v1 → v2 lazy normalization at read time |
| `NormalizedEntry` | type | normalizeLearningLine output (schema_version 1\|2) |
| `writeLearningCandidate` | function | Stage handlers call to write provisional `learning-candidates.json` |
| `WriteLearningCandidateInput` | type | writeLearningCandidate parameter shape |

## Internal (NOT exported via barrel)

- `config.ts` — `isMirrorEnabled()` reads `learning.mirror_on_closeout` from `~/.nexus/config.yaml` (or `$NEXUS_STATE_DIR/config.yaml`). Strict: only the boolean literal `true` enables mirroring. Closeout-internal.
- `mirror.ts` — `mirrorCanonicalToJsonl()` canonical → jsonl mirror with idempotent `(id, run_id)` ledger. Closeout-internal.

Both are imported directly by `lib/nexus/commands/closeout.ts` via relative path, not the barrel.

## 3-surface storage model

| Surface | Path | Written by | Governed? |
|---|---|---|---|
| Raw operational log | `~/.nexus/projects/<slug>/learnings.jsonl` | direct-template skills + closeout mirror | no (append-only) |
| Provisional candidates | `.planning/current/<stage>/learning-candidates.json` | `writeLearningCandidate` (build/review/qa/ship) | no (per-run) |
| Canonical run learnings | `.planning/current/closeout/learnings.json` | `/closeout` promotion | yes |

## Two write templates

- **Direct template** — support skills (`/investigate`, `/retro`, and Phase 8: `/simplify`, `/cso`) emit schema_v2 JSON via the `nexus-learnings-log` bash helper, which injects `id`/`schema_version`/`ts` defaults for v2-shaped entries (those with `writer_skill` present); `ts` is always injected. Lands directly in `learnings.jsonl`.
- **Chain template** — canonical stages (`/build`, and Phase 8: `/review`, `/qa`) call `writeLearningCandidate` → `.planning/current/<stage>/learning-candidates.json`. `/closeout` promotes valid candidates to canonical `learnings.json`, then optionally mirrors to `learnings.jsonl` (opt-in via `learning.mirror_on_closeout`).

## Concurrency note

`learnings.jsonl` writes use `appendFileSync` (in `bin/nexus-learnings-log` and `mirror.ts`) which is atomic per-write on POSIX but NOT sequenced across concurrent Nexus sessions on the same project. Line interleaving is harmless because dedup happens at read by `(key, type)` (latest-ts wins). `learning-candidates.json` writes use temp-file + atomic rename (`writeFileSync` to `<path>.tmp` then `renameSync` to final path; POSIX rename is atomic on the same filesystem). File locking is deferred to a future phase if real concurrent-session demand emerges.

## Schema version policy

- New entries always carry `schema_version: 2`.
- Legacy `learnings.jsonl` entries (no `schema_version`, or `schema_version: 1`) are normalized at read time by `normalizeLearningLine` into a virtual v2 shape with `schema_version: 1` retained as a provenance marker. The on-disk jsonl is never rewritten by SP1.
- A future `nexus learn migrate` command may produce a physical `learnings.v2.jsonl` after SP1 ships — out of SP1 scope.

## Known follow-ups (post-SP1)

- `LEARNING_SOURCES` drift: `lib/nexus/contracts/types.ts` defines a 4-member set; `lib/nexus/learning/schema.ts` defines an 8-member set. The barrel re-exports the contracts/types version. Reconcile before treating `LearningSource` as the cross-boundary canonical type. (Pre-SP1 tech debt surfaced during Task 17.)
- `/closeout` schema_version acceptance is hardcoded to `1 | 2`; a future schema_v3 needs the check extended.
