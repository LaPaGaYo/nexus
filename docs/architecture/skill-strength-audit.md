# Nexus Skill Strength Audit

**Status:** Analysis. Identifies discipline gaps in Nexus's 37 native skills vs Superpowers/GSD/PM upstream practices.
**Date:** 2026-05-06
**Methodology:** Per-skill comparison + 5-dimension scoring + specific strengthening recommendations.

---

## Executive summary

Nexus's native skills are strong as a **routing and governance** layer but weak as an
**engineering discipline** layer. The canonical 9 (`/discover` → `/closeout`) are almost
entirely artifact contracts and runtime advisor wiring — they tell Claude where to write
JSON and which `bun run` to invoke, but they say very little about what good engineering
looks like inside each stage. Build doesn't enforce TDD, review doesn't enforce
verification-before-completion, plan doesn't define a bite-sized task contract, and ship
inherits "Superpowers ship discipline" by reference without re-asserting it. By
comparison, every Superpowers skill names an Iron Law in its first 20 lines, every GSD
command pins a verification gate to a workflow file, and every PM skill anchors to an
explicit framework (MITRE, Cagan, Lawrence, Torres). The asymmetry is real and
quantifiable: Nexus canonical skills average ~2.4/5 on engineering rigor; upstream
counterparts average ~4.3/5.

The good news: Nexus is not uniformly weak. Three skills already grade in the upstream
range — `investigate` (Iron Law explicit, four phases, 3-strike rule), `simplify`
(behavior contract + before/after verification + explicit "Do Not Do" list), and
`cso` (confidence calibration + FP filter + variant analysis + active verification).
These are the templates for what Nexus's own canonical skills should look like.

Recommended path forward: strengthen the canonical 9 first, then a small number of
high-leverage support skills (`build`, `review`, `qa`, `plan`, `frame`). Don't bundle
Superpowers/GSD/PM as third-party skills (Model γ rejected). Instead, port the
discipline content (Iron Laws, verification gates, structured task contracts) directly
into Nexus's own SKILL.md prose so the routing/governance and discipline layers live
in the same file. A future RFC ("Track E: Nexus Skill Strengthening") should sequence
the work.

**Top 5 most impactful gaps**

1. **No Iron Law in `/build`** — nothing forces TDD, fresh verification, or a "no production code without a failing test first" gate. Implementation runs are governed only by route provenance, not by what they actually do to the code.
2. **No verification-before-completion gate in `/review` or `/ship`** — both rely on advisor JSON to indicate readiness instead of requiring fresh test runs in the current message before claiming done. Trust is delegated to runtime artifacts that may be stale.
3. **`/plan` has no bite-sized task contract** — Superpowers' writing-plans demands exact file paths, complete code per step, no "TBD" placeholders. Nexus `/plan` writes a "sprint contract" and "verification matrix" but the SKILL.md does not enforce content discipline.
4. **`/qa` has no failure-mode taxonomy** — `qa-only` (the report-only sibling) has rich rubrics, but the canonical `/qa` skill is mostly a router. The discipline lives in the runtime, not the prose.
5. **No explicit "evidence before claims" pattern across canonical** — Superpowers names this principle once and references it everywhere. Nexus has a "completion advisor" mechanism but no explicit prose rule that says "do not claim DONE without showing the test command output."

---

## Methodology

I read the 37 native Nexus SKILL.md files in `skills/canonical/`, `skills/support/`,
`skills/safety/`, and `skills/root/`. I compared each to the closest upstream
counterpart in:

- **Superpowers** (14 skills): pre-D2 local snapshot audit, now retired
- **GSD** (68 commands): pre-D2 local snapshot audit, now retired
- **PM Skills** (47 skills): pre-D2 local snapshot audit, now retired

Each Nexus skill is scored 1-5 on five dimensions:

1. **Mandatory rules** — Does the skill enforce specific behavioral rules with imperative language ("MUST", "Iron Law", "before claiming complete, do X")?
2. **Verification rigor** — Does the skill require explicit verification before completion (test runs, output assertions, structural validation)?
3. **Failure mode coverage** — Does the skill anticipate specific failure modes and prescribe recovery?
4. **Acceptance criteria specificity** — What constitutes "done"? Is it observable / pinned in artifacts?
5. **Discipline transferability** — How much general engineering discipline (vs Nexus-specific governance) does the skill encode?

Recommendations are concrete, copy-pasteable additions to the SKILL.md prose, not
runtime or contract changes. They strengthen the prose layer, which is what an LLM
actually reads at run time.

Some skills (host-specific, infrastructure, alias-shaped) have no upstream counterpart
and shouldn't be graded against SDD discipline. Those entries explicitly note "no
direct counterpart" and avoid grade inflation in either direction.

---

## Aggregate scores

| Category | Avg score across skills (1-5) | Notes |
|---|---|---|
| Canonical (9) | 2.4 | Strong on artifact contracts and routing; weak on engineering rules. `/build`, `/review`, `/ship` are the most under-disciplined for what they govern. |
| Support (23) | 3.1 | Wide variance. `investigate`, `simplify`, `cso`, `design-review`, `qa-only` are 4-5/5. `learn`, `connect-chrome`, `nexus-upgrade` are infrastructure and not gradable on SDD discipline. |
| Safety (4) | 3.5 | `careful` and `freeze` are tight, single-purpose, with clear output contracts and verification evidence. Better disciplined than canonical. |
| Root (1) | 2.0 | `/nexus` is a routing manifest, not a discipline layer. That's appropriate, so the score is read as "intentionally light," not "weak." |
| **Overall** | **2.9** | Below the upstream average (~4.3/5 across the 14 Superpowers skills + the 10 GSD commands sampled). |

---

## Per-skill audit (37 skills)

### `build` (canonical)

