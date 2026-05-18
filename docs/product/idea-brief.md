# Idea Brief — `/build` self-dispatch failure mode in `local_provider/claude` single-host runs

| | |
|---|---|
| **Run** | Nexus v1.1.x hotfix discovery |
| **Worktree** | `claude/jovial-jang-9618ea` |
| **Date** | 2026-05-12 |
| **Author** | Henry Wen (operator) + Claude Opus 4.7 (assist) |
| **Upstream context** | None. Fresh discovery triggered by reproducible failure in novelWriter SP2 build (2026-05-12) and a contributor field report filed 2026-04-27 noting "second occurrence." |

---

## Look Inward (team's prior, before evidence)

What the team believed entering this discovery:

1. v1.1.1's `stream_to_tty` tee + dispatch banner closes the "user sees no output during `/build`" complaint that motivated the hotfix.
2. The three local topologies (`single_agent`, `subagents` / `claude_subagents`, `agent_team`) are interchangeable consumers of the same dispatch path. A streaming fix in one covers all three.
3. `/build` is a stage-recording command. Its canonical bin (`./bin/nexus build`) orchestrates dispatch to a provider; running it from inside any host (terminal, Claude Code session, other) is meant to work.
4. The `dispatch_command`, `receipt`, and `actual_route` fields in `adapter-output.json` are populated by Nexus from real dispatch outcomes and are trustworthy provenance for downstream stages.
5. Hostile failure modes (silent hang, recursion, schema-conformant placeholder fields) are not currently a thing because Iron Laws + completion advisor + repo-visible artifacts catch them.

These are recorded as priors so the evidence-gathering pass below can be checked for confirmation bias.

---

## Look Outward (evidence)

### Source 1 — novelWriter SP2 build, 2026-05-12

**Path**: `/Users/henry/Documents/novelWriter/.nexus-worktrees/run-2026-05-12T01-45-20-695Z/.planning/current/build/`

The operating Claude session's verbatim confession, captured in `adapter-output.json:transport.raw_output.summary_markdown`:

> "Discovered the canonical `./bin/nexus build` tries to dispatch a sub-claude (recursion into the agent already doing the work); terminated the stuck process and wrote the four artifacts directly per the artifact contract."

Reconstructed timeline from ledger timestamps + artifact mtimes:

- **09:28:07 local** — operator entered `/build` (ledger command_history entry).
- **09:28 → 09:47** — operator performed SP2 implementation in-session: 11 new files, 17 modified files, 99/99 pytest pass in 1.71s.
- **~09:47:00** — operator invoked `./bin/nexus build` for SKILL.md Step 9 artifact write.
- canonical bin entered `runProviderCommand` → spawned `claude -p --output-format text --dangerously-skip-permissions` ([lib/nexus/adapters/local.ts:1432-1438](lib/nexus/adapters/local.ts:1432)).
- Spawn hung silently. Operating Claude (outer) saw no output across the Claude Code Bash tool pipe boundary, where v1.1.1's tee writes to `process.stdout` (a pipe, not a TTY).
- Operator detected the recursion within 30-60 seconds, killed the subprocess.
- **09:47:59** — operator authored all 7 artifacts directly. The `dispatch_command`, `receipt`, and `actual_route` fields were fabricated to satisfy schema validation.

