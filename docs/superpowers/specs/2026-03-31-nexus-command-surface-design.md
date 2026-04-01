# Nexus Command Surface v0.1 Design

## Goal

Define and scaffold the canonical Nexus command surface in-repo while implementing a real governed thin slice for:

- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/closeout`

Milestone 1 proves the governed operating model end to end with repo-visible state, explicit transitions, durable artifacts, and refusal-aware execution. The remaining canonical commands exist as first-class Nexus commands but stay placeholder implementations in v0.1.

## Scope

### In Scope

- Add canonical Nexus commands as top-level command sources:
  - `discover/`
  - `frame/`
  - `plan/`
  - `handoff/`
  - `build/`
  - `review/`
  - `qa/`
  - `ship/`
  - `closeout/`
- Add a new `lib/nexus/` runtime as the single source of truth for:
  - command ownership
  - command status
  - required inputs
  - durable outputs
  - exit conditions
  - alias mapping
  - artifact definitions
  - governance checks
  - legal stage transitions
- Implement a real governed thin slice for:
  - `/plan -> /handoff -> /build -> /review -> /closeout`
- Keep legacy commands as transitional aliases routed through the canonical Nexus runtime.
- Make the repository the system of record for the governed thin slice.

### Out of Scope

- Full implementation of `/discover`, `/frame`, `/qa`, and `/ship`
- Full package rename from gstack to Nexus
- Full remote provider execution through CCB
- Elimination of all legacy commands in v0.1

## Core Decisions

1. Canonical Nexus commands are first-class top-level command directories, not hidden redirects.
2. `lib/nexus/` owns the contract layer. Command directories surface the commands, but do not define independent contract logic.
3. The governed thin slice reads only repo-visible predecessor artifacts. Hidden session memory is not part of the contract.
4. Markdown artifacts are human-readable contracts. Structured JSON files are the source of truth for transition logic.
5. Placeholder commands are executable enough to expose their contract and persist explicit status, but they must never silently advance governed execution.
6. Legacy commands remain compatibility-only and route through canonical Nexus behavior.

## Command Layout

Milestone 1 introduces new top-level directories for each canonical Nexus command. Each directory contains a `SKILL.md.tmpl` source and generated `SKILL.md` so the command surface is immediately visible to the user.

The command set is:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

These commands are the primary documented surface. Legacy names remain available only as aliases.

## Runtime Architecture

`lib/nexus/` is the new shared runtime for canonical command behavior. It centralizes type definitions, command metadata, artifact paths, transition rules, and stage implementations.

Planned runtime structure:

- `lib/nexus/types.ts`
- `lib/nexus/command-manifest.ts`
- `lib/nexus/ledger.ts`
- `lib/nexus/status.ts`
- `lib/nexus/transitions.ts`
- `lib/nexus/artifacts.ts`
- `lib/nexus/governance.ts`
- `lib/nexus/commands/discover.ts`
- `lib/nexus/commands/frame.ts`
- `lib/nexus/commands/plan.ts`
- `lib/nexus/commands/handoff.ts`
- `lib/nexus/commands/build.ts`
- `lib/nexus/commands/review.ts`
- `lib/nexus/commands/qa.ts`
- `lib/nexus/commands/ship.ts`
- `lib/nexus/commands/closeout.ts`

### Shared Type Model

`lib/nexus/types.ts` defines the typed model shared by:

- the run ledger
- stage status files
- transition logic
- command implementations
- artifact pointer definitions

The shared model includes:

- `run_id`
- command ids
- stage ids
- command implementation status
- stage state
- stage decision
- artifact pointers
- route intent
- provenance
- transition result

`state` and `decision` remain separate fields throughout the runtime.

## Command Manifest

`lib/nexus/command-manifest.ts` is the single source of truth for canonical commands and aliases.

Each canonical command record defines:

- canonical command id
- primary owner
- implementation status: `implemented` or `placeholder`
- purpose
- required inputs
- minimum durable outputs
- exit condition
- legal predecessors
- legacy aliases

The manifest also defines which commands are implemented for Milestone 1:

- implemented:
  - `plan`
  - `handoff`
  - `build`
  - `review`
  - `closeout`
- placeholder:
  - `discover`
  - `frame`
  - `qa`
  - `ship`

`allowed_next_stages` is derived from the manifest and transition rules. The ledger records the current projection but does not own the rules.

## Repo-Visible State Model

The repository is the system of record for the governed thin slice.

### Run Ledger

`.planning/nexus/current-run.json` is the current-run ledger. It is a structured record for the active governed lifecycle and must include a stable `run_id`.

The ledger records:

- `run_id`
- lifecycle stage
- current command
- current stage
- previous completed stage
- current projected `allowed_next_stages`
- command history
- current route intent
- artifact pointers
- run-level status

The ledger is not a static manifest. It is the current-run record for the active Nexus lifecycle.

### Stage Status Files

Each implemented stage persists a stage-local structured status file:

- `.planning/current/plan/status.json`
- `.planning/current/handoff/status.json`
- `.planning/current/build/status.json`
- `.planning/current/review/status.json`
- `.planning/current/closeout/status.json`

Each stage status file must include the same `run_id` as the run ledger.

Each status file includes:

- `run_id`
- `stage`
- `state`
- `decision`
- `ready`
- concrete input artifact pointers
- concrete output artifact pointers
- `started_at`
- `completed_at`
- validation errors

The status files are the structured source of truth for stage readiness and completion. Markdown artifacts remain human-readable, but transition logic must not rely on parsing prose.

## Artifact Layout

Milestone 1 writes concrete working artifacts under `.planning/`.

### Run-Level State

- `.planning/nexus/current-run.json`

### Plan

- `.planning/current/plan/execution-readiness-packet.md`
- `.planning/current/plan/sprint-contract.md`
- `.planning/current/plan/status.json`

### Handoff

- `.planning/current/handoff/governed-execution-routing.md`
- `.planning/current/handoff/governed-handoff.md`
- `.planning/current/handoff/status.json`

### Build

- `.planning/current/build/build-request.json`
- `.planning/current/build/build-result.md`
- `.planning/current/build/status.json`

### Review

- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`
- `.planning/audits/current/synthesis.md`
- `.planning/audits/current/gate-decision.md`
- `.planning/audits/current/meta.json`
- `.planning/current/review/status.json`