- **Current discipline scores:** Mandatory 2/5, Verification 1/5, Failure 2/5, Acceptance 2/5, Transferability 1/5 (avg 1.6)
- **Closest external counterpart:** Superpowers `test-driven-development` + `verification-before-completion`; GSD `execute-phase`.
- **Gap analysis:** SKILL.md is almost entirely runtime advisor wiring and route provenance. There is no rule that forces a failing test first, no rule about evidence before claiming done, no "stop and ask after 3 failed hypotheses," and no taxonomy of build failure modes. The Operator Checklist has 3 vague bullets ("run build discipline before transport"). The actual implementation contract lives in `.planning/current/build/build-request.json` but the prose doesn't tell the model what disciplined implementation means.
- **Recommended strengthening rules:**
  1. Add an "Iron Law" section: "NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. If you wrote implementation before the test, delete it and start over from the failing test."
  2. Add a "Verification before claiming complete" section requiring a fresh test command run inside the current turn before marking the build result `ready`. List the failure modes ("test passed previously," "agent said success," "linter clean") and reject them by name.
  3. Add a "When the implementer is stuck" section with the 3-strike rule: after 3 failed hypotheses, escalate; do not rewrite tests to make code pass.
  4. Add a "Bite-sized work loop" section linking to the plan's task structure: each task is one failing test → minimal code → run → commit. No batched commits.
- **Estimated effort:** M

### `closeout` (canonical)

- **Current discipline scores:** Mandatory 2/5, Verification 3/5, Failure 2/5, Acceptance 3/5, Transferability 1/5 (avg 2.2)
- **Closest external counterpart:** GSD `complete-milestone` + `audit-milestone`.
- **Gap analysis:** Closeout is well-defined as an archive verification step (good artifact contract), but the prose doesn't describe what makes a closeout "high quality." There's no explicit list of things to verify ("did the audit set actually exercise the success criteria from `/frame`?"), no failure taxonomy ("what does a stale audit look like?"), and no link between closeout and learnings/retros beyond the advisor.
- **Recommended strengthening rules:**
  1. Add a "Closeout integrity checklist" section that explicitly enumerates: (a) review artifacts present, (b) QA artifacts present when run, (c) ship handoff complete, (d) ledger consistent, (e) success criteria from `/frame` actually addressed by the audit set.
  2. Add a "Stale evidence detection" rule: if any audit was generated more than N commits ago or before the last `/build`, mark the run as `stale_audit` and require rerun.
  3. Add an explicit invariant: "Closeout is read-only with respect to lifecycle authority. Never edit `.planning/current/*/status.json` from `/closeout`. If state is wrong, return to the owning skill."
- **Estimated effort:** S

### `discover` (canonical)

- **Current discipline scores:** Mandatory 1/5, Verification 1/5, Failure 1/5, Acceptance 2/5, Transferability 2/5 (avg 1.4)
- **Closest external counterpart:** PM `discovery-process`, `problem-framing-canvas`, `pol-probe`.
- **Gap analysis:** The SKILL.md prose is 4 lines: capture goals, capture constraints, record open questions, write to `idea-brief.md`. PM `discovery-process` runs 6 phases over 2-4 weeks with explicit anti-patterns ("not waterfall research," "not user testing"), evidence requirements (interviews, synthesis, experiments), and decision gates (build/pivot/kill). Nexus discover doesn't even tell the model whether to ask questions, when to stop, or what makes a discovery "ready" for `/frame`.
- **Recommended strengthening rules:**
  1. Add a "What discovery is and isn't" section copying the PM `discovery-process` anti-patterns: not a feature spec, not user testing, not a substitute for shipping.
  2. Add a "Minimum signal bar" before advancing to `/frame`: at least one named user, one observed pain, and one falsifiable hypothesis, all written into `idea-brief.md`.
  3. Add a "When to recommend a `pol-probe`" trigger: if the hypothesis carries technical, market, or workflow risk, suggest the lightweight validation skill before framing.
  4. Add a "Bias-resistant framing" rule borrowed from `problem-framing-canvas`: explicitly capture "Look Inward" assumptions before "Look Outward" evidence, so the artifact records what the user thought before asking customers.
- **Estimated effort:** M

### `frame` (canonical)

- **Current discipline scores:** Mandatory 1/5, Verification 1/5, Failure 1/5, Acceptance 2/5, Transferability 2/5 (avg 1.4)
- **Closest external counterpart:** PM `prd-development`, `problem-framing-canvas`, `epic-hypothesis`.
- **Gap analysis:** Operator checklist is 3 bullets (scope / non-goals / success criteria). The PM `prd-development` skill prescribes a 9-section PRD template with explicit fields for problem evidence, target persona, strategic context, success metrics, edge cases, out-of-scope, and dependencies. Nexus frame writes `decision-brief.md` and `prd.md` but the SKILL.md doesn't say what those documents must contain or how to test that the framing is sufficient before `/plan`.
- **Recommended strengthening rules:**
  1. Add a "PRD content contract" section enumerating required sections (problem, evidence, persona, strategic context, solution overview, success metrics, user stories, out-of-scope, dependencies & risks). Cite the PM convention.
  2. Add a "Framing readiness gate" before advancing to `/plan`: success criteria are observable and falsifiable; non-goals are explicit; at least one user story has acceptance criteria; out-of-scope is non-empty.
  3. Add a "Hypothesis framing" rule from `epic-hypothesis`: every framed scope must articulate "If we [action], then [users] will [outcome] because [evidence]," so plan and review have a hypothesis to validate against.
- **Estimated effort:** M

### `handoff` (canonical)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 2/5, Acceptance 3/5, Transferability 1/5 (avg 2.4)
- **Closest external counterpart:** No clean upstream counterpart — handoff governance is Nexus-specific. Closest is GSD `pause-work` + Superpowers `subagent-driven-development` task dispatching.
- **Gap analysis:** Handoff is appropriately Nexus-specific and mostly does its job (route provenance, transport availability, separate approval). The weakness is on failure modes: what happens when a handoff is approved but the route then disappears (provider unmounted, branch shifted)? The prose doesn't tell the model how to detect and surface that. The "single canonical continuation into `/build`" line is good but the prose doesn't enumerate the cases where it shouldn't continue.
- **Recommended strengthening rules:**
  1. Add a "Handoff staleness check" section: before re-using an existing handoff, recompute route availability and bail if any of route, provider, branch, or upstream contract changed since approval.
  2. Add a "Recovery from blocked handoff" rule: if approval was recorded but execution can't begin, write a `handoff-blocked` status entry explaining which leg of the route failed, instead of silently re-running.
