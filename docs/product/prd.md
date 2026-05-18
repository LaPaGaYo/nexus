# PRD — Operator-Attested Early-Exit for Self-Dispatch (`/build` v1.1.2)

| | |
|---|---|
| **Run** | Nexus v1.1.2 framing |
| **Worktree** | `claude/jovial-jang-9618ea` |
| **Date** | 2026-05-17 |
| **Upstream** | `docs/product/idea-brief.md` (5 evidence sources, 3 recorded occurrences, Source 5 = PR #160 resolution) |
| **Framing topology** | `agent_team` — engineering / risk / product perspectives synthesized below |
| **Status** | **REVISION REQUIRED — NOT READY FOR /plan.** Independent red-team review (2026-05-17, verified by operator) found 3 blockers. Parked pending PR #160 merge. See banner below. |

---

## ⚠️ RED-TEAM REVISION REQUIRED (2026-05-17)

An independent adversarial review, then re-verified by direct code inspection on branch `claude/jovial-jang-9618ea`, found three blockers. This PRD must not advance to `/plan` until they are resolved. The body below is preserved as-is (pre-revision) for traceability.

- **B1 — Baseline error (operator-introduced).** This PRD treats PR #160's `assertNestedClaudeAllowed` / `NEXUS_ALLOW_NESTED_CLAUDE` as landed code. Verified false: `grep` of `lib/` + `test/` on this branch returns zero hits. PR #160 is APPROVED but OPEN and CONFLICTING (DIRTY after PR #161 merged) — it is NOT merged into any branch. Every PRD reference to "#160 (merged)", "backstop", "escape hatch preserved", Risk 4, Success Criterion 5, Story 2 has no code anchor. v1.1.2 either (a) declares PR #160 a hard merge-prerequisite and re-baselines against the merged code, or (b) absorbs the guard+override itself, which is materially larger than the stated "~30 lines + 4 optional fields".
- **B2 — Detection seam unimplementable as scoped.** `lib/nexus/cli/nexus.ts:139` is `await invocation.handler(...)`. Route data (`execution_mode` / `primary_provider` / `provider_topology`) has zero occurrences in `nexus.ts` — it is resolved downstream inside the adapter/ledger (`build.ts` ledger construction, `local.ts` execute_generator ~1882). The predicate cannot be evaluated at the CLI seam the PRD specifies. The early-exit must move into the adapter layer (`local.ts execute_generator`, after `ctx.ledger.execution` is available) or `build.ts` post-ledger — which invalidates the "CLI-layer, no adapter change, ~30 lines" framing in Section 7.
- **B3 — Phantom /review consumption point; attested build crashes review.** `lib/nexus/commands/review.ts:459-460` hard-throws `'Build must record requested and actual route before review'` when `actual_route` is null. An `operator_attested` build emits null `actual_route` by design (Success Criterion 2, Story 1), so `/review` throws at line 460 before any provenance logic. Line 463 keys on `requested_route.generator === actual_route.route`; there is no `provenance_kind` branch anywhere in `review.ts` or `normalizers/`. The slice MUST include a `review.ts:459-466` attested-variant branch — directly contradicting Non-goal 5 / Out-of-scope 3 ("no /review changes; that's v1.2").

**Resolution path chosen: resolve the #160 dependency first** (B1 is the root). Once PR #160 is rebased past #161 and merged, re-baseline this PRD against the real `assertNestedClaudeAllowed` code, then revise B2 (relocate seam) and B3 (include the review.ts branch) and re-run the `/frame` Law 3 gate.

---

## 1. Problem statement

Operators running Nexus in `local_provider` mode with `primary_provider=claude` invoke canonical `/build` from inside an active Claude Code session — the most common Nexus environment, because `governed_ccb` has higher setup friction. At SKILL.md Step 9, the canonical bin spawns a nested `claude -p` peer to "do the build" even though the calling session already IS the named generator and already did the work in-session. That nested spawn hangs forever at the Claude Code Bash-tool pipe boundary (output buffered until exit, host timeout < the 30-min provider timeout). The operator burns ~20 minutes recognizing the recursion, kills the subprocess, and hand-writes 7 artifacts with **fabricated** `dispatch_command`/`receipt`/`actual_route` fields to pass schema validation. This has recurred ≥3 times across 2 projects on a ~15-day cadence (novelWriter SP2 2026-05-12 being the third). PR #160 (APPROVED but UNMERGED — OPEN/CONFLICTING after PR #161 landed; see B1 banner) is intended to convert the silent hang into an immediate hard error across all 3 claude topologies, but even once merged does not let the operator complete `/build` from their primary environment — it stops the bleeding without restoring the workflow.

## 2. Hypothesis

**If we** make the canonical bin detect, before entering the adapter stack, that the resolved route's generator IS the calling session (`local_provider` + `primary_provider=claude` + same-host claude topology + inside Claude Code + no explicit `NEXUS_ALLOW_NESTED_CLAUDE=1` override) and early-exit with exit 0 plus a structured `operator_attested` contract instead of spawning a nested `claude -p`, **then** operators running `/build` from inside Claude Code **will** complete the governed build in-session with zero silent hang and zero fabricated provenance fields, **because** three recorded occurrences plus PR #160's diff prove the spawn is structurally pointless when the caller is the worker, and the in-session Claude already produces verifiable evidence (test output, git diff) that an honest `provenance_kind` field can carry to `/review`.

## 3. Success criteria

Observable, falsifiable:

1. **No spawn, fast exit**: running `/build` inside Claude Code with `local_provider/claude/single_agent` produces `adapter-output.json` with `provenance_kind="operator_attested"`, exit code 0, in <5s, with **zero** `claude -p` subprocess spawned. Verify: process audit shows no `defaultRunCommand` spawn; `time` on the bin call < 5s.
2. **No fabricated provenance**: `grep` of the resulting `status.json` + `adapter-output.json` shows `dispatch_command`, `receipt`, `actual_route` are absent or `null` when `provenance_kind=operator_attested` (schema permits the attested variant; fabrication is no longer needed to pass it).
3. **Distinguishable downstream**: `/review` reading that artifact surfaces `provenance_kind` as an observable signal in its review input (it does not silently treat operator-attested as spawned-provider). Verify: `/review` adapter-request or review input JSON contains the `provenance_kind` value.
4. **Guardrail enforced**: an `operator_attested` artifact whose worktree has an empty `git log <base>..HEAD` is rejected (or flagged non-ready) — kills the sibling "completed, zero diff" failure. Verify: a forced empty-diff attested run does not produce `ready: true`.
5. **PR #160 backstop intact**: with `NEXUS_ALLOW_NESTED_CLAUDE=1` explicitly set, the old spawn path is still reachable and the early-exit is skipped. Verify: regression test asserts both branches (mirrors `test/relink.test.ts` two-sided assertion from #160).

## 4. Non-goals

1. **Not a v1.2 provenance schema redesign.** v1.1.2 adds only the minimal optional `provenance_kind` field to the four `Local*Raw` interfaces + the early-exit. Full schema rollout, advisor logic changes, and `/review` re-grading intelligence are v1.2.
2. **Not closing the v1.1.1 topology-partial streaming gap.** `agent_team`/`subagents` still lack the `stream_to_tty` tee + dispatch banner. Related, bounded, tracked separately — not in this fix.
3. **Not changing `governed_ccb` or any non-claude / non-single-host dispatch.** CCB dispatching to codex/gemini is a legitimate spawn to a different process and must be untouched.
4. **Not auto-committing the worktree.** The "build_recorded with empty diff" sibling bug (idea-brief Source 4) is only *detected* as a guardrail here, not fixed by auto-commit.
5. **Not `/review` `/qa` `/ship` early-exit in this slice.** Structurally identical and a fast-follow, but all 3 recorded occurrences are `/build`; that is the recurrence surface this fix targets.

## 5. Risks

1. **False early-exit swallowing a legitimate spawn.** Mitigation: the predicate is NOT "inside Claude Code" alone — it requires `local_provider` AND `primary_provider=claude` AND a same-host claude topology AND not overridden. `governed_ccb` (mode≠local_provider), non-claude generators, and explicit overrides are all excluded by construction. Regression tests enumerate each excluded case.
2. **Legacy operator-attested artifacts misclassified.** Already-committed runs (novelWriter SP2 + ≥2 prior) have no `provenance_kind` and carry fabricated dispatch fields. Mitigation: `/review` treats **absent `provenance_kind` as `unknown`, not `spawned`**, and falls back to scanning `build-result.md` for the Provenance Disclosure block. No destructive history rewrite. Accepted; retroactive annotation is out-of-scope (one-time pass, not gated on this fix).
3. **Self-attestation trust gap.** Operator both does the work and writes "verified." Mitigation: `operator_attested` is only trustworthy with (a) git HEAD SHA bound into the artifact at write time, (b) verbatim test command + exit code + counts captured structurally (not paraphrased), (c) `dispatch_command`/`receipt` emitted null so schema cannot be satisfied by fabrication. Success criterion 4 enforces (a).
4. **`NEXUS_ALLOW_NESTED_CLAUDE` semantic shift.** #160 made it "force the spawn instead of throwing"; v1.1.2 makes unset = graceful early-exit. Mitigation: keep the variable as an explicit opt-in to the *old spawn path* (escape hatch unchanged); document precedence; regression-test both branches. Accepted low risk — the override audience is small and explicit.

## 6. Alternatives considered

**Rejected: "Require a real terminal (or `governed_ccb`) for all governed stages."** This codifies the friction as the design. The idea-brief names in-Claude-Code `local_provider/claude` as the *most common* segment precisely because `governed_ccb` is higher-setup-friction. Forcing a context switch out of the front-door environment for every `/build` punishes the majority path to avoid building correct boundary detection, and does not even eliminate fabrication risk — it relocates the work and adds a rule operators will eventually bypass (re-introducing the hang via `NEXUS_ALLOW_NESTED_CLAUDE=1`). The correct answer is the bin knowing when it is the worker, not the operator memorizing where `/build` is safe to type.

**Rejected: "Keep PR #160's throw as the final behavior."** A throw is better than a hang but still presents as a routing failure (`state: blocked`), not a recognized self-dispatch. It leaves the core workflow broken from the operator's primary environment every ~15 days. #160 is the right stopgap, not the right destination.

## 7. Decision rationale

Why this scope: the minimal slice (single_agent / local_provider+claude / inside Claude Code / `/build`) removes the pain for every recorded occurrence with a bounded change — ~30 lines in `lib/nexus/cli/nexus.ts` before the handler dispatch, four additive optional schema fields in `lib/nexus/adapters/local.ts`, one SKILL.md template branch. Nothing renamed, no migration, no downstream `/review` rewrite (that distinction is v1.2). Why now: the failure recurs on a metronome (~15 days, monotonically increasing 1→2→3) and PR #160 made it loud, not livable — every day it bakes, the operator context-switches or re-hangs via the override. What changes when it ships: at Step 9 the bin recognizes "I am the worker," exits 0 in seconds with an honest `operator_attested` contract, the in-session Claude authors artifacts that truthfully say "operator attested, no spawn, here is the git SHA and verbatim test output" — zero hang, zero fabrication, `/review` can finally tell attested from spawned. The governed lifecycle works from the operator's primary environment for the first time.

---

## User stories (acceptance criteria)

**Story 1 — in-session `/build` completes without hang (primary path)**

> **Given** an operator in an active Claude Code session with `execution_mode=local_provider`, `primary_provider=claude`, `provider_topology=single_agent`, having done the implementation work in-session and reached SKILL.md Step 9,
> **when** they run `./bin/nexus build`,
> **then** the bin exits 0 in <5s without spawning `claude -p`, emits a structured `operator_attested` contract JSON on stdout naming the artifact paths to author, and the resulting `adapter-output.json` carries `provenance_kind="operator_attested"` with null `dispatch_command`/`receipt`.

**Story 2 — override preserves the old path**

> **Given** the same session **but** with `NEXUS_ALLOW_NESTED_CLAUDE=1` explicitly set,
> **when** they run `./bin/nexus build`,
> **then** the early-exit is skipped and the existing spawn path runs unchanged (PR #160 escape hatch preserved).

**Story 3 — empty-diff guardrail**

> **Given** an `operator_attested` build whose worktree has an empty `git log <base>..HEAD`,
> **when** `/review` consumes the artifact,
> **then** it does not report `ready: true` for that build (the "completed with zero diff" sibling failure is blocked).

## Out-of-scope (distinct from non-goals)

Adjacent things operators may expect this work to touch but it does not:

1. **Retroactive migration/annotation of historical operator-attested artifacts** (novelWriter SP2 and the ≥2 prior). They stay disclosed via `build-result.md` prose; a one-time additive annotation pass is a separate, ungated task.
2. **SKILL.md human-facing restructuring beyond the minimal Step 9 early-exit branch.** Operators may expect the whole `/build` skill prose to be rewritten for the new model; this fix adds only the one branch instruction needed.
3. **`/review` re-grading logic that acts on `provenance_kind`.** This fix makes the signal *present and observable*; `/review` issuing a structured advisory or changing its verdict based on it is v1.2.
4. **The novelWriter SP2 run itself.** It stays as committed (operator-attested, disclosed). This fix does not retroactively re-run or re-validate it.