### Closeout

- `.planning/current/closeout/CLOSEOUT-RECORD.md`
- `.planning/current/closeout/status.json`

### Artifact Semantics

- `build-request.json` is the requested execution route and requested substrate.
- `.planning/audits/current/meta.json` is the reviewed provenance record.
- Stage inputs and outputs use concrete artifact pointers, not symbolic names.

## Governed Thin Slice

### `/plan`

Purpose:

- convert framing into an execution-ready planning packet

Milestone 1 responsibilities:

- create or refresh the run ledger with a stable `run_id`
- write:
  - execution readiness packet
  - sprint contract
  - plan status
- mark the stage ready or not ready in structured state

Exit:

- `completed` with execution-ready decision
- or `blocked` with explicit not-ready decision

### `/handoff`

Purpose:

- convert a ready plan into governed execution inputs

Milestone 1 responsibilities:

- refuse if plan artifacts or plan status are missing or not ready
- write:
  - governed execution routing
  - governed handoff
  - handoff status
- persist explicit planner, generator, evaluators, substrate, and fallback policy

Exit:

- `completed` when the governed handoff package is valid
- or `refused` when plan prerequisites are not satisfied

### `/build`

Purpose:

- execute the bounded implementation contract

Milestone 1 responsibilities:

- refuse if governed handoff inputs are incomplete
- write:
  - `build-request.json`
  - build result summary
  - build status
- record explicit requested route and explicit execution result
- disallow silent local fallback when governed mode requires refusal

Exit:

- `completed` with implementation result ready for review
- or `refused` with non-compliant route details

### `/review`

Purpose:

- write the formal current audit set and reviewed provenance

Milestone 1 responsibilities:

- refuse if build outputs are incomplete
- write the full current audit workspace:
  - `codex.md`
  - `gemini.md`
  - `synthesis.md`
  - `gate-decision.md`
  - `meta.json`
- write review status
- ensure `meta.json` records actual reviewed provenance

