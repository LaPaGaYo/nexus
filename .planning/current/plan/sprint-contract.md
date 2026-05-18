# Sprint Contract — Problem B: streaming/observability parity across claude dispatch paths

**Upstream:** docs/product/idea-brief.md Source 3 (problem) + Source 11 (c) part 2 (decision). Problem B deliberately skipped /frame per the decomposition's open question (bounded, review-survived). NOT a frame-PRD-backed plan — operator-attested, Law 1/2/3 verified inline.
**Grounded on:** merged origin/main `891055c` (every line re-verified, no stale anchors).
**Scope class:** bounded hotfix-class. NOT Problem A (no provenance model/schema/ownership/review-contract — explicitly deferred per Source 11 part 5). Does not touch governed_ccb or non-claude paths. Does not regress #160 (additions sit AFTER `assertNestedClaudeAllowed`).

## Problem (one paragraph)

`lib/nexus/adapters/local.ts`: the dispatch banner (`process.stderr.write` at L1440-1442) and `stream_to_tty: true` are wired only into `runProviderCommand` (single_agent path, L1425; banner L1440, flag L1457/1484/1511). The two other local-claude dispatch paths — `runClaudeNamedAgentCommand` (subagents, L844) and `runClaudeAgentTeamCommand` (agent_team, L1025) — call `runCommand({argv,cwd,stdin_text,timeout_ms})` with no banner and no `stream_to_tty`. Result: subagents/agent_team are strictly more silent than single_agent under Claude Code host tools. v1.1.1's streaming fix was provider-complete but topology-partial.

## Tasks (Law 1: bounded ≤1d, observable acceptance, verification command)

### B-1 — Extract the dispatch banner into a reusable helper

- **Scope:** In `lib/nexus/adapters/local.ts`, extract the inline banner (`process.stderr.write` at ~L1440-1442) into a small module-level helper `emitDispatchBanner(label: string, timeoutMs: number): void` that writes the identical string format. Replace the inline call in `runProviderCommand` with `emitDispatchBanner(provider, timeoutMs)`. Behavior-preserving for single_agent.
- **Acceptance:** `emitDispatchBanner` exists in `lib/nexus/adapters/local.ts` AND `runProviderCommand` calls it AND the emitted string for single_agent is byte-identical to the pre-change format (`\n[nexus/local-provider] dispatching ${label} (timeout: up to ${minutes} min) — streaming below:\n`).
- **Verify:** `bun test test/nexus/runtime/local-provider-mode.test.ts` (exit 0, no regression in existing single_agent banner expectations).

### B-2 — Add banner + stream_to_tty to subagents and agent_team paths

