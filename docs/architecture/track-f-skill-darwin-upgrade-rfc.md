# Track F: Skill Darwin Upgrade

**Status:** Active.
**Anchor data:** `docs/architecture/skill-strength-audit-v3-darwin.md` (commit `3fdb8db`).
**Predecessor:** Track E (commits `4209cc4` → `09b330b`) — added Iron Laws to canonical 9 + `/learn`.
**Manual track — NOT for Codex auto-pickup.**

---

## Why Track F exists

Track E hit its rigor target (canonical 9 from 1.93/5 to 4.42/5 under the v1/v2 framework). The v3 Darwin audit applied a different lens — engineering quality + actual workflow usability — and revealed Track E's limit:

| | v1/v2 (rigor) | v3 (Darwin engineering) |
|---|---|---|
| Track E 10 | **4.40/5** ✅ HIT target | **73.1/100** ❌ -12.4 vs control |
| Control 3 | 4.47/5 | 85.5/100 |

**The gap is operational, not rigor.** Iron Laws tell the LLM *what must be true at decision time*; they don't tell it *what to do in what order*. The Darwin audit shows:

- Track E lifted the dimensions Iron Laws should lift: D3 Edge Cases (+0.2 vs control), D5 Instruction Specificity (-0.2), D8 Real-World Performance (-1.0).
- Track E did NOT lift the dimensions Iron Laws don't touch: **D2 Workflow Clarity (-3.6, the largest gap)**, D4 Checkpoint Design (-0.9), D1 Frontmatter (-2.4), D6 Resource Integration (-1.3), D7 Overall Architecture (-0.9).

Calibration is honest — Iron Laws didn't accidentally inflate the dimensions they don't mechanically affect.

**The next phase is procedural, not more rigor.** Track F adds numbered workflows + checkpoints + test prompts + frontmatter triggers alongside Iron Laws. The two are complementary.

---

## Goals

1. Lift the canonical 9 from Darwin **mean 73.1 → ≥85** (control parity).
2. Preserve all Track E Iron Laws verbatim. Track F adds; it does not replace.
3. Preserve Nexus-native voice. No wrapping Superpowers/GSD/PM.
4. Preserve Model γ (no third-party skill bundling).
5. Each phase ≤1 day of focused work (per `/plan` Law 1, dogfooding).

---

## Five upgrade actions (per the v3 Darwin recommendations)

Each phase applies these five actions to one canonical skill:

### Action 1 — Numbered "How to" workflow section

The biggest lever. Add a new `## How to run this stage` section that enumerates 5–8 numbered steps with explicit inputs/outputs per step. This is the dimension Track E missed entirely.

**Pattern reference:** `/investigate`'s 4-phase protocol (locate → analyze → hypothesize → fix), `/cso`'s arguments table, `/codex`'s 3-mode dispatch.

**Lift:** D2 Workflow Clarity from ~5/10 toward ~8/10 (+3 raw, ×15 weight = +4.5/skill); D8 Real-World Performance from ~7.7/10 toward ~9/10 (+1.3 raw, ×25 weight = +3.25/skill).

**Combined per-skill: ~+8/100 (the largest single move available).**

Placement: after the Iron Laws section, before the existing Operator Checklist. Iron Laws say *what must be true*; the workflow says *what to do in what order*. Reading sequence: discipline → procedure → contract → routing.

### Action 2 — Frontmatter trigger phrases

The current canonical descriptions are deliberately terse for the dispatcher. Add 1–2 trigger phrases without breaking discovery:

> Canonical Nexus build command. Executes the bounded governed implementation contract. **Use when the user says "implement task X", "build feature Y", or asks to execute a sprint contract.** (nexus)

**Lift:** D1 Frontmatter from ~6/10 toward ~8/10 (+2 raw, ×8 weight = +1.6/skill).

### Action 3 — Typical-prompt examples (2–3 per skill)

