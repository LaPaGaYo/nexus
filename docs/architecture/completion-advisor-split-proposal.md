# `completion-advisor.ts` Split Proposal

**Status:** Draft for review.
**Author:** Surfaced from architecture audit on 2026-05-04.
**Blocks:** Cleanup plan Phase 4 ST1 (`lib/nexus/` subdir-by-concern).

---

## Executive summary

`lib/nexus/completion-advisor.ts` is the highest-coupling module in
`lib/nexus/` at **1452 LOC**. Every lifecycle command handler imports from
it. It mixes resolver logic (which next action to recommend per stage) with
writer logic (build a `.planning/current/<stage>/completion-advisor.json`
artifact pointer).

A two-module split is sufficient and high-ROI:

- `completion-advisor/resolver.ts` — pure logic that builds
  `CompletionAdvisorRecord` per stage; no filesystem I/O.
- `completion-advisor/writer.ts` — orchestrates state inputs, calls the
  resolver, and returns the `{ path, content }` write artifact pointer.

A four-module split (resolver / state / writer / formatter) was initially
proposed; deeper analysis shows `state.ts` and `formatter.ts` would be
empty wrappers — those concerns already live in `verification-matrix.ts` /
`external-skills.ts`, and there is no terminal-rendering code inside this
file. Defer or skip those.

This proposal is migration-safe: every external callsite uses exactly the
same two-symbol import pattern, so each consumer changes one import line.
No logic change is required.

---

## Current state (measured)

```
$ wc -l lib/nexus/completion-advisor.ts
1452 lib/nexus/completion-advisor.ts
```

### Exported symbols (13 total)

| Symbol | Line | Concern | Target module |
|---|---|---|---|
| `CompletionAdvisorWriteOptions` (interface) | 325 | Write API | `writer.ts` |
| `attachExternalInstalledSkillRecommendations` | 293 | Resolver enrichment | `resolver.ts` |
| `buildFrameCompletionAdvisor` | 332 | Resolver | `resolver.ts` |
| `buildPlanCompletionAdvisor` | 411 | Resolver | `resolver.ts` |
| `buildHandoffCompletionAdvisor` | 493 | Resolver | `resolver.ts` |
| `buildBuildCompletionAdvisor` | 546 | Resolver | `resolver.ts` |
| `buildReviewCompletionAdvisor` | 677 | Resolver | `resolver.ts` |
| `buildQaCompletionAdvisor` | 891 | Resolver | `resolver.ts` |
| `buildShipCompletionAdvisor` | 1076 | Resolver | `resolver.ts` |
| `buildCloseoutCompletionAdvisor` | 1236 | Resolver | `resolver.ts` |
| `buildCompletionAdvisorWrite` | 1376 | Writer (compose state + resolver + path) | `writer.ts` |
| `buildStageCompletionAdvisor` | 1394 | Resolver dispatch | `resolver.ts` |
| `reviewDispositionInvocation` | 1440 | Resolver helper | `resolver.ts` |

12 of 13 exported symbols go to `resolver.ts`; 2 of 13 go to `writer.ts`
(one is shared — `attachExternalInstalledSkillRecommendations` is exported
from `resolver.ts` and re-imported by `writer.ts`).

### Callsite inventory (8 consumers, all in `lib/nexus/commands/`)

Every consumer uses **exactly the same two-symbol pattern**:

```ts
// commands/frame.ts:13
import { buildCompletionAdvisorWrite, buildFrameCompletionAdvisor } from '../completion-advisor';

// commands/plan.ts:17
import { buildCompletionAdvisorWrite, buildPlanCompletionAdvisor } from '../completion-advisor';

// commands/handoff.ts:29
import { buildCompletionAdvisorWrite, buildHandoffCompletionAdvisor } from '../completion-advisor';

// ... and 5 more, identical pattern
```

No consumer uses `attachExternalInstalledSkillRecommendations`,
`buildStageCompletionAdvisor`, or `reviewDispositionInvocation` directly.
The split is clean at every callsite — one import becomes two imports per
consumer.

---

## Proposed split

### Target file layout

```
lib/nexus/completion-advisor/
├── resolver.ts        # ~1150 LOC — all 11 build*Advisor functions + private helpers
├── writer.ts          # ~80 LOC   — buildCompletionAdvisorWrite + CompletionAdvisorWriteOptions
└── index.ts           # ~10 LOC   — re-exports for compatibility (optional, see migration phase 1)
```

Or, if the team prefers to keep top-level flat for now:

```
lib/nexus/
├── completion-advisor.ts          # delete after migration
├── completion-advisor-resolver.ts # ~1150 LOC
└── completion-advisor-writer.ts   # ~80 LOC
```

The subdirectory layout aligns with cleanup plan Phase 4 ST1 (subdir-by-
concern) and is recommended.

### Module responsibilities

#### `resolver.ts` (pure logic)

- **Inputs:** stage state records, ledger snapshot, verification matrix,
  installed external skills (all passed in as parameters).
