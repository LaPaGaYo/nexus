# Nexus Skill Deep Dives

Nexus is the only command surface.
PM Skills, GSD, Superpowers, and CCB are absorbed internal capability sources or infrastructure.
Canonical lifecycle skill meaning now comes from Nexus-owned stage content under `lib/nexus/stage-content/`.
Nexus-owned stage packs under `lib/nexus/stage-packs/` remain the active internal runtime units.
Imported upstream repos remain source material only and do not own lifecycle truth.
Upstream maintenance is handled by Nexus maintainers.
Users upgrade Nexus versions, not upstream repos.
`/nexus-upgrade` and automatic upgrade are the only user-facing update paths.
Release detection is channel-based through `release_channel` and published
`release.json` manifests. Managed installs are recorded as
`managed_release` or `managed_vendored`, and vendored copies sync to the same
published Nexus release as the managed global install.
Legacy aliases and host utilities remain documented below for migration, safety, and tooling,
but they do not own lifecycle contracts, artifact truth, or governed stage transitions.
Legacy aliases and host utilities remain secondary compatibility surface only.

## Canonical lifecycle commands

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
- `/qa`
- `/ship`
- `/closeout`

Governed lifecycle:
- `/plan -> /handoff -> /build -> /review -> /qa -> /ship -> /closeout`

`/qa` and `/ship` are now real governed runtime stages. They remain Nexus-owned lifecycle commands, not backend-native front doors.

Legacy compatibility aliases route through the same Nexus runtime:
- `/office-hours -> /discover`
- `/plan-ceo-review -> /frame`
- `/plan-eng-review -> /frame`
- `/autoplan -> /plan`

