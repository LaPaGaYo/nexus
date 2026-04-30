# Nexus development

Claude-facing project instructions for this repository.
Keep this file concise and always-on. Put topic-specific or path-sensitive guidance in
`hosts/claude/rules/`; `.claude/rules/` is the Claude discovery compatibility
surface. Use skills for task-specific workflows. `AGENTS.md` exists for other
hosts and should not replace this file as Claude's source of truth.

## Nexus Skill Routing

When the user's request matches a canonical Nexus command, invoke that command first.
This guidance helps command discovery only.
Contracts, transitions, governed artifacts, and lifecycle truth are owned by `lib/nexus/`
and canonical `.planning/` artifacts.

Key routing rules:
- Product ideas, vague problems, and discovery -> invoke discover
- Scope definition, requirements, and non-goals -> invoke frame
- Execution readiness and implementation planning -> invoke plan
- Governed routing and handoff packaging -> invoke handoff
- Bounded implementation execution -> invoke build
- Formal review and audit state -> invoke review
- QA validation and explicit testing requests -> invoke qa
- Governed release gate and merge-readiness -> invoke ship
- Final governed verification and closure -> invoke closeout
- Root-cause debugging and "why is this broken" -> invoke investigate
- Browser QA, screenshots, and workflow capture -> invoke browse

## Project Truths

- Nexus is the only active command, lifecycle, artifact, and governance surface.
- Repo-visible instructions, contracts, and artifacts are the source of truth.
- If tool state conflicts with repo-visible Nexus state, surface the conflict instead of silently reconciling it.
- Keep project behavior here or in `hosts/claude/rules/`. Keep user-level preferences in `~/.claude/CLAUDE.md`.

## Working Commands

```bash
bun install
bun test
bun run build
bun run gen:skill-docs --host codex
bun run skill:check
```

## Working Conventions

- `SKILL.md` files are generated outputs. Edit `.tmpl` sources or generators, then regenerate.
- Prefer `/browse` or `$B` for browser automation. Do not use `mcp__claude-in-chrome__*` unless explicitly requested.
- Keep Claude-facing instructions short and specific. Move heavy or path-sensitive detail into `hosts/claude/rules/`; keep `.claude/rules/` as compatibility links only.
- Preserve multi-model boundaries: Claude is the front door; Codex and Gemini remain backend collaborators through Nexus and CCB, not parallel contract owners.
