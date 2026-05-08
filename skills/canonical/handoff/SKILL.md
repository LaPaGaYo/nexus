---
name: handoff
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus governed handoff command. Records explicit routing, provider intent,
  and handoff state before governed execution begins. Use when the user says
  "approve the route", "hand off to /build", "lock in the routing", or after `/plan`
  declares the work execution-ready and a provider lane needs to be named before
  governed execution starts. (nexus)
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

# /handoff — Nexus Governed Handoff

Nexus-owned governed handoff guidance for explicit routing and route approval.

## Iron Laws (mandatory; non-negotiable)

These three rules apply to every `/handoff` invocation regardless of provider, topology, or run mode. They are short and absolute on purpose — discipline that lives in qualifiers does not survive contact with the LLM at decision time. `/handoff` is the routing approval gate between `/plan` and `/build`; ambiguity here means execution runs against an approval that no longer matches reality.

### Law 1 — Handoff Freshness Check (Route + Provider + Branch + Contract)

Before reusing an existing handoff approval (e.g., re-entering `/handoff` after a `/build` failure or a session resume), `/handoff` MUST re-validate four dimensions. ANY change invalidates the prior approval:

1. **Route** — the dispatch target named in `governed-execution-routing.md`. If the route mentioned a specific stage pack, provider lane, or topology and any of those shifted since approval, the prior approval is stale.
2. **Provider availability** — the provider lane (CCB session, Codex CLI, Gemini CLI, local) named in the route MUST currently be mounted and online. A provider that was online at approval but is now unmounted invalidates the approval.
3. **Branch state** — the git branch the handoff approved against is the same branch present now. Branch renames, force-push to the same branch name, or operator-initiated branch switches all invalidate.
4. **Upstream contract** — `sprint-contract.md` (per `/plan` Law 3 binding handoff) is unchanged since approval. New tasks added, existing tasks modified, or scope-changing edits all invalidate. The handoff approves a specific contract; a different contract is a different handoff.

The 24-hour soft trigger: any handoff approval older than 24 hours is automatically re-validated against the four dimensions above, regardless of whether the operator believes nothing has changed. Time alone is not invalidating — change is — but 24h is the heuristic that always re-checks.

If any dimension fails, `/handoff` writes `governed-handoff.md` with `status: stale_approval` listing the failed dimension(s), and the operator either re-approves explicitly or routes back to `/plan` to refresh the upstream contract.

Stale handoff approval is the failure mode behind "we approved this two days ago and now it's running against a different tree." The freshness check makes that impossible.

### Law 2 — Recovery From Blocked Handoff (No Silent Retry)

When `/handoff` records approval but governed execution cannot begin, `/handoff` MUST write a `handoff-blocked` status entry to `status.json` rather than silently re-running:

1. **Identify the failing leg** — which dimension blocked execution: `route_unavailable` | `provider_offline` | `branch_drift` | `contract_mismatch` | `transport_error` | `approval_revoked`. Generic "couldn't continue" is not enough; the failing leg is named.
2. **Surface the blocker via `AskUserQuestion`** — the operator decides recovery: re-approve with the new state, route back to the owning skill (`/plan` for contract issues, the provider mount step for transport issues, etc.), or abort the run. `/handoff` does not pick the recovery path.
3. **Record the recovery decision in `governed-handoff.md`** — what blocked, what the operator chose, when. The artifact carries the recovery context for future operators (per Law 3).
4. **NEVER silently retry** — if the prior approval was for state A and the current state is B, attempting to "just run it again" risks executing against B with an approval that meant A. Silent retry is how mismatched approvals execute against drifted state.

A blocked handoff is not a small failure mode. The handoff is the contract `/build` reads when it begins; if that contract was approved against a state that no longer exists, what `/build` reads is fiction. Surfacing the block is cheaper than discovering the fiction during execution.

### Law 3 — Cross-Operator Context Dump

When a `/handoff` will be consumed by a different operator (different person, different session, different agent provider) than approved it, `governed-handoff.md` MUST carry enough context for the receiving operator to begin without spelunking. At minimum:

