Date: 2026-04-17
Milestone: post-v1.0.32 support-surface integration
Branch: `codex/phase-boundary-continuation-advisor`

# Nexus Setup-Deploy Mainline Integration Design

## Goal

Absorb `/setup-deploy` into Nexus-owned repo-visible truth by replacing the
current `CLAUDE.md` deploy section with a canonical deploy contract that both
`/ship` and `/land-and-deploy` consume.

## Scope

- define the canonical deploy contract artifact and ownership boundary
- define how `/setup-deploy` authors or refreshes that contract
- define how `/ship` uses the contract for governed readiness
- define how `/land-and-deploy` consumes the same contract
- define backward-compatibility behavior for existing `CLAUDE.md` deploy config

## Non-Goals

- adding a new canonical lifecycle stage for deploy setup
- moving `/land-and-deploy` into `lib/nexus/` as a canonical stage
- fully redesigning the deploy workflow itself
- removing all deploy-related guidance from `CLAUDE.md`
- implementing canary, benchmark, or release-doc integrations in this spec

## Problem Statement

`/setup-deploy` is still a helper that writes deploy assumptions into
`CLAUDE.md`.

That is no longer aligned with Nexus architecture:

- governed truth should be repo-visible and Nexus-owned
- `CLAUDE.md` should remain invocation guidance, not a contract layer
- `/ship` should be able to say whether deploy prerequisites are explicit
- `/land-and-deploy` should consume the same contract rather than re-discover
  or parse `CLAUDE.md`

The current state creates three concrete problems:

1. deploy configuration lives in a non-canonical surface
2. `/ship` cannot produce a structured deploy-readiness judgment
3. `/land-and-deploy` must infer deploy assumptions from a mixed guidance file

## Desired End State

- `/setup-deploy` writes a canonical deploy contract
- `/ship` records whether deploy configuration is present and usable
- `/land-and-deploy` reads the canonical contract first
- `CLAUDE.md` may still contain high-level operator notes, but not the primary
  deploy contract
- existing projects with only a `CLAUDE.md` deploy section still work during
  migration

## Core Design Decisions

### 1. `/setup-deploy` remains a support workflow

`/setup-deploy` does not become a canonical lifecycle stage.

It becomes a support workflow that authors a **Stage-Owned input** used by
`/ship` and `/land-and-deploy`.

### 2. Canonical deploy contract lives in `.planning/deploy/`

The canonical contract will live at:

- `.planning/deploy/deploy-contract.json`
- `.planning/deploy/DEPLOY-CONTRACT.md`

Rationale:

- deploy configuration is cross-run project state, not tied to a single current
  stage
- it should be repo-visible and versionable
- it should not masquerade as `current` stage output

### 3. `/ship` owns deploy readiness, not deploy setup

`/ship` should not configure deploys.

It should:

- detect whether a deploy contract exists
- record whether deploy prerequisites are explicit
- persist a structured deploy-readiness view in ship artifacts

### 4. `/land-and-deploy` consumes the canonical contract

`/land-and-deploy` should read `.planning/deploy/deploy-contract.json` first.

Only when the canonical contract is absent should it fall back to legacy
`CLAUDE.md` parsing, and that path should be treated as migration compatibility,
not the preferred contract source.

### 5. `CLAUDE.md` deploy config becomes deprecated compatibility

`CLAUDE.md` may still contain:

- routing guidance
- operator notes
- free-form project instructions

It should no longer be described as the source of truth for deploy settings.

## Canonical Deploy Contract

The deploy contract should be structured enough for `/ship` and
`/land-and-deploy` to reason about deploy readiness without re-detecting the
entire environment.

Minimum JSON fields:

- `schema_version`
- `configured_at`
- `platform`
- `project_type`
- `production`
  - `url`
  - `health_check`
- `staging`
  - `url`
  - `workflow`
- `deploy_trigger`
- `deploy_workflow`
- `deploy_status`
  - `kind`
  - `command`
- `custom_hooks`
  - `pre_merge`
  - `post_merge`
- `notes`
- `sources`

The markdown companion should present the same information in a human-scannable
form and explicitly state that the JSON file is canonical.

## Ship Integration

`/ship` should consume the deploy contract and write deploy readiness into ship
artifacts.

Expected new ship artifact:

- `.planning/current/ship/deploy-readiness.json`

Expected behaviors:

- if a canonical deploy contract exists, mark deploy config as explicit
- if only legacy `CLAUDE.md` config exists, mark the result as
  `legacy_compatibility`
- if neither exists, record `deploy_configured=false`

This should not block `ship` for non-deploying projects when the contract
explicitly says the project does not deploy.

## Land-And-Deploy Integration

`/land-and-deploy` should:

1. read `.planning/current/ship/pull-request.json`
2. read `.planning/deploy/deploy-contract.json`
3. use the contract for:
   - production URL
   - staging target
   - deploy workflow
   - deploy status command
   - health checks
4. use legacy `CLAUDE.md` parsing only as a fallback migration path

Its first-run fingerprint should hash the canonical deploy contract plus
workflow files, not the `CLAUDE.md` deploy section.

## Migration Strategy

During migration:

- `/setup-deploy` should overwrite or replace the legacy `CLAUDE.md` deploy
  section with a short note pointing at `.planning/deploy/DEPLOY-CONTRACT.md`,
  or remove that section entirely if safe
- `/land-and-deploy` should continue to work when only legacy config exists
- `/ship` should report the difference between:
  - canonical deploy contract
  - legacy compatibility config
  - no config

## Acceptance Criteria

This integration is complete when:

- `/setup-deploy` writes `.planning/deploy/deploy-contract.json`
- `/setup-deploy` writes `.planning/deploy/DEPLOY-CONTRACT.md`
- `/ship` writes `.planning/current/ship/deploy-readiness.json`
- `/land-and-deploy` uses the canonical contract when present
- legacy `CLAUDE.md` deploy config is compatibility-only, not primary truth
- docs and skill outputs describe `.planning/deploy/*` as canonical deploy state
- tests cover canonical contract, ship readiness, and legacy fallback