- **Estimated effort:** S

### `plan` (canonical)

- **Current discipline scores:** Mandatory 1/5, Verification 1/5, Failure 1/5, Acceptance 2/5, Transferability 1/5 (avg 1.2)
- **Closest external counterpart:** Superpowers `writing-plans`; GSD `plan-phase`.
- **Gap analysis:** This is the largest single gap in Nexus's prose layer. Superpowers `writing-plans` requires exact file paths per task, complete code blocks per step, no "TBD" placeholders, no "fill in details" — the document explicitly enumerates "plan failures" and refuses them. GSD `plan-phase` runs research → plan → verify with a checker subagent and an iteration loop. Nexus `/plan` writes `execution-readiness-packet.md`, `sprint-contract.md`, and `verification-matrix.json` but the SKILL.md says nothing about what those documents must contain. The result is that `/plan` artifacts vary widely in usefulness — sometimes great, often vague.
- **Recommended strengthening rules:**
  1. Add a "Plan content contract" section: every task in the sprint contract has (a) exact file paths to create / modify, (b) the failing test first, (c) the minimal implementation, (d) the verification command, (e) the commit step. Cite Superpowers `writing-plans` task structure.
  2. Add a "No placeholders" enforcement rule: reject "TBD", "implement later", "add appropriate error handling", "similar to Task N" as plan failures. Make this explicit and refuse to advance to `/handoff` if any task contains placeholder language.
  3. Add a "Verification matrix discipline" rule: every success criterion from `/frame` must map to at least one verification entry, and every verification entry must have an executable command, not prose.
  4. Add a "Plan checker self-pass" rule like GSD's plan-phase: after writing the plan, re-read it and answer "could a fresh engineer with no context execute this plan?" If no, revise.
- **Estimated effort:** L

### `qa` (canonical)

- **Current discipline scores:** Mandatory 2/5, Verification 2/5, Failure 2/5, Acceptance 3/5, Transferability 2/5 (avg 2.2)
- **Closest external counterpart:** Superpowers `verification-before-completion`; GSD `verify-work` + `audit-uat`; Nexus's own `qa-only` is the in-house template.
- **Gap analysis:** `qa-only` (the report-only sibling) is well-disciplined: framework-specific guidance, severity calibration, evidence tiers, "11 important rules" with imperative language. The canonical `/qa` skill mostly delegates to runtime advisors and doesn't replicate that discipline. The result: the rules that make QA actually useful live in `qa-only`, but the path that governs the lifecycle (`/qa`) is the thinner one.
- **Recommended strengthening rules:**
  1. Add a "QA content contract" section with the same evidence tiers as `qa-only`: every issue has at least one screenshot, repro is verified by re-running once, console errors are aggregated, never include credentials.
  2. Add a "What blocks `/ship`" rule explicitly: any P0 finding, any new console error not in baseline, any failed health check on a primary user flow.
  3. Add a "Verification freshness" rule from Superpowers: don't claim QA passed unless tests/checks were run in the current message. If passing was claimed, the test command output must be visible in this turn.
- **Estimated effort:** M

### `review` (canonical)

- **Current discipline scores:** Mandatory 2/5, Verification 2/5, Failure 2/5, Acceptance 3/5, Transferability 1/5 (avg 2.0)
- **Closest external counterpart:** Superpowers `requesting-code-review` + `receiving-code-review` + `verification-before-completion`.
- **Gap analysis:** The SKILL.md is governance prose ("dual-audit completion," "audit provenance consistency") with little engineering review discipline. There's no "before claiming the gate is open, what do you require to see," no taxonomy of review smells (drive-by refactor in a fix PR, untested error path, security-sensitive change without explicit approval), and no rule for handling reviewer disagreement (Superpowers' `receiving-code-review` is rich here). The `/codex` support skill carries some of this; the canonical `/review` does not.
- **Recommended strengthening rules:**
  1. Add a "Review content contract" listing the things every review must produce: scope summary, test execution result, list of risks with severity, and an explicit gate verdict (`pass`, `pass_with_advisories`, `fail`).
  2. Add a "No completion claims without fresh evidence" rule: do not write `pass` to the gate without showing the test command output in the current message. Borrow Superpowers' Iron Law verbatim.
  3. Add a "Reviewer disagreement protocol" from `receiving-code-review`: when an outside voice (Codex, design, eng) disagrees, the synthesis must enumerate which findings are accepted, which are pushed back on, and why — not silently average them.
- **Estimated effort:** M

### `ship` (canonical)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 3/5, Acceptance 4/5, Transferability 2/5 (avg 3.0)
- **Closest external counterpart:** Superpowers `finishing-a-development-branch`; GSD `ship`.
- **Gap analysis:** Best-disciplined of the canonical 9 because the artifact contract is concrete (release-gate-record, checklist, deploy-readiness, pull-request, status) and the ordering rule is explicit ("commit stage artifacts, push the ship branch, create or reuse the PR, then allow closeout"). Still, the prose says "Superpowers ship discipline informs the release gate" without re-asserting what that discipline is. A reader of just `/ship`'s SKILL.md doesn't see the merge-readiness gate that Superpowers defines (tests pass, base branch confirmed, options presented, choice executed, cleanup).
- **Recommended strengthening rules:**
  1. Add a "Pre-merge readiness gate" section enumerating: tests pass (with output evidence in this message), CI green, review state current (not stale), QA verdict ready when QA was run, branch up-to-date with base.
  2. Add a "Force-push and skipping CI are forbidden" rule (transferable from `/land`).
  3. Add a "If the user asks to ship a broken thing" escalation rule: refuse and surface the failing checks. Bad work is worse than no work.
- **Estimated effort:** S

---

