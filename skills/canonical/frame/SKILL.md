---
name: frame
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus framing command. Writes repo-visible framing artifacts and stage
  status through Nexus-owned normalization and governance. Use when the user says
  "frame the scope", "write the PRD", "define what we're building", or when
  discovery is complete enough to define scope and success criteria before /plan
  can sequence tasks. (nexus)
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/nexus/bin/nexus-update-check 2>/dev/null || .claude/skills/nexus/bin/nexus-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.nexus/sessions
touch ~/.nexus/sessions/"$PPID"
_SESSIONS=$(find ~/.nexus/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.nexus/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_CONTRIB=$(~/.claude/skills/nexus/bin/nexus-config get nexus_contributor 2>/dev/null || true)
_PROACTIVE=$(~/.claude/skills/nexus/bin/nexus-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.nexus/.proactive-prompted ] && echo "yes" || echo "no")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(~/.claude/skills/nexus/bin/nexus-config get skill_prefix 2>/dev/null || echo "false")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
_MODE_CONFIGURED=$(~/.claude/skills/nexus/bin/nexus-config get execution_mode 2>/dev/null || true)
_PRIMARY_PROVIDER_CONFIG=$(~/.claude/skills/nexus/bin/nexus-config get primary_provider 2>/dev/null || true)
_TOPOLOGY_CONFIG=$(~/.claude/skills/nexus/bin/nexus-config get provider_topology 2>/dev/null || true)
if command -v ask >/dev/null 2>&1; then
  _CCB_AVAILABLE="yes"
else
  _CCB_AVAILABLE="no"
fi
if [ -n "$_MODE_CONFIGURED" ]; then
  _EXECUTION_MODE="$_MODE_CONFIGURED"
  _EXECUTION_MODE_CONFIGURED="yes"
else
  _EXECUTION_MODE_CONFIGURED="no"
  if [ "$_CCB_AVAILABLE" = "yes" ]; then
    _EXECUTION_MODE="governed_ccb"
  else
    _EXECUTION_MODE="local_provider"
  fi
fi
if [ "$_EXECUTION_MODE" = "governed_ccb" ]; then
  _PRIMARY_PROVIDER="codex"
  _PROVIDER_TOPOLOGY="multi_session"
else
  if [ -n "$_PRIMARY_PROVIDER_CONFIG" ]; then
    _PRIMARY_PROVIDER="$_PRIMARY_PROVIDER_CONFIG"
  elif command -v claude >/dev/null 2>&1; then
    _PRIMARY_PROVIDER="claude"
  elif command -v codex >/dev/null 2>&1; then
    _PRIMARY_PROVIDER="codex"
  elif command -v gemini >/dev/null 2>&1; then
    _PRIMARY_PROVIDER="gemini"
  else
    _PRIMARY_PROVIDER="claude"
  fi
  if [ -n "$_TOPOLOGY_CONFIG" ]; then
    _PROVIDER_TOPOLOGY="$_TOPOLOGY_CONFIG"
  else
    _PROVIDER_TOPOLOGY="single_agent"
  fi
