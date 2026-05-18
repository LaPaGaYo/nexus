# SELF_LEARNING_V1 — SP6: LearningContext Read-Side (v1 Design)

> Status: **spec** (brainstorm-approved 2026-05-18). Parent: `docs/designs/SELF_LEARNING_V1_META.md` §4 SP6, §5 Seam 2, §8 SP6 open questions.
> Depends on: SP1 (Signal Architecture, landed) + SP1-followup (shared decay + reader primitives barreled, merged `891055c`).
> Next: `superpowers:writing-plans` → subagent-driven implementation.

## 1. Goal & scope

A read-only `LearningContextResolver` that, when the completion-advisor builds its
recommendation at stage completion, reads the 3 SP1 storage surfaces (via the
SP1-followup barreled contract), ranks matched learnings into a bounded packet,
applies a **bounded additive boost** to the advisor's natural skill ranking, and
writes a full explainability record to `.planning/current/<stage>/learning-context.json`.

**In scope (SP6 v1):** resolver core + bounded packet + explainability record +
ONE consumer wiring: the **completion-advisor**.

**Deferred to SP6.1 (explicitly out of scope here):** `/nexus do` dispatch,
SkillRegistry rank integration as a standalone consumer, stage-pack prompt
builders. Rationale: smallest verified contract first, mirrors how SP1 and
SP1-followup de-risked; the other consumers fan out only after the contract +
all 5 ACs are proven against the lowest-risk read-only surface.

## 2. Acceptance criteria (pre-set by meta-spec; met by construction)

| AC | Requirement | How v1 satisfies it |
|---|---|---|
| **AC#1** | Packet bounded by token budget AND max entries, operator-configurable, defaults in spec | Score-floor `0.15` + max-entries `12` + token-budget `~1500`, whichever binds first; all in a `learning_context` config block, defaults + rationale recorded in `learning-context.json.limits` |
| **AC#2** | Boosts explainable; every applied boost records source entry, factors, weight contribution; no silent re-ranking | `record.ts` writes per-entry `factors{value,weight,contribution}` and per-boost `from_entries` to `learning-context.json` |
| **AC#3** | Malformed learnings fail soft; resolver warns + skips, never crashes | SP1-followup readers already fail-soft; plus a resolver-level guard that degrades to natural ranking on any throw |
| **AC#4** | SkillRegistry rank disagreements recorded | `rank_disagreements[]` populated iff boosted ordering ≠ natural ordering, with full provenance |
| **AC#5** | No runtime mutation of `SKILL.md.tmpl`, `Nexus.md`/`CLAUDE.md`/`AGENTS.md`, lifecycle contracts, or the learnings surfaces | Resolver only *reads* (barreled readers) + *writes* `learning-context.json`. Read-only by construction; AC-traceability test asserts no write-open of protected paths |

If v1 ships without (1)–(5) it does not satisfy the LearningContext contract.

## 3. §8 open questions — resolved

| § Question | Resolution |
|---|---|
| Ranking combination function + per-factor weights | **Transparent weighted linear sum** over a fixed factor set (see §6). Explainable by construction. |
| Packet cap mechanism | **Score floor (0.15) + dual cap (max-entries 12, token-budget ~1500), whichever binds first.** All operator-configurable. |
| Where the resolver runs | **Lazy, synchronous, inside the completion-advisor build path** at stage completion. No daemon, no cache, no CLI preamble. Reads surfaces fresh each call. Sidecar/caching deferred to SP6.1 if telemetry shows need. |
| Boost vs. natural rank — which wins, how recorded | **Bounded additive delta**, capped at the advisor ranking's own strong-signal increment so a boost can nudge ordering among comparable skills but never overtake a strong natural signal (structurally "boost, not override"). Any boosted-vs-natural ordering difference is recorded in `rank_disagreements[]`. |

## 4. Architecture

New module `lib/nexus/learning/context/` — 4 focused files, pure-core + thin-I/O
split mirroring SP1 / SP1-followup conventions:

| File | Responsibility | I/O? |
|---|---|---|
| `resolver.ts` | `resolveLearningContext(input): LearningContextResult` — orchestrates read → match → rank → cap → boost → record. Sole public entry point. | yes (orchestration) |
| `ranking.ts` | Pure `scoreEntry(entry, ctx): { score, factors }` — the weighted linear sum + clamp + boost-cap derivation. | no |
| `packet.ts` | Pure `capPacket(scored[], limits): { packet, dropped }` — score-floor then dual-cap. | no |
| `record.ts` | Builds + writes `.planning/current/<stage>/learning-context.json`. The only writer. | yes (single write) |

