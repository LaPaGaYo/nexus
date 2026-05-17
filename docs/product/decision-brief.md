# Decision Brief — v1.1.2 Operator-Attested Early-Exit

## Hypothesis

If we make the canonical bin detect, before entering the adapter stack, that the resolved route's generator IS the calling session (`local_provider` + `primary_provider=claude` + same-host claude topology + inside Claude Code + no `NEXUS_ALLOW_NESTED_CLAUDE=1`) and early-exit with exit 0 plus a structured `operator_attested` contract instead of spawning a nested `claude -p`, then operators running `/build` from inside Claude Code will complete the governed build in-session with zero silent hang and zero fabricated provenance, because three recorded occurrences plus PR #160's diff prove the spawn is structurally pointless when the caller is the worker, and the in-session Claude already produces verifiable evidence an honest `provenance_kind` can carry.

## Chosen scope

Minimal slice: `single_agent` + `local_provider/claude` + inside Claude Code + `/build` only. Bin-layer early-exit in `lib/nexus/cli/nexus.ts` before the handler dispatch; additive optional `provenance_kind` on the four `Local*Raw` interfaces; one SKILL.md template branch. PR #160's `assertNestedClaudeAllowed` throw is retained as a defensive backstop for programmatic (non-bin) adapter calls.

## Rejected alternatives

- **Require a real terminal / `governed_ccb` for governed stages** — codifies friction as design, punishes the majority segment, doesn't remove fabrication risk. Rejected.
- **Keep PR #160's throw as the destination** — better than a hang, still a broken core workflow every ~15 days. Stopgap, not destination. Rejected.

## Decision rationale

Recurrence is monotonic on a ~15-day cadence (1→2→3 occurrences, 2 projects). #160 stopped the silent failure but left the workflow broken from the operator's primary environment. The fix is bounded (~30 lines + 4 optional fields + 1 template branch, no migration, no downstream rewrite). v1.2 reads the provenance signal; v1.1.2 creates it and stops the hang.

## Open framing questions surviving to `/plan`

1. **Detection seam**: predicate lives in `lib/nexus/cli/nexus.ts` before `invocation.handler` (engineering perspective recommended line ~139). `/plan` confirms the exact insertion point and whether route resolution is available that early or must be partially computed in the CLI.
2. **Attested artifact authorship**: bin emits the contract; the in-session Claude writes the 7 files. `/plan` decides whether the bin writes a skeleton `status.json` first (so the ledger advances atomically) or the operator writes all of it — and how the git-SHA + verbatim-test-output guardrails are enforced (schema-required fields vs `/review`-side check).
3. **`/review` consumption (v1.1.2 boundary)**: this fix only guarantees `provenance_kind` is present + observable. `/plan` must draw the exact line: surfacing the field (in scope) vs acting on it (v1.2).
4. **Topology generalization**: slice is `single_agent`. `subagents`/`agent_team` legitimately spawn; #160 gives them a clean error. `/plan` confirms they stay deferred and the predicate correctly excludes them from early-exit.