Milestone 1 may use local explicit adapters for Codex and Gemini audit outputs if full CCB execution is not yet wired, but the artifacts, route declarations, and provenance fields must still be real and explicit.

Exit:

- `completed` when the current audit set is complete and the gate status is explicit
- or `refused` when required predecessor artifacts are missing

### `/closeout`

Purpose:

- verify the governed work unit and conclude the run

Milestone 1 responsibilities:

- refuse if required audit artifacts are incomplete
- write:
  - closeout record
  - closeout status
- verify:
  - artifact completeness
  - transition legality
  - run_id consistency across ledger and stages
  - cross-artifact consistency
  - reviewed provenance consistency
  - gate decision presence
  - archive requirement status when applicable

Closeout must explicitly detect:

- missing artifacts
- inconsistent provenance
- illegal transition history
- placeholder contamination of governed state

Exit:

- `completed` with final decision
- or `blocked` with explicit reasons

## Transition Rules

`lib/nexus/transitions.ts` enforces legal stage movement.

The governed thin slice for Milestone 1 is:

`plan -> handoff -> build -> review -> closeout`

Transition legality is based on:

- manifest-defined stage rules
- predecessor status files
- concrete predecessor artifact pointers
- run ledger consistency

Commands must not infer readiness from prose or conversation memory.

Illegal transitions are refused. Example refusals:

- `/handoff` without a completed ready plan
- `/build` without governed handoff artifacts
- `/review` without build completion
- `/closeout` without the full current audit set

## Placeholder Commands

The following commands exist as first-class Nexus commands in Milestone 1 but remain placeholder implementations:

- `/discover`
- `/frame`
- `/qa`
- `/ship`

Each placeholder command must:

- be executable
- expose its purpose
- expose its expected inputs
- expose its expected outputs
- expose its exit condition
- validate obvious predecessor state when invoked
- use the shared stage status schema from `lib/nexus/types.ts`
- write a concrete stage status file at:
  - `.planning/current/discover/status.json`
  - `.planning/current/frame/status.json`
  - `.planning/current/qa/status.json`
  - `.planning/current/ship/status.json`

Each placeholder command must not:

- silently advance governed execution
- fabricate missing predecessor artifacts
- mutate governed thin-slice state as if the command were implemented

## Legacy Alias Model

Legacy commands remain compatibility-only and must route through the canonical Nexus runtime.

Initial alias mapping:

- `office-hours -> discover`
- `plan-ceo-review -> frame`
- `plan-eng-review -> frame`
- `autoplan -> plan`
- `start-work -> discover` or `plan`
- `execute-wave -> build`
- `governed-execute -> build`
- `verify-close -> closeout`

Alias ownership is centralized in the Nexus manifest. Alias commands do not own separate contract logic.

## Verification Strategy

Milestone 1 verification focuses on the governed thin slice as a repo-visible stateful system.

### Structure Checks

- every canonical Nexus command directory exists
- every canonical command has `SKILL.md.tmpl`
- generated `SKILL.md` exists for every canonical command
- the manifest covers every canonical command
- shared types cover ledger, status, transitions, and command implementations
- alias mappings are defined centrally in the manifest

### Drift Checks

- manifest command ids match canonical command directories
- canonical command directories match generated `SKILL.md`
- implemented and placeholder command status in the manifest matches runtime behavior
- shared types remain consistent with ledger and stage status payloads

### Governed Slice Checks

- `/plan -> /handoff -> /build -> /review -> /closeout` works end to end
- each stage writes expected markdown artifacts and status files
- all governed stages carry the same stable `run_id`
- transitions are refused when predecessors are missing or invalid
- `build-request.json` route intent and `meta.json` reviewed provenance remain distinguishable and consistent

### Closeout Checks

`/closeout` tests must explicitly catch:

- missing artifacts
- inconsistent provenance
- illegal transition history
- placeholder contamination of governed state

## Milestone 1 Outcome

Milestone 1 is complete when:

- the canonical Nexus command surface exists in-repo
- `lib/nexus/` is the single source of truth for command contracts and transition logic
- the governed thin slice works end to end against repo-visible state
- placeholder commands are explicit and non-advancing
- legacy commands operate only as aliases through the Nexus runtime
- verification proves the governed operating model as a stateful repo-first system
