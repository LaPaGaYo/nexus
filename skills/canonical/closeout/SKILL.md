---
name: closeout
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus closeout command. Verifies review completeness, archive state, and
  final governed readiness before concluding the work unit. Use when the user says
  "close out the run", "archive this work", "finalize and prepare next run", or after
  `/review` and `/ship` complete and the work unit needs to be sealed. (nexus)
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
Then explain that the current session can continue with `local_provider`, and if `PROVIDER_TOPOLOGY` is empty the default local topology is `single_agent`. Claude local-provider topologies invoke the local Claude CLI; inside Claude Code they are guarded unless `NEXUS_ALLOW_NESTED_CLAUDE=1` is set.

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

# /closeout — Nexus Governed Closeout

Nexus-owned closeout guidance for archive verification, provenance consistency, and final readiness.

## Iron Laws (mandatory; non-negotiable)

These three rules apply to every `/closeout` invocation regardless of provider, topology, or run mode. They are short and absolute on purpose — discipline that lives in qualifiers does not survive contact with the LLM at decision time. `/closeout` is where ambiguity from earlier stages becomes permanent; archives that don't actually verify what they claim propagate the looseness into future runs.

### Law 1 — Closeout Integrity Checklist (Five Mandatory Verifications)

`/closeout` cannot mark `CLOSEOUT-RECORD.md` `archived` without ALL of these visible in the advisor record at decision time:

1. **`/review` artifacts present** — `.planning/audits/current/*` contains the dual audit set, `.planning/current/review/status.json` records `pass_round` ≥ 1 with verdict `pass` or `pass_with_advisories`. Missing review artifacts ≡ closeout incomplete.
2. **`/qa` artifacts present when `/qa` was run** — `.planning/current/qa/qa-report.md` and `.planning/current/qa/status.json` exist with verdict `ready` or `ready_with_findings`. If `/qa` was not run for this run, that fact is recorded explicitly in `CLOSEOUT-RECORD.md` (not silently absent).
3. **`/ship` handoff complete** — `.planning/current/ship/release-gate-record.md` records the Law 3 outcome (merge / keep alive / discard / split per `/ship` Law 3). The outcome is explicit; "in-flight branch with no recorded decision" blocks closeout.
4. **Ledger consistent** — the artifact index in `CLOSEOUT-RECORD.md` matches files on disk. Every artifact referenced exists; every artifact on disk in the canonical paths is referenced. Drift between index and disk ≡ closeout incomplete.
5. **Success criteria from `/frame` actually addressed by the audit set** — each success criterion in `prd.md` (per `/frame` Law 1) is verified by at least one audit finding in `.planning/audits/current/*` or one QA finding in `qa-report.md`. Unaddressed criteria are listed in `CLOSEOUT-RECORD.md`'s "what we did NOT verify" section. Silent omission is rejected.

If any check fails, `/closeout` returns `not_archived` and surfaces which check failed. The operator routes to the owning skill (per Law 3) to address the gap.

This is the place where ambiguity from earlier stages becomes permanent. A loose closeout produces archives that don't actually verify what they claim — future `/discover` runs reading this archive propagate the looseness.

### Law 2 — Stale Evidence Rejection

`/closeout` rejects audit and QA artifacts that are stale relative to the current state of the work:

1. **Stale relative to `/build` head** — if any audit in `.planning/audits/current/*` was generated against a commit older than the latest `/build` head SHA, that audit is stale. Closeout marks the run `stale_audit` and requires `/review` rerun against the current head.
2. **Stale relative to run_id** — every audit, QA report, and ship artifact carries a `run_id` field. Closeout verifies all artifacts in the run share the same `run_id`. Mismatched run_ids ≡ artifacts from different runs accidentally collated; closeout returns `not_archived`.
3. **Stale relative to clock** — audits older than 7 days are flagged for review even when run_id and head SHA align. Long-paused runs accumulate context drift; the world a 7-day-old audit described may not match the world the work shipped into.