- **Scope:** In `runClaudeNamedAgentCommand` (L844) and `runClaudeAgentTeamCommand` (L1025), after the existing `assertNestedClaudeAllowed(...)` call (MUST stay first — do not move/bypass the #160 guard), call `emitDispatchBanner(<label>, timeoutMs)` and add `stream_to_tty: true` to the `runCommand({...})` spec. Label: `claude/subagents` (or agent name) and `claude/agent_team` respectively.
- **Acceptance:** both functions call `emitDispatchBanner` AND pass `stream_to_tty: true` AND both calls occur textually AFTER `assertNestedClaudeAllowed(...)` (guard not bypassed).
- **Verify:** `bun test test/nexus/runtime/local-provider-mode.test.ts test/nexus/runtime/local-provider-guards.test.ts` (exit 0; guard tests still green = #160 not regressed).

### B-3 — Regression test: three-topology parity + guard ordering

- **Scope:** Add a test (in `test/nexus/runtime/local-provider-mode.test.ts` or a new `streaming-parity.test.ts` sibling) asserting: all three claude dispatch paths (`runProviderCommand` claude branch, `runClaudeNamedAgentCommand`, `runClaudeAgentTeamCommand`) emit the dispatch banner and pass `stream_to_tty: true`; AND for the two new paths the banner/flag occur only after `assertNestedClaudeAllowed` would have been reached (assert via injected `runCommand` spy capturing the spec + a stderr capture).
- **Acceptance:** new test exists, fails on pre-B-2 code (proves it is meaningful), passes on post-B-2 code, asserts all 3 paths + guard-ordering.
- **Verify:** `bun test <the new/edited test file>` (exit 0) AND `bun test` full suite (exit 0, no regressions).

## Risks (Law 2: ≥3, each with detection signal + mitigation)

1. **Banner format drift breaks an existing single_agent test.** Detection: B-1's `bun test test/nexus/runtime/local-provider-mode.test.ts` fails on a string-match assertion. Mitigation: B-1 acceptance requires byte-identical format; if a test asserts the old inline form, the extraction must preserve it exactly — if drift is unavoidable, STOP and route back (do not loosen the test silently).
2. **`stream_to_tty` interacts with the agent_team `--teammate-mode in-process` path differently than single_agent.** Detection: agent_team dispatch produces doubled/garbled stderr in the new test's stderr capture. Mitigation: B-3 asserts spec-level (`stream_to_tty: true` passed) not behavioral tee correctness; if real teeing misbehaves for agent_team that is a separate finding — flag it, do not expand B's scope to fix tee internals (that is `defaultRunCommand` territory, out of scope).
3. **Moving/duplicating logic accidentally lands the banner before `assertNestedClaudeAllowed`, regressing #160.** Detection: `local-provider-guards.test.ts` fails, or B-3's guard-ordering assertion fails. Mitigation: B-2 acceptance explicitly requires the additions textually after the guard; B-3 asserts ordering. Hard stop if either fails.
4. **Scope creep into Problem A.** Detection: any edit touching `provenance`, `actual_route`, `status.json`, `review.ts`, or schema. Mitigation: those are out of scope per Source 11 part 5; if B appears to "need" them, that is the Problem-A gravity well — STOP, do not expand, record and route back.

## Law 3 posture

This contract is binding. `/build` operates only on B-1/B-2/B-3. If build discovers an additional needed task → stop, route back to extend the contract (do not silently add). If a task proves wrong → stop, route back (do not skip). No pulling adjacent work (e.g. Problem C, the codex-parser bug) into this run.

## Status

Law 1: 3 tasks, each ≤1d, observable "X exists AND Z true" acceptance, specific `bun test` verification command. ✓
Law 2: 4 risks, each with detection signal + mitigation/routing. ✓
Law 3: binding-handoff posture stated; no silent scope expansion. ✓
Anti-pattern guard: every line number re-grounded on merged 891055c (no stale anchors — the session's B1 lesson); Problem A explicitly fenced out (the gravity-well lesson).

**Verdict: bounded plan complete, Law 1/2/3 compliant. Ready for /handoff → /build. Per session iron rule, an independent grounded review before /build is recommended but B is bounded + already review-survived at the decomposition level — operator decides whether to re-review or proceed.**

---

## Execution status (2026-05-18 checkpoint)

Code lives on branch `feat/problem-b-streaming-parity` off origin/main `891055c` (separate worktree; the sprint-contract + planning record stay on `claude/jovial-jang-9618ea`). 3 commits, working tree clean:

- **B-1 DONE** `df688d8` — `emitDispatchBanner(label,timeoutMs)` extracted in lib/nexus/adapters/local.ts (~825); runProviderCommand uses it; single_agent byte-identical. Verified.
- **B-2 DONE** `5d4c430` — runClaudeNamedAgentCommand (subagents, ~L863-864) + runClaudeAgentTeamCommand (agent_team, ~L1050-1051): `emitDispatchBanner(...)` + `stream_to_tty:true`, both AFTER `assertNestedClaudeAllowed` (guard not bypassed, #160 not regressed). Verified 37 pass / 0 fail (local-provider-mode + local-provider-guards) inside Claude Code (CLAUDECODE=1, the original break condition).
- **Finding D DONE (bonus, gated B)** `cd26c81` — confirmed #160 regression (Source 12: assertNestedClaudeAllowed fires inside `bun test` when run in a Claude Code session). Root fix: describe-level beforeEach/afterEach in test/nexus/runtime/local-provider-mode.test.ts clears CLAUDECODE/AI_AGENT/CLAUDE_CODE_EXECPATH so tests are host-env-deterministic. Production guard untouched; guard-assertion tests still assert it FIRES. Verified.

### B-3 — REMAINING (regression-lock test). Cold-start spec:

Fails-pre-B-2 / passes-post-B-2 is the non-negotiable meaningfulness check (verify by checking out `df688d8` = pre-B-2). Invariant: for each claude dispatch path (single_agent runProviderCommand / subagents runClaudeNamedAgentCommand / agent_team runClaudeAgentTeamCommand), the `spec` passed to `runCommand` has `stream_to_tty===true` AND a `[nexus/local-provider] dispatching ...` banner hit `process.stderr` before that runCommand. Guard-ordering sub-case: with `CLAUDECODE=1` + no `NEXUS_ALLOW_NESTED_CLAUDE`, dispatch throws and ZERO specs/banner captured (banner is after the guard). Harness: reuse `test/nexus/runtime/local-provider-mode.test.ts` `runInTempRepo` + `createRuntimeLocalAdapter({now,runCommand:spy})`; mirror subagents-build (~L300), agent-team (~L1213, sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1), single_agent (~L139); spy also captures `spec.stream_to_tty`; capture `process.stderr.write`; guard sub-case uses `withEnv({CLAUDECODE:'1',AI_AGENT:undefined,CLAUDE_CODE_EXECPATH:undefined,NEXUS_ALLOW_NESTED_CLAUDE:undefined},...)` (mirror L1992). Then `bun test` full exit 0, atomic commit, open PR (B-1+B-2+Finding-D+B-3) "feat: streaming parity across claude dispatch paths + fix #160 test-env regression", cite idea-brief Source 11 (c) part 2 + Source 12.