1. **What was decided** — the route, the rationale for choosing this route over alternatives, the relevant constraints. Not just "use Codex"; "use Codex because the work touches `lib/nexus/adapters/*` and Codex carries the type-system context this run."
2. **What the receiving operator needs to read first** — explicit pointers to `prd.md` (per `/frame` Law 1), `sprint-contract.md` (per `/plan` Law 1), the design contract if present, and any prior advisor records relevant to the run. The pointer set is the minimum reading list, not "all of `.planning/current/`."
3. **What's already been verified vs what hasn't** — at handoff time, what evidence exists (prior `/build` runs, partial verification) and what the receiving operator must produce fresh. This prevents re-verifying things already verified AND prevents trusting things that weren't actually verified.
4. **Open decisions deferred to the receiving operator** — choices the approving operator did not make and is intentionally passing along, with the option set visible. "Picking between Approach A and B" is a deferred decision; "make it work" is not.

Cross-operator handoffs without context dumps produce sessions where the receiving operator spends 30 minutes reconstructing what the approver knew, and frequently reaches different conclusions about what's been verified. The context dump is the contract between operators, the same way `prd.md` is the contract between framings.

A handoff between the same operator across sessions counts as cross-operator. Memory across sleep cycles is not reliable; the artifact is.

## How to run /handoff

These steps execute one `/handoff` run. Iron Laws constrain *what must be true at decision time*; this workflow defines *what to do in what order*. Both apply.

### Step 1 — Validate framing + plan completeness

Before opening any routing question, confirm the upstream contract is real:

- `prd.md` exists and `/frame` Law 1 was satisfied (named user, falsifiable hypothesis, design contract if design-bearing).
- `sprint-contract.md` exists and `/plan` Law 3 declared this run handoff-ready.
- The `status.json` for `/plan` shows the work execution-ready, not advisory or returned-to-frame.

If any upstream artifact is missing or in a non-ready state, `/handoff` cannot legitimately approve a route. Return to the owning skill (`/frame` or `/plan`) before proceeding.

### Step 2 — Run the four-dimension freshness check

Per Law 1, the prior approval (if any) must be re-validated against four dimensions before reuse. Even on first entry, capture the current state of each dimension so future re-entries have a baseline:

1. **Route** — read `governed-execution-routing.md` (if it exists). Note the named stage pack, provider lane, and topology.
2. **Provider availability** — confirm the provider lane (CCB session, Codex CLI, Gemini CLI, local) is mounted and online *now*. A provider online at approval time but unmounted now invalidates the prior approval.
3. **Branch state** — `git rev-parse HEAD` and `git status` to capture the current branch and tree. Compare to the branch the prior handoff approved against. Force-pushes, branch renames, or operator-initiated switches all invalidate.
4. **Upstream contract** — diff `sprint-contract.md` against the version the prior handoff bound. New tasks added, existing tasks modified, or scope-changing edits all invalidate.

Time alone is not invalidating, but per Law 1 any approval older than 24 hours is automatically re-checked regardless of whether the operator believes nothing has changed.

### Step 3 — If any dimension shows drift, surface the gate

If Step 2 found a dimension that no longer matches the prior approval, STOP. Use `AskUserQuestion`:

> "Handoff approval is stale on the [route | provider | branch | contract] dimension: [specifics]. Should I (a) re-validate the route with the new state, (b) route back to `/plan` to refresh the upstream contract, or (c) abort and reframe?"

The operator picks; record the choice in `governed-handoff.md`. Per Law 1, never silently treat a stale approval as fresh.

If all four dimensions pass (or this is a first-entry run with no prior approval), proceed to Step 4.

### Step 4 — Request route approval

The operator names the route explicitly: which provider lane, which stage pack, which topology. Capture the rationale per Law 3 #1 — not just "use Codex" but "use Codex because the work touches `lib/nexus/adapters/*` and Codex carries the type-system context this run."

If the operator has not stated a route, prompt for one. `/handoff` does not pick the route; it records and validates the operator's choice.

### Step 5 — Write `governed-handoff.md` with cross-operator context dump

Per Law 3, the handoff artifact MUST carry enough context for a different operator (different person, different session, different agent provider) to begin without spelunking. At minimum include:

1. **What was decided** — the route and the rationale (per Step 4).
2. **What the receiving operator needs to read first** — explicit pointers to `prd.md`, `sprint-contract.md`, the design contract if present, prior advisor records relevant to the run.
3. **What's already verified vs what hasn't** — prior `/build` runs, partial verification, or fresh-run state. Prevents both re-verifying things already verified AND trusting things that weren't actually verified.
4. **Open decisions deferred to the receiving operator** — choices the approving operator did not make, with the option set visible.

A handoff between the same operator across sessions counts as cross-operator. Memory across sleep cycles is not reliable; the artifact is.