### `benchmark` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 3/5, Acceptance 4/5, Transferability 4/5 (avg 3.8)
- **Closest external counterpart:** No clean upstream counterpart in Superpowers/GSD/PM (perf is Nexus-specific). Loose analogue: Superpowers' "evidence before claims" applied to perf.
- **Gap analysis:** Already strong. Has explicit thresholds (regression at >50% or >500ms; warning at >20%), baseline-required workflow, slowest-resources rubric, performance budget table, and a clear "measure first, fix the bottleneck, measure again, add a guard" rule. The `Important Rules` section is one of the better SDD-discipline blocks in the codebase.
- **Recommended strengthening rules:**
  1. Add a "Verification-before-claim" rule: don't write `no_regression` to QA evidence without a current measurement in this turn.
  2. Add a "Confounder taxonomy" section: warm vs cold cache, network conditions, third-party scripts, dev-tools open. Reject readings that didn't control for these.
  3. Add a "Trend integrity" rule: if more than N days of trend data are missing, flag and don't compute slope.
- **Estimated effort:** S

### `browse` (support)

- **Current discipline scores:** Mandatory 2/5, Verification 2/5, Failure 2/5, Acceptance 2/5, Transferability 1/5 (avg 1.8)
- **Closest external counterpart:** No direct counterpart — browser tooling is Nexus-specific.
- **Gap analysis:** The skill is a binary launcher and a setup ritual. Most of the useful discipline (when to use snapshot vs screenshot, when to check console, when to take responsive captures) is implicit or duplicated in other skills (`qa-only`, `design-review`). Not really comparable to SDD skills, but the prose is unusually thin for a heavily-used support tool.
- **Recommended strengthening rules:**
  1. Add a "When `browse` is the right tool" decision section: prefer it for headless QA, route to `connect-chrome` for authenticated flows.
  2. Add a "Evidence rules" section borrowed from `qa-only` rule 11: every screenshot or snapshot taken must be Read inline so the user sees it.
  3. Add a "Network/auth boundary" rule: never enter credentials into a browse session, never send cookies to third-party domains.
- **Estimated effort:** S

### `canary` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 3/5 (avg 3.8)
- **Closest external counterpart:** No clean upstream counterpart. Tangentially: GSD `verify-work` post-deploy.
- **Gap analysis:** Already strong. Explicit alert thresholds, "alert on changes not absolutes" rule, "don't cry wolf" 2-consecutive-checks rule, baseline-encouraged workflow, and a clear health report contract. Persona prose ("Release Reliability Engineer") is concrete and useful.
- **Recommended strengthening rules:**
  1. Add a "Rollback decision rule" section: if a CRITICAL alert persists across 3 checks, the recommended action escalates from "investigate" to "rollback."
  2. Add a "Verification-before-baseline-update" rule: only update the baseline after the deploy is confirmed healthy AND the user has explicitly approved.
  3. Add a "Production data privacy" rule: never store screenshots that include PII; if a page renders user data, redact before saving.
- **Estimated effort:** S

### `codex` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 3/5, Failure 4/5, Acceptance 4/5, Transferability 3/5 (avg 3.6)
- **Closest external counterpart:** Superpowers `requesting-code-review`.
- **Gap analysis:** Already well-disciplined as a multi-mode wrapper (review / challenge / consult). Has explicit gate logic ([P1] => FAIL), filesystem-boundary instruction to prevent rabbit holes, fixed timeouts, error handling, and a "do not summarize Codex output" rule. Cross-model comparison is a nice addition. The gap is not in discipline but in how it's positioned: the skill encodes the discipline of an outside reviewer, but Nexus's own `/review` doesn't reciprocate by re-asserting "evidence before claiming pass."
- **Recommended strengthening rules:**
  1. Add a "When Codex is unavailable" fallback rule: explicitly surface "single-model review" tag rather than silently passing.
  2. Add a "Cross-model disagreement protocol" rule: if Codex finds P1 and Claude's `/review` did not, treat it as a finding to investigate, not an artifact mismatch to reconcile.
- **Estimated effort:** S

### `connect-chrome` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 1/5 (avg 3.2)
- **Closest external counterpart:** No counterpart. Setup/wiring skill specific to Nexus's headed browser.
- **Gap analysis:** Acceptable as infrastructure prose. Has a strong pre-flight cleanup, a setup-needed branch, a step-by-step user dialog, and a verification step that confirms `Mode: headed` before claiming connected. Not gradable on SDD discipline because there's no equivalent upstream.
- **Recommended strengthening rules:**
  1. Add a "If the user already has a Chrome with same profile" detection rule that warns before clobbering.
  2. Add a "If port 34567 is in use by another process" recovery rule.
- **Estimated effort:** S

### `cso` (support)

- **Current discipline scores:** Mandatory 5/5, Verification 5/5, Failure 5/5, Acceptance 5/5, Transferability 4/5 (avg 4.8)
- **Closest external counterpart:** No direct upstream — Nexus's `cso` is more disciplined than any general-purpose security skill in the three reference corpora.
- **Gap analysis:** This is the gold standard of Nexus prose. Confidence calibration table (1-10), 8/10 daily-mode gate vs 2/10 comprehensive gate, hard-exclusions list with exceptions, precedents list with case numbers, active verification step, variant analysis, parallel finding verification, trend tracking, fingerprinting. If the canonical 9 had this density of imperative discipline, the audit would be much shorter.
- **Recommended strengthening rules:**
  1. Promote the confidence calibration / FP filter / active-verification triad into a Nexus-wide pattern. Reference it from `/review` and `/qa` so they inherit the same rigor.
  2. Add an "Annual / quarterly review of FP rules" reminder so the precedents list stays current as the codebase evolves.
- **Estimated effort:** S (already strong; the work is replication elsewhere)

### `deploy` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 3/5 (avg 3.8)
- **Closest external counterpart:** No clean upstream counterpart; loosely Superpowers `finishing-a-development-branch` post-merge phase.
- **Gap analysis:** Already strong. Explicit "never deploy from `/deploy` without merge" rule, signal-resolution order, timeout + recovery dialog, deploy result schema with explicit failure_kind enum.
- **Recommended strengthening rules:**
  1. Add a "If `/canary` is available, recommend it after every deploy" rule (already implied; make it explicit).
  2. Add a "Deploy result staleness" check: deploy-result.json older than the last commit on base means rerun before claiming verified.
