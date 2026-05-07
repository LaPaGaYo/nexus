---
name: plan
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus planning command. Writes repo-visible execution readiness artifacts and
  stage status for the governed Nexus lifecycle. Use when the user says "plan this work",
  "break down the framing into tasks", "make a sprint plan", or when the work is framed
  and needs to become execution-ready. (nexus)
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

If `EXECUTION_MODE=local_provider` and `PRIMARY_PROVIDER=claude`, ask the user which local execution topology to use before starting `/plan`.

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

# /plan — Nexus Canonical Planning Command

Nexus-owned planning guidance for execution readiness and bounded scope.

## Iron Laws (mandatory; non-negotiable)

These three rules apply to every `/plan` invocation regardless of provider, topology, or run mode. They are short and absolute on purpose — discipline that lives in qualifiers does not survive contact with the LLM at decision time. `/plan` writes the contract that `/build`, `/review`, and `/qa` evaluate against; ambiguity here compounds downstream.

### Law 1 — Bite-Sized Task Contract

Every task in `sprint-contract.md` MUST satisfy three properties:

1. **Bounded scope** — describable in ≤3 sentences; deliverable in ≤1 day of focused work. If a task takes longer than 1 day to even describe, it is not a task; it is a phase that needs further decomposition.
2. **Observable acceptance criterion** — written in the form "X exists at path Y AND Z is true" (or equivalent). The criterion must be verifiable WITHOUT running the implementation. Vague criteria like "code works" or "feature is good" are rejected.
3. **Verification command** — one specific command (`bun test path/to/test.ts`, `bun run repo:inventory:check`, `bunx tsc --noEmit`, etc.) that the operator runs to confirm the task is done. If the task has no verification command, it is too vague to plan.

A task that fails any of these three is rejected before `/plan` writes the contract. The cost of rejecting a vague task at `/plan` time is minutes; the cost of letting it through and discovering the ambiguity in `/build` is hours, and the cost at `/review` is a re-entry through the entire stage chain.

### Law 2 — Hypothesis Before Plan

`sprint-contract.md` MUST contain a `## Risks` section listing ≥3 specific failure modes the plan anticipates, each with:

- **Failure description** — what could go wrong, in concrete terms (not "things might break")
- **Detection signal** — how the operator would notice this happening (output of which command, which artifact field, which advisor flag)
- **Mitigation** — what the plan does pre-emptively, OR what the recovery routing is (e.g., "back to `/discover`", "escalate via AskUserQuestion", "split task into two before entering `/build`")

Plans without an explicit risk section are rejected. "I don't see any risks" is itself a risk; if you cannot enumerate ≥3, the plan is under-thought.

Common failure modes worth listing (not exhaustive):

- Underestimated scope of a task that looked bite-sized but isn't
- Missing dependency the plan assumes is installed/available
- Acceptance criterion that's measurable but doesn't capture user value
- Cross-task coupling that wasn't modeled in the task list ordering

The risk section is read by `/build` as predecessor context. When a risk materializes during `/build`, the recovery routing is already known — no scrambling, no unilateral patching.

### Law 3 — Plan→Build Handoff Is Binding

Once `/plan` writes `sprint-contract.md` AND `/handoff` records the route, `/build` operates ONLY on the tasks listed in the contract. Scope expansion mid-`/build` is forbidden:

- If `/build` discovers an additional task is needed → DO NOT add it silently. Stop, route back to `/plan` to extend the contract, then re-enter `/build`.
- If `/build` discovers a listed task is wrong or impossible → DO NOT skip it silently. Stop, route back to `/plan` with the discovered constraint, then re-enter `/build`.
- If `/build` finishes faster than expected → leave remaining capacity unused; do not pull in adjacent work that wasn't contracted.

The reason: the plan is the contract that `/review` and `/qa` evaluate `/build` against. Silent scope expansion makes `/review` impossible — there is no agreed acceptance criterion for the expanded work, and the advisor record cannot reconcile drift it never saw.

