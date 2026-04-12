# Nexus

Nexus is a single-package AI engineering operating system.

Nexus is the only command surface.

Claude remains the only interactive front door.

It gives Claude one unified system for:

- product discovery and framing
- execution planning and governed handoff
- disciplined implementation
- dual-audit review
- QA validation
- release gating
- closeout and archival

Gstack host architecture, PM Skills, GSD, and Superpowers are absorbed into
Nexus-owned commands, stage content, and runtime contracts. CCB remains dispatch
and transport infrastructure only.

Nexus-owned stage packs remain the active internal runtime units. Imported
upstream repos remain source material only.
Upstream maintenance is handled by Nexus maintainers.
Users upgrade Nexus versions, not upstream repos.
`/nexus-upgrade` and automatic upgrade are the only user-facing update paths.
Release detection is channel-based through `release_channel` and published
`release.json` manifests. Managed installs are recorded as
`managed_release` or `managed_vendored`, and vendored copies sync to the same
published Nexus release as the managed global install.

## What Nexus owns

Nexus owns the active product and engineering semantics:

- commands
- lifecycle
- repo-visible state
- artifacts
- governance
- runtime orchestration
- project progression

Nexus does not rely on hidden conversational state as the source of truth.
Governed work is recorded in `lib/nexus/` and `.planning/`.

## How it runs

Nexus supports two explicit execution modes.

### `governed_ccb`

Use this when you want the full governed cross-provider path.

1. Make sure CCB providers are mounted for this repo
2. The standard way to start them is `tmux` → `ccb codex gemini claude`
3. Operate through Nexus from Claude once Codex/Gemini are mounted

**Human → Claude → Nexus → CCB → Codex/Gemini**

- the human interacts with Claude
- Claude invokes Nexus
- Nexus owns commands, lifecycle, artifacts, and governance
- Nexus dispatches external model work through CCB when needed
- repo-visible Nexus artifacts remain the only governed truth source

### `local_provider`

Use this when you do not want to install or run CCB.

**Human → Claude/Codex/Gemini → Nexus → local provider CLI**

- Nexus still owns commands, lifecycle, artifacts, and governance
- repo-visible Nexus artifacts remain the only lifecycle truth
- the active local runtime defaults to `single_agent`
- `claude + subagents` is an active local topology when `provider_topology=subagents`
- `codex + subagents` is an active local topology when `provider_topology=subagents`
- `codex + multi_session` is an active local topology when `provider_topology=multi_session`
- `gemini + subagents` is an active local topology when `provider_topology=subagents`
- non-Codex local `multi_session` still blocks at `/handoff`

## Quick start

1. Install Nexus into `~/.claude/skills/nexus`
2. Run `/discover`
3. Run `/frame`
4. Run `/plan`
5. Run `/handoff`
6. Run `/build`
7. Run `/review`
8. Run `/qa`
9. Run `/ship`
10. Run `/closeout`

Canonical lifecycle:

**Discover → Frame → Plan → Handoff → Build → Review → QA → Ship → Closeout**

## Install