- **Estimated effort:** S

### `design-consultation` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 3/5, Failure 3/5, Acceptance 4/5, Transferability 3/5 (avg 3.4)
- **Closest external counterpart:** No SDD counterpart; loosely PM `positioning-workshop`.
- **Gap analysis:** Strong as a design-process skill. Has the SAFE/RISK breakdown rule, governance reference (five lenses), explicit anti-patterns ("no AI slop"), and a "propose, don't present menus" rule. The discipline content is real but design-domain-specific, so generally not comparable to upstream SDD.
- **Recommended strengthening rules:**
  1. Add a "When the brief is too vague to propose anything" stop-and-ask rule.
  2. Add a "Don't decide for the user without asking" rule for ambiguous color/font choices.
- **Estimated effort:** S

### `design-html` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 4/5, Failure 3/5, Acceptance 4/5, Transferability 2/5 (avg 3.2)
- **Closest external counterpart:** No counterpart.
- **Gap analysis:** Tightly defined output (Pretext-native HTML), explicit "AI slop blacklist," surgical-edits rule for refinement, max-iteration cap on the refinement loop. Strong for what it is.
- **Recommended strengthening rules:**
  1. Add a "Verification before declaring finalized" rule: at minimum a fresh screenshot at all three viewports.
  2. Add a "No new content invented" rule: text comes from the approved mockup, never from the model's imagination.
- **Estimated effort:** S

### `design-review` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 3/5, Acceptance 4/5, Transferability 3/5 (avg 3.6)
- **Closest external counterpart:** PM/Superpowers have nothing equivalent. Closest is Nexus's own `qa-only`.
- **Gap analysis:** Strong fix-loop discipline. Requires a clean working tree before starting (so each fix becomes its own commit), test-framework bootstrap if absent, governance anchors, strong rules in the prose. Comparable to Superpowers in rigor.
- **Recommended strengthening rules:**
  1. Add a "Don't drift into refactor" rule: design fixes touch styling, layout, and copy, not architecture.
  2. Add a "Refuse to commit mixed concerns" rule: each commit is one design finding's fix.
- **Estimated effort:** S

### `design-shotgun` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 3/5, Acceptance 4/5, Transferability 2/5 (avg 3.0)
- **Closest external counterpart:** None.
- **Gap analysis:** Workflow-defined skill that produces design variants, comparison boards, and approval artifacts. Acceptable discipline level but skill-specific.
- **Recommended strengthening rules:**
  1. Add a "Genuinely different directions" rule from the governance reference: directions must come from different schools / anchors, not just adjective swaps.
  2. Add a "Stop generating once the user has approved" rule to prevent runaway variant generation.
- **Estimated effort:** S

### `document-release` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 2/5, Acceptance 3/5, Transferability 3/5 (avg 2.8)
- **Closest external counterpart:** Loosely Superpowers `finishing-a-development-branch`'s docs sync; GSD `docs-update`.
- **Gap analysis:** Decent skill (post-ship doc sync) but the prose is mostly procedural without explicit rules about staleness detection, conflicting docs, or how to handle "the README contradicts CLAUDE.md."
- **Recommended strengthening rules:**
  1. Add a "Source of truth ordering" rule when docs disagree: code first, then CHANGELOG, then README, then CLAUDE.md, then ARCHITECTURE.
  2. Add a "Don't invent" rule: documentation reflects what shipped, not what's planned. If a feature wasn't shipped, don't document it.
  3. Add a "Verify before claiming docs are current" rule: at minimum, the README's commands actually run in the current repo.
- **Estimated effort:** S

### `investigate` (support)

- **Current discipline scores:** Mandatory 5/5, Verification 5/5, Failure 5/5, Acceptance 5/5, Transferability 5/5 (avg 5.0)
- **Closest external counterpart:** Superpowers `systematic-debugging` (essentially the same skill, well-translated).
- **Gap analysis:** The strongest Nexus skill. Iron Law is explicit ("NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST"). Four phases. 3-strike rule. Pattern table. Red flags. Scope lock via freeze. Regression test required. Fresh verification required. Structured debug report. This is what every canonical Nexus skill should look like.
- **Recommended strengthening rules:** None significant. Possibly add a "Capture the learning" hook explicitly tying to `/learn` so insights compound.
- **Estimated effort:** S

### `land` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 3/5 (avg 3.8)
- **Closest external counterpart:** Superpowers `finishing-a-development-branch` Option 2 (push and create PR).
- **Gap analysis:** Strong rules ("never force push," "never skip CI," "never deploy from `/land`," "always ask before merge"). Pre-flight checks and CI gating are explicit. Deploy-result schema is well-typed.
- **Recommended strengthening rules:**
  1. Add a "Stale ship handoff" rule: if `head_sha` differs from PR's current head, refuse and ask for `/ship` rerun.
  2. Add a "Branch protection bypass" rule: if the user requests an admin merge, surface the protection rules being bypassed and require explicit confirmation.
- **Estimated effort:** S

### `land-and-deploy` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 2/5 (avg 3.6)
- **Closest external counterpart:** Combination of Superpowers `finishing-a-development-branch` + Nexus's own `deploy`.
- **Gap analysis:** Strong workflow with explicit dry-run, landing-mode choice, pre-merge gate, merge queue handling, deploy strategy decision tree, canary verification, and revert path.
- **Recommended strengthening rules:**
  1. Add a "Don't run on main/master without explicit consent" rule (borrowed from Superpowers `executing-plans`).
  2. Add a "Refuse to rerun automatically after revert" rule: a revert is a signal to investigate, not retry.
- **Estimated effort:** S

### `learn` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 2/5, Acceptance 3/5, Transferability 3/5 (avg 2.8)
- **Closest external counterpart:** No upstream — it's Nexus's own learnings store.
- **Gap analysis:** Hard gate ("do NOT implement code changes") is good. Stale-detection and conflict-detection logic is well specified. The gap: the learnings system is most useful when other skills consistently capture insights, but the prose for those other skills doesn't always include a "log a learning" hook.
- **Recommended strengthening rules:**
  1. Add a "Confidence rubric" section (Nexus already has it implicitly, but make it explicit so contributors calibrate the same way).
  2. Add a "Learning hygiene quarterly check" rule recommending a `/learn prune` cadence.
  3. Add a cross-skill rule that names which skills must always log a learning on a non-obvious finding (`investigate`, `simplify`, `cso`, `retro`).
