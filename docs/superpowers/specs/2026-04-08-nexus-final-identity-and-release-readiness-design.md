# Nexus Final Identity And Release Readiness Design

Date: 2026-04-08
Milestone: Nexus final identity and release readiness
Branch: `codex/nexus-final-identity-release-readiness`

## Goal

Move Nexus from "internally Nexus-first, historically Gstack-aware" to a final
product state where live contracts, runtime helpers, and release-facing
verification are Nexus-only.

## Scope

- remove legacy Gstack roots and helper names from live support/host/product
  contracts under `lib/nexus/`
- remove live runtime fallback reads of:
  - `~/.gstack`
  - `.gstack-worktrees`
  - `~/.gstack-dev`
- keep any remaining Gstack lineage only in archived closeouts, archived specs,
  and explicit historical inventories
- add release-readiness verification artifacts that prove Nexus can be used as
  the only visible product surface

## Non-Goals

- changing canonical Nexus lifecycle commands
- changing governed artifact ownership under `.planning/`
- changing absorbed stage-pack ownership
- changing CCB's transport-only role
- rewriting archived historical design documents for cosmetic reasons alone

## Architecture

### 1. Nexus-only live contracts

The active support/host/product surface modules become Nexus-only contracts:

- `lib/nexus/support-surface.ts`
- `lib/nexus/host-roots.ts`
- `lib/nexus/product-surface.ts`

These modules should define only the active Nexus identities used by runtime and
verification. Historical Gstack identities must move out of these modules.

### 2. Archive-only historical record

Historical Gstack identities remain documented only in:

- `docs/superpowers/closeouts/`
- `upstream-notes/legacy-host-migration-history.md`
- `lib/nexus/compatibility-surface.ts`

This keeps migration lineage in-repo without leaving legacy names in the active
runtime contract layer.

### 3. Nexus-only runtime reads

Runtime helpers and support scripts should stop probing legacy developer/state
roots as fallbacks. Active code should read/write only Nexus roots:

- `~/.nexus`
- `.nexus-worktrees`
- `~/.nexus-dev`

### 4. Release-readiness proof

Milestone completion should include one repo-visible closeout that proves:

- Nexus-only contract/runtime identity
- Nexus-only install/helper surface
- clean regression verification
- readiness for the target operating mode:
  `tmux -> ccb -> Claude -> Nexus`

## Success Criteria

- active `lib/nexus/` product/support/host contracts no longer export legacy
  Gstack roots or helper names
- active runtime code no longer reads legacy Gstack state or developer roots
- tests are updated to validate Nexus-only live contracts
- historical Gstack references remain only in archive/historical records
- a release-readiness closeout exists with fresh verification evidence