- **Outputs:** `CompletionAdvisorRecord` (in-memory record, no I/O).
- **Imports:** `./types`, `../types`, `../verification-matrix`,
  `../external-skills`, `../shell-quote` (only for `buildShipCompletionAdvisor`'s
  push-command formatting at line 1163).
- **No filesystem writes. No process.env reads. No process.cwd() defaults.**
- Owns the 13 stage-resolver `build*Advisor` functions and all private
  helpers (`action`, `stopAction`, `baseAdvisor`, `suggestedSkillSignal`,
  `reviewAdvisoryFollowupSignal`, etc.).

#### `writer.ts` (state composition + path)

- **Single export:** `buildCompletionAdvisorWrite(record, options)` →
  `{ path: string; content: string }`.
- **Reads:** `readVerificationMatrix(cwd)`,
  `discoverExternalInstalledSkills({ cwd, home })`.
- **Calls:** `attachExternalInstalledSkillRecommendations` from
  `./resolver` to enrich the record.
- **Writes:** nothing — returns a write pointer for the caller to persist.
- **Why not "writes":** the function name says "build...Write" because it
  builds a write artifact. The actual `fs.writeFile` lives in the command
  handler. This keeps the writer testable without touching disk.

The `state.ts` and `formatter.ts` modules originally proposed are **not
recommended** at this time:

- `state.ts` — `verification-matrix.ts` and `external-skills.ts` already
  encapsulate the input concerns. A `state.ts` would just be a thin
  re-export. Add it later only if test infrastructure needs centralized
  injection.
- `formatter.ts` — there is no terminal-rendering code in
  `completion-advisor.ts`. The visibility-reason field is populated inline
  at every `action()` call inside resolver logic; it is not a separate
  pass. If a host-independent renderer is added later (currently
  `cli-advisor.ts` handles terminal output), revisit then.

---

## Migration sequence (3 phases)

### Phase 1 — Extract `writer.ts` (cheapest, highest isolation)

**Branch:** `claude/completion-advisor-writer-split`
**Estimated effort:** 1-2 hours

1. Create `lib/nexus/completion-advisor/writer.ts`.
2. Move `buildCompletionAdvisorWrite` (lines 1376-1392) and
   `CompletionAdvisorWriteOptions` interface (line 325 plus its dependent
   types) into `writer.ts`.
3. `writer.ts` imports from `./resolver` (which is still
   `../completion-advisor.ts` until Phase 2).
4. Update 8 command files to import `buildCompletionAdvisorWrite` from the
   new path:
   ```ts
   // before
   import { buildCompletionAdvisorWrite, buildFrameCompletionAdvisor } from '../completion-advisor';
   // after
   import { buildCompletionAdvisorWrite } from '../completion-advisor/writer';
   import { buildFrameCompletionAdvisor } from '../completion-advisor';
   ```
5. **Verification:** `bun test` exit 0 (no behavior change). The full
   `external-skills.test.ts`, `completion-advisor.test.ts`, and stage tests
   should remain green without modification.

**Why first:** smallest extraction, no ambiguous helpers, validates the
sub-directory layout before committing to the larger move.

### Phase 2 — Extract `resolver.ts` (largest, but internally coherent)

**Branch:** `claude/completion-advisor-resolver-split`
**Estimated effort:** 2-4 hours
**Dependency:** Phase 1 must be in main.

1. Create `lib/nexus/completion-advisor/resolver.ts`.
2. Move all remaining symbols from `lib/nexus/completion-advisor.ts` into
   `resolver.ts`:
   - 11 `build*Advisor` functions (Frame, Plan, Handoff, Build, Review, QA,
     Ship, Closeout, Stage dispatcher)
   - `attachExternalInstalledSkillRecommendations`
   - `reviewDispositionInvocation`
   - All private helpers: `action`, `stopAction`, `baseAdvisor`,
     `suggestedSkillSignal`, `supportSkillWhyFromSignal`,
     `supportSkillEvidenceFromSignal`, `reviewAdvisoryFollowupSignal`,
     `reviewAdvisoryEvidenceFromSignal`, `reviewAdvisoryHasCategory`,
     `advisorSurfaces`, `outcomeForStatus`, `suppressedSurfaces`,
     `uniqueStrings`, `uniqueValues`, `humanList`,
     `renderChecklistBackedVisibilityReason`, `designBearing`,
     `deploySurfaceConfigured`, `canaryEvidenceRelevant`,
     `reviewDispositionActions`
   - `HIDDEN_COMPAT_ALIASES`, `HIDDEN_UTILITY_SKILLS` constants
3. Update the 8 command files' second import line:
   ```ts
   // before
   import { buildFrameCompletionAdvisor } from '../completion-advisor';
   // after
   import { buildFrameCompletionAdvisor } from '../completion-advisor/resolver';
   ```
4. Update `writer.ts`'s import of
   `attachExternalInstalledSkillRecommendations` from
   `'../completion-advisor'` to `'./resolver'`.