fi
_EFFECTIVE_EXECUTION=$(~/.claude/skills/nexus/bin/nexus-config effective-execution 2>/dev/null || true)
if [ -n "$_EFFECTIVE_EXECUTION" ]; then
  _EXECUTION_MODE=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^execution_mode:/{print $2; exit}')
  _EXECUTION_MODE_CONFIGURED=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^execution_mode_configured:/{print $2; exit}')
  _PRIMARY_PROVIDER=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^effective_primary_provider:/{print $2; exit}')
  _PROVIDER_TOPOLOGY=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^effective_provider_topology:/{print $2; exit}')
  _EXECUTION_MODE_SOURCE=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^execution_mode_source:/{print $2; exit}')
  _EXECUTION_PATH=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^effective_requested_execution_path:/{print $2; exit}')
  _CURRENT_SESSION_READY=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^current_session_ready:/{print $2; exit}')
  _REQUIRED_GOVERNED_PROVIDERS=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^required_governed_providers:/{print $2; exit}')
  _GOVERNED_READY=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^governed_ready:/{print $2; exit}')
  _MOUNTED_PROVIDERS=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^mounted_providers:/{print $2; exit}')
  _MISSING_PROVIDERS=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^missing_providers:/{print $2; exit}')
  _LOCAL_PROVIDER_CANDIDATE=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^local_provider_candidate:/{print $2; exit}')
  _LOCAL_PROVIDER_TOPOLOGY=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^local_provider_topology:/{print $2; exit}')
  _LOCAL_PROVIDER_EXECUTION_PATH=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^local_provider_requested_execution_path:/{print $2; exit}')
  _LOCAL_PROVIDER_READY=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^local_provider_ready:/{print $2; exit}')
  _LOCAL_CLAUDE_AGENT_TEAM_READY=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^local_claude_agent_team_ready:/{print $2; exit}')
  _LOCAL_CLAUDE_AGENT_TEAM_REASON=$(printf '%s
' "$_EFFECTIVE_EXECUTION" | awk -F': ' '/^local_claude_agent_team_readiness_reason:/{print $2; exit}')
else
  _EXECUTION_MODE_SOURCE=""
  _EXECUTION_PATH=""
  _CURRENT_SESSION_READY="unknown"
  _REQUIRED_GOVERNED_PROVIDERS=""
  _GOVERNED_READY=""
  _MOUNTED_PROVIDERS=""
  _MISSING_PROVIDERS=""
  _LOCAL_PROVIDER_CANDIDATE=""
  _LOCAL_PROVIDER_TOPOLOGY=""
  _LOCAL_PROVIDER_EXECUTION_PATH=""
  _LOCAL_PROVIDER_READY=""
  _LOCAL_CLAUDE_AGENT_TEAM_READY=""
  _LOCAL_CLAUDE_AGENT_TEAM_REASON=""
fi
echo "CCB_AVAILABLE: $_CCB_AVAILABLE"
echo "EXECUTION_MODE: $_EXECUTION_MODE"
echo "EXECUTION_MODE_CONFIGURED: $_EXECUTION_MODE_CONFIGURED"
echo "EXECUTION_MODE_SOURCE: $_EXECUTION_MODE_SOURCE"
echo "PRIMARY_PROVIDER: $_PRIMARY_PROVIDER"
echo "PROVIDER_TOPOLOGY: $_PROVIDER_TOPOLOGY"
echo "EXECUTION_PATH: $_EXECUTION_PATH"
echo "CURRENT_SESSION_READY: $_CURRENT_SESSION_READY"
echo "REQUIRED_GOVERNED_PROVIDERS: $_REQUIRED_GOVERNED_PROVIDERS"
echo "GOVERNED_READY: $_GOVERNED_READY"
echo "MOUNTED_PROVIDERS: $_MOUNTED_PROVIDERS"
echo "MISSING_PROVIDERS: $_MISSING_PROVIDERS"
echo "LOCAL_PROVIDER_CANDIDATE: $_LOCAL_PROVIDER_CANDIDATE"
echo "LOCAL_PROVIDER_TOPOLOGY: $_LOCAL_PROVIDER_TOPOLOGY"
echo "LOCAL_PROVIDER_EXECUTION_PATH: $_LOCAL_PROVIDER_EXECUTION_PATH"
echo "LOCAL_PROVIDER_READY: $_LOCAL_PROVIDER_READY"
echo "LOCAL_CLAUDE_AGENT_TEAM_READY: $_LOCAL_CLAUDE_AGENT_TEAM_READY"
echo "LOCAL_CLAUDE_AGENT_TEAM_REASON: $_LOCAL_CLAUDE_AGENT_TEAM_REASON"
source <(~/.claude/skills/nexus/bin/nexus-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.nexus/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
# Learnings count
eval "$(~/.claude/skills/nexus/bin/nexus-slug 2>/dev/null)" 2>/dev/null || true
_LEARN_FILE="$HOME/.nexus/projects/${SLUG:-unknown}/learnings.jsonl"
if [ -f "$_LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$_LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries loaded"
else
  echo "LEARNINGS: 0"
fi
# Check if CLAUDE.md already has Nexus routing guidance or an equivalent routing rule
_HAS_ROUTING="no"
if [ -f CLAUDE.md ]; then
  if grep -q "## Nexus Skill Routing" CLAUDE.md 2>/dev/null; then
    _HAS_ROUTING="yes"
  elif grep -Eiq 'route lifecycle work through .*?/discover.*?/closeout' CLAUDE.md 2>/dev/null; then
    _HAS_ROUTING="yes"
  elif grep -Fq "When the user's request matches a canonical Nexus command, invoke that command first." CLAUDE.md 2>/dev/null; then
    _HAS_ROUTING="yes"
  fi
fi
_ROUTING_DECLINED=$(~/.claude/skills/nexus/bin/nexus-config get routing_declined 2>/dev/null || echo "false")
echo "HAS_ROUTING: $_HAS_ROUTING"
echo "ROUTING_DECLINED: $_ROUTING_DECLINED"
```

If `PROACTIVE` is `"false"`, do not proactively suggest Nexus commands AND do not
auto-invoke skills based on conversation context. Only run skills the user explicitly
types (e.g., /qa, /ship). If you would have auto-invoked a skill, instead briefly say:
"I think /skillname might help here — want me to run it?" and wait for confirmation.
The user opted out of proactive behavior.

If `SKILL_PREFIX` is `"true"`, the user has namespaced Nexus commands. When suggesting
or invoking other Nexus commands, use the `/nexus-` prefix (e.g., `/nexus-qa` instead
of `/qa`, `/nexus-ship` instead of `/ship`). Disk paths are unaffected — always use
`~/.claude/skills/nexus/[skill-name]/SKILL.md` for reading skill files.

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/nexus/nexus-upgrade/SKILL.md` and follow the release-based "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). `/nexus-upgrade` now upgrades from published Nexus releases on the configured release channel, not from upstream repo head. If `JUST_UPGRADED <from> <to>`: tell user "Running Nexus v{to} (just updated!)" and continue.

If `JUST_UPGRADED <from> <to>` is present, always include the standardized runtime summary before moving on to work, even when `EXECUTION_MODE_CONFIGURED` is `yes`.

When summarizing setup or upgrade state, always keep `REPO_MODE` and `EXECUTION_MODE` separate:
- `REPO_MODE` is repo ownership only, for example `solo` or `collaborative`
- `EXECUTION_MODE` is runtime routing only, either `governed_ccb` or `local_provider`
- Never describe `solo` or `collaborative` as an execution mode
- If `EXECUTION_MODE_CONFIGURED` is `no`, say it is the current default derived from machine state, not a saved preference
- `EXECUTION_MODE_SOURCE` explains whether the active route came from a saved preference or a machine-state default
- `EXECUTION_PATH` is the current effective route, for example `codex-via-ccb`
- `CURRENT_SESSION_READY` tells you whether the chosen route is runnable right now in this host/session
- `REQUIRED_GOVERNED_PROVIDERS` is the governed provider set Nexus needs for the standard dual-audit path
- when `EXECUTION_MODE=governed_ccb`, also surface `GOVERNED_READY`, `MOUNTED_PROVIDERS`, and `MISSING_PROVIDERS`
- `LOCAL_PROVIDER_CANDIDATE`, `LOCAL_PROVIDER_TOPOLOGY`, `LOCAL_PROVIDER_EXECUTION_PATH`, and `LOCAL_PROVIDER_READY` describe the current-host local fallback path

Whenever you summarize setup, upgrade, or first-run state, present runtime status in this order:
- Repo mode: `REPO_MODE`
- Execution mode: `EXECUTION_MODE` plus whether it is a saved preference or a machine-state default (`EXECUTION_MODE_SOURCE`)
- Execution path: `EXECUTION_PATH`
- Current session ready: `CURRENT_SESSION_READY`
- If `EXECUTION_MODE=governed_ccb`: governed ready, mounted providers, missing providers
- If `EXECUTION_MODE=local_provider` because governed CCB is not ready, explicitly say whether that is because CCB is missing or because mounted providers are incomplete, and include the local fallback path
- Branch: `_BRANCH`
- Proactive: `PROACTIVE`

When `EXECUTION_MODE=governed_ccb` and `CURRENT_SESSION_READY` is `no`, explicitly tell the user whether the gap is:
- CCB not installed (`CCB_AVAILABLE=no`), or
- CCB installed but required providers are not mounted (`MISSING_PROVIDERS` is non-empty)

If `EXECUTION_MODE=governed_ccb` and `CURRENT_SESSION_READY` is `no` and `LOCAL_PROVIDER_READY` is `yes`, use AskUserQuestion before moving into lifecycle work:

> Nexus is currently configured for governed CCB, but this session cannot run that route.
> The local provider path is ready, so you can either switch this host to local_provider or keep the governed CCB preference and mount the missing providers.
>
> RECOMMENDATION: Choose A if you want to work now in this host. Choose B only if you intend to mount CCB providers before continuing.
> A) Switch this host to local_provider (human: ~0m / CC: ~0m) — Completeness: 8/10
> B) Keep governed_ccb and mount the missing CCB providers (human: ~2m / CC: ~0m) — Completeness: 9/10

If A:
```bash
~/.claude/skills/nexus/bin/nexus-config set execution_mode local_provider
if [ -n "$_LOCAL_PROVIDER_CANDIDATE" ]; then
  ~/.claude/skills/nexus/bin/nexus-config set primary_provider "$_LOCAL_PROVIDER_CANDIDATE"
fi
if [ -n "$_LOCAL_PROVIDER_TOPOLOGY" ]; then
  ~/.claude/skills/nexus/bin/nexus-config set provider_topology "$_LOCAL_PROVIDER_TOPOLOGY"
fi
```
Then explain that future Nexus runs on this host will use `local_provider` until the user changes the saved preference.

If B: do not change Nexus config. Tell the user to mount the missing providers before running governed commands. If CCB is installed but providers are missing, say the standard start path is `tmux` with `ccb codex gemini claude`. If CCB is not installed, say they need to install or restore CCB first.

If `JUST_UPGRADED <from> <to>` is present and `EXECUTION_MODE_CONFIGURED` is `no`, state the effective execution mode explicitly using `EXECUTION_MODE`, `EXECUTION_MODE_SOURCE`, and `CCB_AVAILABLE`. Use `~/.claude/skills/nexus/bin/nexus-config effective-execution` when you need the effective provider, topology, or requested execution path.
When `EXECUTION_MODE=governed_ccb`, do not ask the user to configure `PRIMARY_PROVIDER` or `PROVIDER_TOPOLOGY`. Those are local-provider host preferences, not governed CCB config keys.

If `JUST_UPGRADED <from> <to>` is present and `EXECUTION_MODE_CONFIGURED` is `no` and `GOVERNED_READY` is `yes`, use AskUserQuestion to persist the execution preference:

> Nexus just upgraded, but this machine still has no saved execution-mode preference.
> Repo mode only tells you whether the repo is solo or collaborative.
> Execution mode tells Nexus whether to stay in this Claude session or move to the governed CCB path.
>
> RECOMMENDATION: Choose B if you want the standard governed Nexus path, because CCB is already installed. Completeness: 9/10.
> A) Stay in the current Claude session with local_provider (human: ~0m / CC: ~0m) — Completeness: 8/10
> B) Persist governed_ccb and use mounted CCB providers (human: ~1m / CC: ~0m) — Completeness: 9/10