**Base requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or another supported host, [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+, [Node.js](https://nodejs.org/) on Windows

**Additional governed-mode requirements:** [tmux](https://github.com/tmux/tmux/wiki) and [CCB](https://github.com/bfly123/claude_code_bridge)

### Step 1: Install Nexus on your machine

Fast path from the shell:

```bash
git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/.claude/skills/nexus
cd ~/.claude/skills/nexus && ./setup
```

If `~/.claude/skills/nexus` already exists, do not clone over it. Run `/nexus-upgrade` instead.

If setup is interactive in Claude and `ask` / CCB is missing, Nexus asks first
whether you want to install CCB now:

- install CCB now through the official `claude_code_bridge` installer, then continue setup
- continue without CCB and use `local_provider`

If CCB installation fails, setup stops there instead of silently falling through to a
governed or local execution choice.

If `ask` / CCB is already installed and setup is interactive in Claude, Nexus then asks
which path you want:

- continue in the current Claude session with `local_provider`
- switch to `governed_ccb` and make sure CCB providers are mounted, typically via `tmux` + `ccb codex gemini claude`

That choice is now explicit. Interactive Claude setup does not silently time out into
`local_provider` when CCB is present.

If you arrive through `/nexus-upgrade` instead of `./setup`, the first post-upgrade
Claude session now treats repo mode and execution mode separately:

- `repo mode` stays `solo` / `collaborative`
- `execution mode` stays `governed_ccb` / `local_provider`

If no explicit `execution_mode` is saved yet, Nexus states the effective default
execution path and, when CCB is already installed, asks whether to persist
`governed_ccb` or stay in the current Claude session with `local_provider`.

If you choose `local_provider` in interactive Claude setup, Nexus then asks
which local Claude topology to use:

- `single_agent`
- `subagents`

Interactive Codex setup follows the same pattern, but the local subagent path is
role-specific Codex passes for build, review, and QA.
Interactive Codex setup also offers `multi_session` when the installed Codex CLI
exposes the required commands.

If setup is non-interactive, the default remains:

- `governed_ccb` when `ask` is installed
- `local_provider` when `ask` is missing
- `single_agent` when `provider_topology` is not already configured

If neither CCB nor the selected local provider CLI is available, Nexus does not
silently continue. `/handoff` records a blocked route decision until you either
install CCB or configure a working local provider binary.

During interactive Claude installs, `./setup` can also offer to add a concise
Nexus-managed section to `~/.claude/CLAUDE.md` for cross-project defaults.
Project-specific workflow, architecture, and build instructions should stay in the
repository `CLAUDE.md`, rules, or skills.
Non-interactive installs skip that global file change by default.

If you want Claude to do the install for you, open Claude Code and paste this:

> Install Nexus. If **`~/.claude/skills/nexus`** does not exist, run **`git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/.claude/skills/nexus`**. If it already exists, run **`/nexus-upgrade`** instead. During setup, if CCB is missing, ask whether to install it before finalizing execution mode. After the install or upgrade finishes, make sure the global **`CLAUDE.md`** routes Claude through Nexus. If setup did not already offer to update it, add a **`Nexus`** section that says:
>
> - Claude is the only interactive front door.
> - When a repository exposes canonical Nexus commands, route lifecycle work through **`/discover`**, **`/frame`**, **`/plan`**, **`/handoff`**, **`/build`**, **`/review`**, **`/qa`**, **`/ship`**, and **`/closeout`**.
> - Keep global **`CLAUDE.md`** limited to cross-project defaults. Keep project-specific workflow and architecture in the repository **`CLAUDE.md`**, **`.claude/rules/`**, or skills.
> - Use **`/browse`** from Nexus for all web browsing.
> - Never use **`mcp__claude-in-chrome__*`** tools unless the user explicitly asks for them.
> - Legacy aliases **`/office-hours`**, **`/plan-ceo-review`**, **`/plan-eng-review`**, and **`/autoplan`** are compatibility-only.
>
> Then ask the user if they also want to add Nexus to the current project so teammates get it.

### Choose or override execution mode

Nexus reads execution defaults from `~/.nexus/config.yaml` via `nexus-config`:

```bash
nexus-config set execution_mode governed_ccb
nexus-config set execution_mode local_provider
nexus-config set primary_provider claude
nexus-config set primary_provider codex
nexus-config set primary_provider gemini
nexus-config set provider_topology single_agent
nexus-config set provider_topology subagents
nexus-config set provider_topology multi_session
```

Use this to inspect the effective execution route without guessing from partial config:

```bash
nexus-config effective-execution
```

Mode-specific rule:

- `governed_ccb`: normally only persist `execution_mode`; `primary_provider` and `provider_topology` are local-provider-only host preferences and may stay unset
- `local_provider`: persist `primary_provider` and `provider_topology` when you want a non-default local provider or topology
- governed requested/actual route truth lives in canonical `.planning/` artifacts, not in `~/.nexus/config.yaml`

Practical defaults:

- interactive Claude setup requires an explicit mode choice when `ask` is installed and no explicit mode is saved
- the first Claude session after `/nexus-upgrade` now also makes repo mode and execution mode explicit when no mode is saved yet
- interactive Claude setup asks whether to install CCB when `ask` is missing and no explicit local choice is already saved
- interactive Claude setup also asks `single_agent` vs `subagents` when `local_provider` is selected for Claude
- interactive Codex setup asks `single_agent` vs `subagents` vs `multi_session` when `local_provider` is selected for Codex
- Gemini local subagents are supported through `nexus-config set primary_provider gemini` plus `nexus-config set provider_topology subagents`
- non-interactive setup uses `governed_ccb` if `ask` is installed
- `local_provider` if `ask` is missing
- `primary_provider` auto-detects `claude`, then `codex`, then `gemini`

### Step 2: Add Nexus to your repo so teammates get it

Optional, but recommended for team consistency.

Shell path:

```bash
mkdir -p .claude/skills
rsync -a --delete --exclude '.git' ~/.claude/skills/nexus/ .claude/skills/nexus/
cd .claude/skills/nexus && ./setup
```

This must be a real repo copy, not a submodule and not just a symlink.

Then update the project `CLAUDE.md` so it stays Nexus-first, and use `.claude/rules/` for heavier or path-scoped project guidance. Canonical lifecycle commands come first, `/browse` stays the web tool, `mcp__claude-in-chrome__*` stays disallowed unless explicitly requested, and legacy aliases are documented only as compatibility entries.

### Other hosts

Install for Codex-compatible hosts:

```bash
git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/nexus
cd ~/nexus && ./setup --host codex
```

Install into a repo-local `.agents/skills/` root:

```bash
git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git .agents/skills/nexus
cd .agents/skills/nexus && ./setup --host codex
```

If you want Codex to do the install for you, open Codex and paste this:

> Install Nexus for Codex. If **`/nexus-upgrade`** is already available, run it. Otherwise, if **`.agents/skills/nexus`** exists in this repo, run **`cd .agents/skills/nexus && ./setup --host codex`**. If it does not exist and **`~/nexus`** does not exist yet, run **`git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/nexus`**, then **`cd ~/nexus && ./setup --host codex`**. After setup finishes, tell the user where the installed **`nexus-*`** skills live, which execution mode and local topology are selected, and remind them that Codex does not use a Nexus-managed global instruction file equivalent to **`~/.claude/CLAUDE.md`**.

Codex does not use a Nexus-managed global instruction file equivalent to **`~/.claude/CLAUDE.md`**.

Let setup auto-detect installed hosts:

```bash
git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/nexus
cd ~/nexus && ./setup --host auto
```

Factory Droid:

```bash
git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/nexus
cd ~/nexus && ./setup --host factory
```

## Canonical lifecycle commands

| Skill | Role | What it does |
|-------|------|--------------|
| `/discover` | PM discovery | Clarify the problem, goals, constraints, and missing context. |
| `/frame` | PM framing | Lock scope, non-goals, success criteria, and the product brief. |
| `/plan` | GSD planning | Convert approved framing into execution-ready planning artifacts. |
| `/handoff` | Governed routing | Record approved provider routing, substrate, provenance intent, and fallback policy. |
| `/build` | Disciplined execution | Run the bounded implementation contract and persist the build result. |
| `/review` | Dual audit | Persist the audit set, synthesis, and reviewed provenance. |
| `/qa` | Validation | Record explicit validation scope, findings, and QA status. |
| `/ship` | Release gate | Record conservative release readiness and checklist state. |
| `/closeout` | Milestone verification | Verify archive, provenance, legality, and final readiness status. |

Legacy aliases remain compatibility-only:

- `/office-hours -> /discover`
- `/plan-ceo-review -> /frame`
- `/plan-eng-review -> /frame`
- `/autoplan -> /plan`

## See it work

```text
You:    /discover
Claude: clarifies the problem, constraints, goals, and unknowns

You:    /frame
Claude: locks scope, non-goals, success criteria, and product shape

You:    /plan
Claude: writes execution-readiness artifacts and verification intent

You:    /handoff
Claude: freezes governed routing, provider intent, and fallback policy

You:    /build
Claude: executes the bounded implementation contract and records build state

You:    /review
Claude: writes the governed audit set and reviewed provenance

You:    /qa
Claude: records validation scope and defects

You:    /ship
Claude: writes conservative release-gate state

You:    /closeout
Claude: verifies archive, provenance, and final work-unit readiness
```

## Nexus support surface

| Skill | What it does |
|-------|-------------|
| `/browse` | Real browser control for QA, capture, and site workflows. |
| `/connect-chrome` | Launch Chrome with Nexus Side Panel control. |
| `/setup-browser-cookies` | Import browser sessions for authenticated QA. |
| `/design-consultation` | Create a design system and product visual direction. |
| `/design-shotgun` | Generate and compare multiple visual directions. |
| `/design-html` | Turn approved mockups into production HTML. |
| `/design-review` | Audit and polish the visual result in code. |
| `/investigate` | Systematic root-cause debugging. |
| `/document-release` | Sync docs after shipping. |
| `/retro` | Project or global retrospective. |
| `/land-and-deploy` | Merge, deploy, and verify production health. |
| `/canary` | Post-deploy health monitoring. |
| `/benchmark` | Performance baselining and regression checks. |
| `/cso` | Security review and threat analysis. |
| `/careful` | Warn before destructive operations. |
| `/freeze` | Restrict edits to one directory. |
| `/guard` | Combine destructive-command warnings and edit freeze. |
| `/unfreeze` | Remove the edit freeze. |
| `/setup-deploy` | Configure `/land-and-deploy`. |
| `/nexus-upgrade` | Upgrade Nexus through the supported release-based user-facing update flow. |
| `/learn` | Manage project learnings across sessions. |
| `/qa-only` | Run QA in report-only mode. |
| `/codex` | Independent second-opinion review through Codex. |

Deep dives and usage examples live in [docs/skills.md](docs/skills.md).

## Governed truth model

Nexus treats the repository as the system of record.

- canonical lifecycle truth lives in `lib/nexus/`
- governed artifacts live in `.planning/`
- backend outputs become truth only after Nexus normalization and writeback
- requested route and actual route are recorded separately
- closeout verifies legality, provenance, archive state, and readiness

This is what keeps the workflow governed instead of conversationally implicit.

## CCB integration

CCB is connected as infrastructure, not as product ownership.

- CCB provides provider dispatch and transport
- Nexus decides lifecycle, route approval, artifacts, and governance
- Codex and Gemini can be used through CCB without becoming contract owners

The intended usage pattern is:

1. Start `tmux`
2. Start `ccb claude codex gemini`
3. Enter Claude
4. Run work through Nexus

## Docs

| Doc | What it covers |
|-----|---------------|
| [Skill Deep Dives](docs/skills.md) | Detailed behavior and examples for the skill surface |
| [Architecture](ARCHITECTURE.md) | System structure and implementation notes |
| [Contributing](CONTRIBUTING.md) | Dev setup, testing, and contributor workflows |
| [Changelog](CHANGELOG.md) | Version history |
| [Release Notes](docs/releases/2026-04-12-nexus-v1.0.9.md) | Nexus v1.0.9 release notes |

## Troubleshooting

**Skill not showing up?**

```bash
cd ~/.claude/skills/nexus && ./setup
```

**`/browse` fails?**

```bash
cd ~/.claude/skills/nexus && bun install && bun run build
```

**Stale install?**

Run `/nexus-upgrade` or set `auto_upgrade: true` in `~/.nexus/config.yaml`.
Upgrade checks follow the configured `release_channel` and published release
metadata, not upstream repo heads.

**Want shorter commands?**

```bash
cd ~/.claude/skills/nexus && ./setup --no-prefix
```

**Want namespaced commands?**

```bash
cd ~/.claude/skills/nexus && ./setup --prefix
```

**Codex says a SKILL.md is invalid?**

```bash
/nexus-upgrade
```

For repo-local Codex installs:

```bash
/nexus-upgrade
```

**Claude cannot see the skills?**

Make sure your `CLAUDE.md` contains a Nexus section that routes lifecycle work
through `/discover`, `/frame`, `/plan`, `/handoff`, `/build`, `/review`,
`/qa`, `/ship`, and `/closeout`, uses `/browse` for web work, and treats legacy
aliases as compatibility-only.

## Privacy

Nexus does not ship usage telemetry.

- no remote analytics backend
- no background usage reporting
- no install-base pings through Supabase
- if Nexus breaks, file an issue or PR on GitHub instead

Configuration lives under `~/.nexus/config.yaml`.

## License

MIT. Free forever. Go build something.
