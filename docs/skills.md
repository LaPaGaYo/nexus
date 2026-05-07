# Nexus Skill Deep Dives

Nexus is the only command surface and the lifecycle authority for governed
work. Its canonical skill meaning comes from Nexus-owned stage content under
`lib/nexus/stage-content/`, stage packs under `lib/nexus/stage-packs/`, and
runtime contracts under `lib/nexus/`.

Nexus is also a skill router, not a skill warehouse. It does not copy every
useful external skill into this repository. Instead, SkillRegistry scans
installed host skill roots, reads `SKILL.md`, loads optional adjacent
`nexus.skill.yaml` manifests, and gives the advisor and `/nexus do` dispatcher
enough metadata to recommend or route to the right surface.

Imported upstream repos and historical skill families remain source material
and lineage only; they do not own lifecycle truth. Users upgrade Nexus versions,
not upstream repos. `/nexus-upgrade` and automatic upgrade are the only
user-facing update paths. Release detection is channel-based through
`release_channel` and published `release.json` manifests.

Legacy aliases and host utilities remain documented below for migration,
safety, and tooling, but they do not own lifecycle contracts, artifact truth,
or governed stage transitions.

## `/nexus` entrypoint

`/nexus` is the workflow-harness entrypoint.

- It is not the browser skill.
- On entry it should summarize whether the current session is using `governed_ccb`
  or `local_provider`.
- When CCB is relevant, it should report mounted providers and missing governed
  providers before the user starts lifecycle work.
- When governed CCB is not session-ready, it should explain the current-host
  local fallback path and then return the user to the canonical lifecycle.
- Bare `/nexus` should send the user toward `/discover`, not `/browse`.
- Free-form requests should use `/nexus do "<intent>"` so SkillRegistry and
  manifest metadata can classify the route before the user enters a command.

## Skill Ecology v2

Skill Ecology v2 has three cooperating pieces:

- `nexus.skill.yaml` declares routing metadata next to a skill's `SKILL.md`.
  Built-in Nexus skills use it to describe lifecycle fit, intent keywords, and
  classification. External authors can add the same file without moving their
  skill into the Nexus repository.
- `lib/nexus/skill-registry/` scans installed host roots for `SKILL.md`,
  attaches manifests when present, classifies the surface as Nexus canonical,
  Nexus support, safety, or external installed, and ranks candidates for the
  advisor.
- `/nexus do "<intent>"` asks the dispatcher to classify a natural-language
  request against those manifests and installed-skill records. Confident
  matches report the proposed command surface; ambiguous matches produce a
  choice; misses refuse with a helpful next step.