Barreled SP1-followup contract consumed (already live on `main`, `lib/nexus/index.ts`):
`readLearningsJsonl`, `readStageCandidatesFile`, `readCanonicalLearningsFile`,
`walkArchiveRunLearnings`, `computeEffectiveConfidence`, `computeStrength`,
`StageLearningCandidatesRecord`, `RunLearningsRecord`.

## 5. Data flow

Resolver input contract (everything is already available to the completion-advisor at stage completion):

```ts
interface LearningContextInput {
  cwd: string;
  stage: 'discover'|'frame'|'plan'|'handoff'|'build'|'review'|'qa'|'ship'|'closeout';
  runId: string;
  changedFiles: string[];        // files touched this run
  naturalRanking: RankedSkill[]; // rankInstalledSkillsForAdvisor output, pre-boost
  projectSlug: string;           // for ~/.nexus/projects/<slug>/learnings.jsonl
}
```

Synchronous steps, inside the advisor build path:

1. **Read** — `readLearningsJsonl(~/.nexus/projects/<slug>/learnings.jsonl)` +
   `walkArchiveRunLearnings(cwd)` + `readCanonicalLearningsFile(.planning/current/closeout/learnings.json)` +
   `readStageCandidatesFile` for the current stage. All barreled, all fail-soft.
2. **Match** — union the entries; compute per-entry factor inputs against the
   input ctx (file-overlap = `changedFiles ∩ entry.files`; stage-match =
   `entry.subject_stage` vs `ctx.stage`; relevance = token overlap of
   `{entry.key, entry.insight, entry.subject_skill}` vs
   `{ctx.stage, changedFiles basenames, skill names}`; contradiction_risk from
   `supersedes` / `supersedes_reason` chains within the matched set).
3. **Rank** — `scoreEntry` per entry (see §6).
4. **Cap** — `capPacket`: drop `< score_floor`, then take top-scored until
   `max_entries` OR `token_budget` is hit, whichever first.
5. **Boost** — for each packet entry with a `subject_skill`, accumulate a capped
   additive delta onto that skill's natural advisor score.
6. **Record** — diff boosted vs natural ordering; write `learning-context.json`
   with packet entries, per-factor value/weight/contribution, boost deltas, and
   any ordering disagreements.
7. **Return** — `{ boostedRanking, packet, recordPath }` to the advisor; advisor
   emits `boostedRanking` as its `recommended_skills`.

## 6. Ranking model

Every factor normalizes to `[0,1]`. Positive weights sum to `1.0`, so a
contradiction-free entry scores in `[0,1]` and the `0.15` floor is a meaningful
fraction. Defaults below; all weights operator-configurable via the
`learning_context` config block, defaults + rationale echoed into
`learning-context.json.limits.weights`.

| Factor | Normalized definition (→ [0,1]) | Default weight |
|---|---|---|
| `relevance` | token overlap of `{entry.key, entry.insight, entry.subject_skill}` vs `{ctx.stage, changedFiles basenames, skill names in naturalRanking}` | **0.30** |
| `effective_confidence` | `computeEffectiveConfidence(entry) / 10` (folds confidence + recency-decay for observed/inferred — no separate recency term, avoids double-count) | **0.25** |
| `evidence_strength` | `computeStrength(entry) / STRENGTH_MAX` where `STRENGTH_MAX` = the maximum possible `computeStrength` output, derived once from SP1's `EVIDENCE_BASE`/`SOURCE_MOD` tables (not a hand-set constant) | **0.20** |
| `file_overlap` | `|changedFiles ∩ entry.files| / |entry.files|` (0 if `entry.files` empty) | **0.15** |
| `stage_match` | `1.0` if `entry.subject_stage === ctx.stage`; `0.5` if adjacent — i.e. immediately preceding or following stage in the canonical lifecycle order `discover→frame→plan→handoff→build→review→qa→ship→closeout`; `0` otherwise | **0.10** |
| `contradiction_risk` | `1.0` if entry is superseded OR has an unresolved `supersedes` conflict in the matched set; else `0` | **−0.50** (penalty) |

```
score = Σ(positive_factor_i × weight_i) − contradiction_risk × 0.50,   clamped ≥ 0
```

**Boost delta:**
```
boost_delta(skill) = min(BOOST_CAP, Σ_{packet entries with subject_skill = skill} entry.score × BOOST_SCALE)
```
`BOOST_CAP` is read from `ranking.ts`'s existing strong-signal increment scale
(not a magic literal) so a boost can reorder among comparable skills but cannot
overtake a genuinely strong natural signal — structurally "boost, not override."
`BOOST_SCALE` default tuned so a single max-score learning ≈ a weak natural signal.

Weights/floor/caps are starting points, not claimed optimal; SP2 later learns
from the telemetry this produces.

## 7. Explainability record

`.planning/current/<stage>/learning-context.json` — the sole write; AC#2/AC#4 evidence:

