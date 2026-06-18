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
| Boost vs. natural rank — which wins, how recorded | **Bounded additive delta** applied to **`stageAwareAdvisor`'s `RecommendedSkill[]` numeric `score`** (the primary `recommended_skills` surface; see §4a), capped at that ranker's strong-signal increment (= manifest base score `5`) so a boost can nudge ordering among comparable skills but never overtake a strong natural signal (structurally "boost, not override"). Any boosted-vs-natural ordering difference is recorded in `rank_disagreements[]`. |

> **§4a Boost-target decision (resolved during planning, 2026-05-18).** The
> completion-advisor exposes two ranking surfaces: `stageAwareAdvisor`
> (`stage-aware-advisor.ts` → `RecommendedSkill[]` with a numeric `score`, set on
> the **primary** `record.recommended_skills` at `writer.ts:48`, pure fn) and
> `rankInstalledSkillsForAdvisor` (`skill-registry/ranking.ts` →
> `CompletionAdvisorActionRecord[]`, score discarded before return, set on the
> secondary `record.recommended_external_skills`). SP6 v1 boosts
> **`stageAwareAdvisor`** — it retains the numeric score the bounded-additive-delta
> and `natural_score`/`boosted_score` disagreement recording require, it is the
> primary recommendation surface, and it is a single clean pure seam. AC#4's
> "SkillRegistry rank" intent is preserved: `stageAwareAdvisor` ranks
> SkillRegistry-discovered `SkillRecord[]`; "natural rank" = its ordering over
> those skills.

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

Consumer seam: `stageAwareAdvisor` (`lib/nexus/completion-advisor/stage-aware-advisor.ts`),
called at `lib/nexus/completion-advisor/writer.ts:48` where its `RecommendedSkill[]`
is assigned to `record.recommended_skills`. Wiring is additive: the writer computes
the natural `stageAwareAdvisor(...)` result, passes it to the resolver as
`naturalRanking`, and assigns the resolver's `boostedRanking` to
`record.recommended_skills` (falling back to the natural result on resolver failure).
`RecommendedSkill` (from `lib/nexus/contracts/types`) carries `{ name, surface,
namespace, summary, why_relevant, score, manifest_backed }`.

## 5. Data flow

Resolver input contract (everything is already available to the completion-advisor at stage completion):

```ts
interface LearningContextInput {
  cwd: string;
  stage: 'discover'|'frame'|'plan'|'handoff'|'build'|'review'|'qa'|'ship'|'closeout';
  runId: string;
  changedFiles: string[];            // files touched this run
  naturalRanking: RecommendedSkill[]; // stageAwareAdvisor output, pre-boost (carries numeric score)
  projectSlug: string;               // for ~/.nexus/projects/<slug>/learnings.jsonl
}
```

`RecommendedSkill` is the existing `lib/nexus/contracts/types` shape
(`{ name, surface, namespace, summary, why_relevant, score, manifest_backed }`).
The resolver matches a packet entry's `subject_skill` to a `RecommendedSkill` by
`name` (or `surface` `/<name>`).

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
5. **Boost** — for each packet entry whose `subject_skill` matches a
   `naturalRanking` `RecommendedSkill` (by `name`/`surface`), accumulate a capped
   additive delta onto that skill's numeric `score`; re-sort the
   `RecommendedSkill[]` by boosted score (stable, tie-break by `name` to mirror
   `stageAwareAdvisor`'s own `localeCompare` tie-break).
6. **Record** — diff boosted vs natural ordering; write `learning-context.json`
   with packet entries, per-factor value/weight/contribution, boost deltas, and
   any ordering disagreements.
7. **Return** — `{ boostedRanking, packet, recordPath }`; `writer.ts` assigns
   `boostedRanking` to `record.recommended_skills` (on resolver failure it keeps
   the unmodified natural `stageAwareAdvisor` result — additive, never blocking).

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
`BOOST_CAP` default = `5` — `stageAwareAdvisor`'s strong-signal increment (its
manifest base score: a skill whose `nexus.skill.yaml` declares the current
lifecycle stage scores `5`; heuristic/no-manifest scores `1`; each matching
intent tag adds `+1`). Capping the total boost at one manifest-base unit means a
boost can lift a heuristic or weakly-matched skill up to roughly one
manifest-declared tier, but cannot overtake a skill that is itself
manifest-declared **and** tag-matched (score ≥ 6) — structurally "boost, not
override." `BOOST_CAP` is operator-configurable; the default is sourced from the
`stageAwareAdvisor` base-score constant, not a magic literal duplicated in SP6.
`BOOST_SCALE` (default `1.0`) scales summed packet-entry scores into score-space
so a single max-score (`1.0`) learning contributes ≈ one heuristic-signal unit.

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
              "boost_cap": 5, "boost_scale": 1.0 },
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
- **Behavior-preservation:** existing `stage-aware-advisor` + completion-advisor
  `writer` tests stay green — wiring at `writer.ts:48` is additive (writer computes
  natural `stageAwareAdvisor(...)`, passes it to the resolver, assigns
  `boostedRanking`, and falls back to the unmodified natural result on resolver
  failure). This is the SP1-followup-style proof that v1 doesn't regress the
  advisor: with no learnings present the boosted result must equal the natural
  result entry-for-entry.

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

## 12. Post-review decisions (ratified 2026-06-16)

An independent review of this spec (PR #176) surfaced two ranking-correctness
issues. Both were ratified and are now implemented in this branch; they refine
§5/§6/§7 above:

- **D1 — superseded learnings are hard-dropped, not soft-penalized.** §6 originally
  modeled supersession only as a `contradiction_risk` `−0.50` factor, but a
  strongly-positive superseded entry could still clear the `0.15` floor and boost.
  The resolver now **excludes** any entry whose `id` appears in a live peer's
  `supersedes[]` *before* scoring (`dropSuperseded`), and records the count in
  `learning-context.json.dropped.superseded`. The `contradiction_risk` factor is
  retained for a future *live mutual-conflict* signal (not yet modeled by SP1), so
  it contributes 0 in the current resolver path.
- **D2 — boost is clamped to the top natural score ("boost, not override").** §6's
  absolute `BOOST_CAP` alone let a mid-strength skill (e.g. natural score 5) be
  boosted past the strongest (score 6). `applyBoost` now also clamps each boosted
  score to `max(naturalScore)`; since SP6 v1 is boost-only, the naturally-strongest
  skill can never be displaced. The effective post-clamp delta and a `clamped` flag
  are recorded per boost (`boosts[].applied_delta` / `boosts[].clamped`) for AC#2.
