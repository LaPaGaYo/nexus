# Nexus Skill Anatomy Rubric

This rubric keeps Nexus support skills executable and auditable. It is inspired
by production skill-pack anatomy patterns, but is Nexus-owned and enforced by
`bun run skill:check`.

## Scope

The first enforcement target is Nexus support skills, not canonical lifecycle
commands. Canonical commands are governed by the Nexus stage manifest, ledger,
and `.planning/` artifact contracts. Support skills need a separate quality
rubric because they are invoked opportunistically from completion advisors and
external skill surfacing.

## Criteria

Each support skill is scored out of 10:

| Criterion | Weight | Requirement |
|-----------|--------|-------------|
| Trigger conditions | 2 | Frontmatter description says when to use the skill. |
| Identity and overview | 1 | The skill starts with a clear role, purpose, or overview. |
| Workflow steps | 2 | The skill has executable steps, phases, arguments, or setup. |
| Output contract | 2 | The skill declares the report, artifact, status, or handoff it produces. |
| Verification evidence | 2 | The skill requires concrete proof such as tests, screenshots, reports, or status artifacts. |
| Safety boundaries | 1 | The skill states scope limits, ask-first rules, or do-not-touch boundaries. |

Scores:

- `10/10`: pass
- `7-9/10`: warn
- `<7/10`: fail

## Enforcement

Default `skill:check` mode is non-blocking for anatomy failures. This lets Nexus
surface existing support-skill debt without breaking unrelated releases.

Strict mode turns failed support-skill rubric checks into a nonzero exit:

```bash
NEXUS_SKILL_RUBRIC_STRICT=1 bun run skill:check
```

Use strict mode when intentionally polishing the support surface or before
promoting the rubric into a release gate.

## Design Notes

- The rubric checks template sources (`SKILL.md.tmpl`), not generated host
  outputs. Templates are the source of truth.
- The rubric is intentionally heuristic. It surfaces review targets; it does
  not replace human review of skill quality.
- Existing legacy support skills can remain below threshold temporarily, but
  new or heavily edited support skills should target `10/10`.