A stale audit is not a small failure mode. The audit was generated against a tree the user never shipped. Archiving the audit as evidence of "what was verified" produces a record that lies about what was verified.

When `/closeout` flags `stale_audit`, the operator either reruns the relevant stage (`/review`, `/qa`) against the current state or explicitly accepts the staleness with a documented note in `CLOSEOUT-RECORD.md` ("audit is N days old; re-verify before re-shipping any related change"). Silent acceptance is forbidden.

### Law 3 — Closeout Is Read-Only With Respect To Lifecycle Authority

`/closeout` MUST NOT modify any of these from inside `/closeout`:

1. **`.planning/current/*/status.json`** for any owning stage (`/discover`, `/frame`, `/plan`, `/build`, `/review`, `/qa`, `/ship`). These are owned by their respective skills; closeout reads them, never writes them.
2. **Owning-stage artifacts** — `prd.md`, `idea-brief.md`, `sprint-contract.md`, `qa-report.md`, `release-gate-record.md`, etc. If the artifact is wrong, the owning skill fixes it; closeout does not patch around the wrongness.
3. **Stage transition history** — the ledger of stage outcomes. Closeout reads this to verify Law 1 + Law 2 checks; if the history shows a problem, closeout reports `not_archived` rather than rewriting the history to make the archive valid.

Closeout writes only to `.planning/current/closeout/*` — its own outputs (CLOSEOUT-RECORD, FOLLOW-ON-SUMMARY, NEXT-RUN, learnings, status). Everything else is read-only.

The reason: lifecycle authority is single-owner. If `/build` says the build is `complete` and the audit says otherwise, the conflict is real and the resolution belongs in `/build` or `/review`, not in `/closeout`. A closeout that "fixes" upstream state silently is not closing out the run; it is laundering the run.

When closeout finds inconsistent state, the answer is to surface it and route back. The operator decides which owning skill to re-enter; closeout records the routing decision in its own status, not by editing upstream artifacts.

## How to run /closeout