- **Estimated effort:** S

### `nexus-upgrade` (support)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 1/5 (avg 3.4)
- **Closest external counterpart:** No counterpart; it's a tool-specific upgrade flow.
- **Gap analysis:** Acceptable as infrastructure prose. Auto-upgrade vs ask, snooze backoff, install verification, "show what's new" step.
- **Recommended strengthening rules:**
  1. Add a "Refuse to upgrade with a dirty working tree" rule unless user explicitly opts in.
- **Estimated effort:** S

### `plan-design-review` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 2/5, Acceptance 3/5, Transferability 2/5 (avg 2.6)
- **Closest external counterpart:** Loosely Superpowers `requesting-code-review` for design.
- **Gap analysis:** Designer's-eye plan review is a valuable Nexus addition. Rates each design dimension 0-10 and explains what would make it a 10. Decent rubric. The gap: "what blocks plan completion" is implicit; the prose should name when this review's findings are advisory vs blocking.
- **Recommended strengthening rules:**
  1. Add an "Advisory vs blocking" rule: only failing the "philosophical coherence" or "functional fit" lenses blocks; the others are advisory.
  2. Add a "Don't redo `/design-consultation`" rule: this skill reviews; it does not propose.
- **Estimated effort:** S

### `qa-only` (support)

- **Current discipline scores:** Mandatory 5/5, Verification 4/5, Failure 4/5, Acceptance 5/5, Transferability 4/5 (avg 4.4)
- **Closest external counterpart:** Superpowers `verification-before-completion` applied to QA; Nexus's own canonical `/qa` is a thinner sibling.
- **Gap analysis:** Strong skill. 12 explicit rules ("repro is everything," "verify before documenting," "never include credentials," "never refuse to use the browser"). Two evidence tiers, framework-specific guidance, weighted health-score rubric, regression mode comparison.
- **Recommended strengthening rules:**
  1. Replicate this discipline up into the canonical `/qa` so the lifecycle path enforces what `qa-only` defines.
  2. Add a "When the app won't load" failure-mode section.
- **Estimated effort:** S (the work is mainly upward replication)

### `retro` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 4/5, Failure 2/5, Acceptance 4/5, Transferability 3/5 (avg 3.2)
- **Closest external counterpart:** No SDD counterpart. Loose analogue: GSD's `complete-milestone` retro section.
- **Gap analysis:** Well-defined data gathering (14 git/log queries), explicit metric table, session detection, contributor analysis, comparison logic, archive write paths, narrative structure. Verification contract section is strong.
- **Recommended strengthening rules:**
  1. Add a "Don't over-claim" rule: only assert improvements you have data for; everything else is observation.
  2. Add an "Honesty about regression" rule: if test ratio dropped or fix-pct rose above 50%, name it.
- **Estimated effort:** S

### `setup-browser-cookies` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 3/5, Acceptance 3/5, Transferability 1/5 (avg 2.6)
- **Closest external counterpart:** No counterpart.
- **Gap analysis:** Setup skill, infrastructure-shaped, not really gradable on SDD. Adequate.
- **Recommended strengthening rules:**
  1. Add a "Privacy" rule: only import cookies for explicitly listed domains; never bulk-import.
  2. Add a "Refuse to print cookie values" rule.
- **Estimated effort:** S

### `setup-deploy` (support)

- **Current discipline scores:** Mandatory 3/5, Verification 3/5, Failure 3/5, Acceptance 3/5, Transferability 2/5 (avg 2.8)
- **Closest external counterpart:** No counterpart.
- **Gap analysis:** Configuration skill. Adequate.
- **Recommended strengthening rules:**
  1. Add a "Detect existing deploy contract first" rule and surface conflicts before overwriting.
  2. Add a "Don't write secrets" rule: deploy contract is non-secret config; secrets go to `gh secret set` or platform-native secret stores.
- **Estimated effort:** S

### `simplify` (support)

- **Current discipline scores:** Mandatory 5/5, Verification 5/5, Failure 4/5, Acceptance 5/5, Transferability 5/5 (avg 4.8)
- **Closest external counterpart:** Loosely Superpowers TDD's "refactor with tests passing" phase. Nothing in upstream is a dedicated refactor-without-feature-changes skill; Nexus's `simplify` is a strong original.
- **Gap analysis:** Explicit "behavior contract." Explicit "Allowed Simplifications" / "Do Not Do" enumeration. Tests-required-before-and-after rule. "Stop on behavior risk" gate. This is a model SKILL.md. Use as a template for `/build` and `/review`.
- **Recommended strengthening rules:**
  1. Add a "Drive-by detection" rule: warn if the diff touches files outside the trigger advisory's scope.
  2. Add a "When tests are missing entirely" branch: write a characterization test first, then simplify.
- **Estimated effort:** S

---

### `careful` (safety)

- **Current discipline scores:** Mandatory 5/5, Verification 4/5, Failure 4/5, Acceptance 4/5, Transferability 4/5 (avg 4.2)
- **Closest external counterpart:** No SDD counterpart; functionally similar to Superpowers' "never operate on main/master without explicit consent" rules.
- **Gap analysis:** Tight, single-purpose, with an explicit table of patterns + safe exceptions, output contract, and verification evidence section.
- **Recommended strengthening rules:**
  1. Add `terraform destroy`, `pulumi destroy`, and `aws s3 rb` to the protected pattern list.
  2. Add a "Safe-by-default scope" rule: first time the hook fires in a session, show the user a one-line summary of all categories so they understand the boundary.
- **Estimated effort:** S

### `freeze` (safety)