Add a `## Typical prompts` section with 2–3 examples that show how the skill should respond to common requests. Functions as documentation AND as a self-test target.

**Pattern reference:** `/cso`'s arguments table.

**Lift:** D8 Real-World Performance from ~7.7/10 toward ~9/10 (already partially captured by Action 1; the cumulative D8 gain across Action 1 + Action 3 is ~+1.5 raw, ×25 weight = +3.75/skill).

### Action 4 — AskUserQuestion gates at Iron Law branching points

Some Iron Laws imply branching but don't gate on operator confirmation. Add `AskUserQuestion` at the right moments:

- `/build` Law 2 (3-strike): "Continue investigating / Escalate / Add logging?" (mirrors `/investigate` Phase 3)
- `/qa` Law 3 (3-cluster stop): "Confirm cluster and route to /investigate?"
- `/closeout` Law 2 (stale audit): "Rerun review / Accept staleness with note?"
- `/handoff` Law 2 (recovery): already added in Track E
- `/discover` Law 1 (anti-pattern detected): "Reframe / Continue / Route to /pol-probe?"

**Lift:** D4 Checkpoint Design from ~6.1/10 toward ~7.5/10 (+1.4 raw, ×7 weight = +1/skill, but only ~5 of 9 skills benefit).

### Action 5 — Standardize `/discover` Completion Advisor footer

`/discover` is the only canonical skill missing the `{{NEXUS_COMPLETION_ADVISOR:discover}}` template footer. Add it for consistency.

**Lift:** D7 Overall Architecture from 7/10 to 8.5/10 on `/discover` only (+1.5 raw, ×15 = +2.25 single-skill).

---

## Per-phase ROI projection

| Phase | Skill | Darwin baseline | Projected post-F | Δ | Effort |
|---|---|---|---|---|---|
| F.1 | `/discover` | 66.8 | 80–82 | ~+14 | M (+ Action 5 single fix) |
| F.2 | `/build` | 69.5 | 82–84 | ~+13 | M |
| F.3 | `/plan` | 69.5 | 82–84 | ~+13 | M |
| F.4 | `/handoff` | 72.7 | 83–85 | ~+11 | S |
| F.5 | `/frame` | 73.5 | 84–86 | ~+11 | M |
| F.6 | `/qa` | 73.8 | 84–86 | ~+11 | S |
| F.7 | `/closeout` | 74.5 | 85–87 | ~+11 | S |
| F.8 | `/review` | 75.2 | 86–88 | ~+11 | S |
| F.9 | `/ship` | 75.2 | 86–88 | ~+11 | S |

**Track F target:** mean from 73.1 → ~85.5 (matches control). Total Track F effort: ~9 days at ≤1-day-per-phase budget; realistically ~6h since each phase shares structural pattern.

`/learn` is intentionally excluded — already at 80.3 under Darwin. Marginal gain not worth the work.

---

## Voice constraints (CRITICAL)

These match Track E's discipline:

| Pattern | Don't | Do |
|---|---|---|
| Workflow framing | "Steps to follow" | "Step 1: Read `sprint-contract.md`. Each task in the contract has an acceptance criterion (per `/plan` Law 1) — extract them. Step 2: ..." |
| Trigger phrasing | Generic "use this command" | Concrete, in user vocabulary: "Use when the user says 'implement task X' or 'build feature Y'." |
| Test prompt framing | "Examples" | "Typical prompts this skill handles well" — concrete user-side language, not abstract. |
| Cross-skill flow | "Then go to next stage" | Iron-Law-aware: "When this completes, the advisor record carries `stage_outcome: ready`. `/review` reads this and applies its own Iron Laws (per `/review` Law 1)." |
| Checkpoint framing | Vague "ask user" | Specific options: "AskUserQuestion: 'Continue investigating / Escalate to user / Add diagnostic logging?'" |

