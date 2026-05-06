---
name: build
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus build command. Executes the bounded governed implementation contract
  and writes repo-visible build request, result, and stage status artifacts. Use when
  the user says "implement task X", "build the feature", "execute the sprint contract",
  or otherwise asks to turn a planned task into shipped code with verification. (nexus)
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

If `EXECUTION_MODE=local_provider` and `PRIMARY_PROVIDER=claude`, ask the user which local execution topology to use before starting `/build`.

RECOMMENDATION: Choose A for same-file edits or tightly coupled implementation; choose B or C only when the work can be split cleanly by file or domain. Completeness: 9/10.

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

# /build — Nexus Governed Build

Nexus-owned build guidance for disciplined implementation under governed routing.

## Iron Laws (mandatory; non-negotiable)

These three rules apply to every `/build` invocation regardless of provider, topology, or run mode. They are short and absolute on purpose — discipline that lives in qualifiers does not survive contact with the LLM at decision time.

### Law 1 — Evidence Before Claims

Do NOT report `/build` complete unless you ran the verification command in this turn AND attached its output to the advisor record.

Pick the verification appropriate to the change:

- Code change: `bun test` (output attached, exit 0)
- Library / runtime touch: `bunx tsc --noEmit` (output attached, exit 0) plus relevant focused test suite
- Skill prose / template change: `bun run skill:check` (output attached, clean) plus `bun run gen:skill-docs --host codex` if `.tmpl` was edited
- Repo structure / inventory-impacting change: `bun run repo:inventory:check` (regenerated and clean)
- Pure docs change: `bun run repo:inventory:check` plus a manual reread of the diff for accuracy

Empty output ≠ verified. "Tests passed" without command output attached ≠ verified. The runtime advisor reads what you attached, not what you remember running.

### Law 2 — No Fixes Without Root Cause (3-strike stop)

If your build attempt fails 3 times consecutively on the same root cause:

1. STOP attempting fixes.
2. Route to `/investigate` — its 4-phase protocol (locate → analyze → hypothesize → fix) is purpose-built for stuckness.
3. DO NOT continue patching symptoms. Each additional patch makes diagnosis harder.

This is a hard rule, not a guideline. Patching past 3 strikes without confirmed root cause is the most common path to a wrong fix shipped under stage-status `ready`.

### Law 3 — Prior Advisories Are Address-Or-Dispute

If you re-enter `/build` from a prior `/review` with advisories on the advisor record:

- Address EVERY advisory before claiming complete, OR
- Document explicit dispute with rationale in `build-result.md` (cite the advisory id, state why you disagree, propose alternative resolution)

Silently dropping advisories — even one — is not allowed. The reviewer found something real; you must engage with it on the record. Disputed advisories are visible to `/review` and `/ship` for downstream re-evaluation.

## How to run /build

These steps execute one `/build` run. Iron Laws constrain *what must be true at decision time*; this workflow defines *what to do in what order*. Both apply.

### Step 1 — Read the binding contract

Open `.planning/current/plan/sprint-contract.md` (and `.planning/current/plan/design-contract.md` if present). The sprint contract is the binding handoff per `/plan` Law 3 — every task in scope is named there with an observable acceptance criterion and a verification command. Anything not named is out of scope.

If the contract is missing, `/build` cannot proceed. Route back to `/plan` rather than improvising scope.

### Step 2 — Pick the next task and identify its verification command

Each task in `sprint-contract.md` has a verification command per `/plan` Law 1 (e.g., `bun test test/foo.test.ts`, `bunx tsc --noEmit`, `bun run skill:check`). That command is the contract for "this task is done" — you will run it twice, once before editing and once after.

If the task lacks a verification command, treat that as a `/plan` Law 1 violation and route back to `/plan` to extend the contract before editing.

### Step 3 — Run the verification command BEFORE editing

Execute the task's verification command first. Capture exit code and output. The pre-edit run establishes the baseline failure (red state) the edit must turn green; it also catches the case where the test was already passing and the task description was stale.

If the pre-edit run is already green, stop and ask: is the task already done, is the verification command wrong, or is the test under-specified? Resolve before editing.

### Step 4 — Edit the task's files

Make the smallest change that satisfies the task's acceptance criterion. Touch only files the task names; resist scope creep into adjacent code per `/plan` Law 3 (no silent scope expansion).

If the edit reveals the task needs more files than `sprint-contract.md` lists, STOP. Do not silently expand. Route back to `/plan` to extend the contract.

### Step 5 — Re-run the verification command and attach output

Execute the same verification command from Step 3. Capture exit code and full output. Per Law 1 (evidence-before-claims), this output is what the advisor record will read; "tests passed" without attached output is not verification.

If the run is green, the task is verified — proceed to Step 7.

If the run is red, proceed to Step 6.

### Step 6 — Handle failure (per Law 2)

A failed verification is normal. Diagnose, edit, re-verify. Track consecutive failures on the same root cause.

When **3 consecutive failures share the same root cause**, Law 2's hard stop fires. Use `AskUserQuestion`:

> The same failure has reproduced 3 times: [one-line root-cause description].
> Per `/build` Law 2, continuing to patch symptoms past 3 strikes is the most common path to a wrong fix shipped under stage-status `ready`.
>
> RECOMMENDATION: Choose B if the failure is genuinely about understanding why; choose A only if you have a fresh hypothesis that wasn't tested in the prior 3 attempts. Completeness: B 10/10, A 7/10, C 6/10.
> A) Continue investigating with a new hypothesis (human: ~15m / CC: ~5m) — Completeness: 7/10
> B) Route to `/investigate` for the 4-phase root-cause protocol (human: ~30m / CC: ~10m) — Completeness: 10/10
> C) Add diagnostic logging and re-run before forming the next hypothesis (human: ~15m / CC: ~5m) — Completeness: 6/10