If A:
```bash
~/.claude/skills/nexus/bin/nexus-config set execution_mode local_provider
~/.claude/skills/nexus/bin/nexus-config set primary_provider claude
```
Then explain that the current session can continue with `local_provider`, and if `PROVIDER_TOPOLOGY` is empty the default local topology is `single_agent`.

If B:
```bash
~/.claude/skills/nexus/bin/nexus-config set execution_mode governed_ccb
```
Then explain that `governed_ccb` requires active CCB providers for this repo, and that the standard way to start them is `tmux` with `ccb codex gemini claude` if they are not already mounted.

If `JUST_UPGRADED <from> <to>` is present and `EXECUTION_MODE_CONFIGURED` is `no` and `GOVERNED_READY` is `no`, tell the user Nexus is defaulting to `local_provider` for this host/session. If `CCB_AVAILABLE` is `no`, say that CCB is not detected. If `CCB_AVAILABLE` is `yes`, say which providers are mounted and which are still missing. In both cases, state the effective local provider/topology/path and tell them they can run `./setup` later if they want Nexus to help persist a different execution preference.

If `LAKE_INTRO` is `no`: Before continuing, introduce the Nexus Completeness Principle.
Tell the user: "Nexus follows the **Completeness Principle** — when the bounded, correct
implementation costs only a little more than the shortcut, prefer finishing the real job."