- **Current discipline scores:** Mandatory 5/5, Verification 4/5, Failure 3/5, Acceptance 4/5, Transferability 3/5 (avg 3.8)
- **Closest external counterpart:** Loosely Superpowers `using-git-worktrees` for scope isolation.
- **Gap analysis:** Strong. Resolves to absolute path, writes state file, hook reads on every Edit/Write, explicit "this prevents accidental edits, not a security boundary" caveat.
- **Recommended strengthening rules:**
  1. Add an "Auto-suggest" hook from `/investigate`: when a debug session starts, recommend `/freeze` to lock scope.
  2. Add a "Multiple boundaries" extension: support a list of allowed prefixes so investigations across a few paired modules work.
- **Estimated effort:** S

### `guard` (safety)

- **Current discipline scores:** Mandatory 5/5, Verification 4/5, Failure 3/5, Acceptance 4/5, Transferability 3/5 (avg 3.8)
- **Closest external counterpart:** None — combination of `careful` + `freeze`.
- **Gap analysis:** Tight composition skill. Output contract is explicit.
- **Recommended strengthening rules:**
  1. Add a "Composition discipline" note: if the user runs `/careful` then `/freeze` separately later, do not overwrite or surprise.
- **Estimated effort:** S

### `unfreeze` (safety)

- **Current discipline scores:** Mandatory 4/5, Verification 4/5, Failure 3/5, Acceptance 4/5, Transferability 2/5 (avg 3.4)
- **Closest external counterpart:** None.
- **Gap analysis:** Tight cleanup skill, explicit "do not remove any files except `freeze-dir.txt`," explicit "do not claim other hooks were disabled."
- **Recommended strengthening rules:**
  1. Add a "Confirm before unfreezing during an active /investigate" rule, since the freeze was likely set deliberately by that skill.
- **Estimated effort:** S

---

### `nexus` (root)

- **Current discipline scores:** Mandatory 2/5, Verification 2/5, Failure 2/5, Acceptance 2/5, Transferability 2/5 (avg 2.0)
- **Closest external counterpart:** No upstream — this is the routing manifest.
- **Gap analysis:** Appropriate as a router (this is what it should be). Routing rules are clear, support-surface positioning is sensible. Not a discipline-bearing skill.
- **Recommended strengthening rules:**
  1. Add a "When in doubt, delegate" rule: if the user's request maps to a canonical skill, invoke; do not summarize or answer inline first.
  2. Add a "Routing override" rule: if the user explicitly named a skill, never re-route to a different one.
- **Estimated effort:** S

---

## Cross-cutting patterns

What common weaknesses showed up across skills?

- **Pattern 1 — No Iron Law in canonical 9.** Superpowers names its principles in three words: "evidence before claims," "no fixes without root cause," "no production code without a failing test first." Nexus has principles (Completeness Principle, route provenance separation) but they live in the bootstrap, not in the skill prose. The result: when an LLM reads `/build`'s SKILL.md, the only constraints it sees are about JSON files, not about whether to write tests first.

- **Pattern 2 — Verification is advisory, not blocking.** Most canonical skills delegate "is this ready?" to a runtime advisor JSON. That's a fine architecture choice, but the prose then says "trust the advisor" instead of "do not claim ready unless you ran the verification command in this turn." The prose is what the LLM actually reads at decision time; runtime advisors are downstream.

- **Pattern 3 — Acceptance criteria live in artifacts, not in prose.** `/frame` produces `prd.md`, `/plan` produces `sprint-contract.md`, `/qa` produces `qa-report.md`. But the SKILL.md doesn't say what good content looks like in those files. Compare PM `prd-development` which lists 9 required PRD sections in the SKILL.md itself.

- **Pattern 4 — Failure modes are runtime concerns, not prose concerns.** `/build`, `/review`, `/qa` all gracefully delegate failure handling to the advisor's `stage_outcome` field. But the prose doesn't enumerate "here are the 5 ways this stage typically fails and what to do about each." Compare `cso` which has a numbered FP exclusion list with case-precedent references.

- **Pattern 5 — Discipline is concentrated in support, not in canonical.** The strongest discipline lives in `cso`, `investigate`, `simplify`, `qa-only`, `design-review`, `canary`, `benchmark`. The canonical 9 are governance and routing. The user's intuition that "Nexus skills feel weak compared to Superpowers" is really about canonical-9 weakness; the support layer is competitive with upstream.

- **Pattern 6 — Personas are inconsistent.** Some support skills open with a strong persona ("You are a Performance Engineer who has optimized apps serving millions of requests"), which sets implicit discipline through voice. Canonical skills have no persona — they're terse, governance-flavored. A modest persona injection would raise perceived rigor without adding rules.

- **Pattern 7 — No "stop and ask" pattern in canonical.** Superpowers' systematic-debugging has the 3-strike rule. Nexus's `investigate` borrows it. But `/build`, `/review`, `/qa` have no analogous escalation rule when the work isn't progressing. The prose implicitly trusts the advisor JSON to surface stuckness.

- **Pattern 8 — Cross-skill discipline is not enforced.** When `/review` lands with advisories, the advisor surfaces `/simplify` as a side skill. Good. But `/simplify` doesn't reciprocate by saying "if the simplification reveals unsafe behavior, return to `/review` with a finding." Discipline flows down but not back up.

---

## Strengthening priority

Top 10 skills to strengthen first, ROI-ordered:

| Rank | Skill | Reason | Effort |
|---|---|---|---|
| 1 | `plan` | Largest single gap. Plans are the contract executed by `/build`; vague plans guarantee weak builds. Borrowing Superpowers `writing-plans` content contract has the highest leverage. | L |
| 2 | `build` | TDD Iron Law + verification-before-claim missing. Implementation is the most consequential stage; the prose is the thinnest. | M |
| 3 | `review` | Verification-before-claim + reviewer-disagreement protocol missing. Every release passes through this gate. | M |
| 4 | `qa` | The discipline already exists in `qa-only`; replicate it in the canonical lifecycle path. Cheapest high-leverage win. | M |
| 5 | `frame` | PRD content contract + hypothesis framing missing. Bad framing pollutes everything downstream. | M |
| 6 | `discover` | Discovery anti-patterns + minimum signal bar missing. Cheap to fix, sets the tone for the run. | M |
| 7 | `ship` | Pre-merge gate is implicit; make it explicit and adopt Superpowers' merge-discipline rules. | S |
| 8 | `closeout` | Add stale-evidence detection and a closeout integrity checklist. Small but compounding gain. | S |
| 9 | `learn` | Make confidence rubric and capture-cadence explicit; expected to compound across many sessions. | S |
| 10 | `handoff` | Add staleness check and recovery-from-blocked rule; cheap and removes a class of confusing behavior. | S |

