# Nexus Absorption and Surface Unification Design

## Goal

Define Milestone 3 as the transition from a Gstack-hosted Nexus with backend seams into a product that presents itself as one complete Nexus.

The end state is not a bundle of parallel systems. It is one Nexus product surface that absorbs:

- Gstack host-shell and generated skill infrastructure
- PM Skills discovery and framing methods
- GSD planning, verification, and closeout methods
- Superpowers execution-discipline methods
- CCB multi-model dispatch and transport plumbing

The user-facing result must remain a single Nexus command surface, a single governed artifact model, and a single lifecycle owned by Nexus.

## Scope

### In Scope

- Define the product end state for a fully absorbed Nexus surface.
- Define how imported upstream skill systems are transformed into Nexus-owned stage assets.
- Define the boundary between temporary host-shell responsibilities and long-term Nexus ownership.
- Define the migration safety rules that prevent backend-native or host-native paths from advancing lifecycle stages during the transition.
- Define how CCB dispatch remains under Nexus orchestration for Codex and Gemini task execution.
- Define repo-visible structures for absorbed method packs and source tracing.

### Out of Scope

- Fully rewriting every imported upstream skill in Milestone 3.
- Activating reserved future `/review` or `/ship` seams beyond explicit Nexus-owned planning.
- Replacing the current `.planning/` artifact model.
- Replacing CCB with a different collaboration bus.
- Deleting all Gstack-origin files in Milestone 3.

## Core Decisions

1. The final product surface must be one complete Nexus, not multiple coexisting command systems.
2. Upstream skills may be imported, modified, split, merged, and rewritten, but they may not persist as parallel front-door lifecycle commands.
3. Only canonical Nexus commands may advance lifecycle stage, write canonical stage status, or update the run ledger.
4. `lib/nexus/` and canonical repo-visible artifacts remain the only source of governed truth.
5. Gstack remains a migration-era host shell only. It must continue to lose semantic ownership until it is only a shell substrate.
6. PM Skills, GSD, and Superpowers are absorbed capability sources, not long-term product surfaces.
7. CCB is the dispatch and transport bus underneath Nexus. It does not own contracts, stage transitions, artifacts, or governance.
8. During migration, target-state rules and migration-safety rules both apply; the system must defend against legacy or backend-native drift until absorption is complete.

## 1. Product End State

The final product presented to the user is one complete Nexus.

The user should only need to understand:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

The user should not need to reason about:

- Gstack-native commands
- PM-native commands
- GSD-native commands
- Superpowers-native commands
- CCB-native operational commands

Those systems may still exist internally as absorbed assets or infrastructure, but they are not the product surface.

The authoritative governed system remains:

- `lib/nexus/`
- `.planning/nexus/current-run.json`
- `.planning/current/*/status.json`
- canonical stage artifacts under `.planning/current/`
- canonical audit artifacts under `.planning/audits/current/`

## 2. Full Skill Absorption

Milestone 3 adopts a full absorption model:

- upstream skills are imported into the repository
- upstream skills may be modified for Nexus needs
- upstream skills may be decomposed into smaller method units
- upstream skills may be merged into stage-specific Nexus assets

What is absorbed:

- prompts
- templates
- checklists
- workflow steps
- guardrails
- method structures
- verification logic
- dispatch request patterns

What is not preserved:

- a second user-facing command surface
- backend-native lifecycle ownership
- backend-native artifact ownership
- backend-native transition authority

This means PM Skills, GSD, and Superpowers may be fully brought into the repository and rewritten, but they must disappear into Nexus at the product surface.

## 3. Stage Ownership After Absorption

After absorption, stage ownership remains canonical and exclusive:

- `/discover` owns discovery progression
- `/frame` owns framing progression
- `/plan` owns planning progression
- `/handoff` owns governed routing progression
- `/build` owns implementation progression
- `/review` owns review progression
- `/qa` owns QA progression
- `/ship` owns release-gate progression
- `/closeout` owns closure progression

Imported backend methods may inform these commands, but they may not directly advance the stage.

The following actions remain Nexus-only:

- writing `.planning/nexus/current-run.json`
- writing `.planning/current/*/status.json`
- determining legal next stages
- deciding `ready`, `blocked`, `refused`, `completed`, or equivalent canonical state
- deciding final gate or closeout outcomes
- defining canonical artifact paths

Backend-native invocation must not become equivalent to canonical stage execution.

## 4. Target State vs Migration Safety

### Target State

When absorption is complete:

- upstream-native skills are no longer formal lifecycle entrypoints
- Claude and users only invoke Nexus commands
- stage progression occurs only through Nexus-owned command flows
- backend methods exist only as internal absorbed assets

In that state, the system should no longer need to worry about alternate command paths advancing lifecycle stage.

### Migration Safety

Until that target state is fully reached, the system must defend against legacy drift.

During migration:

- host-native paths may still exist
- legacy aliases may still exist
- imported upstream commands and skill files are still present in the repository
- `CLAUDE.md` and generated wrapper logic may still reflect host-era behavior

Therefore Milestone 3 must explicitly block or refuse any path where:

- a backend-native command attempts to advance a stage
- a host wrapper attempts to determine stage outcome
- a non-canonical path writes canonical stage status
- a non-canonical path changes the run ledger
- transport availability is mistaken for Nexus approval

## 5. Host Reduction and Surface Unification

Gstack remains the temporary host shell, but Milestone 3 should continue reducing it toward a minimal shell role.

### What the host may still do

- provide generated top-level command directories
- provide wrapper invocation mechanics
- provide update checks, session detection, and host UX conveniences
- provide installation and documentation substrate during migration

### What the host may not do

