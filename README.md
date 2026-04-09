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

The intended operating path is:

**Human → Claude → Nexus → CCB → Codex/Gemini**

- the human interacts with Claude
- Claude invokes Nexus
- Nexus owns commands, lifecycle, artifacts, and governance
- Nexus dispatches external model work through CCB when needed
- repo-visible Nexus artifacts remain the only governed truth source

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

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+, [Node.js](https://nodejs.org/) on Windows

### Step 1: Install Nexus on your machine

Open Claude Code and paste this. Claude does the rest.

> Install Nexus. If **`~/.claude/skills/nexus`** does not exist, run **`git clone --single-branch --depth 1 https://github.com/LaPaGaYo/nexus.git ~/.claude/skills/nexus`**. If it already exists, run **`cd ~/.claude/skills/nexus && git pull --ff-only`** instead. Then run **`cd ~/.claude/skills/nexus && ./setup`**. After setup finishes, update the global **`CLAUDE.md`** by adding a **`Nexus`** section that says:
>
> - Claude is the only interactive front door.
> - Route product work through **`/discover`**, **`/frame`**, **`/plan`**, **`/handoff`**, **`/build`**, **`/review`**, **`/qa`**, **`/ship`**, and **`/closeout`**.
> - Use **`/browse`** from Nexus for all web browsing.
> - Never use **`mcp__claude-in-chrome__*`** tools unless the user explicitly asks for them.
> - Legacy aliases **`/office-hours`**, **`/plan-ceo-review`**, **`/plan-eng-review`**, and **`/autoplan`** are compatibility-only.
> - Additional Nexus utility skills available include **`/connect-chrome`**, **`/setup-browser-cookies`**, **`/setup-deploy`**, **`/document-release`**, **`/retro`**, **`/investigate`**, **`/land-and-deploy`**, **`/canary`**, **`/benchmark`**, **`/careful`**, **`/freeze`**, **`/guard`**, **`/unfreeze`**, **`/nexus-upgrade`**, **`/learn`**, and **`/cso`**.
>
> Then ask the user if they also want to add Nexus to the current project so teammates get it.

### Step 2: Add Nexus to your repo so teammates get it

Optional, but recommended for team consistency.

> Add Nexus to this project. Copy **`~/.claude/skills/nexus`** into **`.claude/skills/nexus`** as real files for the repo, not a submodule and not just a symlink. Do not copy the source repo’s **`.git`** directory into the project copy. Then run **`cd .claude/skills/nexus && ./setup`**. After that, update the project **`CLAUDE.md`** so it stays Nexus-first: canonical lifecycle commands come first, `/browse` stays the web tool, `mcp__claude-in-chrome__*` stays disallowed unless explicitly requested, and legacy aliases are documented only as compatibility entries.

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
| `/nexus-upgrade` | Upgrade Nexus. |
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
| [Release Notes](docs/releases/2026-04-08-nexus-v1.0.0.md) | Nexus v1.0.0 release notes |

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
cd ~/.codex/skills/nexus && git pull && ./setup --host codex
```

For repo-local Codex installs:

```bash
cd "$(readlink -f .agents/skills/nexus)" && git pull && ./setup --host codex
```

**Claude cannot see the skills?**

Make sure your `CLAUDE.md` contains a Nexus section that routes lifecycle work
through `/discover`, `/frame`, `/plan`, `/handoff`, `/build`, `/review`,
`/qa`, `/ship`, and `/closeout`, uses `/browse` for web work, and treats legacy
aliases as compatibility-only.

## Privacy & telemetry

Telemetry is opt-in.

- default is off
- on first run, Nexus asks
- remote telemetry excludes code, prompts, file contents, and repo-private text
- local analytics remain available through `nexus-analytics`

Configuration lives under `~/.nexus/config.yaml`.

## License

MIT. Free forever. Go build something.