| Skill | Lifecycle role | What it does |
|-------|----------------|--------------|
| [`/discover`](#discover) | **PM discovery** | Clarify the problem, goals, constraints, and missing information. Absorbs PM discovery methods. |
| [`/frame`](#frame) | **PM framing** | Define scope, non-goals, success criteria, and the product brief. |
| [`/plan`](#plan) | **GSD planning** | Convert approved framing into execution-ready artifacts and readiness state. |
| [`/handoff`](#handoff) | **Governed routing** | Record approved provider routing, substrate, provenance intent, and fallback policy. |
| [`/build`](#build) | **Disciplined execution** | Run the bounded implementation contract through Nexus-governed execution. |
| [`/review`](#review) | **Dual audit** | Persist the audit set, synthesis, gate decision, and reviewed provenance. |
| [`/qa`](#qa) | **Validation** | Record explicit validation scope, findings, and QA status. |
| [`/ship`](#ship) | **Release gate** | Record release readiness and checklist state without bypassing review or closeout requirements. |
| [`/closeout`](#closeout) | **Milestone verification** | Verify archive, provenance, legality, and final readiness status. |

## `/discover`

The canonical discovery command. This is the Nexus-owned front door for vague ideas, early product thinking, and problem clarification.

- Primary purpose: clarify the problem, goals, constraints, and open questions.
- Absorbed capability lineage: PM Skills discovery methods.
- Canonical outputs: `docs/product/idea-brief.md` and `.planning/current/discover/status.json`.
- Legacy compatibility alias: `/office-hours`.

## `/frame`

The canonical framing command. This is where Nexus converts discovery into scoped product intent and success criteria.

- Primary purpose: define scope, non-goals, success criteria, dependencies, and PRD shape.
- Absorbed capability lineage: PM Skills framing methods plus the strongest prior review prompts.
- Canonical outputs: `docs/product/decision-brief.md`, `docs/product/prd.md`, and `.planning/current/frame/status.json`.
- Legacy compatibility aliases: `/plan-ceo-review`, `/plan-eng-review`.

## `/plan`

The canonical planning command. This is where Nexus turns approved framing into an execution-ready packet.

- Primary purpose: produce readiness, sprint contract, verification path, and explicit ready or blocked status.
- Absorbed capability lineage: GSD planning and readiness methods.
- Canonical outputs: `.planning/current/plan/execution-readiness-packet.md`, `.planning/current/plan/sprint-contract.md`, and `.planning/current/plan/status.json`.
- Legacy compatibility alias: `/autoplan`.

## `/handoff`

The canonical handoff command. Nexus owns the governed bridge between planning and execution.

- Primary purpose: freeze requested routing, fallback policy, and governed handoff artifacts.
- Absorbed capability lineage: routing-core plus CCB transport consultation.
- Canonical outputs: `.planning/current/handoff/governed-execution-routing.md`, `.planning/current/handoff/governed-handoff.md`, and `.planning/current/handoff/status.json`.
- No backend-native front door is allowed to replace this stage.

## `/build`

The canonical build command. Nexus owns the bounded implementation contract and build record.

- Primary purpose: run disciplined execution and persist the implementation result.
- Absorbed capability lineage: Superpowers execution discipline plus CCB transport.
- Canonical outputs: `.planning/current/build/build-request.json`, `.planning/current/build/build-result.md`, and `.planning/current/build/status.json`.
- Build truth only exists after Nexus normalization and writeback.

## `/closeout`

The canonical closeout command. Nexus verifies the governed work unit and final readiness state here.

- Primary purpose: confirm audit completeness, archive status, legality, provenance consistency, and final outcome.
- Absorbed capability lineage: GSD closeout methods.
- Canonical outputs: `.planning/current/closeout/CLOSEOUT-RECORD.md` and `.planning/current/closeout/status.json`.
- Closeout stays conservative: missing or inconsistent governed state blocks completion.

## Legacy compatibility deep dives

This appendix exists so older names remain decipherable when they show up in
archived plans, imported upstream material, analytics, or generated
compatibility wrappers. It does not define a second lifecycle.

## Compatibility aliases

These names still resolve, but only as compatibility wrappers. New work should
use the canonical Nexus commands.

| Legacy name | Canonical Nexus command | Current role | Notes |
|------------|-------------------------|--------------|-------|
| `/office-hours` | `/discover` | compatibility-only alias | Historical discovery/front-door name. |
| `/plan-ceo-review` | `/frame` | compatibility-only alias | Historical high-level framing/review name. |
| `/plan-eng-review` | `/frame` | compatibility-only alias | Historical architecture/framing split name. |
| `/autoplan` | `/plan` | compatibility-only alias | Historical auto-planning entrypoint. |

Rules:
- Compatibility aliases route through the same Nexus runtime.
- Compatibility aliases cannot own separate artifacts, stage transitions, or governed outcomes.
- If an older doc mentions one of these names, map it through the table above and continue with the canonical Nexus command.

## Support and Specialty Skills

These are real Nexus skills, but they are not the governed lifecycle spine.

| Skill | Current role in Nexus |
|-------|------------------------|
| `/cso` | Security audit and threat-modeling support skill. |
| `/browse` | Fast browser automation and QA support. |
| `/investigate` | Root-cause debugging workflow. |
| `/design-consultation` | Design-system discovery and visual direction. |
| `/design-shotgun` | Design exploration and option generation. |
| `/design-html` | Design-to-implementation handoff support. |
| `/design-review` | Live-site visual audit and polish. |
| `/plan-design-review` | Design-specific plan review support. |
| `/qa-only` | Report-only QA pass without fixes. |
| `/land-and-deploy` | Post-ship merge and deploy workflow. |
| `/canary` | Post-deploy monitoring. |
| `/benchmark` | Performance regression checks. |
| `/document-release` | Release-note and documentation sync. |
| `/retro` | Engineering retrospective workflow. |
| `/learn` | Learned-pattern management. |
| `/careful`, `/freeze`, `/guard`, `/unfreeze` | Safety and edit-boundary controls. |
| `/connect-chrome`, `/setup-browser-cookies`, `/setup-deploy` | Browser and deploy helpers. |
| `/nexus-upgrade` | Upgrade Nexus itself through the supported release-based update flow. |

## Historical Lineage Note

You may still encounter legacy terms like "CEO review", "eng review", or
"office hours" in:
- imported upstream source material
- archived closeouts and plans
- compatibility wrappers under `.agents/skills/`
- analytics and migration history

Those terms are lineage markers, not active product boundaries. Nexus remains
the only command surface and the only lifecycle authority.