### Step 6 — Write `governed-execution-routing.md`

The routing artifact captures the dispatch target named in the route. This is what `/build` reads when it begins. Per Law 1 #1, the route names the specific stage pack, provider lane, and topology — the granularity at which a future freshness check can detect drift.

### Step 7 — Write status

Run the canonical command (in the Routing section below). It writes `status.json` and any continuation artifacts. The advisor record carries the verdict; `/build` reads it.

If governed execution cannot begin (transport error, provider went offline between approval and dispatch, route revoked), do NOT silently retry. Per Law 2, write `status: handoff-blocked` to `status.json` with the named failing leg (`route_unavailable` | `provider_offline` | `branch_drift` | `contract_mismatch` | `transport_error` | `approval_revoked`) and surface to the operator via `AskUserQuestion`.

## Operator Checklist

- record requested route
- validate transport availability
- require separate Nexus approval

## Artifact Contract

Writes `.planning/current/handoff/governed-execution-routing.md`, `.planning/current/handoff/governed-handoff.md`, and `.planning/current/handoff/status.json`.

## Routing

Advance to `/build` only after Nexus records an approved governed handoff. Transport availability alone is never sufficient without an approved route.

Run:

```bash
_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_NEXUS_ROOT="~/.claude/skills/nexus"
[ -d "$_REPO_CWD/.claude/skills/nexus" ] && _NEXUS_ROOT="$_REPO_CWD/.claude/skills/nexus"
cd "$_NEXUS_ROOT" && NEXUS_PROJECT_CWD="$_REPO_CWD" ./bin/nexus handoff
```

## Typical prompts

These are example user requests `/handoff` handles well. The skill is invoked and produces a `governed-handoff.md`, `governed-execution-routing.md`, and a `status.json` with route approval recorded.

### Prompt 1 — Standard governed handoff to a provider lane

> "Hand off the planned work to Codex."

`/handoff` walks Step 1–7. Step 1 verifies `prd.md` and `sprint-contract.md` are ready. Step 2 captures branch/route/provider/contract baseline. Step 4 records "route: Codex CLI, rationale: work touches `lib/nexus/adapters/*` and Codex carries type-system context." Step 5 writes the cross-operator context dump per Law 3. Step 6 writes the routing artifact. Step 7 writes status; advisor surfaces canonical continuation into `/build`.

### Prompt 2 — Re-entering after a paused run

> "I approved this handoff yesterday but the branch was force-pushed — still valid?"

Step 2's freshness check finds branch drift. Step 3 fires the `AskUserQuestion` gate: "Handoff approval is stale on the branch dimension: prior approval was against `track-f-phase-4-handoff` at sha X, current head is sha Y (force-pushed). Re-validate / route back to `/plan` / abort?" The operator picks; the choice is recorded in `governed-handoff.md`. Per Law 1, the prior approval is invalidated until the operator re-approves explicitly or refreshes the upstream contract.

### Prompt 3 — Recovery from a blocked /build

> "/build failed transport — auto-retry the handoff?"

Per Law 2, NEVER silent retry. Step 7's failure path writes `status: handoff-blocked` with leg `transport_error` to `status.json` and surfaces via `AskUserQuestion`: "Build transport failed mid-dispatch. Re-approve with current state / route back to provider mount step / abort?" The operator decides; the recovery decision is recorded in `governed-handoff.md`. The skill does not pick the recovery path; it records what the operator chose.

These prompts test that `/handoff` re-validates freshness, surfaces blocks rather than silently retrying, and produces an artifact a different operator could resume from.

## Completion Advisor

After `/handoff` returns, prefer the runtime JSON field `completion_advisor`. If the host only has
filesystem access, or the field is absent, fall back to `.planning/current/handoff/completion-advisor.json`.
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
- `stop_action`
- `project_setup_gaps`
- `default_action_id`

If `interaction_mode` is `summary_only`, do not call AskUserQuestion. Print the advisor
`summary`, any `project_setup_gaps`, and the invocation for the `default_action_id` if one exists.

If the session is interactive and `interaction_mode` is not `summary_only`, always use
AskUserQuestion for `/handoff` completion.

If the host cannot display AskUserQuestion, rerun `/handoff` with `--output interactive`
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

`/handoff` normally has a single canonical continuation into `/build`. Do not manufacture extra
choices when the advisor has no real branching.

If the session is non-interactive, print the advisor `summary` and the invocation for the
`default_action_id` when one exists.