Reuse the meta-justification ("short and absolute on purpose") from Track E for any new mandatory rules. Numbered workflows themselves are NOT Iron Laws — they're procedure, not constraint.

---

## What Track F is NOT

- **NOT replacing Iron Laws.** Iron Laws stay verbatim. Workflows are added alongside.
- **NOT bundling Superpowers procedural patterns wholesale.** We adapt to Nexus-native concepts (advisor record, stage_outcome, sprint-contract.md, run_id).
- **NOT adding new lifecycle stages.** The 9 canonical stages remain.
- **NOT modifying runtime contracts** (`lib/nexus/stage-content/*`, `lib/nexus/stage-packs/*`). Prose only.
- **NOT touching the 27 non-Track-E support skills.** That's a hypothetical Track G.

---

## Per-phase brief structure

Each phase brief follows the Track E pattern:

```
# Track F Phase N Brief: upgrade `/<skill>` SKILL.md (Darwin)

**Status:** Ready for manual authoring.
**Darwin baseline:** XX.X/100 (per audit-v3).
**Darwin target:** ≥XX/100.
**Audit anchor:** [link to audit-v3 per-skill section]

## Surface map
[file modified, file NOT modified, frontmatter changes]

## Action 1 — Numbered workflow design
[5-8 steps, per-step I/O, voice samples]

## Action 2 — Frontmatter trigger phrases
[old → new diff]

## Action 3 — Typical prompts
[2-3 example prompts with expected behavior]

## Action 4 — AskUserQuestion gates (if applicable)
[branching points + question text]

## Action 5 — Completion Advisor footer (F.1 only for /discover)

## Implementation procedure
[edit, regenerate, verify, commit]

## Acceptance criteria
[≥6 checks]

## Voice constraints
[per Track F voice table]

## Risk register
[3-5 risks]
```

Brief target: ~250–300 lines. Implementation: ~30–60 min per phase.

---

## Acceptance criteria (overall track)

Track F is complete when:

1. ✅ All 9 canonical skill SKILL.md files have a numbered "How to run this stage" section between Iron Laws and Operator Checklist.
2. ✅ All 9 canonical frontmatters carry trigger phrases.
3. ✅ All 9 canonical SKILL.md files have a `## Typical prompts` section with ≥2 examples.
4. ✅ ≥5 of 9 canonical skills have new `AskUserQuestion` gates at Iron Law branching points.
5. ✅ `/discover` has the standardized Completion Advisor footer.
6. ✅ `bun run skill:check` clean across all 4 hosts after each phase.
7. ✅ Re-audit (v4) confirms canonical 9 Darwin mean ≥ 85/100 (control parity) and v2 5-dim mean unchanged at ~4.42 (no rigor regression).

---

## Phase list

| Phase | Skill | Issue | Status |
|---|---|---|---|
| F.1 | `/discover` (lowest baseline + footer fix) | TBD | pending |
| F.2 | `/build` | TBD | pending |
| F.3 | `/plan` | TBD | pending |
| F.4 | `/handoff` | TBD | pending |
| F.5 | `/frame` | TBD | pending |
| F.6 | `/qa` | TBD | pending |
| F.7 | `/closeout` | TBD | pending |
| F.8 | `/review` | TBD | pending |
| F.9 | `/ship` | TBD | pending |

Issues filed at Track F kickoff (after RFC commits) with `manual-only` label, mirroring Track E's anti-Codex-pickup discipline.

---

## Implementation kickoff

After this RFC commits and the user approves direction:

1. File 9 GitHub issues for F.1–F.9 with `manual-only` label.
2. Begin F.1 (`/discover`) brief.
3. Phase-by-phase rhythm: brief → implementation → commit → close issue → next phase.
4. Re-run audit (v4 Darwin) after F.9 lands; verify ≥85/100 mean.

The work is sized to be completable in a focused session-and-a-half. The Iron Laws backbone from Track E is the structural scaffold; Track F fills in the procedural muscle.
