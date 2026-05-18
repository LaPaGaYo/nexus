# Execution Readiness Packet — Problem B

- **What:** streaming/observability parity — add dispatch banner + `stream_to_tty:true` to `runClaudeNamedAgentCommand` (L844) and `runClaudeAgentTeamCommand` (L1025), matching `runProviderCommand` (L1425), via an extracted `emitDispatchBanner` helper. + regression test.
- **Why:** Source 3 — v1.1.1 streaming fix was topology-partial; subagents/agent_team are silently worse than single_agent. Source 11 (c) part 2 — the only review-survived code deliverable.
- **Upstream:** idea-brief Source 3 + Source 11 (no frame PRD by design; decomposition allowed B to skip /frame).
- **Grounded:** origin/main 891055c, every line re-verified.
- **Bounded:** 3 tasks, hotfix-class. Problem A explicitly out (Source 11 part 5).
- **Files:** `lib/nexus/adapters/local.ts` (B-1, B-2), `test/nexus/runtime/` (B-3).
- **Binding:** `/build` runs only B-1/B-2/B-3; scope creep = routing event.
- **Next:** /handoff → /build (independent review optional; B is bounded + decomposition-level review-survived).
