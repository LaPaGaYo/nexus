# Track D-D1 Brief: Rename adapters by lifecycle role

**Status:** Ready for implementation.
**Type:** Mechanical rename. No design decisions; no behavior changes.
**Parent plan:** `docs/architecture/phase-4-plan.md` § Phase 4.3 D1.
**Companion RFCs:** `track-d-d2-rfc.md`, `track-d-d3-rfc.md` (independent).

---

## Goal

Rename the 3 lifecycle-role adapters (and their parallel normalizers) so they
reflect what they *do* instead of where they were *absorbed from*.

| Current name | New name | Why this name |
|---|---|---|
| `adapters/pm.ts` | `adapters/discovery.ts` | Used by `/discover`, `/frame` (PM-style discovery work) |
| `adapters/gsd.ts` | `adapters/planning.ts` | Used by `/plan`, `/handoff` (GSD-style planning work) |
| `adapters/superpowers.ts` | `adapters/execution.ts` | Used by `/build`, `/review`, `/qa`, `/ship`, `/closeout` (engineering execution discipline) |

Same renames apply to `normalizers/{pm,gsd,superpowers}.ts` for parallel
structure.

`adapters/{ccb,local,registry,types,prompt-contracts}.ts` are **NOT renamed** —
they are transport / infrastructure, not lifecycle-role adapters.

---

## Why this rename matters

After D1 lands, the codebase no longer carries names that reference absorbed
upstream projects (PM Skill, GSD, Superpowers). Together with D2 (delete
the retired upstream snapshot root and `lib/nexus/absorption/`), the absorption thesis is
complete: PM/GSD/Superpowers concepts are fully native, and nothing in the
codebase suggests otherwise.

D1 has zero behavior change. Every test that passes before this PR passes after.

---

## Surface map (verified)

### Files to rename (6 total)

```
lib/nexus/adapters/pm.ts           → lib/nexus/adapters/discovery.ts
lib/nexus/adapters/gsd.ts          → lib/nexus/adapters/planning.ts
lib/nexus/adapters/superpowers.ts  → lib/nexus/adapters/execution.ts
lib/nexus/normalizers/pm.ts         → lib/nexus/normalizers/discovery.ts
lib/nexus/normalizers/gsd.ts        → lib/nexus/normalizers/planning.ts
lib/nexus/normalizers/superpowers.ts → lib/nexus/normalizers/execution.ts
```

### Importers (10 files to update)

| Renamed module | Importers |
|---|---|
| `adapters/pm` | `lib/nexus/normalizers/pm.ts`, `lib/nexus/commands/discover.ts`, `lib/nexus/commands/frame.ts` |
| `adapters/gsd` | `lib/nexus/normalizers/gsd.ts`, `lib/nexus/commands/plan.ts`, `lib/nexus/commands/closeout.ts` |
| `adapters/superpowers` | `lib/nexus/normalizers/superpowers.ts`, `lib/nexus/commands/build.ts`, `lib/nexus/commands/review.ts`, `lib/nexus/commands/ship.ts` |

Note: `normalizers/{pm,gsd,superpowers}.ts` import from `adapters/{pm,gsd,superpowers}.ts`. After rename, the new normalizer files import from the new adapter files.

### Out of scope (already organized by lifecycle, no rename needed)

- `lib/nexus/stage-packs/` — already has files named `build.ts`, `closeout.ts`,
  `discover.ts`, `frame.ts`, `handoff.ts`, `plan.ts`, `qa.ts`, `review.ts`,
  `ship.ts` (canonical command names). Untouched by D1.
- `lib/nexus/commands/` — already named after canonical commands. Importers
  inside it just update their `from` paths.
- `skills/**/*.tmpl` — verified zero references to `adapters/pm`,
  `adapters/gsd`, or `adapters/superpowers`. No skill prose rewrites needed.
- `lib/nexus/absorption/` — handled by D2 (delete entirely). D1 doesn't touch it.

### README narrative — defer to D2

`README.md` contains "absorbed from PM Skills, GSD, Superpowers" framing.
**Don't rewrite this in D1**. It's part of D2's documentation phase. Keep D1
purely about file renames.

---

## Implementation procedure

This is mechanical. The PR should consist of one squashable commit.

### Step 1: Rename files (use `git mv` to preserve history)

```bash
cd lib/nexus
git mv adapters/pm.ts adapters/discovery.ts
git mv adapters/gsd.ts adapters/planning.ts
git mv adapters/superpowers.ts adapters/execution.ts
git mv normalizers/pm.ts normalizers/discovery.ts
git mv normalizers/gsd.ts normalizers/planning.ts
git mv normalizers/superpowers.ts normalizers/execution.ts
```

### Step 2: Update import paths in 10 files

Inside each file in the table above, find and replace:

| Find | Replace with |
|---|---|
| `from './adapters/pm'` | `from './adapters/discovery'` |
| `from '../adapters/pm'` | `from '../adapters/discovery'` |
| `from './adapters/gsd'` | `from './adapters/planning'` |
| `from '../adapters/gsd'` | `from '../adapters/planning'` |
| `from './adapters/superpowers'` | `from './adapters/execution'` |
| `from '../adapters/superpowers'` | `from '../adapters/execution'` |
| `from '../normalizers/pm'` | `from '../normalizers/discovery'` |
| `from '../normalizers/gsd'` | `from '../normalizers/planning'` |
| `from '../normalizers/superpowers'` | `from '../normalizers/execution'` |