Recovery commits: [40a020a7](file:///Users/henry/Documents/novelWriter) (`feat(s2): WS-0 branding + WS-1 substrate widening`) and [551d281f](file:///Users/henry/Documents/novelWriter) (`chore: lock S2 build-stage artifacts (operator-attested run)`). The build-result.md carries a Provenance Disclosure section.

### Source 2 — contributor field report, 2026-04-27

**Path**: `~/.nexus/contributor-logs/build-bin-hangs-local-provider.md`

> **What I tried**: `bun run bin/nexus.ts build` inside a Nexus worktree with the requested route `claude-local-single_agent` and an active Claude session as the generator.
>
> **What happened**: Both invocations produced no stdout/stderr and never returned; killed after >30s. **Same behavior was logged in the prior run's `build-result.md` for this project — second occurrence.**
>
> **What would make this a 10**: In `local_provider` mode where the requested route's generator IS the calling Claude session, the build bin should EITHER (a) print the bounded contract and exit 0 immediately so the in-Claude session can author the artifacts, OR (b) exit cleanly with a structured "no out-of-process generator available; this session is the generator" status. Hanging silently with no stdout is the worst behavior because it masquerades as "still working" indefinitely.

This report counts itself as the second occurrence. The May 12 SP2 is the third. Across two worktrees of two different projects, on two different hosts, ~15 days apart.

### Source 3 — code inspection, `lib/nexus/adapters/local.ts`

v1.1.1's streaming fix covers **only one of three local topology dispatch paths**:

- `runProviderCommand` (single_agent path) — passes `stream_to_tty: true` at [local.ts:1437, 1464, 1491](lib/nexus/adapters/local.ts:1437). Has the dispatch banner at [local.ts:1420](lib/nexus/adapters/local.ts:1420).
- `runClaudeAgentTeamCommand` (agent_team path) at [local.ts:1010-1022](lib/nexus/adapters/local.ts:1010) — **does NOT pass `stream_to_tty`**, **no dispatch banner**. Agent_team mode is strictly more silent than single_agent.
- `localRoleRunnerForMode` (subagents path) used at [local.ts:1928-1941](lib/nexus/adapters/local.ts:1928) — needs verification, likely also missing the flag.

The v1.1.1 commit message says "runProviderCommand sets the flag for all three providers (claude/codex/gemini)" but that refers to all three *providers* in the single_agent topology, not all three *topologies*. The hotfix coverage is provider-complete and topology-partial.

### Source 4 — related contributor log, 2026-04-27

**Path**: `~/.nexus/contributor-logs/build-leaves-uncommitted-worktree-local-provider.md`

> **What happened**: Build runtime exited cleanly with `state: completed`, `decision: build_recorded`, `ready: true`, but `git log main..HEAD` was empty — every modified/untracked file was sitting on the working tree, no commit.

Different symptom, same family: even when the dispatch path *does* run to completion, the resulting artifacts misrepresent reality (claim "build_recorded" with no diff for /review to read).

### Source 5 — issue #159 + PR #160 (colleague's in-flight fix), 2026-05-13

**Issue**: [#159](https://github.com/LaPaGaYo/nexus/issues/159) (author LaPaGaYo, assignee glaocon) — same failure, independently filed.
**PR**: [#160](https://github.com/LaPaGaYo/nexus/pull/160) (glaocon, +702/-79, open) — implements issue Options F1 + F3.

PR #160's design rests on this claim in issue #159's root-cause section:

> "The `claude_subagents` and `claude_agent_team` topologies already work correctly inside Claude Code because they dispatch through the Task tool, which runs subagents inside the Claude Code framework (no shell subprocess, no buffering, no host timeout)."

**Code inspection contradicts this premise.** `claude_subagents` does NOT dispatch through the Task tool:

- [local.ts:899-900](lib/nexus/adapters/local.ts:899) — `claude_subagents` → `runClaudeNamedAgentCommand`
- [local.ts:830-843](lib/nexus/adapters/local.ts:830) — `runClaudeNamedAgentCommand` calls `runCommand({ argv, ... })`
- [local.ts:787-804](lib/nexus/adapters/local.ts:787) — argv = `['claude', '-p', '--output-format', 'text', '--dangerously-skip-permissions', '--agents', '{...}', '--agent', name]`
- [local.ts:1773](lib/nexus/adapters/local.ts:1773) — production `runCommand = defaultRunCommand`
- [local.ts:205-214](lib/nexus/adapters/local.ts:205) — `defaultRunCommand` does `spawn(argv[0], ..., { stdio: 'pipe' })`

All three local claude topologies spawn a nested `claude -p` subprocess through the same `defaultRunCommand` → `spawn({stdio:'pipe'})` path. The claude CLI may use the Task tool *internally* for its own subagents, but Nexus's outer dispatch is still a buffered shell subprocess. The Task-tool distinction the issue draws is at the wrong layer.

Consequence for PR #160 as written:

| Path | spawns nested `claude -p`? | hits Bash buffer wall? | F3 backstop guards? |
|---|---|---|---|
| `single_agent` (old default) | 1× | yes | ✅ yes (PR adds it) |
| `subagents` (PR's new default) | 2× (builder + verifier, [local.ts:1921-1957](lib/nexus/adapters/local.ts:1921)) | yes | ❌ no |
| `agent_team` | 1× (`--teammate-mode in-process`, still spawned) | yes | ❌ no |

PR #160's original F3 backstop appeared only inside `runProviderCommand` (verified: `NEXUS_ALLOW_NESTED_CLAUDE` occurred 4× in that diff, all under `@@ runProviderCommand`). The original F1 default-switch routed the common case to `subagents`, which was **unguarded by F3 and spawned twice**. F3 was a sound defensive fix; F1 rested on an incorrect premise and, as written, relocated the hang to a worse, unguarded path.

**Resolution (2026-05-17)**: after this premise contradiction was raised on PR #160 (comment + this brief's Source 5), glaocon re-scoped the PR:

- F1 dropped entirely — `defaultLocalTopology()` removed from `execution-topology.ts`; unset Claude local topology stays `single_agent`.
- F3 centralized as `assertNestedClaudeAllowed(topology)` and called before spawn in all three paths: `runProviderCommand` (single_agent), `runClaudeNamedAgentCommand` (subagents), `runClaudeAgentTeamCommand` (agent_team). Verified against PR diff lines 169/177/186.
- The guard's error message is honest ("Nexus local Claude topologies spawn nested claude -p subprocesses") — the false Task-tool claim was removed from setup, `nexus-config`, preambles, and generated skills.
- A consistency fix was added: `nexus-config effective-execution` now reports `current_session_ready: no` inside Claude Code unless `NEXUS_ALLOW_NESTED_CLAUDE=1`, with `test/relink.test.ts` asserting both sides.
- Regression coverage for all three topologies blocking + override added.

PR #160 is now correctly scoped as a fail-fast hotfix. It does not (and should not) deliver the structural fix; that remains this brief's `/frame` target.

---

## The Problem (named user + observed pain + cost)

**Named user segment**: operators running Nexus in `local_provider` mode with `primary_provider=claude` who invoke canonical lifecycle commands (`/build`, `/review`, `/qa`, `/ship`) from inside an active Claude Code session. This is currently the **most common Nexus user** because the alternative (`governed_ccb`) requires CCB providers mounted, which is a higher-setup-friction path.

**Observed pain**:

1. **Silent hang at SKILL.md Step 9 of `/build`** (and structurally at the equivalent step of `/review`, `/qa`, `/ship`): the canonical bin attempts to dispatch the same agent that is invoking it, hangs at the Claude Code Bash tool pipe boundary, operator must improvise recovery.
2. **Operator improvisation has no audit-trail kind**: when an operator session authors artifacts directly, the schema-conformant placeholder fields (`dispatch_command`, `receipt`, `actual_route`) look identical to real dispatch results to any downstream reader of the structured JSON.
3. **v1.1.1 streaming fix is topology-partial**: operators who select `agent_team` (the topology recommended for `/review`, `/plan`, `/investigate` per `Stage-Aware Local Topology Chooser`) get a *worse* hang than `single_agent` operators because the agent_team path has neither the dispatch banner nor the tee.

**Cost per occurrence**:

- ~20 minutes of operator confusion before recognizing the recursion pattern.
- ~5-15 minutes of artifact-improvisation labor by the operating Claude.
- Permanent provenance blur in `.planning/current/build/adapter-output.json` for that run.
- Downstream risk: `/review` reading the structured fields could conclude a successful dispatch occurred when none did.

**Occurrences on record**: ≥3.
- 2026-04-13 (or earlier) — first occurrence, prior run's `build-result.md` per the April 27 report's reference.
- 2026-04-27 — second occurrence, contributor log filed.
- 2026-05-12 — third occurrence, novelWriter SP2 build (today).

Two worktrees, two projects, ~15-day cadence. This is a recurring pattern, not an incident.

---

## Hypothesis Hint (for `/frame` to sharpen into a Law 2 hypothesis)

**If** Nexus distinguishes "this session **is** the named generator/evaluator" from "this session **delegates** to a different process" at the dispatch contract layer, and the canonical bin exits early with a structured `provenance_kind: "operator_attested"` status when the former is true, **then** operators in single-host single-provider `local_provider` mode will stop experiencing silent canonical-bin hangs, will stop fabricating placeholder dispatch fields to satisfy schema, and downstream `/review` will be able to distinguish operator-attested provenance from spawned-provider provenance, **because** the current dispatch contract assumes the calling session is always orchestrator-only — but in single-host single-provider mode the calling session frequently *is* the worker, and recursing into a peer process is structurally pointless except for creating a Bash-tool pipe wall.

The streaming gap in `agent_team` and `subagents` is a related but bounded sub-problem: those dispatch paths need the same v1.1.1 tee treatment regardless of whether the structural fix lands.

---

## Open Questions for `/frame`

1. **Scope**: is this a v1.1.2 hotfix (target: complete the v1.1.1 streaming fix across all topologies + add early-exit guard for self-dispatch) or v1.2 schema work (target: full `provenance_kind` field on `adapter-output.json` + advisor changes + migration)? Hotfix is bounded; schema work is multi-stage.
2. **Success metric**: what's the falsifiable test? Candidate metrics: zero silent hangs in a controlled SP3 build of any project; or measured reduction in operator-attested artifact occurrences over the next N runs across sample worktrees.
3. **Migration**: existing operator-attested artifacts (the May 12 SP2 one we just committed) — should `/review` recognize them retroactively via build-result.md disclosure markdown, or do we need a one-time annotation pass that adds `provenance_kind: "operator_attested"` to historical `status.json` files?
4. **Topology coverage**: if "early-exit when this session IS the worker" is the structural answer for single_agent, what does it mean for agent_team and subagents? Those topologies *want* to spawn (agent_team for parallel teammate coordination, subagents for builder+verifier 2-pass) — but they still spawn from inside the calling Claude Code session, so the Bash tool pipe wall still applies. Is the fix "always early-exit when in Claude Code, regardless of topology" or "topology-aware"?
5. **Contract change surface**: does SKILL.md Step 9 wording need to change (read by humans + operating Claudes) or only the runtime behavior (read by bin)? Today's Step 9 says "run canonical command to write status." If the bin now early-exits and tells the operator to author artifacts, SKILL.md needs new instructions for that branch.
6. **Stop-the-bleeding question**: even before v1.1.2 lands, should there be an env var or config flag operators can set today (`NEXUS_OPERATOR_IS_GENERATOR=1`) that makes the bin early-exit? Bounded, ~30-min change, prevents the 4th occurrence while design proceeds.
7. **PR #160 disposition** — **APPROVED, NOT MERGED, now a blocking prerequisite for v1.1.2 (corrected 2026-05-17)**: glaocon dropped F1 and reduced #160 to the F3 portion (generalized `assertNestedClaudeAllowed` across all three claude spawn sites + `nexus-config` readiness consistency + regression coverage). The review verdict is APPROVED. **But #160 is OPEN and CONFLICTING (DIRTY after PR #161 merged at ~20:00Z) — it is not merged into any branch.** A subsequent v1.1.2 framing pass (prd.md) incorrectly treated #160's code as landed; an independent red-team review caught this (PRD blocker B1). Corrected disposition: PR #160 is a **hard merge-prerequisite** for the v1.1.2 structural fix — `assertNestedClaudeAllowed` must exist in the build baseline before the operator-attested early-exit can layer on it. The structural fix (operator-attested early-exit per the 2026-04-27 contributor log) remains this brief's `/frame` target, gated on #160 landing first.

---

## Reframe (where Look Outward changed Look Inward)

| Look Inward | Look Outward |
|---|---|
| v1.1.1 covers all three topologies | v1.1.1 covers single_agent only; agent_team and subagents paths have neither tee nor banner |
| Three independent bugs to fix in v1.1.2 | One structural pattern (canonical bin self-dispatch into a peer process when the calling session IS the named worker) with three symptoms |
| `dispatch_command` and `receipt` fields are trustworthy provenance | Both fields are operator-writable in the artifact-write fallback path; no schema field distinguishes spawned-provider from operator-attested provenance |
| The 2026-05-12 SP2 hang was a one-off | Same pattern reported 2026-04-27 with note "second occurrence" plus today = third recorded occurrence across two projects |
| Operators have a clean recovery path | Operators must improvise artifact authoring with schema-conformant lies to advance the ledger |
| Switching default to `subagents` (PR #160 F1) fixes the hang | `subagents` spawns the same nested `claude -p` via `defaultRunCommand`, twice; F1's premise that subagents use the Task tool is contradicted by [local.ts:830-843](lib/nexus/adapters/local.ts:830). **Resolved 2026-05-17**: F1 dropped, F3 generalized to all three spawn sites in PR #160. |

The Reframe matters because **v1.1.2 framed as "three bug fixes" would patch symptoms while leaving the structural cause intact**. Framed as "the canonical bin needs to recognize when it IS the named worker and exit early with operator-attested provenance", the same fix surface emerges (streaming completeness + early-exit guard + provenance field), but ordered so the next occurrence doesn't return as silent.

---

## Status

Five Law 2 checks:

1. ✅ Named user segment — "operators in `local_provider/claude` mode running canonical commands from inside an active Claude Code session"
2. ✅ Observed pain with cost — silent hang, ~20 min/occurrence, audit-trail blur, ≥3 occurrences on record
3. ✅ ≥2 evidence sources — 5 sources (SP2 artifacts, April 27 contributor log, code inspection, related contributor log, issue #159 + PR #160 premise contradiction)
4. ✅ Hypothesis hint — single paragraph If/Then/Because above
5. ✅ ≥3 open questions — 7 questions for `/frame` (incl. PR #160 disposition)

Law 1 anti-pattern check:

- Not a feature spec — no field lists, no API surface, no UI mockups.
- Not user testing — gathers existing evidence, doesn't propose new validation.
- Not substitute for shipping — does not block on perfect framing; recommends a stop-the-bleeding question for `/frame`.
- Not single-stakeholder — operator + downstream `/review` + Nexus governance all represented.
- Not solutioning in disguise — names the problem ("canonical bin self-dispatch into peer process") rather than the fixes, even though candidate fix shapes are noted in open questions.

Law 3 structure check:

- ✅ Look Inward written before evidence gathered
- ✅ Look Outward gathered with cited sources
- ✅ Reframe section showing prior-vs-evidence shift

**Verdict**: ready for `/frame`.

---

## Scope-Escalation Decision (2026-05-18) — v1.1.2-as-hotfix DISPROVEN, escalate to v1.2

### Source 6 — two grounded independent reviews disprove the bounded-hotfix frame

The operator-attested early-exit was framed three times as a ~30-line bounded v1.1.2 hotfix (prd.md draft → B1-corrected → post-#160-merge revision). Two independent adversarial reviews, each re-verified against real merged `origin/main` (@ `857253c`), found the bounded frame structurally false:

- **Red-team pass (2026-05-17):** B1 (PRD treated #160 as merged when unmerged — operator error), B2 (graded on wrong baseline), B3 (phantom `/review` consumption point; attested build crashes `review.ts`).
- **codex 0.130 pass (2026-05-18, grounded on merged main):** revision did not resolve the blockers, only relocated them.
  - BLOCKER: `prd.md:41` (empty-diff guardrail = `/review` changes readiness) directly contradicts `prd.md:47/104` (no `/review` re-grading in v1.1.2). The guardrail IS re-grading.
  - BLOCKER: CLI early-exit at `nexus.ts:139` skips `invocation.handler` (`build.ts:468`), which owns ledger construction + `status.json` + stage advancement. No owner for status authorship; `decision-brief.md:23` admits this is unresolved.
  - BLOCKER: B3 is not bounded to `review.ts:540-546`. Null `actualRoute` crashes downstream at `review.ts:1084` (`actualRoute.provider`). Every downstream deref needs handling.
  - MAJOR: `review.ts:1188` hardcodes `provenance_consistent: true`; `build.ts:100-111` fix-cycle eligibility depends on it. A "survival" branch setting it true for attested/null-route builds is a silent trust-gate downgrade.
  - MAJOR: M2's operator-captured diff-stat is self-attested with no carrier field (`types.ts:990`, `local.ts:35`) and no enforcement path — circular anti-fabrication, same defect class as the original B3.

### The real signal

This is the recurring pattern of this work unit applied to the work unit itself: a structurally deep problem repeatedly treated as a bounded one, with verification exposing the gap each time. The honest conclusion is not "the PRD needs another revision" — it is **the v1.1.2-hotfix frame is wrong**. The operator-attested model has irreducible architectural depth:

1. **`status.json` / ledger ownership** — who writes governed artifacts and advances the stage when the bin does not spawn and does not run the normal handler path.
2. **`provenance_kind` as a real schema citizen** — a carried, enforceable field in `StageStatus` + `Local*Raw`, not an operator-authored string.
3. **`/review` contract change** — `review.ts` must handle the attested shape end-to-end (not just stop the first throw): null `actualRoute` derefs, the `provenance_consistent` gate semantics, fix-cycle eligibility.
4. **Anti-fabrication that is not circular** — a trust anchor not authored by the same session being attested.

These are v1.2 schema+contract scope, multi-stage, not a hotfix. Per the Completeness Principle: flag the unbounded reframe explicitly instead of pretending it is the same kind of task.

**Decision:** stop repolishing the v1.1.2 PRD. Re-run `/discover` → `/frame` at v1.2 depth. The fail-fast stopgap already shipped (PR #160, merged `857253c`) — the silent hang is gone; users get a clear error today. That removes the time pressure that was forcing the hotfix frame. v1.2 can be framed honestly as the structural fix.

The prior `prd.md` / `decision-brief.md` / `design-intent.json` for v1.1.2 are retained on this branch as the disproven-frame record (do not advance them to `/plan`).

---

# v1.2 Re-Discovery (2026-05-18) — the missing concept, not the missing patch

This section supersedes the hotfix framing above for `/frame` purposes. Sources 1-6 remain the evidence base. The hotfix framing (Problem / Hypothesis Hint / Open Questions / Reframe / Status / Scope-Escalation) is retained as the disproven-frame record; `/frame` reads THIS section, not those.

## Look Inward (v1.2 prior — what the team believes NOW, after the disproof)

Entering v1.2 discovery, after two grounded independent reviews disproved the bounded-hotfix frame, the team's prior has materially changed:

1. The problem is **not** "the spawn hangs." The hang is one symptom. PR #160 already removed the silent hang (fail-fast shipped, `857253c`).
2. The problem is **not** "we need an early-exit." Three revisions of that solution each failed verification — the early-exit orphans `status.json`/ledger ownership, the provenance fields have no honest carrier, the `/review` contract crashes on the attested shape.
3. The team now believes the real problem is a **missing concept in the governed-execution model**: Nexus's contract assumes execution is always *delegated to a separate process* (spawn `claude -p`, dispatch via CCB). It has no first-class representation for "the orchestrating session IS the named executor." Every symptom across all 6 sources traces to that one absent concept.
4. The team believes this is why a 30-line patch keeps failing: you cannot bolt "session is the worker" onto a model that structurally assumes "worker is always elsewhere." The model needs a first-class attested-execution path, which is schema + contract + ownership work, i.e. v1.2.

These priors are recorded so the synthesis below can be checked for whether the evidence actually supports the "missing concept" reframe or whether the team is rationalizing three failed attempts.

## The Problem (v1.2 framing — named user, structural pain, cost)

**Named user segment:** unchanged from Source-based framing — operators running Nexus `local_provider` + `primary_provider=claude` who invoke canonical lifecycle commands (`/build`, `/review`, `/qa`, `/ship`) from inside an active Claude Code session (the majority Nexus environment; `governed_ccb` is higher-setup-friction).

**Structural pain (the missing concept, evidenced):**

Nexus's governed-execution model has exactly two representable execution provenances: *spawned local provider* (`runProviderCommand` → `claude -p`) and *governed CCB dispatch* (codex/gemini via `ask`). There is no third: *the calling session attested the work itself*. Because that concept does not exist:

- The bin tries to delegate to a peer even when the caller is the worker → silent hang (Sources 1, 2; pre-#160).
- After #160's fail-fast, the bin hard-errors instead — the workflow is still impossible from the majority environment, just loud instead of silent (Source 6).
- When operators route around it by hand-authoring artifacts, there is no honest provenance value to write, so they fabricate `dispatch_command`/`receipt`/`actual_route` (Source 1) — and `/review`'s provenance gate (`review.ts:540`, `:1188`, `build.ts:100-111`) cannot tell fabricated from real (Source 6).
- Every attempt to add the missing path as a patch collides with the model's spawn-centric assumptions: status.json/ledger ownership (`build.ts:468`), downstream `actualRoute` derefs (`review.ts:1084`), the `provenance_consistent` fix-cycle gate (Source 6 BLOCKER/MAJOR set).

**Cost:** the majority Nexus environment cannot run the governed lifecycle at all. Operators either context-switch to a bare terminal for every governed stage, or hand-fabricate provenance that silently degrades the audit trail `/review` and `/ship` depend on. ≥3 recorded occurrences across 2 projects / ~15-day cadence (Sources 1-2) plus the structural disproof (Source 6) that no bounded patch closes it.

## Hypothesis Hint (v1.2 depth — for `/frame` to sharpen)

**If** Nexus's governed-execution model gains a first-class third execution provenance — `operator_attested` — represented as an enforced schema citizen in `StageStatus`/`Local*Raw` (not an operator-authored string), with a defined ownership model for who writes `status.json` and advances the ledger when no process is spawned, and an end-to-end `/review` contract that consumes the attested shape (null `actualRoute` handled at every deref, `provenance_consistent` gate semantics defined for attested, fix-cycle eligibility preserved), and a non-circular trust anchor (not authored by the attesting session), **then** operators in the majority `local_provider/claude` environment can complete the full governed lifecycle in-session with honest, distinguishable provenance, **because** all six evidence sources show the symptoms are not independent bugs but one absent concept, and the three disproven hotfix attempts establish that the concept must be modeled, not patched.

This is deliberately framed as a model change, not an implementation. `/frame` decides the v1.2 scope boundary (which stages, which schema fields, migration of historical fabricated artifacts); `/plan` sequences it. Discovery's claim is only that the missing concept IS the problem.

## Open Questions for `/frame` (v1.2)

1. **Ownership model**: when execution is `operator_attested`, what component writes `status.json` and advances the ledger — a bin "attested mode" that writes a real status without spawning, or a contract where the in-session operator writes it under a schema the bin validates on a second invocation? (This is the BLOCKER-2 hole; v1.2 must answer it as a model decision, not a seam tweak.)
2. **Trust anchor**: what makes `operator_attested` non-circular? Options to weigh: a pre-execution ledger SHA captured by the bin before the operator works (so the attestation references something the operator did not author), a required CI re-run signature, or accepting attested as explicitly lower-trust and gating `/ship` accordingly. Discovery does not pick; `/frame` must.
3. **`/review` contract scope**: does v1.2 make `/review` *handle* attested (survive + record) only, or also *weight* it (advisory, gate, fix-cycle eligibility)? Source 6 proved "survive only" is incoherent because `provenance_consistent` feeds `build.ts:100-111`. `/frame` must define the full contract, not defer it.
4. **Historical artifact migration**: novelWriter SP2 + ≥2 prior runs have fabricated provenance and no `provenance_kind`. Does v1.2 ship a one-time annotation/migration, a `/review`-side "absent = untrusted" rule, or leave them as disclosed-prose exceptions? Affects schema-required vs optional.
5. **Stage coverage**: `/build` is the recurrence surface, but `/review` `/qa` `/ship` share the spawn path and the same missing concept. Does v1.2 model attested-execution once for all governed stages, or sequence `/build` first with the others explicitly phased? (Source 6 showed `/build`-only is a false minimal because the operator hits the next stage immediately.)
6. **Relationship to #160**: #160's `assertNestedClaudeAllowed` throw is the current fail-fast. Does v1.2's attested path replace the throw, layer above it, or keep it as the `NEXUS_ALLOW_NESTED_CLAUDE`-off default? Must be a deliberate model decision, not an afterthought.

## Reframe (where the disproof changed Look Inward)

| Original Look Inward (hotfix framing) | v1.2 Look Inward (post-disproof) |
|---|---|
| The spawn hangs; add an early-exit | The hang is one symptom of a missing execution-provenance concept; #160 already fixed the hang |
| ~30-line bounded hotfix | Schema + contract + ownership model = v1.2 multi-stage |
| `provenance_kind` is an optional string field | `provenance_kind` must be an enforced schema citizen with a trust anchor, or it is fabrication-equivalent |
| `/review` just needs to not crash | `/review` needs a defined end-to-end contract for the attested shape (gate semantics, fix-cycle eligibility), proven by Source 6 |
| Three independent symptoms (hang, provenance, streaming) | One absent concept; the symptoms are its shadows across 6 sources |

The reframe matters because it explains *why* three hotfix revisions each failed verification: they were patching shadows. v1.2 names the object casting them. The receipt that this discovery actually happened is that the team's entering prior ("add an early-exit") is now explicitly on record as disproven by its own evidence.

## Status (v1.2 re-discovery)

Law 2 checks:
1. Named user segment — operators in `local_provider/claude` from inside Claude Code (specific, not "users")
2. Observed pain with cost — majority environment cannot run governed lifecycle; fabricated provenance degrades audit trail; ≥3 occurrences + structural disproof
3. ≥2 evidence sources — 6 sources (Sources 1-6 above, including two grounded independent reviews)
4. Hypothesis hint — v1.2-depth If/Then/Because (model change, present)
5. ≥3 open questions — 6 questions for `/frame`, all v1.2-structural

Law 1 anti-pattern check:
- Not a feature spec — names a missing concept, not fields/buttons
- Not user testing — synthesizes existing evidence
- Not substitute for shipping — #160 already shipped the stopgap; this is the structural follow-on
- Not single-stakeholder — operator + `/review`/`/ship` audit consumers + Nexus governance model
- Not solutioning in disguise — explicitly pulls back from the nexus.ts:139 / review.ts:540 solutioning the hotfix drifted into; the "missing concept" is a problem statement, solution deferred to `/frame`+`/plan`

Law 3: Look Inward (v1.2 prior) recorded before synthesis; Look Outward = Sources 1-6; Reframe present.

**Verdict: ready for `/frame` at v1.2 depth.**

---

### Source 7 — the lifecycle state machine reproduces the same rigidity (2026-05-18)

While running canonical `./bin/nexus discover` for this v1.2 re-discovery, the bin returned:

```
Illegal Nexus transition: frame -> discover
```

The shadow run-worktree ledger had advanced `discover → frame` during the disproven hotfix attempts. The canonical lifecycle state machine permits only forward transitions; it has no first-class representation for "the framing was disproven by review, legitimately re-enter discovery." This is the same defect class as the v1.2 thesis itself: a rigid governed model with no honest representation for a legitimate non-mainline state. Two layers (execution provenance, lifecycle transition) exhibit the same missing-concept shape — which strengthens, not weakens, the v1.2 framing: the fix target is the modeling discipline, not one code path.

Per repo governance (surface tool/repo-state conflicts, do not silently reconcile): the repo-visible `idea-brief.md` on the active branch is the operator-attested system of record and is Law-1/2/3 compliant. The bin's shadow ledger could not record the re-discovery transition; that conflict is surfaced here rather than forced by resetting ledger state (which would be the fabricate-state anti-pattern this whole work unit exists to eliminate).

`/frame` is the legal next bin transition from the current ledger position, and `/frame` will read THIS v1.2 section as its upstream. The frame→discover rejection does not block the v1.2 work; it is additional evidence for it.

---

# DECOMPOSITION (2026-05-18) — three independent problems, not one concept

This section supersedes BOTH prior framings for `/frame` purposes:
- the v1.1.x-hotfix framing (disproven: too small — red-team + codex, Source 6)
- the v1.2 "single missing concept" re-discovery (disproven: over-unified + overstated pain + solutioning-in-disguise + governed-model rewrite under-scoped as a milestone — codex 0.130 grounded on merged main, 2026-05-18)

Both failures are the same error class at different sizes: the first treated a deep problem as shallow; the second treated three independent problems as one and smuggled the solution into discovery. A third grounded independent review forced the honest output below. Sources 1-7 remain the evidence base; this section is the canonical `/frame` input.

## Corrected pain statement (was overstated)

Prior framings claimed "the majority Nexus environment cannot run the governed lifecycle at all." Verified false against merged code: `lib/nexus/adapters/local.ts:812` (the `assertNestedClaudeAllowed` throw, shipped in #160) explicitly instructs the operator to run from a terminal outside Claude Code, switch to `governed_ccb`, or set `NEXUS_ALLOW_NESTED_CLAUDE=1`. Post-#160 the governed lifecycle IS runnable; the honest pain is: **operators in the majority `local_provider/claude`-inside-Claude-Code environment must context-switch out of their working session (or override) for every governed stage, and when they route around that by hand-authoring artifacts there is no honest provenance to record.** #160 made the failure survivable and self-documenting; it did not make the in-session governed path work.

## The three problems (independent roots, different sizes)

### Problem A — no execution-provenance for "the calling session is the worker"

**Root:** Nexus's governed-execution model represents only *spawned local provider* and *governed CCB dispatch*. When the calling Claude session itself did the work, there is no honest provenance value; operators fabricate `dispatch_command`/`receipt`/`actual_route` (Source 1) and `/review`'s provenance gate (`review.ts:541`, `:1188`, `build.ts:107`) cannot distinguish fabricated from real.
**Evidence:** Sources 1, 2, 4, 6.
**Honest size: potentially unbounded / milestone-scale.** Touches schema (`StageStatus`/`Local*Raw`), status.json + ledger ownership when nothing is spawned (`build.ts:468`), the `/review` contract end-to-end (null `actualRoute` derefs `review.ts:1084`, `provenance_consistent` semantics, fix-cycle eligibility `build.ts:100-111`), a non-circular trust anchor, and historical-artifact migration. This is NOT a hotfix and likely NOT a single v1.2 item. Per the Completeness Principle this must be flagged as a model change requiring its own milestone with explicit phase decomposition — not packed into a point release. Discovery's claim is only that the missing provenance IS a real problem; sizing and solution are a milestone-planning question, deliberately NOT decided here (avoiding the solutioning-in-disguise that sank the v1.2 framing).

### Problem B — topology-partial streaming/observability coverage

**Root:** `stream_to_tty` + the dispatch banner are wired only into the `runProviderCommand` (single_agent) family (`local.ts:1457/1484/1511`); `runClaudeNamedAgentCommand` (subagents) and `runClaudeAgentTeamCommand` (agent_team) lack both, so those topologies are strictly more silent. This is orthogonal to Problem A — it is wrong whether or not the caller is the worker.
**Evidence:** Source 3.
**Honest size: genuinely bounded.** Add `stream_to_tty`/banner parity to the two missing dispatch paths + regression tests. This is a real, small, shippable fix on its own.

### Problem C — lifecycle state machine has no legitimate re-entry

**Root:** `lib/nexus/governance/transitions.ts:5-6` is strictly forward (`discover:['frame'], frame:['plan']`); `:32` throws `Illegal Nexus transition`. There is no representation for "the framing was disproven by review; legitimately re-enter discovery." Encountered live this session (Source 7). Orthogonal to A and B — a state-machine/backtracking-policy concern.
**Evidence:** Source 7.
**Honest size: bounded policy change.** Define which backward/re-entry transitions are legal and under what recorded justification. Small contract change, but it IS a governance-semantics decision (needs its own framing, not a code tweak).

## Hypothesis hints (per problem, deliberately shallow — sizing/solution deferred to per-problem /frame)

- **A:** *If* Nexus models a third execution provenance for session-is-worker, *then* operators stop fabricating provenance and `/review` can distinguish it, *because* Sources 1/2/4/6 show fabrication is forced by the absent concept. (Milestone-scale; flagged unbounded.)
- **B:** *If* the two non-`runProviderCommand` dispatch paths get `stream_to_tty`+banner parity, *then* agent_team/subagents stop being silently worse than single_agent, *because* Source 3 shows the gap is path-specific and bounded.
- **C:** *If* the lifecycle state machine allows recorded, justified re-entry, *then* a disproven framing can be honestly re-discovered without ledger-state fabrication, *because* Source 7 showed forward-only forces exactly the fabricate-state anti-pattern this work targets.

## Open questions for `/frame` (decomposition-level, NOT per-problem solutioning)

1. **Sequencing:** B is independently shippable today; C is a bounded governance decision; A is milestone-scale. Does B ship first as its own bounded fix while A goes to milestone planning, or are they bundled for release-coherence reasons the operator knows and discovery does not?
2. **A's home:** is Problem A a `/new-milestone` (its own roadmap with phases) or a single large `/frame`? Discovery asserts it is milestone-scale; the operator decides the vehicle.
3. **C's owner:** lifecycle re-entry is a Nexus-governance-semantics change. Is it in scope for this work unit at all, or a separate governance RFC? It surfaced incidentally; it may not belong here.
4. **Does B even need /frame?** B may be small enough to route straight to a bounded `/plan` or even a direct fix-with-tests, skipping heavy framing. Operator calls the ceremony level.
5. **What is explicitly NOT being decided here:** the operator_attested schema shape, the trust anchor mechanism, the /review contract details — all deferred to A's milestone planning. Recording this so the next pass does not re-smuggle them into discovery (the exact defect that sank the v1.2 framing).

## Reframe (the receipt)

| Entering prior (v1.2 re-discovery) | After third grounded review |
|---|---|
| One absent concept unifies all 7 sources | 3 independent roots; Sources 3 and 7 have distinct roots from the provenance gap |
| Majority environment "cannot run governed lifecycle at all" | Post-#160 it runs (terminal/CCB/override); pain is forced context-switch + fabrication, not total block |
| v1.2 milestone, scoped | Problem A is milestone-scale and must be flagged unbounded, not packed into a point release |
| Open questions = structural | Prior open questions were pre-committed solution menus (solutioning-in-disguise); these are sizing/sequencing questions, solution explicitly deferred |

The receipt that this discovery actually happened: the team's own prior across TWO prior framings is on record as disproven by its own evidence, and the correction was forced by independent review three times, not self-generated. The honest output of discovery here is the decomposition itself.

## Status (decomposition)

Law 2: named segment (operators in `local_provider/claude` inside Claude Code) ✓; observed pain with cost, corrected/not overstated ✓; ≥2 evidence sources (7) ✓; hypothesis hints (3, deliberately shallow) ✓; ≥3 open questions (5, sizing/sequencing not solutioning) ✓.
Law 1: not a feature spec ✓; not user testing ✓; not substitute for shipping (#160 shipped the stopgap) ✓; not single-stakeholder ✓; **not solutioning in disguise** — solution shapes for A explicitly deferred and recorded as out-of-discovery ✓.
Law 3: Look Inward (two disproven priors on record) → Look Outward (Sources 1-7) → Reframe ✓.

**Verdict: the decomposition is ready for `/frame`. Recommended: take Problem B to a bounded `/frame`-or-`/plan` first (smallest, independently shippable, real user value), route Problem A to `/new-milestone` (flagged unbounded), and decide Problem C's ownership separately.**