The stage-completion advisor uses the same registry data after each canonical
stage. It writes `recommended_skills` for manifest-aware Nexus surfaces and
keeps `recommended_external_skills` supplemental so hosts can display external
skills without confusing them with governed lifecycle commands.

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
| [`/discover`](#discover) | **Discovery** | Clarify the problem, goals, constraints, and missing information. |
| [`/frame`](#frame) | **Framing** | Define scope, non-goals, success criteria, and the product brief. |
| [`/plan`](#plan) | **Planning** | Convert approved framing into execution-ready artifacts and readiness state. |
| [`/handoff`](#handoff) | **Governed routing** | Record approved provider routing, substrate, provenance intent, and fallback policy. |
| [`/build`](#build) | **Disciplined execution** | Run the bounded implementation contract through Nexus-governed execution. |
| [`/review`](#review) | **Dual audit** | Promote provider-authored review receipts into the audit set, synthesis, gate decision, and reviewed provenance. |
| [`/qa`](#qa) | **Validation** | Record explicit validation scope, findings, and QA status. |
| [`/ship`](#ship) | **Release gate** | Record release readiness, checklist state, and PR handoff metadata without bypassing review or closeout requirements. |
| [`/closeout`](#closeout) | **Milestone verification** | Verify archive, provenance, legality, and final readiness status. |

## `/discover`

The canonical discovery command. This is the Nexus-owned front door for vague ideas, early product thinking, and problem clarification.

- Primary purpose: clarify the problem, goals, constraints, and open questions.
- Router note: related discovery skills may appear through SkillRegistry, but
  `/discover` remains the governed lifecycle source of truth.
- Canonical outputs: `docs/product/idea-brief.md` and `.planning/current/discover/status.json`.
- Legacy compatibility alias: `/office-hours`.

Fresh-run discover may emit session continuation advice at phase boundaries.
That advice keeps lifecycle legality separate from session-quality guidance:
Nexus can continue here even when compaction or a fresh session is
recommended. The normalized options are `continue_here`,
`compact_then_continue`, and `fresh_session_continue`. `/continue` remains the
canonical fresh-session resume path.
Fresh-run discover may also emit retro continuity artifacts when recent
repo-scoped retros exist under `.planning/archive/retros/`.

## `/frame`

The canonical framing command. This is where Nexus converts discovery into scoped product intent and success criteria.

- Primary purpose: define scope, non-goals, success criteria, dependencies, and PRD shape.
- Router note: related framing or research skills may be recommended as
  support, but `/frame` owns the canonical product intent.
- Canonical outputs: `docs/product/decision-brief.md`, `docs/product/prd.md`, and `.planning/current/frame/status.json`.
- Legacy compatibility aliases: `/plan-ceo-review`, `/plan-eng-review`.

## `/plan`

The canonical planning command. This is where Nexus turns approved framing into an execution-ready packet.

- Primary purpose: produce readiness, sprint contract, the canonical verification matrix, and explicit ready or blocked status.
- Router note: planning-adjacent skills can supplement readiness, but `/plan`
  owns the canonical verification matrix and sprint contract.
- Canonical outputs: `.planning/current/plan/execution-readiness-packet.md`, `.planning/current/plan/sprint-contract.md`, `.planning/current/plan/verification-matrix.json`, and `.planning/current/plan/status.json`.
- Legacy compatibility alias: `/autoplan`.

## `/handoff`

The canonical handoff command. Nexus owns the governed bridge between planning and execution.

- Primary purpose: freeze requested routing, fallback policy, and governed handoff artifacts.
- Router note: handoff remains governed Nexus runtime state; CCB is transport,
  not lifecycle authority.
- Canonical outputs: `.planning/current/handoff/governed-execution-routing.md`, `.planning/current/handoff/governed-handoff.md`, and `.planning/current/handoff/status.json`.
- No backend-native front door is allowed to replace this stage.

## `/build`

The canonical build command. Nexus owns the bounded implementation contract and build record.

- Primary purpose: run disciplined execution and persist the implementation result.
- Router note: execution-discipline skills can be recommended as support, but
  `/build` owns the bounded implementation record.
- Canonical outputs: `.planning/current/build/build-request.json`, `.planning/current/build/build-result.md`, and `.planning/current/build/status.json`.
- Build truth only exists after Nexus normalization and writeback.

## `/review`

The canonical review command. Nexus owns the governed audit truth, but providers now author attempt-scoped receipts first.

- Primary purpose: validate the build through dual audit and promote the validated current-attempt receipts into canonical current audit truth.
- Attempt receipts: `.planning/current/review/attempts/<review_attempt_id>/codex.md`, `.planning/current/review/attempts/<review_attempt_id>/codex.json`, `.planning/current/review/attempts/<review_attempt_id>/gemini.md`, and `.planning/current/review/attempts/<review_attempt_id>/gemini.json`.
- Canonical outputs: `.planning/audits/current/codex.md`, `.planning/audits/current/gemini.md`, `.planning/audits/current/synthesis.md`, `.planning/audits/current/gate-decision.md`, `.planning/audits/current/meta.json`, and `.planning/current/review/status.json`.
- Ownership boundary: providers own review receipt content; Nexus promotes and owns canonical current audit truth.
- Late stale replies stay in attempt receipts and do not overwrite `.planning/audits/current/*`.

## Stage Completion Advisor

Every canonical stage from `/frame` through `/closeout` also writes
`.planning/current/<stage>/completion-advisor.json`.

- Primary purpose: give interactive hosts a runtime-owned next-step contract instead of relying on prompt-only heuristics.
- Advisor contents: interaction mode, primary next actions, alternative actions, recommended side skills, stop action, default action, project setup gaps, and whether an explicit user choice is required.
- Design-aware surfacing: when `design_impact` and the verification matrix say a run is design-bearing, the advisor can elevate `/plan-design-review`, `/design-review`, and `/browse`.
- Maintainability surfacing: when `/review` advisories indicate complexity or behavior-preserving cleanup, the advisor can elevate `/simplify` as a side skill before QA.
- Security/performance surfacing: security advisories can elevate `/cso --diff` and performance advisories can elevate `/benchmark --diff` instead of forcing those checks into the main review pass.
- Manifest-aware skills: SkillRegistry reads installed `SKILL.md` files and
  adjacent `nexus.skill.yaml` manifests, then writes matching Nexus-aware
  surfaces to `recommended_skills`.
- External installed skills: user-installed skills without a governed Nexus
  role can still surface as `recommended_external_skills`. These are
  supplemental only; they never override Nexus canonical commands or
  Nexus-owned support skills.
- CLI fallback: when the host cannot show an interactive prompt, `--output interactive` renders a terminal chooser from the same advisor record without auto-executing the selected command.
- Hidden surfaces: compatibility aliases and utility skills remain off the stage-completion advisor unless the user invokes them directly.
- Strong interactive stages: `/frame`, `/plan`, `/review`, `/qa`, `/ship`, and `/closeout` should surface completion choices in interactive hosts even when the canonical next step is obvious.

## `/closeout`

The canonical closeout command. Nexus verifies the governed work unit and final readiness state here.

- Primary purpose: confirm audit completeness, archive status, legality, provenance consistency, and final outcome.
- Router note: closeout-adjacent skills can contribute evidence, but `/closeout`
  owns final governed verification.
- Canonical outputs: `.planning/current/closeout/CLOSEOUT-RECORD.md` and `.planning/current/closeout/status.json`.
- Closeout stays conservative: missing or inconsistent governed state blocks completion.

## Legacy compatibility deep dives

This appendix exists so older names remain decipherable when they show up in
archived plans, imported upstream material, or generated
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
| `/design-consultation` | Design-system discovery plus integrated deliverable direction for UI, prototype, slide, motion, and infographic work. |
| `/design-shotgun` | Design exploration and option generation across UI screens, prototypes, decks, motion boards, and infographics. |
| `/design-html` | Design-to-implementation handoff support that consumes frozen design and brand context for UI-bearing runs. |
| `/design-review` | Live-site visual audit and polish using an integrated five-lens design critique for UI-bearing runs. |
| `/plan-design-review` | Design-specific plan review support that feeds canonical lifecycle artifacts for UI-bearing runs. |
| `/simplify` | Behavior-preserving simplification pass for maintainability and complexity advisories. |
| `/qa-only` | Report-only QA pass without fixes. |
| `/land` | Post-ship PR landing workflow that consumes ship handoff evidence, merges only after user confirmation, and records merge-only landing evidence. |
| `/deploy` | Post-land deployment workflow that verifies a configured production surface and updates `.planning/current/ship/deploy-result.json`. |
| `/land-and-deploy` | Compatibility shortcut that consumes ship handoff evidence, asks for merge-only vs merge+deploy, and attaches `.planning/current/ship/deploy-result.json`. |
| `/canary` | Post-deploy monitoring that attaches `.planning/current/ship/canary-status.json` as follow-on ship evidence. |
| `/benchmark` | Performance regression checks that attach `.planning/current/qa/perf-verification.md` as follow-on QA evidence. |
| `/document-release` | Release-note and documentation sync that attaches `.planning/current/closeout/documentation-sync.md` as follow-on closeout evidence. |
| `/retro` | Engineering retrospective workflow with repo-scoped archive continuity under `.planning/archive/retros/`. |
| `/learn` | Learned-pattern management. |
| `/careful`, `/freeze`, `/guard`, `/unfreeze` | Safety and edit-boundary controls. |
| `/connect-chrome`, `/setup-browser-cookies`, `/setup-deploy` | Browser and deploy helpers. `/setup-deploy` authors `.planning/deploy/deploy-contract.json` and `.planning/deploy/DEPLOY-CONTRACT.md`, including primary and secondary deploy surfaces. |
| `/nexus-upgrade` | Upgrade Nexus itself through the supported release-based update flow. |

The Nexus design runtime under `runtimes/design/` supports five deliverable
classes: `ui-mockup`, `prototype`, `slides`, `motion`, and `infographic`.
It also includes internal export and verification pipelines for HTML, PDF,
editable PPTX, MP4, GIF, and Playwright-based HTML verification without
reintroducing a second design product surface.

Governed runs may publish canonical learnings at `/closeout`.
`/learn` surfaces both operational JSONL learnings and canonical run learnings when available.
`/closeout` also writes `.planning/current/closeout/FOLLOW-ON-SUMMARY.md` and
`.planning/current/closeout/follow-on-summary.json` as the canonical index for
attached support evidence.

## Historical Lineage Note

You may still encounter legacy terms like "CEO review", "eng review", or
"office hours" in:
- imported upstream source material
- archived closeouts and plans
- compatibility wrappers under `.agents/skills/`
- migration history

Those terms are lineage markers, not active product boundaries. Nexus remains
the only command surface and the only lifecycle authority.