### Step 3: Update internal symbol names if any

Each renamed file may export symbols whose names hint at the absorbed source.
Check inside each file for symbols like `createPmAdapter`, `pmNormalizer`,
`SUPERPOWERS_*`. Rename them to match the new file purpose.

**Recommended symbol mapping:**

| Old symbol pattern | New symbol pattern |
|---|---|
| `createPmAdapter` | `createDiscoveryAdapter` |
| `createDefaultPmAdapter` | `createDefaultDiscoveryAdapter` |
| `createRuntimePmAdapter` | `createRuntimeDiscoveryAdapter` |
| `PmAdapter` (type) | `DiscoveryAdapter` |
| `pmNormalizer` | `discoveryNormalizer` |
| (same pattern for `Gsd` → `Planning` and `Superpowers` → `Execution`) | |

The `adapters/registry.ts` file likely registers all adapters by name; update
the registration keys/symbols there too.

The `adapters/types.ts` file likely has `NexusAdapters` interface members like
`pm`, `gsd`, `superpowers`. Rename those interface fields to `discovery`,
`planning`, `execution`.

### Step 4: Update field references in command handlers

Command handlers access adapters via `ctx.adapters.pm`, `ctx.adapters.gsd`,
`ctx.adapters.superpowers`. After Step 3, those become `ctx.adapters.discovery`
etc. Each of the 6 command handlers (`discover.ts`, `frame.ts`, `plan.ts`,
`closeout.ts`, `build.ts`, `review.ts`, `ship.ts`) needs the field reference
updated. (The exact list depends on which commands access which adapter.)

### Step 5: Verification

```bash
bunx tsc --noEmit                  # passes — every import path resolves
bun test                            # passes — no behavior change, all tests green
git grep -F "from './adapters/pm'"  # zero results
git grep -F "adapters/gsd"          # zero results
git grep -F "adapters/superpowers"  # zero results
git grep -F "createPmAdapter"       # zero results
git grep -F "createGsdAdapter"      # zero results
git grep -F "createSuperpowersAdapter"  # zero results
```

If any of those `git grep` commands return matches, the rename is incomplete.

### Step 6: Regenerate inventory

```bash
bun run repo:inventory:check       # passes after regeneration
```

---

## PR shape

- **Branch name**: `codex/track-d-d1-rename-adapters` (or
  `claude/track-d-d1-rename-adapters` if Claude does it).
- **Commit subject**: `Track D-D1: rename adapters by lifecycle role`
- **Commit body**:
  ```
  Rename adapters/{pm,gsd,superpowers} → {discovery,planning,execution}
  and matching normalizers/. Pure rename; no behavior change.

  6 files renamed via git mv (preserves history).
  10 importers updated.
  Symbol names within renamed files updated to match new file purpose.

  Companion to track-d-d2-rfc.md (deletes retired upstream snapshots) and
  track-d-d3-rfc.md (skill ecology v2).
  ```

---

## Acceptance criteria

D1 is complete when:

1. `bun test` passes (no behavior change).
2. `bunx tsc --noEmit` passes (every import resolves).
3. `git grep -F "from './adapters/pm'"`, `from './adapters/gsd'`,
   `from './adapters/superpowers'` all return zero results.
4. `git grep -F "createPmAdapter"`, `createGsdAdapter`, `createSuperpowersAdapter`
   return zero results.
5. `git grep -F "from './normalizers/pm'"`, `from '../normalizers/gsd'`,
   `from '../normalizers/superpowers'` all return zero results.
6. `lib/nexus/adapters/{discovery,planning,execution}.ts` exist.
7. `lib/nexus/normalizers/{discovery,planning,execution}.ts` exist.
8. `lib/nexus/adapters/{pm,gsd,superpowers}.ts` do NOT exist.
9. `lib/nexus/normalizers/{pm,gsd,superpowers}.ts` do NOT exist.
10. `git log --follow lib/nexus/adapters/discovery.ts` shows the original
    `adapters/pm.ts` history (proving `git mv` was used, not `cp + rm`).

---

## Effort estimate

**~1.5-2 hours**. Mechanical rename + 10 importer updates + symbol rename in 6
files + verification. The biggest time sink is making sure no symbol name
slipped through.

---

## Why this can land before D2

D1 is purely about **renaming** files and symbols. It does not delete
anything; it does not change any runtime behavior. D2 deletes vendor snapshots
and absorption metadata, which are also untouched by D1.

The two PRs are independent and can land in any order. Recommendation:
**land D1 first** — its smaller diff makes review easier, and once D1 lands,
any D2 work can drop the cognitive load of "which axis is this name on".

---

## References

- `docs/architecture/phase-4-plan.md` — parent plan
- `docs/architecture/track-d-d2-rfc.md` — companion RFC (delete upstream)
- `docs/architecture/track-d-d3-rfc.md` — companion RFC (skill ecology v2)
- `lib/nexus/adapters/registry.ts` — likely registers all adapters; update
  registration keys
- `lib/nexus/adapters/types.ts` — likely has `NexusAdapters` interface;
  update field names