Scope creep is a routing event, not a unilateral decision.

## How to run /plan

These steps execute one `/plan` run. Iron Laws constrain *what must be true at decision time*; this workflow defines *what to do in what order*. Both apply.

### Step 1 — Read upstream framing

Read `.planning/current/frame/prd.md`. Per `/frame` Law 1 it carries seven required sections (problem, hypothesis, success criteria, non-goals, risks, alternatives, decision rationale). The success criteria section is the input to Step 2; the risks section is one input to Step 5.

If `prd.md` does not exist, `/plan` cannot run. Route back to `/frame` instead of synthesizing the framing here.

### Step 2 — Extract success criteria

Per `/frame` Law 1, each success criterion is observable (named command, metric, or artifact — vague criteria like "users love it" were rejected upstream). List them as the seed set for task drafting.

If a success criterion looks vague despite passing `/frame`, treat it as a framing escape and route back to `/frame`. `/plan` does not retroactively sharpen criteria — `/frame` Law 1 owns that contract.

### Step 3 — Draft 1–3 candidate tasks per criterion

For each criterion, draft one to three candidate tasks that, when complete, would satisfy that criterion. Aim for the smallest set that covers the criterion; over-decomposition produces busywork, under-decomposition violates Law 1.

Candidate tasks at this step are drafts. They have not yet been verified against Law 1's three properties — that is Step 4.

### Step 4 — Verify each task is bite-sized

For each candidate task from Step 3, verify all three Law 1 properties:

1. Bounded scope (≤3 sentences, ≤1 day of focused work)
2. Observable acceptance criterion ("X exists at path Y AND Z is true" form)
3. Verification command (one specific `bun test ...` / `bunx tsc --noEmit` / `bun run repo:inventory:check` / etc.)

A task that fails any property is rejected here, before the contract is written. The cost of rejection at `/plan` is minutes; the cost downstream is hours per Law 1's own justification.

### Step 5 — Enumerate ≥3 risks

Per Law 2, every plan needs ≥3 specific failure modes, each with failure description, detection signal, and mitigation/recovery routing. Sources to draw from:

