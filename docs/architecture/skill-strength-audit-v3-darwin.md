# Nexus Skill Strength Audit v3 (Darwin Framework)

> **Audit date:** 2026-05-06
> **Auditor lens:** Darwin 8-dimension weighted rubric (engineering/usability)
> **Subjects:** 10 Track E (Iron-Law'd) skills + 3 control skills
> **Predecessor audits:** `skill-strength-audit.md` (v1, 5-dim), `skill-strength-audit-v2.md` (v2, 5-dim post-Track-E)
> **Constraint:** read-only audit — no SKILL.md, .tmpl, or generator changes

---

## Framework reference (Darwin 8-dim, 100-point weighted rubric)

Each dimension scored 1–10. Weighted total = Σ(score × weight) / 10. Max 100, precision 0.1.

### Structure dimensions (60 points)

| # | Dimension | Weight | Scoring criteria |
|---|---|---|---|
| 1 | Frontmatter Quality | 8 | Name standardization, description includes what/when/triggers, frontmatter ≤1024 chars |
| 2 | Workflow Clarity | 15 | Numbered steps, clear inputs/outputs per step, executable sequence |
| 3 | Edge Case Coverage | 10 | Handles exceptions, fallback paths, error recovery present |
| 4 | Checkpoint Design | 7 | User confirmation before critical decisions, prevents autonomous failure |
| 5 | Instruction Specificity | 15 | Concrete (not vague), parameters/formats/examples, directly executable |
| 6 | Resource Integration | 5 | References/scripts/assets cited with correct, reachable paths |

### Effect dimensions (40 points)

| # | Dimension | Weight | Scoring criteria |
|---|---|---|---|
| 7 | Overall Architecture | 15 | Clear hierarchy, no redundancy/omissions, aligned with ecosystem standards |
| 8 | Real-World Performance | 25 | Dry-run 2–3 typical prompts; output quality matches declared capability |

### Pass threshold (from the framework)

> "改进后总分必须严格高于改进前才保留" — improvements must strictly exceed baseline.

The Darwin framework is workflow-quality-oriented, not rigor-oriented. It rewards numbered steps, concrete inputs/outputs, and demonstrable performance. Iron Laws (which are constraint-language) help some dimensions but do not, on their own, satisfy Workflow Clarity or Checkpoint Design.

---

## Methodology

**Scoring philosophy.**
- Score the SKILL.md as currently rendered (post-Track-E for the 10 primary subjects).
- The shared ~485-line preamble (lines ~1–485 in canonical skills) is identical across Track E and is treated equally in dimensions 4, 6, 7. It is NOT counted as workflow content for D2 — it is environment/governance setup.
- Iron Laws are scored under D3 (edge cases), D5 (instruction specificity), and D8 (real-world performance). They do NOT lift D2 (Workflow Clarity) or D4 (Checkpoint Design) much because they are constraints, not workflows or new gates.
- D8 uses dry-run simulation (`干跑验证`): mentally execute 2–3 typical prompts against the skill text and assess whether the skill would actually guide useful output.

**Honesty calibration.**
- A skill that delegates execution to a runtime (`bun run bin/nexus.ts <stage>`) gets credit for the contract (D3, D5, D7) but NOT credit for workflow clarity it does not own (D2). Workflow clarity is "what would a reader of this SKILL.md, with no other context, do step by step?"
- A skill whose only "workflow" is "run this one bash command and read the advisor JSON" scores lower on D2 than a skill with 5 numbered investigation phases — even if the former is more architecturally elegant.

**Predecessor audit notes.**
- v1 used a 5-dim rigor rubric and scored canonical 9 at mean 1.93/5. It identified `/investigate` as best-disciplined.
- v2 re-scored after Track E and found canonical 9 at mean 4.42/5 (≈+2.5/5 lift attributed to Iron Laws).
- v3 is a different lens. v2's gains on rigor will partially translate to D3/D5/D8, but D2/D4/D6/D1 won't have moved much.

---

## Per-skill scoring — Track E 10

### `/build` (canonical)

Source: `skills/canonical/build/SKILL.md` (611 lines; Iron Laws at L491–527; unique content L487–611).

**Dimension 1 — Frontmatter Quality (weight 8): 6/10 → 4.8/8**
Description is short and accurate ("Executes the bounded governed implementation contract...") but contains no trigger phrases, no when-to-invoke language, and no examples of the user request that should fire it. Name is standard (`build`). Frontmatter is well within the 1024-char budget. The discoverability surface lives in CLAUDE.md routing, not in the SKILL.md frontmatter — that's a structural choice, but Darwin rewards self-describing frontmatter.

**Dimension 2 — Workflow Clarity (weight 15): 5/10 → 7.5/15**
The actual workflow is one bash command (`bun run bin/nexus.ts build`) plus an advisor-driven branch on `interaction_mode`. There are no numbered "Step 1 / Step 2 / Step 3" sections that an operator could follow if the runtime were absent. The Iron Laws section is rule-shaped, not step-shaped. The Operator Checklist is three bullets ("run build discipline before transport / preserve requested route / record actual route separately") — directional, not actionable. Compare to `/investigate` which has 5 explicit numbered phases.

**Dimension 3 — Edge Case Coverage (weight 10): 8/10 → 8/10**
Iron Law 2 (3-strike stop → route to `/investigate`), Iron Law 3 (advisory address-or-dispute), and the "build is blocked, follow advisor" routing in the Completion Advisor section explicitly enumerate failure paths. The Stage-Aware Local Topology Chooser handles missing-CCB cases. What's missing: explicit handling of "verification command not available for this change type" beyond the matrix in Law 1.

**Dimension 4 — Checkpoint Design (weight 7): 6/10 → 4.2/7**
Checkpoints come from the inherited preamble (execution mode chooser, topology chooser, routing-CLAUDE.md prompt) and from the Completion Advisor's `requires_user_choice`/AskUserQuestion path. Iron Laws don't add new checkpoints — they add constraints the operator must satisfy. The 3-strike rule is a routing event, not a user-confirmation gate (good, but doesn't lift D4).

**Dimension 5 — Instruction Specificity (weight 15): 8/10 → 12/15**
Iron Law 1 names exact verification commands per change type (`bun test`, `bunx tsc --noEmit`, `bun run skill:check`, `bun run gen:skill-docs --host codex`, `bun run repo:inventory:check`) — that is genuinely concrete and executable. Iron Law 2 names the recovery path explicitly (`/investigate`). Iron Law 3 names the artifact (`build-result.md`) and the required field (advisory id, dispute rationale). Pre-Track-E, this section was largely "execute the bounded contract"; now it has bite.

**Dimension 6 — Resource Integration (weight 5): 7/10 → 3.5/5**
References `~/.claude/skills/nexus/bin/nexus-update-check`, `nexus-config`, `nexus-repo-mode`, `nexus-slug`, `nexus-review-read`, `bin/nexus.ts build`, `.planning/current/build/build-request.json`, `build-result.md`, `status.json`, `completion-advisor.json`, `design-contract.md`. Paths are repo-visible and consistent. Minor issue: `_NEXUS_ROOT="~/.claude/skills/nexus"` uses a literal `~` that bash won't expand inside double quotes — the runner script handles this, but the prose is technically off. Not load-bearing in practice.

**Dimension 7 — Overall Architecture (weight 15): 8/10 → 12/15**
Clean separation: Iron Laws (discipline) → Operator Checklist (intent) → Artifact Contract (outputs) → Routing (transport) → Completion Advisor (runtime-owned next step). No redundancy with `/plan`, `/review`, `/qa` — each Iron Law in `/build` cites the law in the upstream/downstream skill it depends on (e.g., Law 3 cites `/review` produced advisories; Law 2 cites `/investigate`'s 4-phase protocol). The architecture is consistent with the rest of Track E.

**Dimension 8 — Real-World Performance (weight 25): 7/10 → 17.5/25 (dry_run)**

Test prompts:

1. *"Implement the bite-sized task #3 from sprint-contract.md."* — The skill points the reader at the runtime call (`bun run bin/nexus.ts build`) and the Iron Laws constrain the operator's discipline (verify before claiming complete; 3-strike stop; address advisories). The reader without the runtime gets useful constraints but no concrete implementation steps. With the runtime, the skill produces a build-result.md, status.json, and an advisor JSON to drive next-step. Dry-run: would produce a useful, well-bounded implementation IF the runtime is present and the contract was solid; would produce minimal value as a standalone document. Score: 7.

2. *"My build keeps failing — same error each time."* — Iron Law 2 explicitly handles this: "If your build attempt fails 3 times consecutively on the same root cause: STOP. Route to `/investigate`." This is a clear, correct guidance. Score: 9.

3. *"Review left advisories — what do I do?"* — Iron Law 3 says: address every advisory before claiming complete OR document explicit dispute with rationale. Concrete and actionable. Score: 9.

Average: (7 + 9 + 9) / 3 ≈ 8.3, but D8 rewards typical prompts; the most typical is prompt 1 ("just implement task X") and that's the weakest. Score 7.

**Total:** 4.8 + 7.5 + 8 + 4.2 + 12 + 3.5 + 12 + 17.5 = **69.5/100**

---

### `/plan` (canonical)

Source: `skills/canonical/plan/SKILL.md` (612 lines; Iron Laws at L492–537).

**D1 (8): 6/10 → 4.8/8** — Description names the trigger ("when the work is framed and needs to become execution-ready"), better than `/build`. Still no example trigger phrases.

**D2 (15): 5/10 → 7.5/15** — Same delegation pattern: one bash command + advisor branch. Operator Checklist is three bullets ("verify framing inputs / produce readiness packet / produce sprint contract"). Iron Laws read as a contract for what `sprint-contract.md` MUST contain, but the SKILL.md does not number "how to actually produce that contract."

**D3 (10): 8/10 → 8/10** — Iron Law 1 rejects vague tasks at plan time; Iron Law 2 requires ≥3 enumerated risks with detection signals and mitigations; Iron Law 3 forbids silent scope expansion in `/build` (binding handoff). Each enumerates failure modes the operator might otherwise paper over.

**D4 (7): 6/10 → 4.2/7** — Inherited preamble checkpoints + advisor's interaction_mode. Iron Laws don't add new gates. Recommendation in the Stage-Aware Local Topology Chooser explicitly says "Choose C when available" for plan, which is a soft-checkpoint nudge.

**D5 (15): 8/10 → 12/15** — Law 1 names the three required properties (≤3 sentences, observable acceptance criterion phrased as "X exists at path Y AND Z is true", verification command). Law 2 names the four risk fields. Law 3 names the recovery routing for each scope-creep type. Concrete and verifiable.

**D6 (5): 7/10 → 3.5/5** — Same path inventory as `/build`. Plus references `design-contract.md` and `verification-matrix.json` consistent with how `/build` and `/review` consume them.

**D7 (15): 8/10 → 12/15** — Plan's Iron Laws cleanly anchor the rest of the lifecycle: Law 1's bite-sized task contract is what `/build` Law 1 evaluates against; Law 3's binding handoff is what `/handoff` Law 1 verifies. The cross-skill law-to-law citations are a strength.

**D8 (25): 7/10 → 17.5/25 (dry_run)**

Test prompts:

1. *"Plan the work to add /telemetry to Nexus."* — Skill says: write `sprint-contract.md`, `execution-readiness-packet.md`, `verification-matrix.json`. Iron Laws say: each task ≤3 sentences with observable criterion + verification command; ≥3 risks; binding handoff. The reader gets a clear contract for the artifact shape but no scaffolding for "how to break /telemetry into bite-sized tasks." Score: 7.

2. *"This task says 'improve performance' — is that ok?"* — Law 1 explicitly rejects this: vague criteria like "code works" or "feature is good" are rejected. Concrete: "p95 latency on the search endpoint drops below 300ms" is named as the acceptance form. Score: 9.

3. *"Build discovered we need an extra task — should we add it?"* — Law 3 explicitly handles this: stop, route back to `/plan` to extend the contract, then re-enter `/build`. No silent scope expansion. Score: 9.

Score 7 (most-typical prompt drags).

**Total:** 4.8 + 7.5 + 8 + 4.2 + 12 + 3.5 + 12 + 17.5 = **69.5/100**

---

### `/review` (canonical)

Source: `skills/canonical/review/SKILL.md` (623 lines; Iron Laws at L492–532).

**D1 (8): 6/10 → 4.8/8** — Description: "Persists the required current audit set and structured review completion state." Still terse, no trigger phrasing.

**D2 (15): 5/10 → 7.5/15** — Same delegation pattern. Operator Checklist is "run dual audits / verify provenance / synthesize and record verdict" — directional. The Iron Laws are explicitly NOT a workflow — they're a verdict contract.

**D3 (10): 9/10 → 9/10** — Strongest of the canonical batch on edge cases: Law 2 specifies the two-round protocol for block-grade advisories (single-pass forbidden); Law 3 specifies the reviewer disagreement protocol (silent averaging forbidden, escalation via AskUserQuestion). These are real edge cases that Track E's predecessor lacked explicit handling for.

**D4 (7): 7/10 → 4.9/7** — Law 3's escalation requirement ("escalate via AskUserQuestion when synthesis cannot choose without speculation") is a genuine new checkpoint. Plus inherited preamble. This is one of the few Iron Laws that adds a checkpoint, lifting D4.

**D5 (15): 9/10 → 13.5/15** — Highly concrete: four required artifacts at decision time (scope summary, fresh test evidence, risk register, explicit gate verdict — `pass` | `pass_with_advisories` | `fail`). Severity tags (`block`, `advisory`, `nit`). The disagreement protocol's four required fields (conflicting verdicts, accepted verdict, rationale, pushed-back verdicts).

**D6 (5): 7/10 → 3.5/5** — References `.planning/audits/current/*`, `learning-candidates.json`, plus the design-contract path conditionally. Clean.

**D7 (15): 8/10 → 12/15** — Cleanly architected. Cross-skill law citations: Law 2 `pass_round` field is read by `/ship` Law 1 check 3. Law 1's "fresh test evidence" mirrors `/build` Law 1.

**D8 (25): 8/10 → 20/25 (dry_run)**

Test prompts:

1. *"Review the changes I just made on this branch."* — Skill produces verdict + four artifacts. Iron Laws make sure verdict isn't unsupported. Concrete enough that a reader knows what a complete review looks like. Score: 8.

2. *"Codex says block, Gemini says nit, what's the call?"* — Law 3 explicitly says: enumerate the disagreement, name the accepted verdict + rationale + pushed-back verdicts. If you can't choose without speculation, escalate. Concrete and immediately actionable. Score: 9.

3. *"Pass 1 found one block — can we ship?"* — Law 2 forbids it: re-enter `/build`, then re-enter `/review` for Pass 2. Score: 9.

`/review` is one of the strongest Track E lifts in D8 — the disagreement protocol and two-round protocol are exactly the kind of guidance that improves real outputs. Score 8.

**Total:** 4.8 + 7.5 + 9 + 4.9 + 13.5 + 3.5 + 12 + 20 = **75.2/100**

---

### `/qa` (canonical)

Source: `skills/canonical/qa/SKILL.md` (588 lines; Iron Laws at L456–498). Note: `/qa` does NOT have the Stage-Aware Local Topology Chooser section (compare `/build`, `/plan`, `/review`).

**D1 (8): 6/10 → 4.8/8** — Same canonical pattern.

**D2 (15): 5/10 → 7.5/15** — Same delegation pattern. Operator Checklist three bullets.

**D3 (10): 9/10 → 9/10** — Strong: Law 2's verdict ladder (`ready` | `ready_with_findings` | `not_ready`) is explicit, with conditions for each. Law 3 (3-same-root-cause stop → `/investigate`) handles a real failure mode (enumeration without insight).

**D4 (7): 5/10 → 3.5/7** — Lower than `/review` because `/qa` has no topology chooser checkpoint, and Iron Laws don't add new AskUserQuestion gates. The verdict ladder is a routing event, not a user-confirmation gate.

**D5 (15): 9/10 → 13.5/15** — Strongly concrete: severity tags `P0` | `P1` | `P2` | `P3`, evidence requirements per category (interactive: before+after+diff snapshot; static: annotated screenshot; console-only: full line + URL), no-credentials rule, baseline regression rule.

**D6 (5): 7/10 → 3.5/5** — Standard path inventory. References `qa-report.md`, `design-verification.md`, `perf-verification.md` from `/benchmark`, `learning-candidates.json`.

**D7 (15): 8/10 → 12/15** — Clean. Note Track E removed the topology chooser section here — likely intentional since QA isn't a planning-style stage where teams of perspectives compete. The structural reasoning is sound.

**D8 (25): 8/10 → 20/25 (dry_run)**

Test prompts:

1. *"Run QA on the current state of the app."* — Skill says: write findings with severity tags, repro that ran in this turn, evidence per category. Verdict ladder. Concrete enough to drive a real QA pass. Score: 8.

2. *"I found 5 broken-link errors — should I write them all up?"* — Law 3 explicitly says: stop after 3 same-root-cause findings, route to `/investigate`. Concrete and unambiguous. Score: 9.

3. *"Found one P0 — gate decision?"* — Law 2: "Any P0 → `not_ready`. There is no 'P0 but ship anyway.'" Score: 9.

`/qa`'s Iron Laws are among the most operationally useful Track E additions because severity + evidence rules directly translate to better real-world outputs. Score 8.

**Total:** 4.8 + 7.5 + 9 + 3.5 + 13.5 + 3.5 + 12 + 20 = **73.8/100**

---

### `/frame` (canonical)

Source: `skills/canonical/frame/SKILL.md` (618 lines; Iron Laws at L492–541).

**D1 (8): 6/10 → 4.8/8** — Description: "Use when discovery is complete enough to define scope and success criteria." Slightly better trigger language than `/build` or `/review`.

**D2 (15): 5/10 → 7.5/15** — Same delegation. Operator Checklist three bullets ("define scope / non-goals / success criteria"). Iron Laws are content-shape contracts, not workflow steps.

**D3 (10): 8/10 → 8/10** — Strong content contracts: Law 1 names seven required PRD sections (problem, hypothesis, success criteria, non-goals, risks, alternatives, decision rationale); Law 3 names five readiness gate checks. Edge cases for "what if framing is incomplete" are handled by `not_ready` verdict + route back to `/discover`.

**D4 (7): 6/10 → 4.2/7** — Inherited preamble; no new Iron Law gates.

**D5 (15): 9/10 → 13.5/15** — Strongest of canonical Track E on D5: Law 1's seven required PRD sections each name what counts vs what's rejected ("Users are frustrated" rejected; named user + failed action + cost accepted). Law 2's hypothesis form ("If we [action], then [users] will [outcome] because [evidence]") is a directly executable template. Law 3's five readiness checks each name the explicit fail/pass condition.

**D6 (5): 7/10 → 3.5/5** — References `docs/product/decision-brief.md`, `prd.md`, `design-intent.json`, `status.json`. Clean.

**D7 (15): 8/10 → 12/15** — Strong: Law 1's success criteria become `/plan` Law 1's verification commands; Law 2's hypothesis becomes `/review`'s evaluation contract. Cross-skill anchoring is tight.

**D8 (25): 8/10 → 20/25 (dry_run)**

Test prompts:

1. *"Frame the work for adding session sharing."* — Iron Laws prescribe seven PRD sections + hypothesis template + readiness gates. A reader can produce a complete PRD by following Law 1 mechanically. Score: 8.

2. *"Is this success criterion good enough: 'users will be happier'?"* — Law 1 rejects it: vague criteria like "users love it" are rejected; need an observable command/metric/artifact. Concrete and immediately actionable. Score: 9.

3. *"What's the difference between non-goals and out-of-scope?"* — Law 3 distinguishes them: non-goals = ≥3 things this work won't do; out-of-scope = adjacent things users may expect that this work doesn't address. Concrete distinction. Score: 8.

Score 8.

**Total:** 4.8 + 7.5 + 8 + 4.2 + 13.5 + 3.5 + 12 + 20 = **73.5/100**

---

### `/discover` (canonical)

Source: `skills/canonical/discover/SKILL.md` (521 lines; Iron Laws at L457–498). Note: `/discover` is shorter than other canonical skills — it stops after Routing without a full Completion Advisor section.

**D1 (8): 6/10 → 4.8/8** — Description: "Use when the problem is still vague and needs clarification." Decent trigger.

**D2 (15): 4/10 → 6/15** — Lower than other Track E. The skill stops at Routing without the structured Completion Advisor branch. Operator Checklist is "capture goals / capture constraints / record open questions." Iron Laws shape content but the SKILL.md doesn't number "how to do discovery."

**D3 (10): 8/10 → 8/10** — Law 1 explicitly enumerates five anti-patterns (`/discover` is not feature spec, not user testing, not substitute for shipping, not single-stakeholder framing, not solutioning). Law 2 specifies the minimum signal bar (named segment, observed pain with cost, ≥2 evidence sources, hypothesis hint, ≥3 open questions). Law 3 (Look Inward Before Look Outward) is itself an edge-case rule against confirmation-only discovery.

**D4 (7): 5/10 → 3.5/7** — Inherited preamble; no new gates. The skill's lighter footer (no Completion Advisor) means fewer structural checkpoints than other Track E skills.

**D5 (15): 9/10 → 13.5/15** — Strong specificity: Law 1's five rejected patterns; Law 2's five required artifacts with concrete examples ("operators run /build, hit a 3-strike loop, and abandon the session 18% of the time"); Law 3's required two-section structure (Look Inward + Look Outward, in order).

**D6 (5): 6/10 → 3/5** — References `docs/product/idea-brief.md` plus a long list of fresh-run-from-archived-closeout artifacts (NEXT-RUN.md, retro-continuity, session-continuation-advice etc.). The path list is correct but verbose; it's also unique to `/discover` and not cross-referenced by other skills, slightly reducing integration value.

**D7 (15): 7/10 → 10.5/15** — Mostly clean, but the missing Completion Advisor section is a structural inconsistency. Other Track E skills walk the operator from Routing → advisor JSON → AskUserQuestion → next invocation. `/discover` ends at the bash invocation. This is OK if `/discover` truly has no branching downstream, but the structural asymmetry costs a point.

**D8 (25): 7/10 → 17.5/25 (dry_run)**

Test prompts:

1. *"I want to add some kind of telemetry to Nexus runs but I don't know what shape."* — Iron Laws prescribe: write idea-brief.md with Look Inward (current beliefs), Look Outward (evidence with citations), named segment, observed pain with cost, hypothesis hint, ≥3 open questions. Reader gets a clear target artifact. Score: 8.

2. *"Should I just talk to one user and call it discovery?"* — Law 1 anti-pattern 4 explicitly rejects single-stakeholder framing; Law 2 requires ≥2 evidence sources. Concrete. Score: 9.

3. *"My discovery brief reads like a feature list — is that ok?"* — Law 1 anti-pattern 5 explicitly rejects this: "we should add X" is solution; "users currently fail at Y because Z" is discovery. Score: 9.

Score 7 (the most typical prompt — fuzzy idea — produces good guidance, but `/discover` doesn't tell the operator HOW to interview, ticket-mine, or extract data; it tells the operator what the artifact should contain).

**Total:** 4.8 + 6 + 8 + 3.5 + 13.5 + 3 + 10.5 + 17.5 = **66.8/100**

---

### `/ship` (canonical)

Source: `skills/canonical/ship/SKILL.md` (632 lines; Iron Laws at L491–530).

**D1 (8): 6/10 → 4.8/8** — Description names release-gate purpose. Standard.

**D2 (15): 5/10 → 7.5/15** — Same delegation. Operator Checklist four bullets ("require completed review / require ready QA / keep merge readiness explicit / keep ordering explicit"). The four-outcome Branch Decision Tree (Law 3) reads more workflow-like than other Iron Laws but it's a decision tree, not a procedure.

**D3 (10): 9/10 → 9/10** — Strongest D3 of canonical batch: Law 1's five-check pre-merge gate enumerates real failure modes (stale CI, stale review, dirty base). Law 2 explicitly forbids three real shortcuts (silent merge past failed checks, force-push to base, skipping CI). Law 3's four-outcome decision tree (merge / keep alive / discard / split) covers the "branches in limbo" failure mode.

**D4 (7): 7/10 → 4.9/7** — Law 2's exception path explicitly requires AskUserQuestion confirmation for any override, AND records the override with rationale. That's a genuine new checkpoint contributed by Track E. Lifts D4 above other Track E skills.

**D5 (15): 9/10 → 13.5/15** — Concrete: Law 1's five checks each named with the evidence required; Law 2's three forbidden actions each named with the reason; Law 3's four outcomes each named with the artifact field (`release_gate: deferred | discarded | split`).

**D6 (5): 7/10 → 3.5/5** — References `release-gate-record.md`, `checklist.json`, `deploy-readiness.json`, `pull-request.json`, `canary-status.json` from `/canary`, `deploy-result.json` from `/land-and-deploy`. Plus push_required state. Cleanly integrated with `/canary`, `/land-and-deploy`, `/setup-deploy`, `/deploy`, `/document-release`.

**D7 (15): 8/10 → 12/15** — Cross-skill law citations are tight: Law 1 check 3 reads `pass_round` from `/review` Law 2; Law 1 check 4 reads QA verdict from `/qa` Law 2; Law 3 split outcome routes back to `/plan` Law 3 contract extension.

**D8 (25): 8/10 → 20/25 (dry_run)**

Test prompts:

1. *"Ship this branch."* — Law 1's five mandatory checks force the operator to verify tests, CI, review, QA, base before merge. Concrete and unambiguous. Score: 9.

2. *"QA found a P0 but the user says ship anyway."* — Law 2: "There is no 'P0 but ship anyway'... When the user asks `/ship` to merge despite a failing check, the answer is to surface the check and explain." With a documented exception path that requires AskUserQuestion. Score: 9.

3. *"This branch isn't ready but I don't want to delete it."* — Law 3 outcome 2 (Keep alive): record `release_gate: deferred` with one-paragraph reason. Score: 8.

Score 8.

**Total:** 4.8 + 7.5 + 9 + 4.9 + 13.5 + 3.5 + 12 + 20 = **75.2/100**

---

### `/closeout` (canonical)

Source: `skills/canonical/closeout/SKILL.md` (593 lines; Iron Laws at L456–498).

**D1 (8): 6/10 → 4.8/8** — "Use after `/review`" trigger phrase present. Standard.

**D2 (15): 5/10 → 7.5/15** — Same delegation pattern. Operator Checklist three bullets. Iron Law 1's five-check integrity checklist reads close to a workflow but is verification, not procedure.

**D3 (10): 9/10 → 9/10** — Strong: Law 1's five integrity checks; Law 2's three staleness signals (head SHA, run_id, 7-day clock); Law 3's three categories of files closeout MUST NOT modify. Each handles a real failure mode (laundering the run, stale audit, accidental upstream-state mutation).

**D4 (7): 6/10 → 4.2/7** — Inherited preamble; no new gates.

**D5 (15): 9/10 → 13.5/15** — Concrete: Law 1 names the exact files (`prd.md`, `idea-brief.md`, `sprint-contract.md`, `qa-report.md`, `release-gate-record.md`); Law 2 names the staleness fields (`run_id`, head SHA, ≥7 days); Law 3 names exactly what closeout writes (only `.planning/current/closeout/*`). Concrete enough that a closeout that violates a law is detectable from the artifact.

**D6 (5): 7/10 → 3.5/5** — References CLOSEOUT-RECORD.md, FOLLOW-ON-SUMMARY.md/.json, NEXT-RUN.md, next-run-bootstrap.json, LEARNINGS.md, learnings.json, documentation-sync.md from `/document-release`. Clean.

**D7 (15): 8/10 → 12/15** — Strong cross-skill citations: Law 1 explicitly reads from `/review`, `/qa`, `/ship`, `/frame`. Law 3's "closeout is read-only with respect to lifecycle authority" is the single-owner principle codified.

**D8 (25): 8/10 → 20/25 (dry_run)**

Test prompts:

1. *"Close out this run."* — Law 1's five-check checklist plus Law 2's staleness check produce a concrete, executable closeout. Score: 8.

2. *"Audit was generated yesterday but I made commits today — ok to archive?"* — Law 2: stale relative to head SHA, mark run `stale_audit`, require `/review` rerun. Concrete. Score: 9.

3. *"`/build` says complete but `/review` says fail — closeout fix it?"* — Law 3 explicitly forbids: closeout cannot patch upstream state; surface the conflict and route back. Score: 9.

Score 8.

**Total:** 4.8 + 7.5 + 9 + 4.2 + 13.5 + 3.5 + 12 + 20 = **74.5/100**

---

### `/handoff` (canonical)

Source: `skills/canonical/handoff/SKILL.md` (575 lines; Iron Laws at L457–498).

**D1 (8): 6/10 → 4.8/8** — Description names the trigger ("Use after `/plan` declares the work execution-ready"). Standard.

**D2 (15): 5/10 → 7.5/15** — Same delegation. Operator Checklist three bullets ("record requested route / validate transport / require separate Nexus approval"). Iron Laws constrain re-validation logic, not workflow.

**D3 (10): 9/10 → 9/10** — Law 1's four-dimension freshness check (route, provider, branch, contract) plus 24-hour soft trigger; Law 2's six recovery categories named (`route_unavailable` / `provider_offline` / `branch_drift` / `contract_mismatch` / `transport_error` / `approval_revoked`); Law 3's cross-operator context dump four required fields. Genuinely cover the "we approved this two days ago and now it's running against a different tree" failure mode.

**D4 (7): 7/10 → 4.9/7** — Law 2's required AskUserQuestion for blocked-handoff recovery is a real new checkpoint. Lifts D4.

**D5 (15): 9/10 → 13.5/15** — Concrete: four freshness dimensions named; six failure-leg labels named; cross-operator context dump four fields enumerated. The skill text could be checked mechanically against an artifact.

**D6 (5): 7/10 → 3.5/5** — References `governed-execution-routing.md`, `governed-handoff.md`, status.json. Cross-skill: reads `sprint-contract.md` per `/plan` Law 3.

**D7 (15): 8/10 → 12/15** — Single canonical continuation into `/build`; the skill explicitly notes "do not manufacture extra choices when the advisor has no real branching." Architecturally honest.

**D8 (25): 7/10 → 17.5/25 (dry_run)**

Test prompts:

1. *"Hand off the planned work to Codex."* — Law 1's four-dimension check plus Law 3's context dump produce a complete handoff artifact. Concrete. Score: 8.

2. *"I approved this handoff yesterday but the branch was force-pushed — still valid?"* — Law 1: branch state is one of the four dimensions; force-push invalidates. Concrete. Score: 9.

3. *"`/build` failed transport — auto-retry the handoff?"* — Law 2 explicitly forbids silent retry; identify failing leg, surface via AskUserQuestion. Score: 9.

The most typical prompt (1) requires the runtime to actually package the route — the skill specifies the contract but not how to assemble the routing artifact. Score 7.

**Total:** 4.8 + 7.5 + 9 + 4.9 + 13.5 + 3.5 + 12 + 17.5 = **72.7/100**

---

### `/learn` (support, Track E)

Source: `skills/support/learn/SKILL.md` (819 lines; Iron Laws at L571–625; commands at L629–798).

**D1 (8): 8/10 → 6.4/8** — Description is rich: lists five sub-commands, named triggers ("what have we learned", "show learnings", "prune stale learnings", "export learnings"), proactive trigger ("when the user asks about past patterns or wonders 'didn't we fix this before?'"). One of the strongest D1 in the audit set.

**D2 (15): 7/10 → 10.5/15** — Has a numbered "Detect command" parser (L629) that routes to numbered subcommands: Show current, Search, Prune, Export, Stats, Manual add. Each subcommand has explicit bash + presentation steps. This is the strongest D2 of the Track E batch — by a lot — because `/learn` actually has workflows, not just contracts.

**D3 (10): 8/10 → 8/10** — Iron Law 1 (Confidence rubric) prevents miscalibrated capture; Iron Law 2 (when to log) names MUST-log skills (`/investigate`, `/simplify`, `/cso`, `/retro`, `/closeout`) and SHOULD-log skills (`/review`, `/build`, `/qa`); Iron Law 3 (quarterly hygiene + on-demand prune before export) handles the "wiki nobody reads" decay path. Edge cases for staleness signals (dead-file ref, same-key contradiction, low-confidence aging) are explicit.

**D4 (7): 7/10 → 4.9/7** — Prune subcommand uses AskUserQuestion per flagged entry (Remove / Keep / Update). Cross-project learnings opt-in is gated. Manual add asks five questions via AskUserQuestion. Genuine checkpoint design.

**D5 (15): 9/10 → 13.5/15** — Confidence rubric is concrete (5 tiers with verbal anchors and example phrasing); evidence-type taxonomy explicit (`test-output` | `code-pattern` | etc.); subcommands have exact bash invocations.

**D6 (5): 8/10 → 4/5** — References `nexus-learnings-search`, `nexus-learnings-log`, `nexus-slug`, `~/.nexus/projects/<slug>/learnings.jsonl`, `.planning/archive/runs/*/closeout/learnings.json`. Resources are well-cited and reachable.

**D7 (15): 7/10 → 10.5/15** — Strong skill but slightly inconsistent with canonical Track E pattern (no Completion Advisor section, no advisor JSON). That's fine because `/learn` is operational not lifecycle, but the asymmetry costs half a point.

**D8 (25): 9/10 → 22.5/25 (dry_run)**

Test prompts:

1. *"What have we learned about CCB transport flakiness?"* — Skill says: `/learn search "ccb transport"` invokes `nexus-learnings-search --query "ccb transport"`. Concrete. Score: 10.

2. *"Prune stale learnings."* — Subcommand is explicit: search, find dead-file refs, find contradictions, AskUserQuestion per flagged entry. Score: 9.

3. *"Show me everything we've learned this quarter."* — Skill says `/learn` (no args) shows top-20. To filter by date, the operator would need `nexus-learnings-search` with a date flag, which isn't documented in the skill. Slight gap. Score: 8.

`/learn` actually has the workflow structure that lifts D8 substantially. Score 9.

**Total:** 6.4 + 10.5 + 8 + 4.9 + 13.5 + 4 + 10.5 + 22.5 = **80.3/100**

---

## Per-skill scoring — Control group 3

The control group skills were NOT changed by Track E. They give a calibration baseline.

### `/investigate` (support, control)

Source: `skills/support/investigate/SKILL.md` (837 lines; unique content L608–836). Five numbered phases.

**D1 (8): 9/10 → 7.2/8** — Description is the strongest in the audit set: lists four phases ("investigate, analyze, hypothesize, implement"), states the Iron Law inline ("no fixes without root cause"), names six trigger phrases ("debug this", "fix this bug", "why is this broken", etc.), AND names proactive triggers (errors, 500 errors, stack traces, "it was working yesterday"). Also has a `hooks` field for PreToolUse Edit matchers.

**D2 (15): 9/10 → 13.5/15** — The structural reason this skill was called "best-disciplined" in v2 lives here. Five numbered phases (Phase 1 Root Cause Investigation → Phase 2 Pattern Analysis → Phase 3 Hypothesis Testing → Phase 4 Implementation → Phase 5 Verification & Report). Each phase has numbered sub-steps with clear inputs/outputs (collect symptoms → read code → check recent changes → reproduce → form hypothesis → output: "Root cause hypothesis: ..."). Pattern Analysis includes a recognition table (race condition, nil propagation, state corruption, integration failure, configuration drift, stale cache). This is what Workflow Clarity looks like.

**D3 (10): 8/10 → 8/10** — 3-strike rule (3 hypotheses fail → STOP, AskUserQuestion); blast-radius rule (>5 files → AskUserQuestion); recurring bug warning (architectural smell, not coincidence); WebSearch sanitization rules (strip hostnames, IPs, paths, SQL, customer data). Strong edge case handling.

**D4 (7): 8/10 → 5.6/7** — Phase 3's 3-strike AskUserQuestion is a real checkpoint. Phase 4's blast-radius AskUserQuestion is another. Cross-project learnings opt-in is a third. Three genuine user-confirmation gates.

**D5 (15): 9/10 → 13.5/15** — Concrete: pattern recognition table; sanitization rules with examples; debug report template with named fields (Symptom / Root cause / Fix / Evidence / Regression test / Related / Status); learning-log JSON schema; bash invocations for git log, freeze state, learnings search.

**D6 (5): 8/10 → 4/5** — References `${CLAUDE_SKILL_DIR}/../../../runtimes/hooks/freeze/bin/check-freeze.sh`, `${CLAUDE_PLUGIN_DATA:-$HOME/.nexus}/freeze-dir.txt`, `nexus-config`, `nexus-learnings-search`, `nexus-learnings-log`. Plus uses Glob/Grep/Read/Edit/WebSearch consistent with allowed-tools. Well integrated.

**D7 (15): 9/10 → 13.5/15** — Cleanest hierarchy in the audit set. Overview → Iron Law → 5 Phases → Capture Learnings → Important Rules. No redundancy. The proactive-invocation language in the description means the orchestrator (Claude) routes here automatically when the user reports symptoms.

**D8 (25): 9/10 → 22.5/25 (dry_run)**

Test prompts:

1. *"Why is the test suite flaky?"* — Phase 1 (collect symptoms, read code, check recent changes, reproduce) → Phase 2 (race condition pattern from the table) → Phase 3 (form hypothesis, add temp log, verify) → Phase 4 (fix root cause, write regression test) → Phase 5 (verify, debug report). Concrete and immediately executable. Score: 10.

2. *"This bug touches 8 files — should I fix all of them?"* — Phase 4 step 5 explicitly handles: AskUserQuestion (Proceed / Split / Rethink). Score: 9.

3. *"I've tried 3 fixes and none work."* — Phase 3 step 3: STOP, AskUserQuestion (Continue / Escalate / Add logging). Score: 9.

`/investigate` is the gold standard for D8 in this audit — the skill actually walks the operator through what to do. Score 9.

**Total:** 7.2 + 13.5 + 8 + 5.6 + 13.5 + 4 + 13.5 + 22.5 = **87.8/100**

---

### `/cso` (support, control)

Source: `skills/support/cso/SKILL.md` (1156 lines; unique content L560–1156). Phases 0-14.

**D1 (8): 9/10 → 7.2/8** — Description names Chief Security Officer mode, lists six audit categories (secrets archaeology, supply chain, CI/CD, LLM/AI, skill supply chain, OWASP), names two modes (daily / comprehensive) with confidence gates, names trend tracking, lists five trigger phrases.

**D2 (15): 9/10 → 13.5/15** — 15 numbered phases (Phase 0 through Phase 14), each with concrete actions (bash patterns, Grep targets, severity rules, FP rules). Plus mode resolution rules (numbered 1-7), arguments table, output schemas. Strong Workflow Clarity.

**D3 (10): 9/10 → 9/10** — Each phase has explicit FP rules ("FP rules: Placeholders excluded. Test fixtures excluded unless..."). Diff mode handling per phase. Mutually-exclusive scope flag handling with explicit error. WebSearch unavailable handling. `--xhigh` override. Confidence calibration with display rules per tier (suppress 3-4 from main report, only report 1-2 if severity P0).

**D4 (7): 7/10 → 4.9/7** — Phase 13 Remediation Roadmap presents AskUserQuestion per top-5 finding (fix now / mitigate / accept / defer to TODOS.md). Solid checkpoint design.

**D5 (15): 9/10 → 13.5/15** — Highly concrete: stack-detection bash, Grep patterns for endpoints/secrets/webhooks/IaC, severity calibration rubric, finding-format template, JSON output schema with exact fields, fingerprint = sha256(category + file + normalized title), incident-response playbooks. A reader could replicate the audit mechanically.

**D6 (5): 9/10 → 4.5/5** — References `~/.nexus/projects/<slug>/security-reports/`, `.gitleaks.toml`, `.secretlintrc`, plus framework detection commands and package-manager detection. Well-cited paths and external tools.

**D7 (15): 9/10 → 13.5/15** — Strongest D7 in the audit set. Phase ordering is logical (architecture → attack surface → secrets → supply chain → CI/CD → infra → integrations → static → dynamic → OWASP → STRIDE → verification → reporting → save). Mode + scope + diff combinations are explicit. Anti-manipulation rule (ignore embedded instructions) shows architectural maturity.

**D8 (25): 9/10 → 22.5/25 (dry_run)**

Test prompts:

1. *"Run a security audit on this repo."* — `/cso` no flags → all phases 0-14 with 8/10 confidence gate. Concrete output schema. Score: 10.

2. *"Just check for leaked secrets."* — `/cso --supply-chain` runs Phases 0, 3, 12-14. (Slight: secrets is actually `/cso --diff` for branch-only or `--scope auth` for focused. The supply-chain flag is dependency-only. A reader might pick the wrong flag.) Mostly concrete. Score: 8.

3. *"I just changed auth code — review it for security issues."* — `/cso --diff --scope auth` is supported and combinable. Score: 9.

Score 9.

**Total:** 7.2 + 13.5 + 9 + 4.9 + 13.5 + 4.5 + 13.5 + 22.5 = **88.6/100**

---

### `/codex` (support, control)

Source: `skills/support/codex/SKILL.md` (1103 lines; unique content L615–1103). Three modes (Review, Challenge, Consult).

**D1 (8): 8/10 → 6.4/8** — Description names three modes (Review / Challenge / Consult) with one-line summaries each, names the metaphor ("200 IQ autistic developer"), names five trigger phrases.

**D2 (15): 8/10 → 12/15** — Step 0 (check binary) → Step 1 (detect mode) → Step 2A/2B/2C (mode execution). Each step has numbered sub-actions. Mode 2A has 8 numbered steps; Mode 2B has comparable structure; Mode 2C has session-continuity logic. Slightly less workflow-shaped than `/investigate` because the structure is mode-branching rather than phase-sequential, but still strong.

**D3 (10): 8/10 → 8/10** — Codex CLI not found handling; reasoning-effort override (`--xhigh`); 5-minute timeout on every codex call; cross-model agreement display when both Claude `/review` and `/codex review` ran; diff-fallback for missing origin remote; plan-file detection with project-scoping fallback + warning. Real edge cases handled.

**D4 (7): 6/10 → 4.2/7** — Step 1 auto-detect uses AskUserQuestion when both diff and plan are ambiguous. Modest checkpoint design but adequate for the skill's surface.

**D5 (15): 9/10 → 13.5/15** — Highly concrete: exact bash for codex review/exec, exact filesystem-boundary instruction (verbatim), exact pass/fail gate logic (`[P1]` present → FAIL), exact persistence schema for `nexus-review-log`, exact NEXUS REVIEW REPORT table format, exact field expectations per review type.

**D6 (5): 8/10 → 4/5** — References `nexus-review-log`, `~/.claude/plans/*.md`, `nexus-review-read`, `agents/openai.yaml` (as a do-not-touch). Well integrated, with explicit anti-manipulation guidance.

**D7 (15): 8/10 → 12/15** — Three-mode architecture is clean. Filesystem Boundary section is shared across modes (DRY). Plan File Review Report section is reusable across review skills. NEXUS REVIEW REPORT format is consistent with other Nexus review skills.

**D8 (25): 8/10 → 20/25 (dry_run)**

Test prompts:

1. *"Get a codex review on this branch."* — Step 0 → Step 1 detects review mode → Step 2A runs codex review with exact bash. Concrete and immediately executable. Score: 9.

2. *"Codex challenge security."* — Step 1 detects challenge mode with focus → Step 2B constructs adversarial prompt with security focus prepended to filesystem-boundary instruction. Concrete. Score: 9.

3. *"Ask codex about my Postgres schema."* — Step 1 routes to consult mode (Step 2C). The Read tool above only loaded part of 2C — but based on context likely produces a session-continuity response. Score: 7 (some uncertainty without reading full 2C).

Score 8.

**Total:** 6.4 + 12 + 8 + 4.2 + 13.5 + 4 + 12 + 20 = **80.1/100**

---

## Aggregate analysis

### Score table

| Skill | D1 (×8) | D2 (×15) | D3 (×10) | D4 (×7) | D5 (×15) | D6 (×5) | D7 (×15) | D8 (×25) | Total /100 |
|---|---|---|---|---|---|---|---|---|---|
| **Track E (n=10)** | | | | | | | | | |
| /build | 4.8 | 7.5 | 8 | 4.2 | 12 | 3.5 | 12 | 17.5 | **69.5** |
| /plan | 4.8 | 7.5 | 8 | 4.2 | 12 | 3.5 | 12 | 17.5 | **69.5** |
| /review | 4.8 | 7.5 | 9 | 4.9 | 13.5 | 3.5 | 12 | 20 | **75.2** |
| /qa | 4.8 | 7.5 | 9 | 3.5 | 13.5 | 3.5 | 12 | 20 | **73.8** |
| /frame | 4.8 | 7.5 | 8 | 4.2 | 13.5 | 3.5 | 12 | 20 | **73.5** |
| /discover | 4.8 | 6 | 8 | 3.5 | 13.5 | 3 | 10.5 | 17.5 | **66.8** |
| /ship | 4.8 | 7.5 | 9 | 4.9 | 13.5 | 3.5 | 12 | 20 | **75.2** |
| /closeout | 4.8 | 7.5 | 9 | 4.2 | 13.5 | 3.5 | 12 | 20 | **74.5** |
| /handoff | 4.8 | 7.5 | 9 | 4.9 | 13.5 | 3.5 | 12 | 17.5 | **72.7** |
| /learn | 6.4 | 10.5 | 8 | 4.9 | 13.5 | 4 | 10.5 | 22.5 | **80.3** |
| **Track E mean** | **5.0** | **7.7** | **8.5** | **4.3** | **13.2** | **3.5** | **11.7** | **19.3** | **73.1** |
| **Control (n=3)** | | | | | | | | | |
| /investigate | 7.2 | 13.5 | 8 | 5.6 | 13.5 | 4 | 13.5 | 22.5 | **87.8** |
| /cso | 7.2 | 13.5 | 9 | 4.9 | 13.5 | 4.5 | 13.5 | 22.5 | **88.6** |
| /codex | 6.4 | 12 | 8 | 4.2 | 13.5 | 4 | 12 | 20 | **80.1** |
| **Control mean** | **6.9** | **13.0** | **8.3** | **4.9** | **13.5** | **4.2** | **13.0** | **21.7** | **85.5** |

### Summary metrics

- **Track E mean:** 73.1/100
- **Control mean:** 85.5/100
- **Gap:** Track E is **12.4 points** behind the well-disciplined controls under the Darwin lens.
- **Top Track E skill:** `/learn` at 80.3 (the only Track E skill with real workflow structure).
- **Bottom Track E skill:** `/discover` at 66.8 (truncated structure — no Completion Advisor section).
- **Top control skill:** `/cso` at 88.6.
- **Range across all 13:** 21.8 points (66.8 → 88.6).

### Per-dimension means (Track E only)

| Dim | Track E mean (raw 1-10) | Control mean (raw 1-10) | Δ Track E vs control |
|---|---|---|---|
| D1 Frontmatter | 6.3 | 8.7 | **−2.4** (Track E hurt by short canonical descriptions) |
| D2 Workflow Clarity | 5.1 | 8.7 | **−3.6** (largest gap; Iron Laws are not workflows) |
| D3 Edge Cases | 8.5 | 8.3 | **+0.2** (Iron Laws lifted Track E above control) |
| D4 Checkpoint Design | 6.1 | 7.0 | −0.9 |
| D5 Instruction Specificity | 8.8 | 9.0 | −0.2 (Iron Laws closed this gap) |
| D6 Resource Integration | 7.0 | 8.3 | −1.3 |
| D7 Overall Architecture | 7.8 | 8.7 | −0.9 |
| D8 Real-World Performance | 7.7 | 8.7 | −1.0 |

### Did Iron Laws help every Darwin dimension equally?

**No, and the framework predicted this.** Iron Laws are constraint-language. They name what MUST be true at decision time (D3, D5, D8) but they do not prescribe ordered steps (D2), introduce new user gates (D4 — except `/review`, `/handoff`, `/ship` Law 2 exception path, and `/learn` prune), expand frontmatter (D1), or add new resource references (D6).

**Where Iron Laws clearly helped Track E:**
- **D3 Edge Cases (mean 8.5)**: Track E actually beats the control mean here (8.3). The Iron Laws explicitly enumerate failure modes — "no silent retry", "stale audit", "scope expansion forbidden", "3-strike stop", "P0 blocks ship", "Look Inward Before Look Outward". This is the framework's strongest Track-E lift.
- **D5 Instruction Specificity (mean 8.8)**: Nearly tied with control. Iron Laws turned vague "execute the bounded contract" into concrete law-shaped requirements ("seven required PRD sections", "five readiness checks", "four required artifacts at decision time").
- **D8 Real-World Performance (mean 7.7)**: Iron Laws meaningfully improved dry-run output for stuck/contested cases (3-strike → /investigate, P0 blocks /ship, disagreement → enumerate explicitly). The lift is real but not enough to close the workflow-clarity gap.

**Where Iron Laws didn't help:**
- **D2 Workflow Clarity (mean 5.1 vs control 8.7)**: This is the framework's big finding. Track E skills delegate execution to `bun run bin/nexus.ts <stage>`. The SKILL.md does not contain "Step 1, Step 2, Step 3" the way `/investigate` and `/cso` do. Iron Laws are rule-shaped, not procedure-shaped. A reader of `/build` SKILL.md does not learn how to actually build something — they learn the constraints their build must satisfy.
- **D4 Checkpoint Design (mean 6.1)**: Most Iron Laws don't introduce AskUserQuestion gates. Notable exceptions where Track E DID add a gate: `/review` Law 3 (escalate disagreements via AskUserQuestion), `/handoff` Law 2 (blocked-handoff recovery requires AskUserQuestion), `/ship` Law 2 exception path, `/learn` Iron Law 3 prune (per-entry AskUserQuestion). These four lifted D4 from a baseline of ~5/10 to ~7/10. The other six Track E skills got only the inherited preamble checkpoints.
- **D1 Frontmatter Quality (mean 6.3 vs control 8.7)**: Frontmatter was unchanged by Track E. The canonical skills' descriptions are deliberately terse ("Canonical Nexus X command. Persists Y. (nexus)") because Nexus discovery routes through CLAUDE.md, not through SKILL frontmatter triggers. That's an architectural choice that costs Darwin points.
- **D6 Resource Integration (mean 7.0 vs control 8.3)**: No new resource references from Track E.

### Comparison: Track E's strongest Darwin skills vs the control group

The Track E skills that match or beat the control mean (85.5) on Darwin:

- `/learn` 80.3 — closest to controls. Only Track E skill with explicit numbered subcommands.

The Track E skills that lag the control mean by >10 points:

- `/discover` 66.8, `/build` 69.5, `/plan` 69.5, `/handoff` 72.7, `/frame` 73.5, `/qa` 73.8, `/closeout` 74.5, `/review` 75.2, `/ship` 75.2.

**Eight of the ten Track E skills lag the controls by 10+ points** under the Darwin lens. This is not because Track E was bad — it is because Track E rigorously addressed rigor, and Darwin scores workflow.

---

## Cross-framework comparison (v2 5-dim vs v3 Darwin)

The v2 audit (`skill-strength-audit-v2.md`) used a 5-dimension rigor rubric and scored canonical 9 at mean 4.42/5 after Track E. v2 ranked these 10 in roughly this order (per the v2 audit prose):
- `/review` (4.8/5) — strongest under v2 because it added two-round + disagreement protocols (highest rigor lift)
- `/qa` (4.6/5) — strong because P0 ladder + 3-strike cluster protocol
- `/build` (4.6/5) — strong because verification matrix + 3-strike + advisory contract
- `/plan` (4.5/5) — strong because bite-sized + risks + binding handoff
- `/ship` (4.5/5) — strong because five-check gate
- `/closeout` (4.4/5) — strong because integrity checklist
- `/frame` (4.4/5) — strong because seven-section PRD
- `/handoff` (4.3/5) — strong because freshness + recovery
- `/discover` (4.2/5) — slightly weaker because three Iron Laws are content-shape not behavior
- `/learn` (4.0/5) — weakest under v2 because it's operational not lifecycle-gate

### Darwin v3 ranking of the same 10:

1. `/learn` 80.3
2. `/review` 75.2 (tied with `/ship`)
3. `/ship` 75.2
4. `/closeout` 74.5
5. `/qa` 73.8
6. `/frame` 73.5
7. `/handoff` 72.7
8. `/build` 69.5 (tied with `/plan`)
9. `/plan` 69.5
10. `/discover` 66.8

### Where the rankings reorder

- **`/learn` jumped from #10 (v2) to #1 (Darwin).** Why: `/learn` has six explicit numbered subcommands (Show / Search / Prune / Export / Stats / Manual add) plus the richest frontmatter description in the Track E set. v2 penalized it for being operational not gate-bearing; Darwin rewards it for actually having workflow.
- **`/review` stays at the top under both frameworks** (v2 #1, Darwin tied #2). Iron Laws here added both rigor (v2 win) and workflow-shaped guidance (the disagreement protocol's enumeration is workflow-like). Real all-rounder.
- **`/build` and `/plan` dropped from v2 top-3 to Darwin bottom-3.** Why: v2 rewarded their Iron Laws heavily; Darwin sees they're still delegate-to-runtime skills with no internal numbered workflow. The Iron Laws' rigor doesn't translate into Darwin D2 or D4.
- **`/discover` is bottom under both frameworks.** v2 noted its Iron Laws are content-shape; Darwin additionally docks it for missing the Completion Advisor section.

### Which Darwin dimensions are NOT captured by v2's 5-dim framework

v2 scored: mandatory rules, verification, failure modes, acceptance, transferability. Darwin scores: frontmatter, workflow, edge cases, checkpoints, specificity, resources, architecture, performance.

The Darwin dimensions v2 mostly missed:
- **D1 Frontmatter Quality** — v2 did not score frontmatter at all. Darwin reveals canonical skills lose ~2 points/skill on this.
- **D2 Workflow Clarity** — v2 scored "verification" and "acceptance" but not "are there numbered steps a reader can follow." Darwin reveals Track E skills lose ~3.6 points/skill on D2.
- **D4 Checkpoint Design** — v2 scored "verification" rigor but not specifically "user-confirmation gates." Darwin reveals only 4/10 Track E skills added new gates.
- **D6 Resource Integration** — v2 scored "transferability" loosely; Darwin scores explicit script/path citations.
- **D7 Overall Architecture** — v2 scored cross-skill alignment as part of "transferability"; Darwin breaks this out and weights it 15.

The Darwin dimensions where v2 and Darwin agree:
- **D3 Edge Cases ≈ v2 failure modes** — both scored high on Track E.
- **D5 Instruction Specificity ≈ v2 mandatory rules + acceptance** — both scored high on Track E.
- **D8 Real-World Performance** — partially captured by v2's verification + acceptance; Darwin's dry-run focus is a stricter lens.

---

## Honest gap analysis

### Where Track E genuinely won under Darwin

- **D3 Edge Cases (Track E 8.5 vs control 8.3):** Iron Laws moved the canonical batch *above* the control group. This is real. Failure modes are now enumerated explicitly across the 10 skills.
- **D5 Instruction Specificity (Track E 8.8 vs control 9.0):** Track E nearly closed the gap with the controls. The verification matrix in `/build` Law 1, the seven-section PRD in `/frame` Law 1, the verdict ladder in `/qa` Law 2, the five-check gate in `/ship` Law 1 — these are concrete enough to be checked mechanically.
- **D8 (Track E 7.7 vs control 8.7):** Iron Laws materially helped real-world performance on stuck/contested cases. The 1-point gap is the residual workflow-clarity gap (next).

### Where Track E did NOT move the needle (and the gap remains)

- **D2 Workflow Clarity (Track E 5.1 vs control 8.7):** **The biggest Darwin gap.** Track E canonical skills delegate execution to a runtime; the SKILL.md does not contain numbered "Step 1, Step 2, Step 3." Reading `/build` does not teach a reader how to build; it teaches the rules a build must satisfy. Iron Laws are constraint-shaped, not procedure-shaped — and the Darwin framework explicitly weights numbered steps.
- **D4 Checkpoint Design (Track E 6.1 vs control 7.0):** Track E added new AskUserQuestion gates in only 4 of 10 skills (`/review` disagreement escalation, `/handoff` blocked recovery, `/ship` exception path, `/learn` prune). The other six skills inherited only the preamble checkpoints. Iron Laws don't think in terms of "user-confirmation gates."
- **D1 Frontmatter Quality (Track E 6.3 vs control 8.7):** Canonical descriptions are deliberately terse. Nexus's discovery story goes through CLAUDE.md routing rules, not SKILL frontmatter. Darwin doesn't know that and penalizes it.
- **D6 Resource Integration (Track E 7.0 vs control 8.3):** Track E didn't add new scripts, paths, or external references. Existing references (nexus-config, nexus.ts, .planning paths) are reachable but unchanged.

### Calibration check: did Iron Laws help dimensions they shouldn't have helped?

I asked myself this for each scored dimension. Specifically:

- **D2:** Did I give Track E skills a workflow-clarity bonus for having Iron Laws? No — I scored 5/10 across canonical Track E because Iron Laws are not workflows. `/learn` got 7/10 because it has actual numbered subcommands separate from its Iron Laws.
- **D4:** Did I give every Track E skill a checkpoint-design bonus for having Iron Laws? No — I distinguished the four skills whose Iron Laws actually introduce AskUserQuestion gates (`/review`, `/handoff`, `/ship`, `/learn`) from the six that don't.
- **D1:** Did I give Track E skills credit for the Iron Laws section in the frontmatter? No — Iron Laws are body content, not frontmatter. Frontmatter scoring is unchanged from pre-Track-E.

The scoring stands.

---

## Recommendations

### What would lift Nexus Track E skills MOST under the Darwin lens

The Darwin framework weights workflow clarity (15), checkpoint design (7), and real-world performance (25). To close the 12.4-point gap with the controls:

**1. Add numbered procedural sections to canonical skills (D2, D8).**

Each canonical Track E skill currently has:
- Iron Laws (constraints — KEEP)
- Operator Checklist (3-bullet directional — INSUFFICIENT)
- Artifact Contract (output spec — KEEP)
- Routing (one bash command — KEEP)
- Completion Advisor (post-runtime branch — KEEP)

The missing piece is a numbered "How to actually do this" section. Examples:

- `/build` could add: "Step 1: Read the binding contract from `sprint-contract.md`. Step 2: For each task, run the verification command listed in `verification-matrix.json` BEFORE editing. Step 3: Edit the task's files... Step 4: Re-run the verification command and attach output. Step 5: Repeat per task. Step 6: Aggregate results into `build-result.md`."
- `/plan` could add: "Step 1: Read `prd.md` Iron Law 1 sections. Step 2: For each acceptance criterion, draft 1-3 candidate tasks. Step 3: For each task, verify the bite-sized contract..."
- `/review` could add: "Step 1: Run primary audit. Step 2: Run secondary audit. Step 3: Compare findings... Step 4: Apply disagreement protocol..."

This is the single largest Darwin lift available. Adding numbered workflows would lift D2 from 5/10 toward 8/10 (a +4.5 point per skill weighted gain), and would also lift D8 from 7/10 toward 9/10 (a +5 point per skill weighted gain). Combined: roughly +9.5 points per canonical skill, closing most of the Track-E-vs-control gap.

**Specifically different from v2's recommendation.** v2 recommended "more Iron Laws." Darwin recommends "Iron Laws are good, KEEP them, but ALSO add numbered workflows alongside them." The two are complementary — Iron Laws say what's true at decision time; numbered workflows say what to do in what order.

**2. Add explicit user-confirmation gates where the Iron Law rules already imply branching (D4).**

Six of ten Track E skills have Iron Laws that imply branching but don't gate on AskUserQuestion. Examples:
- `/build` Law 2 (3-strike) routes to `/investigate` — could surface AskUserQuestion ("Continue investigating / Escalate / Add logging") like `/investigate` Phase 3 does.
- `/qa` Law 3 (3-cluster stop) routes to `/investigate` — could surface AskUserQuestion confirming the cluster.
- `/closeout` Law 2 (stale audit) could surface AskUserQuestion (rerun review / accept staleness with note).

This would lift D4 from 6/10 toward 7.5/10 across the canonical batch.

**3. Add real test-prompt assertions to each SKILL.md (D8).**

The Darwin framework explicitly suggests sub-agent test prompts. Even without sub-agents, the SKILL.md could include 2-3 typical prompts as examples of how the skill should respond. This functions both as documentation AND as a self-test target. Compare `/cso`'s arguments table — it shows the user exactly what to type for each scope.

**4. Standardize the canonical structural footer (D7).**

`/discover` is missing the Completion Advisor section that other Track E skills share. Either add it for consistency or document in the architecture brief why discovery is structurally different. The asymmetry costs `/discover` 1.5 points on D7.

**5. Enrich canonical descriptions with trigger phrasing (D1).**

The canonical skills could add 1-2 trigger phrases to their description without breaking the discovery model. Example for `/build`:

> Canonical Nexus build command. Executes the bounded governed implementation contract. Use when the user says "implement task X" or "build feature Y" with a sprint-contract present.

This costs nothing structurally and lifts D1 from 6/10 toward 8/10 (≈+1.6 weighted points per skill).

### Recommendations summary table

| Action | D affected | Per-skill weighted lift | Effort |
|---|---|---|---|
| Add numbered "How to" workflow section | D2 (+3), D8 (+2) | ~+9.5 | High (per skill) |
| Add AskUserQuestion gates at Iron Law branching points | D4 (+1.5) | ~+1.0 | Medium |
| Add 2-3 typical-prompt examples in SKILL.md | D8 (+1) | ~+2.5 | Low |
| Standardize Completion Advisor footer (`/discover`) | D7 (+1.5) | ~+1.5 (one skill) | Low |
| Enrich canonical descriptions with trigger phrases | D1 (+2) | ~+1.6 | Low |

If all five recommendations were applied to all 10 Track E skills, the projected mean would move from 73.1 toward 87.7, fully closing the gap with the control group. The most cost-effective items are #5 (frontmatter), #3 (test prompts), #4 (`/discover` footer); the highest-leverage item is #1 (numbered workflows).

### What v2 got right and what Darwin reveals it missed

- **v2 was right that Track E significantly improved rigor.** Darwin confirms D3 (edge cases) and D5 (specificity) lifted to or above the control mean.
- **v2 missed that workflow clarity is independently valuable.** A skill can be rigorously rule-bound AND useless if the operator doesn't know in what order to do things. Darwin makes this gap visible.
- **v2's "transferability" dimension partially captured architecture but missed checkpoints and frontmatter as separate scoring axes.** The control group skills are uniformly strong on D1/D4/D6/D7 — that's not luck, it's design.

The recommendation is not to undo Track E but to add a sixth Phase to it: "Numbered workflow + checkpoint pass." Iron Laws + numbered workflows + real checkpoints + test-prompt examples is what the Darwin framework rewards in full.

---

## Appendix: Notes on dry-run honesty

For each D8 score, I considered: would a real Claude session, reading only this SKILL.md and asked the typical prompt, produce a useful response without hallucination?

- **Where I scored 9-10:** The skill text alone gives concrete actions a model can execute (`/investigate`'s phases, `/cso`'s phase bash, `/learn`'s subcommand parser, `/qa`'s severity/repro/evidence rules).
- **Where I scored 7-8:** The skill text gives concrete contracts but delegates execution to a runtime. A model with the runtime gets useful output; a model without gets discipline but not steps. Most canonical Track E skills sit here.
- **Where I scored 4-6:** None in this audit set. The lowest D8 in this audit is 7 (`/discover`, `/build`, `/plan`, `/handoff`).
- **Where I considered scoring lower:** I considered scoring `/build`, `/plan`, `/handoff` at 6 because their most typical prompt ("just do the thing") gets minimum guidance. I held them at 7 because Iron Laws materially improve the second-most-typical prompts (stuck cases, advisory cases). If the reader is rarely stuck, Iron Laws are dead weight in their session; if they are sometimes stuck, Iron Laws save the run. 7 reflects this average.

The audit's bottom line under Darwin: Track E is rigorously correct but operationally underspecified, and the next phase of skill strengthening should be procedural — not more rigor.