Then run:

```bash
touch ~/.nexus/.completeness-intro-seen
```

This only happens once.

If `PROACTIVE_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: After the lake intro is handled,
ask the user about proactive behavior. Use AskUserQuestion:

> Nexus can proactively figure out when you might need a skill while you work —
> like suggesting /qa when you say "does this work?" or /investigate when you hit
> a bug. We recommend keeping this on — it speeds up every part of your workflow.

Options:
- A) Keep it on (recommended)
- B) Turn it off — I'll type /commands myself

If A: run `~/.claude/skills/nexus/bin/nexus-config set proactive true`
If B: run `~/.claude/skills/nexus/bin/nexus-config set proactive false`

Always run:
```bash
touch ~/.nexus/.proactive-prompted
```

This only happens once. If `PROACTIVE_PROMPTED` is `yes`, skip this entirely.

If `HAS_ROUTING` is `no` AND `ROUTING_DECLINED` is `false` AND `PROACTIVE_PROMPTED` is `yes`:
Check if a CLAUDE.md file exists in the project root. If it does not exist, create it.
Before prompting, treat either the standard `## Nexus Skill Routing` section or any
existing instruction that routes lifecycle work through `/discover` to `/closeout`
as equivalent Nexus routing guidance. If equivalent guidance already exists, skip this entirely.

Use AskUserQuestion:

> Nexus works best when your project's CLAUDE.md includes canonical Nexus command
> routing guidance. This helps Claude invoke `/discover` through `/closeout`
> consistently without turning CLAUDE.md into a second contract layer.

Options:
- A) Add Nexus invocation guidance to CLAUDE.md (recommended)
- B) No thanks, I'll invoke Nexus commands manually

If A: Append this section to the end of CLAUDE.md only when the file does not already
contain equivalent Nexus routing guidance:

```markdown

## Nexus Skill Routing

When the user's request matches a canonical Nexus command, invoke that command first.
This guidance helps command discovery only.
Contracts, transitions, governed artifacts, and lifecycle truth are owned by `lib/nexus/`
and canonical `.planning/` artifacts.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke discover
- Scope definition, requirements framing, non-goals → invoke frame
- Architecture review, execution readiness, implementation planning → invoke plan
- Governed routing and handoff packaging → invoke handoff
- Bounded implementation execution → invoke build
- Code review, check my diff → invoke review
- QA, test the site, find bugs → invoke qa
- Ship, deploy, push, create PR → invoke ship
- Final governed verification and closure → invoke closeout
```

Do not auto-commit the file. After updating `CLAUDE.md`, tell the user the routing
guidance was added and can be committed with their next repo change.

If B: run `~/.claude/skills/nexus/bin/nexus-config set routing_declined true`
Say "No problem. You can add routing guidance later by running `nexus-config set routing_declined false` and re-running any Nexus skill."

This only happens once per project. If `HAS_ROUTING` is `yes` or `ROUTING_DECLINED` is `true`, skip this entirely.

## Voice

**Tone:** direct, concrete, sharp, never corporate, never academic. Sound like a builder, not a consultant. Name the file, the function, the command. No filler, no throat-clearing.

