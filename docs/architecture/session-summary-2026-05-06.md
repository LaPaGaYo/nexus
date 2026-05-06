# Session summary — 2026-05-06

**Scope:** Track E (Iron Laws), Track F (numbered workflows), Track D-D3 (skill ecology + dispatcher), Track H (adoption telemetry), plus 3 stuck-PR rescues and miscellaneous cleanup.

**Net commits:** ~30 commits to `main` across 7 PRs.

---

## What shipped

### Track E — Iron Laws (rigor framework)

10 phases × 3 Iron Laws = 30 mandatory rules added to canonical 9 + `/learn` SKILL.md prose.

| Phase | Skill | Commit | Notes |
|---|---|---|---|
| E.1 | `/build` | `4209cc4` | Trial PoC; 3 Iron Laws (evidence-before-claims, no-fixes-without-root-cause 3-strike, advisories address-or-dispute) |
| E.2 | `/plan` | `10974ed` | Bite-sized task contract + hypothesis + binding handoff |
| E.3 | `/review` | `7fbcb7d` | Content contract + two-round protocol + disagreement protocol |
| E.4 | `/qa` | `52c02fa` | Finding evidence contract + ship-blocking categories + 3-strike cluster |
| E.5 | `/frame` | `16fccc8` | PRD 7-section + hypothesis framing + readiness gate |
| E.6 | `/discover` | `fcbcbbe` | Anti-patterns + signal bar + Look Inward/Outward |
| E.7 | `/ship` | `c5bacef` | Pre-merge gate + refuse-to-ship-broken + branch decision tree |
| E.8 | `/closeout` | `0a90629` | Integrity checklist + stale evidence + read-only authority |
| E.9 | `/learn` | `18143a0` | Confidence rubric + cross-skill capture + hygiene cadence |
| E.10 | `/handoff` | `09b330b` | Freshness check + recovery from blocked + cross-operator context dump |

**v1/v2 audit result:** canonical 9 lifted from **1.93/5 → 4.42/5** (HIT target ≥4.0).

### Track F — numbered workflows (Darwin operational quality)

9 phases applied to canonical skills:
- Numbered "How to run" workflow section (largest lever)
- Frontmatter trigger phrases
- 2–3 typical-prompt examples
- AskUserQuestion gates at Iron Law branching points
- `/discover` Completion Advisor footer fix (one-time)

| Phase | Skill | Commit |
|---|---|---|
| F.1 | `/discover` | `cb50dc4` |
| F.2 | `/build` | `0dfd1ad` (merge of `track-f-phase-2-build`) |
| F.3 | `/plan` | `e0eb139` |
| F.4 | `/handoff` | `53b1ee7` |
| F.5 | `/frame` | `4e5f5c1` |
| F.6 | `/qa` | `2c971b1` |
| F.7 | `/closeout` | `787abd4` |
| F.8 | `/review` | `1cbfe9a` |
| F.9 | `/ship` | `098a6ce` |

**v3/v4 Darwin audit result:** canonical 9 lifted from **72.3/100 → 84.1/100** (gap to control mean 85.5 closed from -13.2 to -1.4, within methodology noise).

F.2–F.9 dispatched as **8 parallel agents in worktrees** for ~1.5h wall-clock vs ~8h sequential. Centralized test-additions commit (`e2241a1`) added 9 new test assertions covering all 8 phases.

### Track D-D3 — skill ecology + `/nexus do` dispatcher

Backfilled all 4 deferred phases in one cohesive commit (`6dfdf72`):

- **Phase 4** — 37 `nexus.skill.yaml` manifests (9 canonical + 23 support + 4 safety + 1 root)
- **Phase 2.b** — discovery loads manifests; bug fix (`build` was wrongly in `SKIP_DIRS`)
- **Phase 3** — stage-aware advisor surfaces manifest-driven `recommended_skills`
- **Phase 5** — keyword-based intent classifier + `/nexus do <intent>` meta-command

