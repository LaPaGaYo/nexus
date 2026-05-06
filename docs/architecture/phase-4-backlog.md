# Phase 4 Backlog

**Status:** Living document. Updated as issues are assigned, merged, or new work surfaces.
**Last updated:** 2026-05-05
**Scope:** All Phase 4 work — ongoing tracks (D2/D3/#41/local-provider) + Phase 4.4 polish + housekeeping.

---

## What this document is

This is the **assignment-side companion** to `phase-4-plan.md`. The plan
captures *what* Phase 4 is and *why*; this backlog captures *what's
filed where, what's blocked on what, and who's working on it*.

If you want to know "what should glaocon pick up next", read this. If you want
to know "why is Phase 4 the way it is", read `phase-4-plan.md`.

When an issue lands or a new issue surfaces, update this doc + the GitHub
issue together (don't let drift accumulate).

---

## Quick state

| Bucket | Count | What it means |
|---|---|---|
| ✅ Merged this session | 9 | PRs already in main |
| 🟢 Currently assigned to glaocon | 6 | In queue, may have PR open |
| 🟡 Tier 1 unassigned (actionable) | 5 | Spec exists, can dispatch when queue clears |
| 🟠 Tier 2 needs brief | 8 | D3 chain; brief required before dispatch |
| 🟣 Tier 3 polish unassigned | 7 | Phase 4.4 ST items |
| 🔵 Tier 4 housekeeping | 2 | Doc refreshes |

**Total open backlog: 28 issues** (6 assigned + 22 filed unassigned).

---

## ✅ Merged this session (reference)

```
6e4ec1b  #58  D2 Phase 2.1: sever upstream imports        (closes #54/#61)
956404c  #60  D3 Phase 1 follow-up: harden registry tests (closes #59)
6f258ab  #57  D3 Phase 1: SkillRegistry consolidation     (closes #53)
7ea3da8  #56  Phase 4.1 ST5: runtimes/safety→hooks         (closes #52)
0f7cfdc  #55  Deploy contract + cwd hardening              (closes #38/#39/#40)
bb15bd8  #51  Phase 4.2: completion-advisor writer         (closes #41 partial)
1321b1a  #50  Track D-D1: rename adapters by lifecycle
60402e8  #47  Phase 4.1: host skill roots + ledger schema (closes #43/#44)
2132e5f  #45  Phase 4.1: guard production stub adapters
```

---

## 🟢 Currently assigned to glaocon

| Issue | Title | Status | Notes |
|---|---|---|---|
| #48 | PR #45 follow-up: parameterize stub-rejection test | OPEN | Recently dispatched |
| #49 | PR #47 follow-up: schema_version reader symmetry | OPEN | Recently dispatched |
| #62 | Track D-D2 Phase 2.2: remove maintainer scripts | OPEN | **PR #66 in flight** |
| #63 | Issue #41 Phase 2: extract resolver | OPEN | |
| #64 | Local-provider traceability fix | OPEN | Blocking D3 Phase 2.2 cleanly |
| #65 | Track D-D3 Phase 2: nexus.skill.yaml schema | OPEN | Brief at `track-d-d3-phase-2-brief.md` |

---

## 🟡 Tier 1 — actionable, unassigned

Spec exists (RFC or brief). Can dispatch as glaocon's queue clears.

| Issue | Title | Effort | Depends on |
|---|---|---|---|
| #69 | D2 Phase 2.3: delete `lib/nexus/absorption/` (~9 files) | S (~30 min) | #62 (PR #66) merge |
| #70 | D2 Phase 2.4: delete `vendor/upstream/` + retire upstream tests | M (~2h) | #69 |
| #71 | D2 Phase 2.5: docs rewrite (README, skills.md, runbook, etc.) | S-M (~1-1.5h) | #70 |
| #72 | #41 Phase 3: mirror tests for resolver | S (~1h) | #63 merge |
| #73 | Local verifyCodex/verifyGeminiSubagentSupport | S (~1-2h) | None |

**Spec sources**:
- D2 chain → `docs/architecture/track-d-d2-rfc.md` § Phase 2.3-2.5
- #41 Phase 3 → `docs/architecture/completion-advisor-split-proposal.md` § Phase 3
- #73 → this session's local-provider audit (IMPORTANT #2)

---

## 🟠 Tier 2 — D3 chain, needs brief

Briefs to be written by Claude before dispatch. Each issue has a placeholder
description pointing at its brief location.

| Issue | Title | Brief status | Depends on |
|---|---|---|---|
| #74 | D3 Phase 2.2: SkillRegistry consumes manifests | brief pending | #65 merge |
| #75 | D3 Phase 2.3: first-party manifest catalog (Δ1) | brief pending | #65 merge |
| #76 | D3 Phase 2.4: installer convenience (Δ2) | brief pending | #65 merge |
| #77 | D3 Phase 3: stage-aware advisor | brief pending | #74 merge |
| #78 | D3 Phase 4: 28 built-in nexus.skill.yaml manifests | brief pending | #74 merge |
| #79 | D3 Phase 5: `/nexus do` dispatcher | brief pending | #74 + #78 merge |
| #80 | D3 Phase 6: documentation pass | brief pending | #79 merge |
| #81 | D3 Phase 7: shim removal | brief pending | #80 merge |

**Brief authoring order** (recommended):
1. D3 Phase 2.2 brief — natural sequel to Phase 2 brief; unblocks the rest
2. D3 Phase 4 brief — built-in manifests; easier to author after 2.2 is real
3. D3 Phase 2.3 brief (catalog Δ1) — independent; can lag
4. D3 Phase 2.4 brief (installer Δ2) — independent; can lag
5. D3 Phase 3 brief — advisor; the user-facing payoff
6. D3 Phase 5 brief — dispatcher; biggest UX win
7. D3 Phase 6/7 briefs — small; write once 2-5 land

---

## 🟣 Tier 3 — Phase 4.4 polish

Per `docs/architecture/post-audit-cleanup-plan.md` Phase 4 ST items. Mostly
small, opportunistic.

| Issue | Title | Effort | Block |
|---|---|---|---|
| #82 | ST1+ST9: subdir `lib/nexus/` + mirror `test/nexus/` | M (~3-4h) | **#72 (#41 Phase 3)** |
| #83 | ST2: decide single-child `lib/` | S (~30 min) | None |
| #84 | ST3: ~~move CHANGELOG.md / TODOS.md out of root~~ — **🟢 RFC complete; Decision: Option A (stay in root)**. Implementation = small note in repo-taxonomy-v2.md. | XS (~10 min) | RFC at `track-c-st3-rfc.md` |
| #85 | ST4: split `bin/` source vs built | S (~1h) | None |
| #86 | ST7: decide `agents/openai.yaml` single-child | S (~15-30 min) | None |
| #87 | ST8: decide `skills/root/` single-child | S (~30-60 min) | None — ⚠️ touches host install paths |
| #88 | ST10: group `scripts/` by concern | S (~30-60 min) | None — lowest priority |

**Easy filler**: #83, #85, #86 — small, independent, glaocon can pick when queue is light.

---

## 🔵 Tier 4 — Housekeeping

Doc refreshes that should happen post-D2 to keep architecture docs in sync.

| Issue | Title | Depends on |
|---|---|---|
| #89 | Doc refresh: `context-diagram.md` post-D2 | #71 |
| #90 | Doc refresh: `repo-taxonomy-v2.md` post-D2 | #71 |

---

## Dependency graph

```
                  [#66 in flight]
                        │
                       #69 (delete absorption/)
                        │
                       #70 (delete vendor/upstream/)
                        │
                       #71 (docs rewrite)
                       /  \
                     #89  #90 (doc refreshes)


    #63 (resolver extract) ─→ #72 (mirror tests) ─→ #82 (ST1+ST9)


    #65 (manifest schema) ─→ #74 (registry consumes) ─→ #77 (advisor)
                          ├→ #75 (catalog Δ1)             │
                          └→ #76 (installer Δ2)           │
                                                          │
                          ┌→ #78 (28 manifests) ──────────┤
                          │                               │
                          └→ ─────────────────────────────┘
                                                          │
                                                         #79 (/nexus do)
                                                          │
                                                         #80 (docs)
                                                          │
                                                         #81 (shim removal)


    Independent / no deps:
      #48 PR #45 follow-up
      #49 PR #47 follow-up
      #64 local-provider traceability
      #73 local verifyCodex/Gemini
      #83 ST2  | #85 ST4 | #86 ST7 | #87 ST8 | #88 ST10
      #84 ST3  (needs RFC first)
```

---

## Assignment policy

When glaocon's queue dips below 3 active issues, dispatch the next eligible:

### Priority order

1. **Critical-path D2/D3 chains**: #66 → #69 → #70 → #71 (D2 path); #65 → #74 → #77/#78 → #79 (D3 path)
2. **Independent fixes with audit findings**: #64 (already assigned), #73
3. **#41 chain unblocking ST1**: #63 → #72 → #82 (ST1 + ST9)
4. **ST polish filler**: #83, #85, #86, #87 — assign one per dispatch when no critical-path issue ready
5. **Lowest priority**: #88 ST10, doc refreshes #89/#90

### Don't dispatch yet

- **#84 ST3** — needs RFC first (move CHANGELOG/TODOS, runtime references unclear)
- **Tier 2 D3 stubs (#74-#81)** — need briefs written first (Claude task)

### Brief-writing queue (Claude)

When user asks for brief work, recommended order:

1. D3 Phase 2.2 (#74) — natural sequel, unblocks 5+ downstream
2. D3 Phase 4 (#78) — easier to author after 2.2 brief exists
3. D3 Phase 3 (#77) — advisor; user-facing payoff
4. D3 Phase 5 (#79) — dispatcher; biggest UX win
5. D3 Phase 2.3 (#75) — catalog Δ1
6. D3 Phase 2.4 (#76) — installer Δ2
7. ST3 RFC (#84) — small; can fold into a polish-pass session
8. D3 Phase 6 (#80) + Phase 7 (#81) — write once 2-5 land

---

## How to update this doc

When an issue's state changes:

- **Issue assigned** → move from Tier list → "Currently assigned"
- **PR opened** → add "PR #X in flight" annotation in "Currently assigned"
- **PR merged** → move issue out of "Currently assigned" → "Merged this session" (with sha)
- **New issue surfaces** → add to appropriate Tier with effort + dep notation
- **Brief landed** → update Tier 2 row "brief status" from "pending" to brief filename

This doc is **append-and-mark, not rewrite**. History helps future sessions
understand the trajectory.

---

## Cross-references

- `phase-4-plan.md` — strategic intent + scope decisions for Phase 4
- `track-d-d1-brief.md` — D1 (adapter rename) — done
- `track-d-d2-rfc.md` — D2 (upstream removal) — Phase 2.1 done; 2.2-2.5 in flight via this backlog
- `track-d-d3-rfc.md` — D3 (skill ecology v2) — Phase 1 done; Phase 2 in flight; rest queued via this backlog
- `track-d-d3-phase-1-brief.md` — D3 Phase 1 — done
- `track-d-d3-phase-2-brief.md` — D3 Phase 2 — in flight (#65)
- `completion-advisor-split-proposal.md` — #41 split RFC — Phase 1 done; Phase 2/3 queued
- `post-audit-cleanup-plan.md` — Phase 4 ST items — Tier 3 of this backlog
- `phase-5-team-mode-plan.md` — Phase 5 RFC — parked, 2 user-decision TODOs

---

## Open questions (deferred)

These don't block any in-flight work but should be resolved when convenient:

1. **Should ST1+ST9 (#82) be one issue or two?** Currently bundled because they're tightly coupled. If the migration is too big as one PR, split when the brief is written.
2. **CCB ship persona symmetry** (from local-provider audit MINOR #6): does the CCB adapter need a ship-persona surface to mirror local? If yes, file as RFC issue.
3. **D4 lifecycle hooks** — not yet planned. Should it become a Phase 4.3 sub-track, or its own milestone? Decide when D2/D3 are mostly done.
4. **Phase 5 TODOs** (non-goals + trigger criteria) — parked in `phase-5-team-mode-plan.md`. Resolve before Phase 5 work starts.

---

## Session log

- **2026-05-04 evening through 2026-05-05 midday**: Phase 4.1 main wave (PRs #45/#47/#50/#51/#55/#56/#57/#58/#60). 9 PRs landed. 11 issues closed.
- **2026-05-05 ~midday**: 22 backlog issues filed (#69-#90) for cross-session visibility.
- **2026-05-05 evening**: D3 Phase 2 brief committed; #65 issued. PR #66 (D2 Phase 2.2) in flight.
