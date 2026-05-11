# Track D-D3 Phase 5 Brief: `/nexus do <intent>` dispatcher

**Status:** Ready for implementation. Largest D3 sub-phase by user-impact: introduces a NEW top-level command. Schema (Phase 2.a, PR #91 ✅), registry consumption (Phase 2.b, #74), advisor (Phase 3, #77), and built-in manifests (Phase 4, #78) should land first.

> **Historical context note (issue #148):** This document was authored
> against an earlier repository layout. Some commands and file paths
> below reference the pre-#142 flat `scripts/` layout — current paths
> live under `scripts/{build,skill,eval,repo,resolvers}/`. The contents
> are kept verbatim for provenance; substitute current paths when
> running commands from this document today.

**Type:** New product surface. Adds `nexus do <intent>` as a meta-command alongside the existing canonical lifecycle.

**Parent plan:** `docs/architecture/track-d-d3-rfc.md` § Phase 3.5 (Component 4: `/nexus do <intent>` dispatcher (C)).
**Predecessors:**
- Phase 2.a (#65, ✅ landed via PR #91)
- Phase 2.b (#74)
- Phase 3 advisor (#77) — recommended; both phases consume the same registry data
- Phase 4 built-in manifests (#78) — strongly recommended; without manifests, dispatcher has no Nexus-native intent to route to

**Issue:** #79.

---

## Goal

Introduce a new top-level entrypoint:

```bash
nexus do "let's plan this auth refactor"
```

The dispatcher:
1. Parses the free-form intent string
2. Queries the SkillRegistry's `intent_keywords` for candidates
3. Optionally calls a local LLM classifier for richer matching (gated by env)
4. Returns one of three outcomes:
   - **Confident match** → auto-dispatch to the matched skill (governed if canonical)
   - **Ambiguous** → show top 3-5 candidates, user picks
   - **No match / refuse** → "Out of scope" with helpful suggestion
5. Records every routing decision in `.planning/<run>/do-history.json` for transparency

**Why this matters**: until Phase 5, users must remember 9 canonical commands + dozens of support skill names. After Phase 5, they describe what they want in plain language, and Nexus routes. This is the user-facing payoff that makes the entire D3 track worthwhile.

---

## Strategic framing

Phase 5 is the moment Nexus stops being an artifact pipeline you have to learn and starts being a router that adapts to you.

Two design tensions resolved here:
- **Convenience vs governance**: `do` is non-governed (no artifact write); the skill it dispatches to remains governed (canonical lifecycle stages still write artifacts and require user confirmation). Governance is preserved at the right boundary.
- **Smart vs predictable**: keyword matching is deterministic and offline. LLM classification is smarter but introduces non-determinism + cost + latency + cross-provider risk. Solution: keyword is the default; LLM is opt-in via env var; LLM **never crosses provider boundary** (Claude users get Claude classifier; Codex users get Codex classifier — never cross-routed via CCB).

This brief implements the keyword path with an LLM hook that other phases (or third-party skills) can plug in. The keyword path alone is sufficient to ship Phase 5 — LLM is purely additive.

---

## Cross-host behavior (added 2026-05-06)

Phase 5 dispatcher is **host-agnostic** by design. The classifier is pure TypeScript over the registry API; nothing in the routing logic depends on the active host (Claude Code, Codex CLI, Gemini CLI, Factory, etc.).

### What's the same across all hosts

- **9 canonical lifecycle commands** (`/discover` … `/closeout`): always present, always dispatchable
- **23 Nexus-native support skills + 4 safety + 1 root**: always present after Phase 4 (#78)
- **Keyword classifier behavior**: deterministic, identical input → identical output regardless of host
- **`do-history.json` artifact format**: portable across hosts; user can switch host mid-milestone
- **Privacy guards**: `local_provider` mode + LLM env gates work identically

### What's host-specific

**External skill availability depends on what the user has installed.** Per Model γ (parent RFC § Strategic framing), Nexus does NOT bundle PM Skills (47), Superpowers (14), GSD (24 agents + 67 commands), or CCB (11 skills). Users install these via their host's marketplace:

| Host | External skill installation channel |
|---|---|
| Claude Code | PM marketplace, `claude-plugins-official`, GSD installer, CCB |
| Codex CLI | Codex's plugin/skill ecosystem (`codex_skills/`) |
| Gemini CLI | Gemini's plugin/skill ecosystem |
| Factory | Factory's plugin/skill ecosystem |

**Implication for `nexus do`:**

```
Claude Code user with PM marketplace installed:
  nexus do "write a PRD"  →  prd-development (PM, score 12) ✓ confident match

Codex CLI user without PM:
  nexus do "write a PRD"  →  /frame (canonical, score 9) — falls back gracefully
                              OR refuse if even canonical doesn't reach threshold
```

The graceful degradation is **by design** — it's exactly what Model γ buys us. Users on different hosts get different external skills; Nexus's canonical lifecycle is the universal floor.

### LLM classifier defaults to active host's provider

The LLM classifier (when enabled via `NEXUS_INTENT_LLM=1`) calls **the user's current host's provider**:

- Claude Code user → classifier calls Claude API
- Codex CLI user → classifier calls Codex/OpenAI API
- Gemini CLI user → classifier calls Gemini API

The LLM call is **NOT a new privacy boundary** — the user is already talking to that provider through the host. The classifier is one extra small call on a path the user is already using.

**What `NEXUS_INTENT_LLM=0` (default) buys you:**
- **Determinism**: same input → same output across runs (CI / audit / reproducibility)
- **Cost**: zero token spend on routing decisions
- **Latency**: keyword match is sub-millisecond; LLM call is seconds
- **NOT**: "no network at all" — the rest of your Nexus session uses the host normally

### Cross-provider via CCB: explicitly OPT-IN, not default

If user has CCB mounted with multi-provider routing (e.g., Claude Code + Codex + Gemini all reachable), `nexus do` does NOT cross-provider-route the classifier by default. Reasons:

1. **User intent stays in user's primary provider** — sending Claude user's `nexus do` intent string to Codex via CCB would be unexpected data flow
2. **Determinism** — cross-provider routing introduces an extra dimension of behavioral variability
3. **Cost attribution** — calls go where the user expects them

A future opt-in flag (`NEXUS_INTENT_LLM_PROVIDER=codex` or similar) could allow override, but it's NOT in this brief's scope.

### `local_provider` mode story

When `ledger.execution.mode === 'local_provider'`:

- Phase 5 classifier runs **keyword-only path** (LLM unreachable structurally)
- Motivation: user has explicitly chosen offline-first / minimal-call mode
- Implication: classifier quality depends entirely on manifest `intent_keywords` quality
- Phase 4 (#78) authoring 28 native manifests is the lever that makes local_provider mode usable

This pairs cleanly with Phase 5's role in Mode A (per `phase-5-team-mode-plan.md`): solo Nexus user on a non-Nexus team gets a friendly entrypoint without surrendering control over LLM calls.

### Two-layer routing

`nexus do` adds a NEW routing layer **on top of** the existing Phase 1-4 lifecycle routing:

```
nexus do "..."
       ↓
Layer 1: Phase 5 classifier — intent → skill name
       ↓
Layer 2: existing canonical/external dispatch — skill → run on CCB or local provider
       (per ledger.execution.mode, unchanged from current behavior)
```

Layer 2 is what handles "Claude user delegates `/qa` execution to Codex via CCB" — that's existing behavior preserved. Layer 1 (Phase 5) only changes how users invoke; it doesn't reshape lifecycle execution.

---

## Surface map

### Files to create

```
lib/nexus/commands/
└── do.ts                              ← new command handler

lib/nexus/intent-classifier/
├── index.ts                           ← orchestration + public API
├── keyword.ts                         ← deterministic keyword matching
├── llm.ts                             ← LLM-based classifier (opt-in stub)
└── types.ts                           ← shared types

test/nexus/
├── intent-classifier.test.ts          ← classifier unit tests
└── do-command.test.ts                 ← end-to-end dispatcher tests
```

### Files to modify

```
lib/nexus/command-manifest.ts          ← register 'do' as a meta-command (NOT canonical)
lib/nexus/migration-safety.ts          ← update assertCanonicalLifecycleEntrypoint to allow 'do'
bin/nexus.ts                           ← route 'do' to commands/do.ts handler
docs/skill-manifest-schema.md          ← document intent_keywords semantics for skill authors
```

### Files NOT to modify

- `lib/nexus/skill-registry/*` — frozen post-Phase-1; this phase only consumes the public API
- Stage-pack files — `do` is not a lifecycle stage
- `completion-advisor/*` — different consumer of the same registry data; no overlap with `do`

---

## CLI semantics

### Invocation

```bash
nexus do "<free-form intent>"
```

Examples:
- `nexus do "write a PRD for the auth feature"` → dispatches `/frame` or PM `prd-development`, depending on confidence
- `nexus do "ship it"` → dispatches `/ship` (canonical)
- `nexus do "review the auth module"` → ambiguous → shows top 3
- `nexus do "do my taxes"` → refuses with "out of scope"

### Output formats

**Terminal (TTY)**: human-readable prose with confirmation prompt for medium-confidence cases.

**Non-TTY / `--json`**: structured JSON for programmatic use:

```json
{
  "intent": "let's plan this auth refactor",
  "outcome": "confident_match",
  "chosen": {
    "name": "plan",
    "namespace": "nexus_canonical",
    "score": 12,
    "matched_keywords": ["plan this", "refactor"]
  },
  "candidates": [
    { "name": "plan", "score": 12 },
    { "name": "frame", "score": 7 },
    { "name": "discover", "score": 4 }
  ],
  "history_entry_id": "do_2026-05-06T04-30-00Z_a1b2"
}
```

### Confidence semantics

- **Confident match**: top score ≥ 10 AND top-1 score > top-2 score × 1.5
  → auto-dispatch (no prompt) when CLI; show choice in JSON output
- **Ambiguous**: top score ≥ 5 but tie/cluster
  → show top 3-5; user picks via interactive prompt OR via `nexus do <intent> --pick=N`
- **No match**: top score < 5 OR no candidates
  → refuse with reason + helpful "Did you mean...?"

Thresholds are configurable via env (see Decision points).

### Refuse format

```
Out of scope.

I matched no skills with high confidence for: "do my taxes"

Closest candidates (low confidence):
  /retro    (score 2) — engineering retrospective

If this should be a Nexus skill, see docs/skill-manifest-schema.md
to author one. If you're starting a new milestone, try: nexus discover
```

Refuses are NOT errors at the shell level (exit 0) — they're meaningful "no" signals. Failures (registry unreachable, etc.) exit non-zero.

---

## Routing algorithm

### Keyword path (default, always available)

For each skill in `registry.list()`:
1. Score = sum of weighted keyword matches between intent string and `manifest.intent_keywords`
2. Boosts:
   - Exact match: 5 points
   - Substring match (whole word): 3 points
   - Stem/lemma match: 2 points (basic English stemming, no NLP libs)
3. Apply `manifest.ranking.base_score` and `boosts[]`
4. Filter: `manifest.applies_to.contexts` — skip skills whose context doesn't match current run
5. Sort descending by score
6. Apply confidence thresholds → outcome

Implementation in `intent-classifier/keyword.ts`. Pure function over `(intent: string, registry: SkillRegistry, ctx: Context) → ClassifierResult`.

### LLM path (opt-in, gated)

When `NEXUS_INTENT_LLM=1` AND **NOT** in `local_provider` mode:

1. Build a system prompt with skill list (name + summary + intent_keywords) — capped at top-50 by recent usage to keep token budget bounded
2. User message = the free-form intent
3. Single classification call: returns top-3 skill names with confidence scores
4. Merge LLM scores with keyword scores (weighted average; configurable)
5. Apply confidence thresholds → outcome

LLM provider chosen by host config (Claude / Codex / Gemini), defaulting to the active provider. Cache: identical (intent, registry hash) skips the call within 5 min window.

**Gating logic**: `local_provider` mode (offline-first preference) AND `NEXUS_INTENT_LLM=1` (opt-in flag) BOTH must be true for LLM path to run. The two gates are AND'd, not OR'd. See § Cross-host behavior for the design rationale (NOT primarily about "no LLM data leak"; about determinism + cost + cross-provider opt-in).

Implementation in `intent-classifier/llm.ts`. Returns `null` when gated off; `do-command.ts` falls through to keyword-only.

### Combined orchestration

`intent-classifier/index.ts` exports:

```typescript
export interface ClassifierResult {
  outcome: 'confident_match' | 'ambiguous' | 'refuse';
  candidates: Array<{
    name: string;
    namespace: NexusSkillNamespace;
    score: number;
    matched_keywords: string[];
    surface: string;     // "/<name>" for canonical, just name for support/external
  }>;
  chosen?: ClassifierCandidate;  // only when outcome === 'confident_match'
  reason?: string;                // human-readable for ambiguous/refuse cases
}

export function classifyIntent(
  intent: string,
  registry: SkillRegistry,
  ctx: ClassifierContext,
): ClassifierResult;
```

`do-command.ts` calls `classifyIntent` and translates the result into terminal output + dispatch action.

---

## `do-history.json` artifact

Every `nexus do` invocation appends to `.planning/<run>/do-history.json`:

```json
{
  "schema_version": 1,
  "history": [
    {
      "id": "do_2026-05-06T04-30-00Z_a1b2",
      "timestamp": "2026-05-06T04:30:00Z",
      "intent": "let's plan this auth refactor",
      "outcome": "confident_match",
      "candidates": [...],
      "chosen": "plan",
      "classifier_path": "keyword",
      "duration_ms": 47
    }
  ]
}
```

Stamped via `withLedgerSchemaVersion` (mirroring the ledger pattern from PR #47). Each invocation appends; no compaction. After Phase 6 docs, this artifact's purpose is documented for users who want to audit "why did Nexus dispatch X for me?"

History entries with `outcome: 'refuse'` are kept too — they're useful for "user keeps trying intents Nexus can't match → consider authoring a new skill".

---

## Implementation procedure

### Step 1: Add types

`lib/nexus/intent-classifier/types.ts`:
- `ClassifierResult`, `ClassifierCandidate`, `ClassifierContext`, `ClassifierOutcome`

### Step 2: Implement keyword classifier

`lib/nexus/intent-classifier/keyword.ts`:
- `classifyByKeywords(intent, candidates)` pure function
- Tokenize intent (whitespace + lowercase + basic stemming)
- Score per skill via manifest.intent_keywords matching
- Apply `manifest.ranking` boosts

### Step 3: Implement LLM classifier (stub OK)

`lib/nexus/intent-classifier/llm.ts`:
- Stub the call boundary; real LLM integration can land in a later sub-phase
- Returns `null` when env gates are unset
- Document the prompt template and expected response format

### Step 4: Orchestrate

`lib/nexus/intent-classifier/index.ts`:
- Read env (`NEXUS_INTENT_LLM`)
- Detect `local_provider` mode (via `ledger.execution.mode`)
- Call keyword classifier
- If LLM enabled AND not local_provider: call LLM, merge scores
- Apply confidence thresholds
- Return `ClassifierResult`

### Step 5: Implement `commands/do.ts`

- Parse args: free-form intent string, optional `--json`, `--pick=N`, `--no-llm`
- Call `classifyIntent`
- Route by outcome:
  - `confident_match`: dispatch chosen skill via existing canonical lifecycle handler (governed); for external skill, hand off to host with skill identifier
  - `ambiguous`: terminal prompt with picker; respect `--pick=N` for non-interactive
  - `refuse`: print refuse message + closest candidates
- Append to `.planning/<run>/do-history.json` regardless of outcome
- Return appropriate exit code (0 for valid outcomes incl. refuse; 1+ for errors)

### Step 6: Wire into command manifest + dispatch

`lib/nexus/command-manifest.ts`:
- Add new `META_COMMANDS` table (or similar): `{ name: 'do', handler: commands/do.ts }`
- Keep `CANONICAL_COMMANDS` for the 9 lifecycle stages (untouched)

`lib/nexus/migration-safety.ts`:
- Update `assertCanonicalLifecycleEntrypoint` to ALSO accept `'do'`
- Or refactor to two checks: lifecycle vs meta

`bin/nexus.ts`:
- Update `resolveRuntimeInvocation` to dispatch `'do'` to its handler

### Step 7: Tests

#### Classifier unit tests (`test/nexus/intent-classifier.test.ts`)

1. **Confident keyword match**: intent "write a PRD" → top 1 skill (e.g., `prd-development`) with score gap > 1.5×
2. **Ambiguous**: intent "review code" → 3 skills cluster (review, code-review-helper, design-review)
3. **No match**: intent "fly to mars" → empty candidates
4. **Stem matching**: intent "planning a feature" matches keyword "plan"
5. **Manifest base_score applied**: skill with `base_score: 10` outranks keyword-only matches
6. **Ranking boosts applied**: skill with stage-tag boost in matching context wins
7. **Empty registry**: returns refuse outcome
8. **LLM disabled (`NEXUS_INTENT_LLM=0`)**: keyword path only; LLM stub never called
9. **LLM in local_provider mode**: stub never called regardless of env
10. **LLM enabled (mock)**: scores merged with keyword; result follows expected shape
11. **`applies_to.contexts` filter**: skill restricted to "team" mode skipped in solo run

#### Dispatcher end-to-end tests (`test/nexus/do-command.test.ts`)

12. **Confident match → dispatch**: `nexus do "ship it"` → routes to `/ship`; do-history.json updated
13. **Ambiguous → picker (with --pick=N)**: `nexus do "review" --pick=2` selects 2nd candidate
14. **Refuse**: `nexus do "do my taxes"` → exit 0, refuse message, history entry recorded
15. **`--json` output**: structured response on stdout
16. **History persistence**: 3 invocations → 3 entries in do-history.json, all with valid IDs
17. **Schema versioning**: do-history.json header has `schema_version: 1`

### Step 8: Documentation

- New: `docs/intent-routing.md` — user-facing guide ("write a PRD" → /frame, etc.)
- Update: `docs/skill-manifest-schema.md` — explain `intent_keywords` design for authors
- Update: `README.md` — mention `nexus do` as primary entrypoint after the canonical commands
- Update: `CLAUDE.md` — add note that `nexus do` is now available

### Step 9: Verification

```bash
bun test test/nexus/intent-classifier.test.ts test/nexus/do-command.test.ts
bun test                                           # all green
bun run skill:check                                # clean
bunx tsc --noEmit                                  # green
nexus do "let's discover this idea"                # smoke test → /discover
nexus do "do my taxes"                             # smoke test → refuse
bun run scripts/repo-path-inventory.ts             # regen + commit
```

---

## Acceptance criteria

This brief is complete when:

1. ✅ `lib/nexus/commands/do.ts` exists with full dispatcher logic
2. ✅ `lib/nexus/intent-classifier/{index,keyword,llm,types}.ts` exist
3. ✅ `command-manifest.ts` registers `do` as meta-command
4. ✅ `migration-safety.ts` allows `do` past canonical-lifecycle gate
5. ✅ `bin/nexus.ts` dispatches `do` correctly
6. ✅ Tests at `test/nexus/intent-classifier.test.ts` (11 cases) and `test/nexus/do-command.test.ts` (6 cases) all pass
7. ✅ `.planning/<run>/do-history.json` is created/appended on every invocation
8. ✅ Schema version stamping via `withLedgerSchemaVersion`
9. ✅ LLM path structurally unreachable in `local_provider` mode (test pinned). Note: this gate is about user's offline-first preference + cross-provider routing avoidance, NOT about "preventing data leak to LLM" (host's main session already calls LLM).
10. ✅ User-facing docs: `docs/intent-routing.md` + manifest-schema doc updated
11. ✅ README mentions `nexus do` as a primary entrypoint
12. ✅ `bun test` green; `bun run skill:check` clean; `bunx tsc --noEmit` green
13. ✅ `repo-path-inventory.md` regenerated (4-7 new files added)

---

## Out of scope (deferred)

- **Real LLM integration**: stub provided; full provider integration (Claude/Codex/Gemini) is a follow-up. Phase 5 ships with a working stub + the keyword path proven.
- **Multi-step intent decomposition**: dispatcher handles single-stage intent only ("plan this") not multi-step ("plan AND build it"). Multi-step routing is a future research direction.
- **Conversational refinement**: dispatcher does not ask clarifying questions ("which auth module?") — outputs candidates and lets user re-invoke. Future work for richer UX.
- **Cross-stage history awareness**: dispatcher doesn't read prior do-history to detect "user already tried this skill" — each invocation is stateless. Future work.
- **Skill installation suggestion**: when no skill matches, dispatcher suggests authoring a manifest but doesn't help install third-party skills. Phase 2.4 (#76 installer) covers that separately.
- **`/nexus do` from inside an existing run**: this brief assumes top-level invocation only; in-stage routing is out of scope.
- **Telemetry / metrics on routing decisions**: do-history.json is per-run; cross-run aggregate metrics is future observability work.

---

## Effort estimate

**~6-8 hours** total:
- 30 min: types
- 2 hr: keyword classifier
- 30 min: LLM classifier stub
- 1 hr: orchestration + privacy gates
- 1.5 hr: `do.ts` command handler + CLI args + interactive picker
- 30 min: command-manifest + migration-safety wiring
- 1.5-2 hr: tests (17 cases across 2 files)
- 30 min: documentation
- 30 min: verification + inventory regen

This is the largest D3 sub-phase by both LOC and design surface. Recommend splitting across 2 PRs:
- **PR-1**: Classifier infrastructure (Steps 1-4) + tests = ~3-4h
- **PR-2**: Command handler + wiring + tests + docs (Steps 5-9) = ~3-4h

OR keep as 1 PR for atomicity if reviewer is comfortable with size.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Keyword matching produces low-quality results for unclear intents | Confidence thresholds tuned conservatively (refuse > confident); user always sees candidates; iterate based on real usage |
| Cross-provider LLM routing leaks intent across vendor boundary | Default is "use active host's provider only"; cross-provider routing requires explicit opt-in; `local_provider` mode pins LLM unreachable; document in `docs/intent-routing.md` § Cross-host behavior + § Data Flow |
| Stem matching false positives ("planning" matches "plant") | Use minimal stemmer (whitespace + simple suffix strip); explicit `intent_keywords` in manifests are higher signal than stems |
| Refuse threshold too strict → user frustration | Threshold configurable via `NEXUS_INTENT_THRESHOLD_REFUSE`; default conservative; iterate post-launch |
| do-history.json grows unbounded | Append-only is fine for one run; per-run separation prevents cross-run growth; future: rotate or compact in Phase 6 |
| `command-manifest.ts` change breaks existing canonical-only callers | Add `META_COMMANDS` as new table; keep `CANONICAL_COMMANDS` untouched; existing callers use the latter |
| Phase 4 (28 manifests) must land first for meaningful matching | Document predecessor; tests use mock manifests so Phase 5 can land independently |
| Cache invalidation for LLM path | Use intent + registry hash + 5-min TTL; cache file at `.planning/<run>/do-cache.json` (cleared per run) |

---

## Decision points (resolved before implementation)

| Decision | Resolution | Rationale |
|---|---|---|
| LLM provider for classifier | Active host's default provider | NOT a new privacy boundary (user already talking to that provider through host); just one extra small call on existing path |
| LLM gate default | OFF (`NEXUS_INTENT_LLM=0`) | Determinism + cost + latency. Keyword path is sufficient; LLM is opt-in for cases where keyword matching is too rigid |
| `local_provider` mode behavior | LLM path structurally unreachable | User chose offline-first / minimal-call mode; classifier respects that choice. NOT about "preventing data leak to LLM" (rest of session already calls LLM normally) |
| Cross-provider classifier routing via CCB | Explicitly OPT-IN, NOT default | User intent stays in user's primary provider; cross-provider flow is unexpected data flow without explicit opt-in |
| Confidence thresholds | confident: top ≥10 AND gap >1.5×; ambiguous: top ≥5; refuse: <5 | Empirical placeholder; configurable via env |
| Refuse exit code | 0 (informational) | "No match" is a meaningful answer, not a failure |
| Failures (registry unreachable) exit code | non-zero | Distinguishes "couldn't decide" from "couldn't run" |
| Show top-N for ambiguous | 3 (default), max 5 | More than 5 overwhelms terminal output |
| `--pick=N` for non-interactive | Yes | CI / scripts need deterministic dispatch |
| `--json` output for programmatic | Yes | Structured output for tools / piping |
| Cache TTL | 5 min, per-run | Repeated identical invocations within a session benefit; longer caches risk staleness |
| do-history.json schema versioning | `schema_version: 1` via `withLedgerSchemaVersion` | Mirror PR #47 ledger pattern |
| Refuse with closest candidates | Yes — show top 3 even if below threshold | "Did you mean...?" UX is helpful |
| Multi-step decomposition | Out of scope | Future research; not P0 |
| External skill dispatch | Hand off to host with skill identifier | Nexus is router; host invokes the skill via its plugin system |

---

## References

- `docs/architecture/track-d-d3-rfc.md` § Phase 3.5 + Component 4 (parent)
- `docs/architecture/track-d-d3-phase-2-brief.md` (schema — frozen)
- `docs/architecture/track-d-d3-phase-2-2-brief.md` (registry consumption)
- `docs/architecture/track-d-d3-phase-3-brief.md` (advisor — sibling consumer of registry)
- `docs/architecture/track-d-d3-phase-4-brief.md` (manifests — recommended predecessor)
- `lib/nexus/skill-registry/` (consumed APIs)
- `lib/nexus/commands/` (canonical commands — sibling but unchanged)
- `lib/nexus/migration-safety.ts` (canonical-lifecycle gate to extend)
- `bin/nexus.ts` (top-level dispatcher to update)
- PR #47 (ledger schema versioning pattern — mirror)
- PR #55 (discriminated-union read result pattern — mirror)
- Issue #79 (this brief implements)
- Issue #74 (Phase 2.b — must land first)
- Issue #77 (Phase 3 — sibling)
- Issue #78 (Phase 4 — strongly recommended predecessor)

---

## Acceptance criteria for this brief itself

This document is complete when:

1. ✅ Goal stated with concrete user-facing outcome
2. ✅ Strategic framing (router moment of D3)
3. ✅ Surface map (files to create / modify / NOT modify)
4. ✅ CLI semantics — invocation, output formats, confidence levels, refuse format
5. ✅ Routing algorithm — keyword path + LLM path + orchestration
6. ✅ `do-history.json` artifact specified
7. ✅ 9-step implementation procedure
8. ✅ 17 enumerated test cases
9. ✅ 13-item acceptance criteria
10. ✅ Out-of-scope deferrals named (LLM real integration, multi-step, conversational, etc.)
11. ✅ Decision points resolved (13 items)
12. ✅ Risk register
13. ✅ Effort breakdown + PR-split recommendation
14. ✅ References cross-link parent RFC + 4 predecessor briefs

This brief is ready for implementation by Codex (or human) without further design clarification, **provided** Phase 2.b (#74) and ideally Phases 3 (#77) + 4 (#78) land first. Phase 5 is testable independently using mock manifests in tests.