Then per-merge follow-ups:
- **Phase 5.5** (PR #122, commit `14da2f4`) — `gen-skill-docs` copies manifests to host install paths so `/nexus do` works from any cwd
- **#94 fix** (same PR) — stale `runtimes/safety/freeze` test path
- **Phase 6 docs** (same PR) — README/CLAUDE.md/AGENTS.md updated to describe Iron Laws + workflows + dispatcher
- **LLM tiebreaker wiring** (PR #123, commit `ecf58c1`) — opt-in via `NEXUS_INTENT_LLM=1`; consults LLM only on ambiguous keyword outcomes; LLM picks must be within keyword shortlist; falls back to keyword on throw

### Track H — adoption telemetry

PR #124, commit `84ca062`. Per Darwin v4 audit recommendation (*"next bottleneck is adoption discipline, not skill quality"*).

- `lib/nexus/telemetry/` — types (9 event kinds), append-only JSONL storage, env-gated public API, summary reporting
- Chokepoint integration in `buildCompletionAdvisorWrite` — one emit captures all canonical lifecycle stages
- `nexus telemetry` meta-command — read-only reporter with stage/kind/since filters and JSON output
- 27 tests; default OFF (`NEXUS_TELEMETRY=1` to opt in); zero-content payload (privacy preserved)

### Stuck-PR rescue

3 Codex-authored PRs (#93, #100, #101) had been CONFLICTING for ~9 hours. Pivoted to manual rebase + direct merge after discovering the PRs were from a fork (`glaocon/nexus-FH1M`) we don't have write access to. Net: 3 PRs merged via `git merge --no-ff` to main with full attribution; 6 issues auto-closed via `Closes #X`.

---

## Audits

| Audit | Framework | Run point | Headline result |
|---|---|---|---|
| `skill-strength-audit.md` | v1 5-dim rigor | Pre-Track E | Canonical 9: 1.93/5 |
| `skill-strength-audit-v2.md` | v2 5-dim rigor | Post-Track E | Canonical 9: 4.42/5 (+2.49) — HIT |
| `skill-strength-audit-v3-darwin.md` | Darwin 8-dim engineering | Post-Track E | Canonical 9: 72.3/100 (gap to control −13.2) — revealed Track F's need |
| `skill-strength-audit-v4-darwin-post-track-f.md` | Darwin 8-dim | Post-Track F | Canonical 9: 84.1/100 (+11.8, gap −1.4) — HIT |

The v3/v4 Darwin audits were **the critical insight** of the session: v2 confirmed rigor was up but missed that Iron Laws don't add operational quality. Darwin caught the gap (workflow clarity, checkpoints, real-world prompt performance) and predicted exactly which dimensions Track F would lift. v4 confirmed all predictions held.

---

## Repo state at end of session

| | |
|---|---|
| Total skills with manifests | 37 (9 canonical + 23 support + 4 safety + 1 root) |
| Test count | 854 pass, 144 skip, 2 pre-existing fails (`command-runner`, `runtime-cwd`) flagged for follow-up |
| Open issues | 27 (all non-Track-E/F/D-D3/H scope) |
| Merged PRs in session | 7 (#122, #123, #124 directly + 3 manual merges + 1 from manifest backfill) |
| `bun run skill:check` | clean across all 4 hosts (claude/codex/factory/gemini-cli) |
| `bunx tsc --noEmit` | clean |

---

## Pre-existing follow-ups (not addressed)

- `test/nexus/command-runner.test.ts` — pre-existing failure on main; flagged
- `test/nexus/runtime-cwd.test.ts` — pre-existing failure (`process.cwd()` in `createSkillRegistry`); flagged
- 6 Phase 4.4 repo-structure issues (#82, #83, #85, #86, #87, #88) — low ROI repo hygiene; left open
- Iron Law–specific telemetry events (`review_pass_round_changed`, `ship_branch_outcome_chosen`, etc.) — schemas defined in Track H, runtime emit points deferred to follow-up PRs
- Real LLM classifier implementation (e.g., `ClaudeAPILLMClassifier`) — wiring is shipped (Track D-D3 Phase 5 follow-up), real implementation deferred

---

## What changed in user vocabulary

After this session, users now have these new surfaces:

- `nexus do "<free-form intent>"` — natural language → canonical skill
- `nexus telemetry [--stage=... --kind=... --since=... --raw --json]` — observability
- `NEXUS_INTENT_LLM=1` — opt-in LLM tiebreaker for ambiguous intent classification
- `NEXUS_TELEMETRY=1` — opt-in adoption telemetry
- Iron Laws referenceable in cross-skill prose (e.g., "per `/build` Law 3", "per `/qa` Law 2")
- Numbered workflow sections in every canonical skill's `SKILL.md`

---

## Strategic next bottleneck (per v4 audit)

> "Diminishing returns on further skill-text edits. Next bottleneck is adoption discipline (telemetry on whether Iron Law gates and AskUserQuestion checkpoints actually fire in real runs), not skill quality."

Track H started this. Next steps for the team:

1. Wire the 8 Iron Law–specific telemetry events into their respective runtime emit points (8 small PRs, ~30 min each)
2. Run for 2–4 weeks with `NEXUS_TELEMETRY=1` enabled in dev workflows
3. Analyze the telemetry corpus to validate Iron Laws are firing (or surface where they're being silently bypassed)
4. Use that signal to inform any future Track G (skill-strength) decisions

Track G itself was explicitly NOT recommended by the v4 audit — diminishing returns. Telemetry is the higher-leverage move.