**Writing rules:** No em dashes (use commas, periods, "..."). No AI vocabulary (delve, crucial, robust, comprehensive, nuanced, etc.). Short paragraphs. End with what to do.

The user always has context you don't. Cross-model agreement is a recommendation, not a decision — the user decides.

## Stage-Aware Local Topology Chooser

If `EXECUTION_MODE=local_provider` and `PRIMARY_PROVIDER=claude`, ask the user which local execution topology to use before starting `/frame`.

RECOMMENDATION: Choose C when available for broad product/engineering/design tradeoff exploration; choose B for a faster structured second pass. Completeness: 9/10.

Use AskUserQuestion with these options:
- A) `single_agent` — One Claude session. Lowest coordination overhead and safest for sequential work.
- B) `subagents` — Focused local Claude subagents. Good for quick parallel checks whose results return to the lead.
- C) `agent_team` — Claude Code Agent Teams. Best when teammates should coordinate, challenge each other, or work from independent perspectives.

If `LOCAL_CLAUDE_AGENT_TEAM_READY` is not `yes`, still show option C but mark it unavailable and include `LOCAL_CLAUDE_AGENT_TEAM_REASON`. Do not set `agent_team` unless the user explicitly chooses to configure Claude Code first.

Stage-specific guidance:
- `/review`: `agent_team` maps naturally to code / security / test / performance / design reviewers.
- `/investigate`: `agent_team` maps naturally to competing root-cause hypotheses.
- `/frame` and `/plan`: `agent_team` maps naturally to CEO / engineering / design / risk perspectives.
- `/build`: prefer `single_agent` for same-file edits or tightly coupled implementation; only choose team modes when file ownership can be split.
- `/ship`: `subagents` or `agent_team` can cover release / QA / security / docs-deploy gates.

If the user chooses A:
```bash
~/.claude/skills/nexus/bin/nexus-config set provider_topology single_agent
```

If the user chooses B:
```bash
~/.claude/skills/nexus/bin/nexus-config set provider_topology subagents
```

If the user chooses C and `LOCAL_CLAUDE_AGENT_TEAM_READY=yes`:
```bash
~/.claude/skills/nexus/bin/nexus-config set provider_topology agent_team
```

After setting the topology, continue with the canonical Nexus command.

## Contributor Mode

If `_CONTRIB` is `true`: you are in **contributor mode**. At the end of each major workflow step, rate your Nexus experience 0-10. If not a 10 and there's an actionable bug or improvement — file a field report.

**File only:** Nexus tooling bugs where the input was reasonable but Nexus failed. **Skip:** user app bugs, network errors, auth failures on user's site.

**To file:** write `~/.nexus/contributor-logs/{slug}.md`:
```
# {Title}
**What I tried:** {action} | **What happened:** {result} | **Rating:** {0-10}
## Repro
1. {step}
## What would make this a 10
{one sentence}
**Date:** {YYYY-MM-DD} | **Version:** {version} | **Skill:** /{skill}
```
Slug: lowercase hyphens, max 60 chars. Skip if exists. Max 3/session. File inline, don't stop.

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — All steps completed successfully. Evidence provided for each claim.
- **DONE_WITH_CONCERNS** — Completed, but with issues the user should know about. List each concern.
- **BLOCKED** — Cannot proceed. State what is blocking and what was tried.
- **NEEDS_CONTEXT** — Missing information required to continue. State exactly what you need.

### Escalation

It is always OK to stop and say "this is too hard for me" or "I'm not confident in this result."

Bad work is worse than no work. You will not be penalized for escalating.
- If you have attempted a task 3 times without success, STOP and escalate.
- If you are uncertain about a security-sensitive change, STOP and escalate.
- If the scope of work exceeds what you can verify, STOP and escalate.

Escalation format:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

## Plan Mode Safe Operations

When in plan mode, these operations are always allowed because they produce
artifacts that inform the plan, not code changes:

- `$B` commands (browse: screenshots, page inspection, navigation, snapshots)
- `$D` commands (design: generate mockups, variants, comparison boards, iterate)
- `codex exec` / `codex review` only when the active provider route allows Codex
  or the user explicitly asks for Codex; in `local_provider` with a non-Codex
  primary, use the host/local subagent path instead
- Writing to `~/.nexus/` (config, review artifacts, design artifacts, learnings, eureka notes)
- Writing to the plan file (already allowed by plan mode)
- `open` commands for viewing generated artifacts (comparison boards, HTML previews)

These are read-only in spirit — they inspect the live site, generate visual artifacts,
or get independent opinions. They do NOT modify project source files.

## Plan Status Footer

When you are in plan mode and about to call ExitPlanMode:

1. Check if the plan file already has a `## NEXUS REVIEW REPORT` section.
2. If it DOES — skip (a review skill already wrote a richer report).
3. If it does NOT — run this command:

\`\`\`bash
~/.claude/skills/nexus/bin/nexus-review-read
\`\`\`

Then write a `## NEXUS REVIEW REPORT` section to the end of the plan file:

