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
7. **PR #160 disposition** — **RESOLVED 2026-05-17**: outcome (c). glaocon dropped F1 and reduced #160 to the F3 portion, generalized to all three claude spawn sites (`single_agent`, `subagents`, `agent_team`) plus a `nexus-config` readiness consistency fix and regression coverage. PR #160 verified and approved as a fail-fast hotfix. The structural fix (operator-attested early-exit per the 2026-04-27 contributor log) is unchanged as this brief's `/frame` target — it is explicitly out of #160's scope.

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