Record the operator's choice in `build-result.md`. If B, hand off to `/investigate` and stop the current `/build` run; the investigate output drives the next `/build` re-entry.

### Step 7 — Repeat per task

Loop Step 2 through Step 6 for every task in `sprint-contract.md`. Per-task verification output stays attached for `/review` Law 1 to consume — fresh evidence is non-fungible.

If a task can't be completed without breaking another, that's a `/plan` Law 3 scope-extension trigger, not a license to silently rework the contract.

### Step 8 — Address prior advisories (per Law 3)

If this `/build` is a re-entry from `/review` with advisories on the advisor record:

- Address every advisory before claiming complete, OR
- Document explicit dispute in `build-result.md` (cite advisory id, state rationale, propose alternative resolution)

Silently dropping advisories is forbidden per Law 3. Disputed advisories remain visible to `/review` and `/ship` for downstream re-evaluation.

### Step 9 — Aggregate into `build-result.md` and write status

Collect per-task verification output, resolved advisories, disputed advisories, and any scope notes. Write `build-result.md` and `status.json` via the canonical command (in the Routing section below). The advisor record carries the verdict; `/review` reads it next.

If the advisor returns `requires_user_choice`, follow the advisor's branching prompt — that's a runtime checkpoint, not a workflow step the operator picks unprompted.

## Operator Checklist

- run build discipline before transport
- preserve requested route
- record actual route separately

## Artifact Contract

Writes `.planning/current/build/build-request.json`, `.planning/current/build/build-result.md`, and `.planning/current/build/status.json`.

When `.planning/current/plan/design-contract.md` is present, `/build` treats it as part of the bounded implementation contract, passes it as a predecessor artifact, and records the design-bearing provenance on build status.

## Routing

Advance to `/review` only after Nexus records a bounded build result with requested and actual route provenance kept distinct.

Run:

```bash
_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_NEXUS_ROOT="~/.claude/skills/nexus"
[ -d "$_REPO_CWD/.claude/skills/nexus" ] && _NEXUS_ROOT="$_REPO_CWD/.claude/skills/nexus"
cd "$_NEXUS_ROOT" && NEXUS_PROJECT_CWD="$_REPO_CWD" bun run bin/nexus.ts build
```

## Typical prompts

These are example user requests `/build` handles well. The skill consumes the bounded sprint contract, runs per-task verification, and produces `build-result.md` plus `status.json`.

### Prompt 1 — Single bite-sized task

> "Implement task #3 from sprint-contract.md."

`/build` walks Step 1 (read contract) → Step 2 (pick task #3, find its verification command) → Step 3 (pre-edit run, captures red baseline) → Step 4 (edit) → Step 5 (post-edit run, captures green output) → Step 8 (no prior advisories on a fresh build) → Step 9 (aggregate into `build-result.md`). The advisor record carries `stage_outcome: ready`; `/review` picks up next.

### Prompt 2 — Stuck on the same error

> "I've tried fixing this test failure three times and it keeps coming back the same way."

Step 6 fires. Per Law 2, three consecutive failures on the same root cause is a hard stop. The `AskUserQuestion` gate surfaces three options: continue with a new hypothesis (only valid if genuinely new), route to `/investigate` for the 4-phase protocol (recommended), or add diagnostic logging before re-attempting. The operator's choice is recorded in `build-result.md`; if `/investigate` is chosen, the current build halts and re-enters after investigation completes.

### Prompt 3 — Re-entering after review found advisories

> "Review left 4 advisories on my last build — finish the implementation."

Step 8 governs. Per Law 3, every advisory is address-or-dispute. The build addresses each advisory, OR documents disagreement with explicit rationale (advisory id, why-disagree, alternative-resolution) in `build-result.md`. Silently dropping any advisory is forbidden — disputed ones remain visible to `/review` and `/ship` for downstream re-evaluation.

These prompts test that `/build` produces verified, contract-bounded implementation output — not symptomatic patches (Iron Law 2's failure mode) and not silent scope expansion (Iron Law 3's failure mode).

## Completion Advisor

After `/build` returns, prefer the runtime JSON field `completion_advisor`. If the host only has
filesystem access, or the field is absent, fall back to `.planning/current/build/completion-advisor.json`.
If the runtime exited nonzero, inspect `completion_context.completion_advisor` from the error JSON
envelope before falling back to disk. Treat that advisor as the canonical next-step contract.

Read and summarize:

- `summary`
- `stage_outcome`
- `interaction_mode`
- `requires_user_choice`
- `primary_next_actions`
- `alternative_next_actions`
- `recommended_side_skills`
- `recommended_external_skills`
- `stop_action`
- `project_setup_gaps`
- `default_action_id`

If `interaction_mode` is `summary_only`, do not call AskUserQuestion. Print the advisor
`summary`, any `project_setup_gaps`, and the invocation for the `default_action_id` if one exists.

If the session is interactive and `interaction_mode` is not `summary_only`, always use
AskUserQuestion for `/build` completion.

If the host cannot display AskUserQuestion, rerun `/build` with `--output interactive`
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

For design-bearing runs, the advisor may surface `/design-review` and `/browse` based on
`design_impact` and the verification matrix. Keep `/review` first when the build is ready.

If the build is blocked, do not invent your own routing. Follow the advisor:

- stale handoff / route issues -> `/handoff`
- implementation ambiguity or deeper failure analysis -> `/investigate`

If the session is non-interactive, print the advisor `summary` and the invocation for the
`default_action_id` when one exists.