These steps execute one `/closeout` run. Iron Laws constrain *what must be true at decision time* (especially Law 3's read-only boundary — closeout writes only to `.planning/current/closeout/*`); this workflow defines *what to do in what order*. Both apply.

### Step 1 — Read all upstream stage status.json files

Per Law 1 and Law 3, closeout is read-only over upstream stages. Begin by reading every stage's `status.json` from `.planning/current/<stage>/status.json` for `/discover`, `/frame`, `/plan`, `/build`, `/review`, `/qa`, `/ship` (whichever ran for this run). These tell you what the run claims as truth.

Do not modify them. If they look wrong, that is a Law 3 surface-and-route signal, not a closeout edit.

### Step 2 — Run Law 1 integrity checklist (five mandatory verifications)

Walk Law 1's five checks against the read state from Step 1:

1. `/review` artifacts present in `.planning/audits/current/*`; review status.json records `pass_round` ≥ 1 with verdict `pass` or `pass_with_advisories`.
2. `/qa` artifacts present when `/qa` was run, with verdict `ready` or `ready_with_findings`. If `/qa` was not run, capture that fact explicitly for `CLOSEOUT-RECORD.md`.
3. `/ship` `release-gate-record.md` records the Law 3 outcome (merge / keep alive / discard / split). The decision is explicit, not silent.
4. Ledger consistency — every artifact referenced exists; every artifact on disk in canonical paths is referenced.
5. Each `/frame` success criterion is addressed by at least one audit or QA finding. List unaddressed criteria for the "what we did NOT verify" section.

If any check fails, do NOT proceed. Closeout returns `not_archived` and reports which check failed (per Law 1).

### Step 3 — Run Law 2 stale-evidence checks

Independent of Law 1, verify against Law 2's three staleness signals:

1. **Head-SHA staleness** — does any audit in `.planning/audits/current/*` carry a commit SHA older than the current `/build` head SHA?
2. **Run-id mismatch** — do all audits, QA report, and ship artifacts share the same `run_id` field? Mismatched run_ids ≡ artifacts collated from different runs.
3. **Clock staleness** — is any audit older than 7 days even when run_id and SHA align?

If any signal fires, the run is `stale_audit`. Do NOT silently archive.

### Step 4 — Surface staleness via AskUserQuestion (gate)

When Step 3 flags `stale_audit`, do not auto-resolve. Use `AskUserQuestion`:

> "The audit set is stale (head SHA / run_id / 7-day clock — name which fired). Should I (a) rerun `/review` against the current head, (b) accept staleness with a documented note in `CLOSEOUT-RECORD.md` ("audit is N days old; re-verify before re-shipping"), or (c) block archive until upstream re-runs complete?"

The operator picks. Record the choice in the closeout record. Silent acceptance is forbidden (per Law 2's last paragraph).

### Step 5 — Assemble follow-on summary

Walk `.planning/current/closeout/` and any attached follow-on artifacts (e.g., `documentation-sync.md` from `/document-release`). Compose `FOLLOW-ON-SUMMARY.md` and `follow-on-summary.json` so future `/discover`, `/retro`, and `/learn` runs consume one stable index instead of rediscovering raw artifacts.

This is closeout writing to its own outputs only — Law 3 still holds.

### Step 6 — Write learnings if candidates exist

If `/review`, `/qa`, or `/ship` left valid learning-candidate artifacts behind, assemble the canonical run learnings into `LEARNINGS.md` and `learnings.json` under `.planning/current/closeout/`. If no valid candidates are available on a rerun, remove any stale learnings artifacts and ledger references rather than leaving them behind.

If no candidates exist at all, skip this step — do not synthesize learnings from nothing.

### Step 7 — Write CLOSEOUT-RECORD.md

Compose the closeout record with:

- Outcome of all five Law 1 checks (pass / fail / N/A with reason)
- Outcome of all three Law 2 staleness checks
- The Step 4 staleness disposition if it fired
- Artifact ledger (every file referenced exists; every canonical-path file is referenced)
- "What we did NOT verify" section listing any unaddressed `/frame` success criteria

If any Law 1 check failed, set `archive_state: not_archived` and include the routing target (which owning skill to re-enter, per Law 3).

### Step 8 — Write next-run-bootstrap.json (for `/discover` continuation)

If a future `/discover` will resume from this run, write `next-run-bootstrap.json` and the human-readable `NEXT-RUN.md` carrying:

- Run-id, branch, head SHA at archive time
- Open questions left unanswered
- Follow-on items not yet routed
- Any explicit "next discovery should consider" notes

`/discover` Step 1 reads this on the next run. A missing or empty bootstrap is fine — it just means fresh discovery rather than seeded continuation.

### Step 9 — Write status

Run the canonical command (in the Routing section below). It writes `status.json` with the verdict (`archived` / `not_archived` / `stale_audit`). The advisor record carries the verdict; downstream tooling reads it.

If the verdict is anything other than `archived`, the closeout has surfaced a problem — Law 3 says route back to the owning skill, not patch from inside `/closeout`.

## Operator Checklist

- verify audit completeness
- verify archive state
- verify legal transition history

## Artifact Contract

Writes `.planning/current/closeout/CLOSEOUT-RECORD.md`, `.planning/current/closeout/FOLLOW-ON-SUMMARY.md`, `.planning/current/closeout/follow-on-summary.json`, `.planning/current/closeout/NEXT-RUN.md`, `.planning/current/closeout/next-run-bootstrap.json`, and `.planning/current/closeout/status.json`.

When `/review`, `/qa`, or `/ship` leave valid learning-candidates artifacts behind, `/closeout` assembles the canonical run learnings and writes `.planning/current/closeout/LEARNINGS.md` and `.planning/current/closeout/learnings.json` alongside the other closeout outputs. If no valid candidates are available on rerun, closeout removes any stale learnings artifacts and ledger references instead of leaving them behind.

Follow-on support workflows may attach additional closeout evidence without
changing canonical closeout state, including
`.planning/current/closeout/documentation-sync.md` from
`/document-release`. `/closeout` assembles the currently attached QA/ship/closeout
follow-on evidence into `.planning/current/closeout/FOLLOW-ON-SUMMARY.md` and
`.planning/current/closeout/follow-on-summary.json` so fresh discover, retro,
and learn flows can consume one stable index instead of rediscovering each raw
artifact separately.

## Routing

Closeout is the final governed conclusion of the work unit and must remain blocked if archive or provenance checks are inconsistent.

Run:

```bash
_REPO_CWD="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
_NEXUS_ROOT="~/.claude/skills/nexus"
[ -d "$_REPO_CWD/.claude/skills/nexus" ] && _NEXUS_ROOT="$_REPO_CWD/.claude/skills/nexus"
cd "$_NEXUS_ROOT" && NEXUS_PROJECT_CWD="$_REPO_CWD" ./bin/nexus closeout
```

## Typical prompts

These are example user requests `/closeout` handles well. The skill is invoked and produces a structured `CLOSEOUT-RECORD.md` plus `status.json` (and learnings/next-run artifacts when relevant).

### Prompt 1 — Clean closeout

> "Close out this run."

`/closeout` walks Step 1–9. Step 1 reads all upstream status.json files. Step 2 confirms Law 1's five checks pass. Step 3 confirms no Law 2 staleness signal fires. Steps 5–7 assemble the follow-on summary, learnings (if candidates exist), and CLOSEOUT-RECORD. Step 9 writes `archive_state: archived`.

### Prompt 2 — Stale audit branching

> "Audit was generated yesterday but I made commits today — ok to archive?"

Step 1 reads upstream state. Step 3 fires the head-SHA staleness signal (audit's commit SHA is older than current `/build` head). Step 4 surfaces the `AskUserQuestion` gate: rerun `/review`, accept staleness with note, or block until upstream re-runs. The operator picks; closeout records the disposition rather than silently archiving (per Law 2).

### Prompt 3 — Inconsistent upstream state

> "`/build` says complete but `/review` says fail — closeout fix it?"

Step 1 reads both status.json files. The conflict is real. Per Law 3, closeout is read-only over upstream stages — it does not patch the inconsistency. Step 7 writes `CLOSEOUT-RECORD.md` with `archive_state: not_archived`, names the conflict, and identifies the owning skill to re-enter (`/build` or `/review`). The operator decides which stage to re-run; closeout does not launder the run by editing upstream artifacts.

These prompts test that `/closeout` runs the integrity + staleness checklist faithfully, surfaces operator choice when staleness fires, and refuses to patch upstream state (Law 3).

## Completion Advisor

After `/closeout` returns, prefer the runtime JSON field `completion_advisor`. If the host only has
filesystem access, or the field is absent, fall back to `.planning/current/closeout/completion-advisor.json`.
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
- `suppressed_surfaces`
- `default_action_id`

If `interaction_mode` is `summary_only`, do not call AskUserQuestion. Print the advisor
`summary`, any `project_setup_gaps`, and the invocation for the `default_action_id` if one exists.

If the session is interactive and `interaction_mode` is not `summary_only`, always use
AskUserQuestion for `/closeout` completion.

If the host cannot display AskUserQuestion, rerun `/closeout` with `--output interactive`
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

The closeout advisor should be the single place where you surface:

- fresh `/discover` for the next governed run
- `/land` when landing is still pending
- `/land-and-deploy` as the compatibility shortcut when landing is still pending
- `/deploy` after a landed merge-only result when deploy is still needed
- `/canary` after a verified deploy with a production URL but no post-deploy health evidence
- `/retro`, `/learn`, and `/document-release` as follow-on work

If the session is non-interactive, print the advisor `summary` and the invocation for the
`default_action_id` when one exists.