- The framing risks section in `prd.md` (don't duplicate — refine for execution)
- Underestimated-scope risk for any borderline task from Step 4
- Cross-task coupling risk if multiple tasks touch the same module
- Dependency risk for any task that assumes infrastructure or library availability
- Acceptance-criterion-vs-user-value risk for tasks where the verification command passes but the user impact is unclear

If you cannot enumerate three risks, the plan is under-thought (per Law 2). Return to Step 3 and revisit task scope before forcing the count.

### Step 6 — Branching: borderline tasks

If any candidate task from Step 4 is borderline on Law 1 (e.g., "≤1 day if assumptions hold; might be 2 days if X surfaces"), do not silently accept or silently split. Use `AskUserQuestion`:

> "Task `<task-name>` is borderline on Law 1's bite-sized contract — estimated 1 day if `<assumption>` holds, ~2 days otherwise. Should I (a) split into two tasks now, (b) accept as-is and flag the assumption in the risk register, or (c) route back to `/frame` to tighten the success criterion this task serves?"

The operator picks; record the choice in the contract or risk register. The same gate applies if `/build` re-enters `/plan` mid-execution to extend scope (per Law 3) — confirm with the operator whether the discovered work is a contract extension, a split, or a framing reset.

### Step 7 — Write `sprint-contract.md`

Compose the contract with the verified task list (Step 4), the risk register (Step 5), and any operator decisions recorded at Step 6. Each task carries its scope sentence, observable acceptance criterion, and verification command per Law 1. Each risk carries its three Law 2 fields.

The contract is the input `/build`, `/review`, and `/qa` evaluate against. Anything missing here is missing for the rest of the lifecycle.

### Step 8 — Verify the binding-handoff posture

Per Law 3, once the contract is written and `/handoff` records the route, `/build` operates only on the listed tasks. Before writing status, sanity-check:

- Every task has the three Law 1 properties (no exceptions)
- The risk register has ≥3 entries with Law 2's three fields each
- The success criteria from Step 2 are each addressed by at least one task

If any fail, return to the relevant step. The contract is binding once written; under-specification at this gate becomes a routing event in `/build`.

### Step 9 — Write status

Run the canonical command (in the Routing section below). It writes `execution-readiness-packet.md`, `sprint-contract.md`, `verification-matrix.json`, `design-contract.md` when present, and `status.json`. The advisor record carries the verdict; `/handoff` reads it next.

## Operator Checklist

- verify framing inputs
- produce readiness packet
- produce sprint contract

## Artifact Contract

Writes `.planning/current/plan/execution-readiness-packet.md`, `.planning/current/plan/sprint-contract.md`, `.planning/current/plan/verification-matrix.json`, `.planning/current/plan/design-contract.md` when present, and `.planning/current/plan/status.json`.

## Routing

Advance to `/handoff` only after Nexus declares execution ready.

Run:

```bash
_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_NEXUS_ROOT="~/.claude/skills/nexus"
[ -d "$_REPO_CWD/.claude/skills/nexus" ] && _NEXUS_ROOT="$_REPO_CWD/.claude/skills/nexus"
cd "$_NEXUS_ROOT" && NEXUS_PROJECT_CWD="$_REPO_CWD" ./bin/nexus plan
```

## Typical prompts

These are example user requests `/plan` handles well. The skill is invoked and produces an `execution-readiness-packet.md`, a `sprint-contract.md`, a `verification-matrix.json`, and a `status.json`.

### Prompt 1 — Plan from a fresh PRD

> "Plan the work for the telemetry feature now that /frame is done."

`/plan` walks Step 1–9. Step 1 reads `prd.md` and confirms the seven `/frame` Law 1 sections are present. Step 2 extracts each success criterion. Steps 3–4 draft and verify 1–3 bite-sized tasks per criterion against Law 1. Step 5 builds the risk register from the framing risks plus execution-specific failure modes. Step 7 writes the contract. Verdict `ready` if all gates pass.

### Prompt 2 — Vague task suspected

> "Is 'improve performance' an OK task in the contract?"

Step 4 rejects it: Law 1 explicitly disallows vague acceptance criteria like "code works" or "feature is good." `/plan` proposes a sharpened replacement (e.g., "p95 latency on the search endpoint drops below 300ms, verified by `bun test test/perf/search.test.ts`") or routes back to `/frame` if the underlying success criterion was the source of the vagueness.

### Prompt 3 — Build wants to expand scope mid-run

> "/build hit a 3-strike loop and thinks we need an extra task — should we just add it?"

Law 3 forbids silent scope expansion: stop, route back to `/plan` to extend the contract, then re-enter `/build`. Step 6's AskUserQuestion gate asks whether the discovered work is (a) a contract extension here, (b) a split of an existing task, or (c) a framing reset that needs `/frame` first. The operator's choice is recorded; the contract is updated explicitly, never silently.

These prompts test that `/plan` produces a binding execution contract — bite-sized tasks, enumerated risks, no silent scope drift (Iron Laws 1–3).

## Completion Advisor

After `/plan` returns, prefer the runtime JSON field `completion_advisor`. If the host only has
filesystem access, or the field is absent, fall back to `.planning/current/plan/completion-advisor.json`.
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
AskUserQuestion for `/plan` completion.

If the host cannot display AskUserQuestion, rerun `/plan` with `--output interactive`
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

If the advisor surfaces `/plan-design-review`, that is design-driven follow-on work inferred from
`design_impact` and the verification matrix. Keep the canonical execution path anchored on
`/handoff`.

If the session is non-interactive, print the advisor `summary` and the invocation for the
`default_action_id` when one exists.