- define canonical Nexus command meaning
- define alias semantics
- define transition legality
- define readiness or refusal rules
- define governed artifact truth
- define release or closeout outcomes

The highest-risk host structure remains `scripts/resolvers/preamble.ts`. It must continue to lose routing and contract semantics until it functions only as host bootstrap.

The top-level canonical command directories may remain during migration, but they should become thinner and more purely passthrough over time.

## 6. `CLAUDE.md` Boundary

`CLAUDE.md` may influence invocation behavior, but it must not become a contract layer.

Allowed influence:

- helping Claude route a user request to the correct canonical Nexus command
- host-level convenience or discoverability guidance

Forbidden influence:

- defining stage contracts
- defining artifact truth
- defining transition legality
- defining readiness or refusal semantics
- defining review or closeout completion semantics

If `CLAUDE.md` conflicts with `lib/nexus/` or canonical `.planning/` artifacts, Nexus wins by definition.

Milestone 3 should treat stale or conflicting `CLAUDE.md` semantics as migration drift, not as a second source of truth.

## 7. Absorbed Capability Packs

Imported upstream sources now live under:

- `upstream/pm-skills`
- `upstream/gsd`
- `upstream/superpowers`
- `upstream/claude-code-bridge`

These directories are source repositories only. They are not runtime front doors.

Milestone 3 should introduce Nexus-owned absorbed capability packs under `lib/nexus/`, for example:

- `lib/nexus/absorption/pm/`
- `lib/nexus/absorption/gsd/`
- `lib/nexus/absorption/superpowers/`
- `lib/nexus/absorption/ccb/`

Each absorbed capability pack should include at least:

- a `source-map` record linking the Nexus-owned method pack to upstream source files
- Nexus-owned method modules or templates that are safe for canonical command use

The runtime should depend on the absorbed Nexus-owned packs, not directly on raw upstream skill directories.

## 8. Upstream-Specific Absorption Model

### PM Skills

Absorb PM methods into Nexus-owned discovery and framing stage assets.

Primary targets:

- discovery structures
- framing structures
- PRD generation methods
- prioritization and synthesis templates

Primary canonical destinations:

- `/discover`
- `/frame`

### GSD

Absorb planning, readiness, verification, and closeout methods into Nexus-owned lifecycle assets.

Primary targets:

- execution-readiness logic
- bounded-scope planning
- verification expectations
- closeout structure

Primary canonical destinations:

- `/plan`
- `/closeout`
- future support for `/review` and `/ship` only when Nexus activates them

### Superpowers

Absorb execution discipline and workflow rigor into Nexus-owned implementation lifecycle assets.

Primary targets:

- TDD discipline
- verification-before-completion discipline
- plan execution discipline
- review-before-completion discipline
- finish-branch discipline

Primary canonical destinations:

- `/build`
- future support for `/review`
- future support for `/ship`

### CCB

Absorb dispatch and provider-transport patterns as infrastructure under Nexus ownership.

Primary targets:

- request shaping
- provider dispatch
- result collection
- requested-route vs actual-route records
- provider-specific execution plumbing for Codex and Gemini

Primary canonical destinations:

- `/handoff`
- `/build`
- future `/review`

## 9. CCB Dispatch Boundary

CCB remains infrastructure only.

Nexus decides:

- whether dispatch should occur
- which lifecycle stage is active
- which requested route is canonical
- whether a provider route is approved
- whether returned output can be normalized into governed truth

CCB may:

- dispatch implementation tasks to Codex
- dispatch audit tasks to Codex or Gemini in future stages
- return execution metadata and provider-specific responses

CCB may not:

- approve the route on its own
- advance the lifecycle stage
- write canonical stage status
- decide gate outcomes
- persist governed truth instead of Nexus

Requested route, route validation, and actual reviewed provenance must stay distinct wherever CCB is involved.

## 10. Backend Command Non-Authority Rule

This rule must remain explicit until full absorption is complete:

- PM-native commands may not advance discovery or framing stage on their own.
- GSD-native commands may not advance planning or closeout stage on their own.
- Superpowers-native commands may not advance build, review, or ship stage on their own.
- CCB-native operational commands may not establish governed truth on their own.

Even if Claude invokes a backend-native command directly, that invocation is not a valid governed stage transition.

At most, it may produce:

- non-authoritative trace output
- source material for later normalization
- migration-defect evidence

It may not produce:

- canonical stage completion
- canonical stage status
- ledger advancement
- canonical gate decisions

## 11. Discoverability Reduction

Surface unification is not complete unless discoverability is unified too.

Milestone 3 must reduce non-Nexus discoverability across:

- generated `SKILL.md` files
- wrapper descriptions
- README and docs navigation
- host routing help text
- installation guidance
- skill lists that still suggest backend-native entrypoints

Legacy compatibility may still exist, but it must be clearly secondary to canonical Nexus names.

## 12. Success Criteria

Milestone 3 is successful when:

- the intended product end state is explicitly one complete Nexus
- imported upstream systems are defined as absorbed sources, not parallel product surfaces
- only canonical Nexus commands retain lifecycle advancement authority
- Gstack host responsibilities are reduced toward a shell-only role
- `CLAUDE.md` remains invocation guidance only, not a contract layer
- backend-native command paths are explicitly prevented from advancing governed state during migration
- CCB is clearly constrained to dispatch and transport infrastructure
- repo-visible upstream imports and provenance remain traceable
- the path from imported upstream skills to Nexus-owned absorbed capability packs is explicitly defined

## 13. Recommended Next Step

Write the Milestone 3 implementation plan around:

- host routing preamble reduction
- absorbed capability pack scaffolding
- upstream-to-Nexus source mapping
- backend command non-authority enforcement
- discoverability reduction toward a single Nexus surface
