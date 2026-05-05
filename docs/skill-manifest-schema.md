# Nexus Skill Manifest Schema

`nexus.skill.yaml` is an optional sidecar manifest for `SKILL.md`. It lets a skill declare routing intent, lifecycle stage fit, ranking hints, and provenance in a format Nexus can validate before later registry phases consume it. The TypeScript shape is `NexusSkillManifest`.

Skills without a manifest still work through heuristic discovery. Add a manifest when a skill should participate in stage-aware routing with explicit metadata.

## Location

Place one manifest next to the skill file:

```text
my-skill/
  SKILL.md
  nexus.skill.yaml
```

Nexus standardizes on `.yaml`. Do not create a parallel `.yml` file.

## Required Fields

| Field | Type | Notes |
|---|---|---|
| `schema_version` | number | Must be `1` for the current parser. |
| `name` | string | Canonical skill name. |
| `summary` | string | Short routing summary, 200 characters or fewer. |
| `intent_keywords` | string array | Non-empty list of natural-language phrases. |

## Optional Fields

| Field | Type | Notes |
|---|---|---|
| `lifecycle_stages` | enum array | Any of `discover`, `frame`, `plan`, `handoff`, `build`, `review`, `qa`, `ship`, `closeout`. |
| `classification.namespace` | enum | `nexus_canonical`, `nexus_support`, or `external_installed`. |
| `classification.category` | string | Free-form grouping label. |
| `applies_to.hosts` | enum array | Any of `claude`, `codex`, `gemini-cli`. Empty or omitted means all hosts. |
| `applies_to.contexts` | enum array | Any of `solo`, `pair`, `team`. Empty or omitted means all contexts. |
| `inputs[]` | object array | Declared inputs with `name`, optional `description`, `artifact`, and `optional`. |
| `outputs[]` | object array | Declared outputs with `name`, optional `description`, `artifact`, and `optional`. |
| `ranking.base_score` | number | Optional baseline score for later ranking phases. |
| `ranking.boosts[]` | object array | Each boost has `delta` and either `context` or `tag`. |
| `provenance.*` | object | Optional `author`, `source_url`, `version`, and `license`. |
| `notes[]` | string array | User-facing notes for future advisor surfaces. |

Unknown top-level fields are ignored with a warning so future schema additions do not break v1 readers. Invalid required fields and invalid enum values fail validation.

## Minimal Example

```yaml
schema_version: 1
name: my-skill
summary: A skill that does a focused job.
intent_keywords:
  - do the focused job
```

## Stage-Aware Example

```yaml
schema_version: 1
name: prd-development
summary: Guide product managers through structured PRD creation.
intent_keywords:
  - write a PRD
  - product requirements document
  - PRD template
lifecycle_stages:
  - frame
  - plan
classification:
  namespace: external_installed
  category: product-management
inputs:
  - name: discovery_artifact
    description: Output from /discover.
    optional: true
outputs:
  - name: prd_document
    description: Structured PRD markdown.
    artifact: framing/prd.md
ranking:
  base_score: 5
  boosts:
    - context: stage:frame
      delta: 3
```

## External Skill Example

```yaml
schema_version: 1
name: test-driven-development
summary: Drive implementation through failing tests, small patches, and verification.
intent_keywords:
  - write tests first
  - test driven development
  - red green refactor
lifecycle_stages:
  - build
  - qa
classification:
  namespace: external_installed
  category: engineering-discipline
applies_to:
  hosts:
    - claude
    - codex
  contexts:
    - solo
    - pair
provenance:
  author: Superpowers
  source_url: https://github.com/obra/superpowers
  license: MIT
notes:
  - Most useful before implementation starts.
```

## FAQ

Do I need a manifest for every skill?
: No. Skills without `nexus.skill.yaml` continue to work through heuristic discovery.

Can a skill have multiple manifests?
: No. Use one `nexus.skill.yaml` next to one `SKILL.md`.

What if the manifest name differs from `SKILL.md` frontmatter?
: The standalone parser validates only the manifest. Later registry consumption should compare the manifest name with `SKILL.md` metadata before using it.

What happens with `schema_version: 2`?
: The v1 parser returns `unsupported_version` and falls back to non-manifest behavior in future registry consumption.

How should I write `intent_keywords`?
: Use phrases a user might naturally type, such as `write a PRD`, `review for accessibility`, or `run browser QA`. Keep them specific enough to distinguish neighboring skills.
