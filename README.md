# Nexus

Nexus is a single-package AI engineering operating system.
Claude remains the only interactive front door.

> PM Skills, GSD, and Superpowers are absorbed capability sources. CCB remains dispatch and transport infrastructure only.

> "I don't think I've typed like a line of code probably since December, basically, which is an extremely large change." — [Andrej Karpathy](https://fortune.com/2026/03/21/andrej-karpathy-openai-cofounder-ai-agents-coding-state-of-psychosis-openclaw/), No Priors podcast, March 2026

When I heard Karpathy say this, I wanted to find out how. How does one person ship like a team of twenty? Peter Steinberger built [OpenClaw](https://github.com/openclaw/openclaw) — 247K GitHub stars — essentially solo with AI agents. The revolution is here. A single builder with the right tooling can move faster than a traditional team.

I'm [Garry Tan](https://x.com/garrytan), President & CEO of [Y Combinator](https://www.ycombinator.com/). I've worked with thousands of startups — Coinbase, Instacart, Rippling — when they were one or two people in a garage. Before YC, I was one of the first eng/PM/designers at Palantir, cofounded Posterous (sold to Twitter), and built Bookface, YC's internal social network.

**Nexus is the system I want in front of every project.** I've been building products for twenty years, and right now I'm shipping more code than I ever have. In the last 60 days: **600,000+ lines of production code** (35% tests), **10,000-20,000 lines per day**, part-time, while running YC full-time. Here's my last `/retro` across 3 projects: **140,751 lines added, 362 commits, ~115k net LOC** in one week.

**2026 — 1,237 contributions and counting:**

![GitHub contributions 2026 — 1,237 contributions, massive acceleration in Jan-Mar](docs/images/github-2026.png)

**2013 — when I built Bookface at YC (772 contributions):**

![GitHub contributions 2013 — 772 contributions building Bookface at YC](docs/images/github-2013.png)

Same person. Different era. The difference is the tooling.

**Nexus is how the workflow comes together.** Claude interacts with one unified system. Nexus owns the commands, lifecycle, artifacts, governance, and project progression; PM Skills, GSD, and Superpowers are absorbed capability sources behind that surface, and CCB remains dispatch and transport infrastructure. The result is a virtual engineering team — a CEO who rethinks the product, an eng manager who locks architecture, a designer who catches AI slop, a reviewer who finds production bugs, a QA lead who opens a real browser, a security officer who runs OWASP + STRIDE audits, and a release engineer who ships the PR.

This is my open source software factory. I use it every day. I'm sharing it because these tools should be available to everyone.

Fork it. Improve it. Make it yours. And if you want to hate on free open source software — you're welcome to, but I'd rather you just try it first.

**Who this is for:**
- **Founders and CEOs** — especially technical ones who still want to ship
- **First-time Claude Code users** — structured roles instead of a blank prompt
- **Tech leads and staff engineers** — rigorous review, QA, and release automation on every PR

## Quick start

1. Install Nexus into `~/.claude/skills/nexus`
2. Run `/discover` — describe the product, problem, or unknown
3. Run `/frame` — lock scope, non-goals, and success criteria
4. Run `/plan` — turn approved framing into execution-ready artifacts
5. Run `/handoff` — freeze governed routing and fallback policy
6. Run `/build` — execute the bounded implementation contract
7. Run `/review` — complete governed dual-audit review
8. Run `/qa` — record explicit governed validation
9. Run `/ship` — record conservative release-gate state
10. Run `/closeout` — verify the governed work unit and archive state

## Nexus v0.1 command surface

Nexus is the only command surface.
PM Skills, GSD, Superpowers, and CCB are absorbed internal capability sources or infrastructure.
Canonical lifecycle skill meaning now comes from Nexus-owned stage content under `lib/nexus/stage-content/`.
Nexus-owned stage packs under `lib/nexus/stage-packs/` remain the active internal runtime units.
Imported upstream repos remain source material only and do not own lifecycle truth.
Legacy aliases remain compatibility-only entrypoints and do not own separate contract,
artifact, or transition logic.

Canonical Nexus commands:
- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

Implemented canonical commands in the current milestone:
- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/closeout`
- `/qa`
- `/ship`

The governed lifecycle now runs end to end with real tail-runtime stages:
- `/plan -> /handoff -> /build -> /review -> /qa -> /ship -> /closeout`

`/qa` and `/ship` remain policy-optional in some flows, but they are no longer placeholders.

The following legacy names remain as compatibility aliases and route through the same Nexus runtime:
- `/office-hours -> /discover`
- `/plan-ceo-review -> /frame`
- `/plan-eng-review -> /frame`
- `/autoplan -> /plan`

## Install — 30 seconds

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.0+, [Node.js](https://nodejs.org/) (Windows only)

### Step 1: Install Nexus on your machine

Open Claude Code and paste this. Claude does the rest.

> Install Nexus: clone this repo into **`~/.claude/skills/nexus`**, run **`./setup`**, then add a "Nexus" section to CLAUDE.md that routes product work through `/discover`, `/frame`, `/plan`, `/handoff`, `/build`, `/review`, `/qa`, `/ship`, and `/closeout`. Keep `/browse` for web work, and keep legacy aliases compatibility-only.

### Step 2: Add Nexus to your repo so teammates get it (optional)

> Add Nexus to this project: copy the install into **`.claude/skills/nexus`**, run **`./setup`**, and keep the CLAUDE.md guidance Nexus-first. Teammates should see the canonical Nexus lifecycle commands first, with legacy aliases documented only as compatibility entries.

Real files get committed to your repo (not a submodule), so `git clone` just works. Everything lives inside `.claude/`. Nothing touches your PATH or runs in the background.

> **Contributing or need full history?** The commands above use `--depth 1` for a fast install. If you plan to contribute or need full git history, do a full clone instead:
> ```bash
> git clone <nexus-repo-url> ~/.claude/skills/nexus
> ```

The active install surface is Nexus-only.

### Codex, Gemini CLI, or Cursor

Nexus works on any agent that supports the [SKILL.md standard](https://github.com/anthropics/claude-code). Skills live in `.agents/skills/` and are discovered automatically.

Install to one repo:

```bash
git clone --single-branch --depth 1 <nexus-repo-url> .agents/skills/nexus
cd .agents/skills/nexus && ./setup --host codex
```

When setup runs from `.agents/skills/nexus`, it installs the generated Codex skills next to it in the same repo and does not write to `~/.codex/skills`.

Install once for your user account:

```bash
git clone --single-branch --depth 1 <nexus-repo-url> ~/nexus
cd ~/nexus && ./setup --host codex
```

`setup --host codex` creates the runtime root at `~/.codex/skills/nexus` and
links the generated Codex skills at the top level. This avoids duplicate skill
discovery from the source repo checkout.

Or let setup auto-detect which agents you have installed:

```bash
git clone --single-branch --depth 1 <nexus-repo-url> ~/nexus
cd ~/nexus && ./setup --host auto
```

For Codex-compatible hosts, setup supports both repo-local installs from `.agents/skills/nexus` and user-global installs from `~/.codex/skills/nexus`.

### Factory Droid

Nexus works with [Factory Droid](https://factory.ai). Skills install to `.factory/skills/` and are discovered automatically. Sensitive skills (ship, land-and-deploy, guard) use `disable-model-invocation: true` so Droids don't auto-invoke them.

```bash
git clone --single-branch --depth 1 <nexus-repo-url> ~/nexus
cd ~/nexus && ./setup --host factory
```

Skills install to `~/.factory/skills/nexus-*/`. Restart `droid` to rescan skills, then type `/qa` to get started.

## See it work

```
You:    I want to build a daily briefing app for my calendar.
You:    /discover
Claude: [asks about the pain — specific examples, not hypotheticals]

You:    Multiple Google calendars, events with stale info, wrong locations.
        Prep takes forever and the results aren't good enough...

Claude: I'm going to push back on the framing. You said "daily briefing
        app." But what you actually described is a personal chief of
        staff AI.
        [extracts 5 capabilities you didn't realize you were describing]
        [challenges 4 premises — you agree, disagree, or adjust]
        [generates 3 implementation approaches with effort estimates]
        RECOMMENDATION: Ship the narrowest wedge tomorrow, learn from
        real usage. The full vision is a 3-month project — start with
        the daily briefing that actually works.
        [writes idea brief + discovery notes]

You:    /frame
        [locks scope, non-goals, success criteria, and PRD shape]

You:    /plan
        [writes execution readiness packet + sprint contract]

You:    /handoff
        [records governed route, fallback policy disabled, provider intent explicit]

You:    /build
        [writes implementation summary and bounded build result]

You:    /review
        [dual audit set persisted with reviewed provenance]

You:    /qa https://staging.myapp.com
        [validation scope recorded, defects surfaced explicitly]

You:    /ship
        [release gate recorded]

You:    /closeout
        [archive state verified, work unit concluded]
```

You said "daily briefing app." Nexus turned that into a governed work unit with explicit framing, planning, execution, audit, QA, ship, and closeout state. That is not a copilot. That is a system.

## The sprint

Nexus is a process, not a collection of tools. The lifecycle runs in one canonical order:

**Discover → Frame → Plan → Handoff → Build → Review → QA → Ship → Closeout**

Each command feeds the next through repo-visible artifacts. `/discover` writes the problem record that `/frame` hardens. `/plan` produces the execution packet that `/handoff` freezes into governed routing. `/build` produces the implementation record that `/review`, `/qa`, `/ship`, and `/closeout` verify. Nothing falls through the cracks because Nexus owns the lifecycle and artifact chain.

| Skill | Your specialist | What they do |
|-------|----------------|--------------|
| `/discover` | **PM discovery** | Clarify the problem, goals, constraints, and missing context. |
| `/frame` | **PM framing** | Lock scope, non-goals, success criteria, and the product brief. |
| `/plan` | **GSD planning** | Convert approved framing into execution-ready planning artifacts. |
| `/handoff` | **Governed routing** | Record approved provider routing, substrate, provenance intent, and fallback policy. |
| `/build` | **Disciplined execution** | Run the bounded implementation contract and persist the build result. |
| `/review` | **Dual audit** | Persist the audit set, synthesis, and reviewed provenance. |
| `/qa` | **Validation** | Record explicit validation scope, findings, and QA status. |
| `/ship` | **Release gate** | Record conservative release readiness and checklist state. |
| `/closeout` | **Milestone verification** | Verify archive, provenance, legality, and final readiness status. |

Legacy aliases remain compatibility-only. `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, and `/autoplan` route through the same Nexus runtime and do not own separate lifecycle semantics.

## Nexus support surface

| Skill | What it does |
|-------|-------------|
| `/codex` | **Second Opinion** — independent code review from OpenAI Codex CLI. Three modes: review (pass/fail gate), adversarial challenge, and open consultation. Cross-model analysis when both `/review` and `/codex` have run. |
| `/design-consultation` | **Design Partner** — build a complete design system from scratch. |
| `/design-review` | **Designer Who Codes** — run a live-site design audit and fix loop. |
| `/design-shotgun` | **Design Explorer** — generate multiple visual variants and compare them quickly. |
| `/design-html` | **Design Engineer** — turn an approved mockup into production-quality HTML. |
| `/debug` | **Debugger** — systematic root-cause debugging with strict investigation discipline. |
| `/qa-only` | **QA Reporter** — run the QA method without code changes. |
| `/document-release` | **Technical Writer** — update docs after a governed release. |
| `/retro` | **Eng Manager** — run a project or global retrospective. |
| `/browse` | **QA Engineer** — give the agent eyes with real browser control. |
| `/setup-browser-cookies` | **Session Manager** — import browser sessions for authenticated testing. |
| `/land-and-deploy` | **Release Engineer** — merge, deploy, and verify production health. |
| `/canary` | **SRE** — monitor post-deploy health and regressions. |
| `/benchmark` | **Performance Engineer** — baseline and compare performance. |
| `/cso` | **Chief Security Officer** — run security review methodology. |
| `/careful` | **Safety Guardrails** — warns before destructive commands (rm -rf, DROP TABLE, force-push). Say "be careful" to activate. Override any warning. |
| `/freeze` | **Edit Lock** — restrict file edits to one directory. Prevents accidental changes outside scope while debugging. |
| `/guard` | **Full Safety** — `/careful` + `/freeze` in one command. Maximum safety for prod work. |
| `/unfreeze` | **Unlock** — remove the `/freeze` boundary. |
| `/connect-chrome` | **Chrome Controller** — launch Chrome with the Side Panel extension. Watch every action live, inspect CSS on any element, clean up pages, and take screenshots. Each tab gets its own agent. |
| `/setup-deploy` | **Deploy Configurator** — one-time setup for `/land-and-deploy`. Detects your platform, production URL, and deploy commands. |
| `/nexus-upgrade` | **Self-Updater** — upgrade Nexus to the latest version. Detects global vs vendored install, syncs both, shows what changed. |
| `/learn` | **Memory** — manage what Nexus learned across sessions. |

**[Deep dives with examples and philosophy for every skill →](docs/skills.md)**

## Parallel sprints

Nexus works well with one sprint. It gets interesting with ten running at once.

**Design is at the heart.** `/design-consultation` builds your design system from scratch, researches the space, proposes creative risks, and writes `DESIGN.md`. `/design-shotgun` generates multiple visual variants and opens a comparison board so you can pick a direction. `/design-html` takes that approved mockup and generates production-quality HTML with Pretext, where text actually reflows on resize instead of breaking with hardcoded heights. Then `/design-review`, `/frame`, and `/plan` carry those decisions into the governed lifecycle.

**`/qa` was a massive unlock.** It let me go from 6 to 12 parallel workers. Claude Code saying *"I SEE THE ISSUE"* and then actually fixing it, generating a regression test, and verifying the fix — that changed how I work. The agent has eyes now.

**Smart review routing.** Just like at a well-run startup: CEO doesn't have to look at infra bug fixes, design review isn't needed for backend changes. Nexus tracks what reviews are run, figures out what's appropriate, and just does the smart thing. The Review Readiness Dashboard tells you where you stand before you ship.

**Test everything.** `/ship` bootstraps test frameworks from scratch if your project doesn't have one. Every `/ship` run produces a coverage audit. Every `/qa` bug fix generates a regression test. 100% test coverage is the goal — tests make vibe coding safe instead of yolo coding.

**`/document-release` is the engineer you never had.** It reads every doc file in your project, cross-references the diff, and updates everything that drifted. README, ARCHITECTURE, CONTRIBUTING, CLAUDE.md, TODOS — all kept current automatically. And now `/ship` auto-invokes it — docs stay current without an extra command.

**Real browser mode.** `$B connect` launches your actual Chrome as a headed window controlled by Playwright. You watch Claude click, fill, and navigate in real time — same window, same screen. A subtle green shimmer at the top edge tells you which Chrome window Nexus controls. All existing browse commands work unchanged. `$B disconnect` returns to headless. A Chrome extension Side Panel shows a live activity feed of every command and a chat sidebar where you can direct Claude. This is co-presence — Claude isn't remote-controlling a hidden browser, it's sitting next to you in the same cockpit.

**Sidebar agent — your AI browser assistant.** Type natural language instructions in the Chrome side panel and a child Claude instance executes them. "Navigate to the settings page and screenshot it." "Fill out this form with test data." "Go through every item in this list and extract the prices." Each task gets up to 5 minutes. The sidebar agent runs in an isolated session, so it won't interfere with your main Claude Code window. It's like having a second pair of hands in the browser.

**Personal automation.** The sidebar agent isn't just for dev workflows. Example: "Browse my kid's school parent portal and add all the other parents' names, phone numbers, and photos to my Google Contacts." Two ways to get authenticated: (1) log in once in the headed browser — your session persists, or (2) run `/setup-browser-cookies` to import cookies from your real Chrome. Once authenticated, Claude navigates the directory, extracts the data, and creates the contacts.

**Browser handoff when the AI gets stuck.** Hit a CAPTCHA, auth wall, or MFA prompt? `$B handoff` opens a visible Chrome at the exact same page with all your cookies and tabs intact. Solve the problem, tell Claude you're done, `$B resume` picks up right where it left off. The agent even suggests it automatically after 3 consecutive failures.

**Multi-AI second opinion.** `/codex` gets an independent review from OpenAI's Codex CLI — a completely different AI looking at the same diff. Three modes: code review with a pass/fail gate, adversarial challenge that actively tries to break your code, and open consultation with session continuity. When both `/review` (Claude) and `/codex` (OpenAI) have reviewed the same branch, you get a cross-model analysis showing which findings overlap and which are unique to each.

**Safety guardrails on demand.** Say "be careful" and `/careful` warns before any destructive command — rm -rf, DROP TABLE, force-push, git reset --hard. `/freeze` locks edits to one directory while debugging so Claude can't accidentally "fix" unrelated code. `/guard` activates both. `/investigate` auto-freezes to the module being investigated.

**Proactive skill suggestions.** Nexus notices what stage you're in — brainstorming, reviewing, debugging, testing — and suggests the right skill. Don't like it? Say "stop suggesting" and it remembers across sessions.

## 10-15 parallel sprints

Nexus is powerful with one sprint. It is transformative with ten running at once.

[Conductor](https://conductor.build) runs multiple Claude Code sessions in parallel — each in its own isolated workspace. One session running `/discover` on a new idea, another doing `/review` on a PR, a third implementing through `/build`, a fourth running `/qa` on staging, and six more on other branches. All at the same time. I regularly run 10-15 parallel sprints — that's the practical max right now.

The sprint structure is what makes parallelism work. Without a process, ten agents is ten sources of chaos. With a process — discover, frame, plan, handoff, build, review, QA, ship, closeout — each agent knows exactly what to do and when to stop. You manage them the way a CEO manages a team: check in on the decisions that matter, let the rest run.

---

Free, MIT licensed, open source. No premium tier, no waitlist.

I open sourced how I build software. You can fork it and make it your own.

> **We're hiring.** Want to ship 10K+ LOC/day and help harden Nexus?
> Come work at YC — [ycombinator.com/software](https://ycombinator.com/software)
> Extremely competitive salary and equity. San Francisco, Dogpatch District.

## Docs

| Doc | What it covers |
|-----|---------------|
| [Skill Deep Dives](docs/skills.md) | Philosophy, examples, and workflow for every skill (includes Greptile integration) |
| [Builder Ethos](ETHOS.md) | Builder philosophy: Boil the Lake, Search Before Building, three layers of knowledge |
| [Architecture](ARCHITECTURE.md) | Design decisions and system internals |
| [Browser Reference](BROWSER.md) | Full command reference for `/browse` |
| [Contributing](CONTRIBUTING.md) | Dev setup, testing, contributor mode, and dev mode |
| [Changelog](CHANGELOG.md) | What's new in every version |

## Privacy & Telemetry

Nexus includes **opt-in** usage telemetry to help improve the project. Here's exactly what happens:

- **Default is off.** Nothing is sent anywhere unless you explicitly say yes.
- **On first run,** Nexus asks if you want to share anonymous usage data. You can say no.
- **What's sent (if you opt in):** skill name, duration, success/fail, Nexus version, OS. That's it.
- **What's never sent:** code, file paths, repo names, branch names, prompts, or any user-generated content.
- **Change anytime:** `nexus-config set telemetry off` disables everything instantly.

Data is stored in [Supabase](https://supabase.com) (open source Firebase alternative). The schema is in [`supabase/migrations/`](supabase/migrations/) — you can verify exactly what's collected. The Supabase publishable key in the repo is a public key (like a Firebase API key) — row-level security policies deny all direct access. Telemetry flows through validated edge functions that enforce schema checks, event type allowlists, and field length limits.

**Local analytics are always available.** Run `nexus-analytics` to see your personal usage dashboard from the local JSONL file — no remote data needed.

## Troubleshooting

**Skill not showing up?** `cd ~/.claude/skills/nexus && ./setup`

**`/browse` fails?** `cd ~/.claude/skills/nexus && bun install && bun run build`

**Stale install?** Run `/nexus-upgrade` — or set `auto_upgrade: true` in `~/.nexus/config.yaml`

**Want shorter commands?** `cd ~/.claude/skills/nexus && ./setup --no-prefix` — switches from `/nexus-qa` to `/qa`. Your choice is remembered for future upgrades.

**Want namespaced commands?** `cd ~/.claude/skills/nexus && ./setup --prefix` — switches from `/qa` to `/nexus-qa`. Useful if you run other skill packs alongside Nexus.

**Codex says "Skipped loading skill(s) due to invalid SKILL.md"?** Your Codex skill descriptions are stale. Fix: `cd ~/.codex/skills/nexus && git pull && ./setup --host codex` — or for repo-local installs: `cd "$(readlink -f .agents/skills/nexus)" && git pull && ./setup --host codex`

**Windows users:** Nexus works on Windows 11 via Git Bash or WSL. Node.js is required in addition to Bun — Bun has a known bug with Playwright's pipe transport on Windows ([bun#4253](https://github.com/oven-sh/bun/issues/4253)). The browse server automatically falls back to Node.js. Make sure both `bun` and `node` are on your PATH.

**Claude says it can't see the skills?** Make sure your project's `CLAUDE.md` has a Nexus section. Add this:

```
## Nexus
Use /browse from Nexus for all web browsing. Never use mcp__claude-in-chrome__* tools.
Canonical lifecycle: /discover, /frame, /plan, /handoff, /build, /review, /qa, /ship, /closeout.
Support surface: /design-consultation, /design-shotgun, /design-html, /design-review,
/debug, /browse, /connect-chrome, /setup-browser-cookies, /document-release, /retro,
/codex, /cso, /land-and-deploy, /canary, /benchmark, /careful, /freeze, /guard,
/unfreeze, /setup-deploy, /nexus-upgrade, /learn.
Legacy aliases remain compatibility-only: /office-hours, /plan-ceo-review, /plan-eng-review, /autoplan.
```

## License

MIT. Free forever. Go build something.