5. Delete `lib/nexus/completion-advisor.ts` (the original file is now empty
   or just re-exports — remove cleanly).
6. Optional: add `lib/nexus/completion-advisor/index.ts` that re-exports
   from both modules for backwards-compatible imports if the team prefers
   `'../completion-advisor'` to keep working as an alias. Not recommended
   long-term — the explicit imports are more readable.
7. **Verification:** `bun test` exit 0; `bun run build` exit 0.

### Phase 3 — Move tests to mirror layout (cleanup plan ST9)

**Branch:** `claude/completion-advisor-test-mirror`
**Estimated effort:** 1 hour
**Dependency:** Phase 2 must be in main.

Move `test/nexus/completion-advisor.test.ts` to mirror the new structure:

```
test/nexus/completion-advisor/
├── resolver.test.ts   # behavioral tests for build*Advisor functions
└── writer.test.ts     # buildCompletionAdvisorWrite tests (currently absent —
                       # opportunity to add coverage here)
```

This phase is the natural moment to address PR #34's noted gap: there is
currently no behavioral test for `buildCompletionAdvisorWrite`'s
empty-array default behavior on
`attachExternalInstalledSkillRecommendations`. Add it during the move.

---

## Test strategy

### Phase 1 verification

- `bun test test/nexus/completion-advisor.test.ts` exit 0
- `bun test` (full suite) exit 0
- Manual: run `bun run bin/nexus.ts plan` against a scratch repo, verify
  `.planning/current/plan/completion-advisor.json` content unchanged.

### Phase 2 verification

- Same as Phase 1, plus:
- `bunx tsc --noEmit` exit 0 (every import path resolves)
- `git grep -F "from '../completion-advisor'"` returns zero matches in
  `lib/nexus/`
- `git grep -F "from '../completion-advisor/resolver'"` returns 8 matches
  (one per command file)
- `git grep -F "from '../completion-advisor/writer'"` returns 8 matches

### Phase 3 verification

- Test paths follow `test/nexus/completion-advisor/<module>.test.ts`
- New `writer.test.ts` exercises:
  - happy path: returns expected `{ path, content }`
  - sparse-record path: empty arrays as default for installed external
    skills
  - cwd-required: throws when `cwd` is not provided (per PR #34's
    convention)

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Import-path typo breaks build | Medium | Low (caught by tsc/test) | Phase 1 first to validate the layout with the smallest move |
| Hidden circular dependency | Low | High | Verified by static analysis: writer→resolver, resolver does not import writer |
| Private helpers accidentally left in old file | Low | Low | git grep verification step in Phase 2 catches dangling imports |
| Test fixture path collision | Low | Low | Phase 3 moves test files separately after the runtime move stabilizes |
| Subdir layout disagrees with cleanup plan ST1 | Low | Low | Subdir layout is exactly what ST1 prescribes |
| New `writer.test.ts` reveals behavior bug | Medium | Medium | Treat as separate fix; do not block Phase 3 on a pre-existing bug |

The largest single risk is **size** — moving ~1300 LOC in Phase 2. Mitigated
by Phase 1's smaller test of the layout pattern, plus the migration is
mechanical (no logic change).

---

## Out of scope

The following are explicitly **not** part of this proposal:

- Behavior changes to any `build*Advisor` function. Phase 2 is a pure move.
- `state.ts` / `formatter.ts` modules. Add later if test infrastructure or
  host-independent rendering needs emerge.
- Refactoring the `action`/`stopAction` factory pattern. Already idiomatic.
- Splitting `buildShipCompletionAdvisor` (170 LOC, the largest stage
  function). Internally cohesive; no current need.
- `governance.ts` typed-error work. Tracked separately.

---

## Acceptance criteria

The split is considered complete when:

1. `lib/nexus/completion-advisor.ts` no longer exists (or is a thin
   re-export shim if the team chose option B).
2. `lib/nexus/completion-advisor/{resolver,writer}.ts` exist and are
   imported directly by all 8 `commands/*.ts` consumers.
3. `bun test` and `bun run build` both pass.
4. The verification matrix and external skill scanner are unaffected (no
   changes to `verification-matrix.ts` or `external-skills.ts`).
5. `bun test test/nexus/completion-advisor/writer.test.ts` includes at
   least one test that did not exist before (the empty-default test
   surfaced in PR #34's review).

---

## References

- `lib/nexus/completion-advisor.ts` — current source (1452 LOC).
- `docs/architecture/context-diagram.md` — discovery doc for this risk.
- `docs/architecture/post-audit-cleanup-plan.md` Phase 4 ST1 — depends on
  this proposal landing first.
- 8 consumer command files at `lib/nexus/commands/{frame,plan,handoff,build,review,qa,ship,closeout}.ts`.
- Related: PR #34 (cwd discipline) noted the missing behavioral test for
  `buildCompletionAdvisorWrite`'s empty-default; Phase 3 picks it up.