Skills already strong (no immediate work): `investigate`, `simplify`, `cso`, `canary`,
`benchmark`, `qa-only`, `design-review`, `careful`, `freeze`, `guard`.

Skills that are infrastructure / no SDD counterpart (don't grade against discipline):
`browse`, `connect-chrome`, `setup-browser-cookies`, `setup-deploy`, `nexus-upgrade`,
`unfreeze`, `nexus`.

---

## Recommended next steps

1. **Land an RFC titled "Track E: Nexus Skill Strengthening"** sequencing the top 10 above. Assign each entry a one-line "what to add" and the file path of the SKILL.md.tmpl to edit.
2. **Adopt three patterns Nexus-wide.** (a) Iron Law block at the top of every canonical SKILL.md. (b) "Verification before claiming complete" block referencing the specific commands. (c) Failure-mode taxonomy with at least 3 enumerated modes.
3. **Promote `cso` and `investigate` as in-house style references.** When strengthening canonical skills, point contributors at these as the bar to clear.
4. **Audit the auto-generated `SKILL.md` outputs after each strengthening pass.** The `.tmpl` source feeds the generated file; verify the strengthening actually appears in the artifact Claude reads at run time.
5. **Don't bundle Superpowers/GSD/PM as skills (Model γ remains rejected).** The right answer is to absorb specific patterns (Iron Laws, content contracts, escalation rules) directly into Nexus's own prose so the routing/governance and discipline layers stay co-located.
6. **Add cross-skill discipline backflows.** When a downstream skill discovers a problem (e.g., `/simplify` finds unsafe behavior, `/qa` finds a regression), the prose should explicitly route back to the originating canonical stage rather than silently completing.

---

## Appendix: external counterparts inventory

Quick reference table of which Superpowers/GSD/PM skill maps to which Nexus skill (or "no match" entries).

| Nexus skill | Superpowers | GSD | PM Skills | Notes |
|---|---|---|---|---|
| `discover` | — | — | `discovery-process`, `problem-framing-canvas`, `pol-probe` | PM corpus is the strongest match for problem-space exploration. |
| `frame` | — | — | `prd-development`, `epic-hypothesis`, `problem-statement` | PM `prd-development` is essentially the same skill, more rigorous. |
| `plan` | `writing-plans` | `plan-phase`, `discuss-phase` | `epic-breakdown-advisor`, `user-story-splitting` | Superpowers `writing-plans` is the strongest direct counterpart. |
| `handoff` | `subagent-driven-development` (loose) | `pause-work` | — | Mostly Nexus-specific. |
| `build` | `test-driven-development`, `verification-before-completion`, `executing-plans`, `subagent-driven-development` | `execute-phase`, `quick`, `fast` | — | Heavy gap. Superpowers TDD + verification cover most of what's missing. |
| `review` | `requesting-code-review`, `receiving-code-review`, `verification-before-completion` | `code-review` | — | Superpowers' two review skills are both relevant. |
| `qa` | `verification-before-completion` | `verify-work`, `audit-uat`, `audit-fix` | — | GSD `verify-work` is the strongest counterpart. |
| `ship` | `finishing-a-development-branch` | `ship`, `pr-branch` | — | Superpowers' Option 2 (push and create PR) is the closest. |
| `closeout` | — | `complete-milestone`, `audit-milestone` | — | GSD complete-milestone is the strongest counterpart. |
| `investigate` | `systematic-debugging` | `debug` | — | Already strong — direct port of Superpowers + GSD discipline. |
| `simplify` | (loose: TDD refactor phase) | — | — | Original to Nexus; no upstream. Already strong. |
| `cso` | — | — | — | Original to Nexus; the strongest skill in the corpus. |
| `qa-only` | `verification-before-completion` | `verify-work` | — | Already strong; replicate up into `qa`. |
| `design-review` | — | `ui-review` (loose) | — | Original to Nexus. Already strong. |
| `design-consultation` | — | — | `positioning-workshop` (loose) | Original to Nexus. |
| `design-html` | — | — | — | Original. |
| `design-shotgun` | — | — | — | Original. |
| `plan-design-review` | `requesting-code-review` (loose) | — | — | Design-domain analogue. |
| `benchmark` | — | — | — | Original. Already strong. |
| `canary` | — | — | — | Original. Already strong. |
| `deploy` | `finishing-a-development-branch` (loose) | — | — | Largely Nexus-specific. |
| `land` | `finishing-a-development-branch` Option 2 | — | — | Direct counterpart. |
| `land-and-deploy` | `finishing-a-development-branch` + post-merge | — | — | Composition. |
| `setup-deploy` | — | — | — | Configuration skill. No counterpart. |
| `setup-browser-cookies` | — | — | — | Configuration skill. No counterpart. |
| `connect-chrome` | — | — | — | Setup skill. No counterpart. |
| `browse` | — | — | — | Tool wrapper. No counterpart. |
| `codex` | `requesting-code-review` (loose) | — | — | Cross-model review wrapper. Original. |
| `learn` | — | — | — | Original. |
| `retro` | — | (loose: complete-milestone retro) | — | Original. |
| `document-release` | `finishing-a-development-branch` (loose) | `docs-update` | — | Largely Nexus-specific post-ship doc sync. |
| `nexus-upgrade` | — | `update` | — | Tool-specific upgrade flow. |
| `careful` | — | — | — | Safety hook skill. No counterpart. |
| `freeze` | `using-git-worktrees` (loose, scope isolation) | — | — | Different mechanism, similar intent. |
| `guard` | — | — | — | Composition of `careful` + `freeze`. |
| `unfreeze` | — | — | — | Cleanup skill. No counterpart. |
| `nexus` (root) | — | — | — | Routing manifest. No counterpart. |
