# Nexus — Agent Surface

This file mirrors the public Nexus command surface for non-Claude hosts.
Claude follows `CLAUDE.md`; other agents can use this file to stay aligned with the
same Nexus-owned lifecycle and support surface.

## Canonical Nexus lifecycle

Invoke canonical Nexus commands first.

| Skill | What it does |
|-------|-------------|
| `/discover` | Clarify the problem, goals, and constraints. |
| `/frame` | Define scope, non-goals, success criteria, and product shape. |
| `/plan` | Turn approved framing into an execution-ready packet. |
| `/handoff` | Freeze governed routing, provenance intent, and fallback policy. |
| `/build` | Execute the bounded implementation contract. |
| `/review` | Persist the formal audit set and reviewed provenance. |
| `/qa` | Record explicit validation beyond code review. |
| `/ship` | Record the governed release-gate decision. |
| `/closeout` | Verify archive, provenance, and final readiness status. |

## Nexus support surface

| Skill | What it does |
|-------|-------------|
| `/design-consultation` | Build a complete design system from scratch. |
| `/investigate` | Systematic root-cause debugging. No fixes without investigation. |
| `/design-review` | Design audit + fix loop with atomic commits. |
| `/qa-only` | Same as /qa but report only — no code changes. |
| `/document-release` | Update all docs to match what you just shipped. |
| `/retro` | Weekly retro with per-person breakdowns and shipping streaks. |
| `/browse` | Headless browser — real Chromium, real clicks, ~100ms/command. |
| `/setup-browser-cookies` | Import cookies from your real browser for authenticated testing. |
| `/careful` | Warn before destructive commands (rm -rf, DROP TABLE, force-push). |
| `/freeze` | Lock edits to one directory. Hard block, not just a warning. |
| `/guard` | Activate both careful + freeze at once. |
| `/unfreeze` | Remove directory edit restrictions. |
| `/nexus-upgrade` | Update Nexus to the latest version. |

## Legacy compatibility aliases

These remain compatibility-only entrypoints. They route through the same Nexus runtime and do not own separate lifecycle, artifact, or transition semantics.

- `/office-hours -> /discover`
- `/plan-ceo-review -> /frame`
- `/plan-eng-review -> /frame`
- `/autoplan -> /plan`

## Build commands

```bash
bun install              # install dependencies
bun test                 # run tests (free, <5s)
bun run build            # generate docs + compile binaries
bun run gen:skill-docs   # regenerate SKILL.md files from templates
bun run skill:check      # health dashboard for all skills
```

## Key conventions

- `SKILL.md` files are generated from `.tmpl` templates. Edit the template, not the output.
- Run `bun run gen:skill-docs --host codex` to regenerate Codex-specific output.
- The browse binary provides headless browser access. Use `$B <command>` in skills.
- Safety skills (careful, freeze, guard) use inline advisory prose — always confirm before destructive operations.