```jsonc
{
  "schema_version": 1,
  "generated_at": "<iso8601>",
  "stage": "build", "run_id": "...", "project_slug": "...",
  "resolver": { "status": "ok|degraded|failed", "warnings": ["skipped 2 malformed jsonl lines @ ..."] },
  "limits": { "score_floor": 0.15, "max_entries": 12, "token_budget": 1500,
              "weights": { "relevance": 0.30, "effective_confidence": 0.25, "evidence_strength": 0.20,
                           "file_overlap": 0.15, "stage_match": 0.10, "contradiction_risk": -0.50 },
              "boost_cap": "<derived from ranking strong-signal increment>", "boost_scale": "<default>" },
  "packet": [
    { "id": "lrn_...", "source_path": "~/.nexus/.../learnings.jsonl", "subject_skill": "investigate",
      "score": 0.82,
      "factors": { "relevance": { "value": 0.70, "weight": 0.30, "contribution": 0.21 },
                   "effective_confidence": { "value": 0.80, "weight": 0.25, "contribution": 0.20 },
                   "evidence_strength": { "value": 0.66, "weight": 0.20, "contribution": 0.13 },
                   "file_overlap": { "value": 0.50, "weight": 0.15, "contribution": 0.075 },
                   "stage_match": { "value": 1.0, "weight": 0.10, "contribution": 0.10 },
                   "contradiction_risk": { "value": 0.0, "weight": -0.50, "contribution": 0.0 } } }
  ],
  "dropped": { "below_floor": 9, "over_cap": 4 },
  "boosts": [ { "skill": "investigate", "delta": 0.42, "from_entries": ["lrn_..."] } ],
  "rank_disagreements": [
    { "skill": "simplify", "natural_rank": 3, "boosted_rank": 1,
      "natural_score": 4, "boosted_score": 4.42, "caused_by": ["lrn_..."] }
  ]
}
```

`rank_disagreements` is populated **only** when boosted ordering differs from
natural ordering (AC#4). Empty array = boost changed nothing material.

## 8. Error handling (AC#3, layered)

- **Surface reads:** SP1-followup readers are already fail-soft (missing → `[]`/`null`,
  malformed → skip). Resolver tallies skip counts into `resolver.warnings`.
- **Resolver-level guard:** the entire `resolveLearningContext` body is wrapped;
  on any unexpected throw it returns
  `{ boostedRanking: input.naturalRanking, packet: [], recordPath }` and writes a
  `status:"failed"` record. The completion-advisor **always** gets a usable
  ranking — SP6 failure degrades to "no boost," never blocks the advisor.
- **Record write failure:** caught and logged to the resolver result; the advisor
  still proceeds (the record is evidence, not a dependency).

## 9. Testing strategy

- **Pure units (no fs):**
  - `ranking.ts` — each factor's normalization; the weighted sum; clamp ≥ 0;
    boost-cap derivation; contradiction penalty pushing an entry below floor.
  - `packet.ts` — score-floor; max-entries cap; token-budget cap;
    "whichever binds first" with crafted fixtures.
- **Resolver integration (tmp dirs):**
  - all-3-surfaces present → packet + boost + record;
  - sparse store → floor prevents noise injection;
  - malformed entry in each surface → `degraded` status + warning + still returns;
  - total failure → natural ranking returned + `status:"failed"` record;
  - boost shifts rank → `rank_disagreements` populated;
  - no shift → `rank_disagreements` empty.
- **AC-traceability tests:** one per AC asserting the construction guarantee
  (e.g., AC#5: resolver never write-opens `SKILL.md.tmpl` / `Nexus.md` /
  `CLAUDE.md` / `AGENTS.md` / lifecycle-contract paths; AC#4: disagreement
  recorded iff ordering differs).
- **Behavior-preservation:** existing completion-advisor tests stay green —
  wiring is additive (advisor calls resolver, falls back to natural ranking on
  failure). This is the SP1-followup-style proof that v1 doesn't regress the
  advisor.

## 10. Out of scope (explicit non-goals for v1)

- No `/nexus do`, SkillRegistry-rank-as-standalone-consumer, or stage-pack prompt
  wiring (SP6.1).
- No caching/sidecar/daemon (deferred until telemetry justifies it).
- No write-side mutation of any kind (that is SP3/Seam 2, deferred-aggressive).
- No change to the SP1 schema or the SP1-followup barreled contract — SP6 is a
  pure consumer of it.

## 11. Meta-spec update on ship

On SP6 v1 landing, update `SELF_LEARNING_V1_META.md`: §4 SP6 row →
in-progress/landed; §9 trigger log row ("SP6 v1 lands"); note SP6.1 (remaining
3 consumers) + SP2 (now unblocked once SP6 ships to production, per glaocon V1
feedback) as the next candidates.