- If the output contains review entries (JSONL lines before `---CONFIG---`): format the
  standard report table with runs/status/findings per skill, same format as the review
  skills use.
- If the output is `NO_REVIEWS` or empty: write this placeholder table:

\`\`\`markdown
## NEXUS REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | 0 | — | — |
| Codex Review | \`/codex review\` | Independent 2nd opinion | 0 | — | — |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | 0 | — | — |
| Design Review | \`/plan-design-review\` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run \`/autoplan\` for full review pipeline, or individual reviews above.
\`\`\`

**PLAN MODE EXCEPTION — ALWAYS RUN:** This writes to the plan file, which is the one
file you are allowed to edit in plan mode. The plan file review report is part of the
plan's living status.

# /frame — Nexus Framing

Nexus-owned framing guidance for scope, non-goals, and success criteria.

## Iron Laws (mandatory; non-negotiable)

These three rules apply to every `/frame` invocation regardless of provider, topology, or run mode. They are short and absolute on purpose — discipline that lives in qualifiers does not survive contact with the LLM at decision time. `/frame` is the input contract for everything downstream — `/plan`, `/build`, `/review`, `/qa` — and ambiguity here propagates straight through to the user.

### Law 1 — PRD Content Contract

`docs/product/prd.md` MUST contain these seven sections, each non-empty:

1. **Problem statement** — who hurts, how, and how much (2–4 sentences). "Users are frustrated" is rejected; specify the user, the action they fail at, and the cost.
2. **Hypothesis** — the "If/Then/Because" statement (see Law 2). Without a hypothesis, the PRD is wishful description, not framing.
3. **Success criteria** — observable, falsifiable conditions. Each one must answer "what command/metric/artifact reveals whether this is achieved?" Vague criteria like "users love it" are rejected; "task completion rate >85% on the X flow" is accepted.
4. **Non-goals** — ≥3 concrete things this work will NOT do. The non-goals section is where scope creep gets pre-empted; an empty non-goals section means scope is undefined.
5. **Risks** — ≥3 specific failure modes the framing acknowledges, each with a one-sentence mitigation or "accepted; will revisit if it materializes" note.
6. **Alternatives considered** — at least one rejected alternative with the reason it was rejected. "We considered nothing else" is a sign the framing is premature.
7. **Decision rationale** — why this scope, why now, what changes when this ships. The rationale is what `/review` reads when judging whether the work matches intent.

A PRD missing any of the seven sections is not a PRD; it is a wishlist. Wishlists don't survive contact with `/plan`.

### Law 2 — Hypothesis Framing

Every framed scope MUST articulate its hypothesis as:

> **If we [action], then [users] will [outcome] because [evidence].**

Each clause is mandatory:

- **Action** — what the work does, in concrete verbs (build, ship, change, deprecate). Not "improve" or "enhance"; those are direction without target.
- **Users** — who is affected, named specifically. "All users" is rarely true; specify the segment whose behavior the hypothesis predicts.
- **Outcome** — the observable change in user behavior or system state. Must be falsifiable in the same way Law 1 success criteria are.
- **Evidence** — what makes the team believe this hypothesis is true now. Could be data, prior research, customer interviews, market signal, or explicit reasoning. "We think it'll work" is not evidence; it is hope.

The hypothesis is the contract `/review` evaluates against. When `/review` asks "did this work deliver what `/frame` framed?", the hypothesis is what answers that question. A scope without a hypothesis cannot be reviewed honestly.

Stating a hypothesis up front also surfaces disagreement early. If two teammates can't agree on the [evidence] clause, the framing is not yet ready for `/plan`.

### Law 3 — Framing Readiness Gate Before `/plan`

Before `/frame` writes `status.json` with verdict `ready`, ALL of these must hold:

1. **Success criteria are observable and falsifiable** — each one names the command, metric, or artifact that reveals achievement. "Users are happier" fails; "p95 latency on the search endpoint drops below 300ms" passes.
2. **Non-goals lists ≥3 concrete items** — empty or one-bullet non-goals sections are rejected. Pre-empting scope creep is the cheapest at framing time.
3. **At least one user story has explicit acceptance criteria** — in the form "Given X, when Y, then Z." Without this, `/plan` has nothing to translate into bite-sized tasks (per `/plan` Law 1).
4. **`out-of-scope` section is non-empty** — distinct from non-goals; out-of-scope captures things adjacent users may expect that this work doesn't address.
5. **Hypothesis is present per Law 2** — all four clauses (action, users, outcome, evidence) populated.

If any of the five fail, `/frame` returns `not_ready` and the operator either iterates within `/frame` or routes back to `/discover` to gather missing input.

`/plan` reads the framing verdict from the advisor record. If `not_ready`, `/plan` cannot proceed.

The reason: `/plan` translates framing into tasks. If the framing has no falsifiable success criteria, the tasks have no observable acceptance criteria (per `/plan` Law 1) — the ambiguity propagates straight through `/build`, `/review`, `/qa`, and lands in the user's lap as "we shipped what we said we'd ship, but the user expected something different."

## How to run /frame

These steps execute one `/frame` run. Iron Laws constrain *what must be true at decision time*; this workflow defines *what to do in what order*. Both apply.

### Step 1 — Read upstream context

Read `docs/product/idea-brief.md` from the prior `/discover` run. The brief carries:

- The Look Inward / Look Outward / optional Reframe sections
- The named user segment, observed pain with cost, evidence sources
- The hypothesis hint that `/frame` Law 2 sharpens
- The ≥3 open questions that `/frame` is responsible for answering

If `idea-brief.md` is missing or returned `not_ready` from `/discover`, framing has nothing to scope. Route back to `/discover` rather than guessing.

If a prior closeout produced `next-run-bootstrap.json` or `RETRO-CONTINUITY.md`, read those too — they may carry framing-relevant context (prior decisions, deferred scope).

### Step 2 — Draft `prd.md` with all seven sections

Open `docs/product/prd.md` and draft each of the seven sections required by Law 1, in order:

1. Problem statement (who hurts, how, how much)
2. Hypothesis (the If/Then/Because — see Step 3)
3. Success criteria (observable, falsifiable conditions)
4. Non-goals (≥3 concrete things this work will NOT do)
5. Risks (≥3 specific failure modes with mitigations)
6. Alternatives considered (≥1 rejected alternative + reason)
7. Decision rationale (why this scope, why now)

Sections may be drafted in any order, but ALL seven must end up non-empty before Step 6. A wishlist is not a PRD.

If unsure where to start, draft Problem statement first (Step 1's idea-brief feeds it directly), then Non-goals (cheapest pre-empt of scope creep), then iterate.

### Step 3 — Write hypothesis as If/Then/Because

Per Law 2, the hypothesis MUST be of the form:

> If we [action], then [users] will [outcome] because [evidence].

Each clause:

- **Action** — concrete verbs (build, ship, change, deprecate). Not "improve" or "enhance."
- **Users** — named segment, not "all users." Reuse the segment from `idea-brief.md`'s Look Outward.
- **Outcome** — observable behavior or system change, falsifiable in the same way Law 1 success criteria are.
- **Evidence** — what makes the team believe this hypothesis is true now. Pull citations from `idea-brief.md`.

If two teammates can't agree on the [evidence] clause, the framing is not yet ready for `/plan`. Iterate or route back to `/discover` for more evidence.

### Step 4 — Define `out-of-scope` distinct from non-goals

Law 3 #4 requires `out-of-scope` non-empty AND distinct from non-goals:

- **Non-goals** — things this work intentionally won't do (e.g., "won't add multi-tenant support")
- **Out-of-scope** — things adjacent users may expect that this work doesn't address (e.g., "doesn't change the existing billing flow even though users may assume framing changes touch it")

Both sections may overlap in spirit but the audience differs: non-goals talk to the team's discipline; out-of-scope talks to the user's expectations.

### Step 5 — Write ≥1 user story with explicit acceptance criteria

Law 3 #3 requires at least one user story in the form:

> Given [context], when [action], then [observable outcome].

This is what `/plan` Law 1 reads to translate framing into bite-sized tasks with verifiable acceptance criteria. Without it, `/plan` has nothing concrete to plan against.

A framing pass with ten stories but none in Given/When/Then form fails Law 3 #3 — one rigorous story beats ten vague ones.

### Step 6 — Verify framing readiness gate

Before writing `status.json`, check ALL five Law 3 conditions:

1. Success criteria are observable and falsifiable (Law 1 #3 + Law 3 #1)
2. Non-goals lists ≥3 concrete items (Law 1 #4 + Law 3 #2)
3. ≥1 user story has explicit Given/When/Then acceptance criteria (Law 3 #3)
4. `out-of-scope` section non-empty (Law 3 #4)
5. Hypothesis present per Law 2, all four clauses populated (Law 3 #5)

If any fail, surface the choice via `AskUserQuestion`:

> "Framing readiness gate failed on [list which of the 5]. Should I (a) iterate within `/frame` and try to satisfy the failing checks, (b) route back to `/discover` to gather missing input, or (c) continue and write `status.json` with verdict `not_ready`?"

The operator picks; record the choice in the decision brief.

### Step 7 — Write `decision-brief.md`

`docs/product/decision-brief.md` summarizes the framing in 1–2 pages:

- The hypothesis (per Law 2)
- The chosen scope and rejected alternatives (Law 1 #6 — the Alternatives Considered section, condensed)
- The decision rationale (Law 1 #7 — why this scope, why now)
- Any open framing questions that survived to `/plan`

The decision brief is what `/review` reads later when judging whether the work matches intent. It is also the artifact the operator points stakeholders at when explaining "what we framed and why."

### Step 8 — Write `design-intent.json`

`.planning/current/frame/design-intent.json` captures the framing's machine-readable contract:

- `hypothesis` (the four-clause If/Then/Because, parsed)
- `success_criteria` (array of observable conditions)
- `non_goals` (array of ≥3 items)
- `out_of_scope` (array)
- `acceptance_criteria` (array of Given/When/Then statements from Step 5)

Downstream stages read this file rather than re-parsing prose. Keep it consistent with `prd.md` — they are two views of the same framing.

### Step 9 — Write status

Run the canonical command (in the Routing section below). It writes `decision-brief.md`, `prd.md`, `design-intent.json`, and `status.json`. The advisor record carries the verdict (`ready` or `not_ready`); `/plan` reads it.

If verdict is `not_ready`, `/plan` cannot proceed. The operator either iterates within `/frame` or routes back to `/discover`.

## Operator Checklist

- define scope
- define non-goals
- define success criteria

## Artifact Contract

Writes `docs/product/decision-brief.md`, `docs/product/prd.md`, `.planning/current/frame/design-intent.json`, and `.planning/current/frame/status.json`.

## Routing

Advance to `/plan` only after Nexus writes the framing artifacts.

Run:

```bash
_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_NEXUS_ROOT="~/.claude/skills/nexus"
[ -d "$_REPO_CWD/.claude/skills/nexus" ] && _NEXUS_ROOT="$_REPO_CWD/.claude/skills/nexus"
cd "$_NEXUS_ROOT" && NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts frame
```

## Typical prompts

These are example user requests `/frame` handles well. The skill is invoked and produces `decision-brief.md`, `prd.md`, `design-intent.json`, and `status.json`.

### Prompt 1 — Direct framing request after discovery

> "We finished `/discover` for the telemetry idea. Frame the scope so we can plan the build."

`/frame` walks Step 1–9. Step 1 reads `idea-brief.md` from the prior discovery. Step 2 drafts the seven PRD sections; Step 3 sharpens the hypothesis hint into a full If/Then/Because per Law 2. Step 5 writes ≥1 Given/When/Then user story. Step 6 verifies the readiness gate; if it fails, the AskUserQuestion surfaces the iterate/route-back/not_ready choice. Verdict written to `status.json`.

### Prompt 2 — Reframing a vague success metric

> "Our success criterion is 'users will love the new flow' — frame this properly so review can evaluate it later."

Step 2 forces the seven sections; Law 1 #3 rejects "users will love it" as vague and demands an observable command/metric/artifact. The skill pushes the operator toward something like "task completion rate >85% on the X flow, measured via session telemetry over a 14-day window." Step 6's gate fails on Law 3 #1 until the criterion is concrete; the AskUserQuestion routes the choice.

### Prompt 3 — Deciding between non-goals and out-of-scope

> "What goes in non-goals vs out-of-scope for this PRD?"

Step 4 names the distinction explicitly: non-goals are intentional team discipline ("won't add multi-tenant"), out-of-scope is user-expectation management ("doesn't change billing even though users may assume so"). Both are required non-empty by Law 3 #2 and #4 respectively. The skill helps the operator draft both sections rather than collapsing one into the other.

These prompts test that `/frame` produces a complete framing artifact with hypothesis, falsifiable success criteria, and the readiness-gate verdict that `/plan` can act on.

## Completion Advisor

After `/frame` returns, prefer the runtime JSON field `completion_advisor`. If the host only has
filesystem access, or the field is absent, fall back to `.planning/current/frame/completion-advisor.json`.
If the runtime exited nonzero, inspect `completion_context.completion_advisor` from the error JSON
envelope before falling back to disk. Treat that advisor as the canonical next-step contract.

Read and summarize:

- `summary`
- `interaction_mode`
- `requires_user_choice`
- `primary_next_actions`
- `alternative_next_actions`
- `recommended_side_skills`
- `stop_action`
- `project_setup_gaps`
- `suppressed_surfaces`
- `default_action_id`

If `interaction_mode` is `summary_only`, do not call AskUserQuestion. Print the advisor
`summary`, any `project_setup_gaps`, and the invocation for the `default_action_id` if one exists.

If the session is interactive and `interaction_mode` is not `summary_only`, always use
AskUserQuestion for `/frame` completion.

If the host cannot display AskUserQuestion, rerun `/frame` with `--output interactive`
to print the same runtime-owned chooser in the terminal. Do not reconstruct choices
from `status.json`.

If `interaction_mode` is `recommended_choice`, present:

1. recommended primary action
2. other primary actions
3. alternatives
4. recommended side skills
5. `stop_action`

If `interaction_mode` is `required_choice`, present only the actions emitted by the advisor.

Use each action's `label` and `description`. If an action has `visibility_reason`,
`why_this_skill`, or `evidence_signal`, include it in the explanation so the user sees
why it is showing up now.

After the user chooses an action, run the selected `invocation` unless the selected action
is `stop_action` or has no invocation.

If the advisor surfaces `/plan-design-review` or `/design-consultation`, that means the run is
design-bearing or still lacks a stable design contract. Keep the canonical path anchored on
`/plan`.

If the session is non-interactive, print the advisor `summary` and the invocation for the
`default_action_id` when one exists.
