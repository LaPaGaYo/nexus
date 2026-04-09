# Nexus Internal Substrate Cutover Design

## Goal

Define the next milestone after root and compatibility cutover:
move the remaining primary runtime, helper, utility, and developer substrate
from legacy `gstack` naming into Nexus-owned implementation while keeping
explicit compatibility shims for existing installs and tooling.

The governed lifecycle is already Nexus-owned:

- canonical commands are Nexus-owned
- `lib/nexus/` owns lifecycle contracts and governance
- canonical `.planning/` artifacts are the only governed truth
- install roots and helper entrypoints are Nexus-primary

The remaining mismatch is lower in the product substrate:

- runtime support helpers still execute as `gstack-*`
- preamble and resolver code still write host support state into `~/.gstack/*`
- worktree and eval tooling still use `.gstack-worktrees` and `~/.gstack-dev`
- build scripts still compile `gstack-*` binaries as primary outputs
- generated docs and runtime instructions still expose `gstack` helper names in
  places where Nexus should now be the only primary identity

That means the lifecycle surface is Nexus, but too much of the underlying
runtime still presents itself as Gstack.

This milestone fixes that without changing governed lifecycle truth or deleting
compatibility support in one pass.

## Scope

### In Scope

- make Nexus-native support binaries the implementation owners for retained
  support capabilities
- demote legacy `gstack-*` support binaries to shim-only compatibility wrappers
- move primary host support writes from `~/.gstack/*` to `~/.nexus/*`
- introduce Nexus-primary developer substrate roots for evals, harvests, and
  worktree scratch state
- replace primary runtime references to `.gstack-worktrees` with
  `.nexus-worktrees`
- replace primary runtime references to `~/.gstack-dev` with `~/.nexus-dev`
- make generated preamble and resolver output use Nexus helper names and Nexus
  support paths first
- make build and setup flows produce Nexus-native support binaries as the
  primary outputs
- update docs, inventories, and tests so `gstack` only appears as compatibility
  or historical context where explicitly intended
- keep `lib/nexus/` and canonical `.planning/` artifacts unchanged as the only
  governed lifecycle truth

### Out Of Scope

- changing canonical Nexus lifecycle commands
- changing governed artifact ownership or stage-transition rules
- deleting every `gstack-*` compatibility binary or path in one pass
- renaming the repository host or remote URL
- rewriting all historical design/archive docs that mention Gstack
- moving host support state into lifecycle truth
- turning CCB into a contract or lifecycle owner

## Current Problem

Milestones 7 and 8 cut the visible product and host roots to Nexus-first, but
the retained support substrate is still split:

- README and generated docs still mention `gstack-*` helpers as active tools
- `scripts/resolvers/preamble.ts` writes sessions, analytics, telemetry markers,
  and learnings paths under `~/.gstack`
- runtime support commands like analytics, review log/read, learnings log/search,
  and global discover remain `gstack-*` binaries
- worktree and eval code still stores scratch data under `.gstack-worktrees` and
  `~/.gstack-dev`
- build scripts still compile `bin/gstack-global-discover.ts`
- multiple tests still prove Gstack-named support binaries as the active path

The result is a remaining contradiction:

- Nexus is now the visible product and lifecycle authority
- but the runtime support substrate still behaves like Gstack in too many
  primary paths

Until this changes, Nexus is still carrying a split internal identity.

## Approaches Considered

### 1. Leave internal Gstack naming in place forever

Keep the current substrate and treat `gstack` naming as an implementation detail.

Pros:

- smallest short-term blast radius
- avoids binary and state migration work

Cons:

- leaves Nexus permanently split between product identity and runtime identity
- keeps new docs and generated instructions leaking Gstack
- makes a complete Nexus product impossible

### 2. Nexus-primary internal cutover with compatibility shims

Make Nexus-native support binaries, support state paths, and developer substrate
the primary implementation everywhere new writes happen. Keep Gstack names only
as compatibility wrappers and migration fallbacks.

Pros:

- aligns runtime identity with product identity
- preserves existing automation and legacy scripts
- keeps the milestone bounded and reversible

Cons:

- requires coordinated changes across binaries, preamble, runtime support paths,
  docs, and tests
- temporarily supports both Nexus and Gstack names at the boundary

### 3. Hard delete Gstack support surface immediately

Rename everything and remove all Gstack compatibility paths in one pass.

Pros:

- conceptually clean end state

Cons:

- too destructive for current users and test infrastructure
- couples cutover with cleanup/removal
- high regression risk across helper scripts and legacy automation

## Recommendation

Use approach 2.

The correct next move is an internal substrate cutover:

- Nexus-owned support binaries become the implementation authorities
- Nexus-owned support and developer roots become the primary write targets
- Gstack names remain only as explicit compatibility shims
- governed lifecycle truth stays exactly where it already is

This milestone should make new runtime behavior feel fully Nexus while keeping
existing Gstack-era automation alive through compatibility rules.

## 1. Core Product Rule

After this milestone, a new user or a newly generated runtime should be able to:

- install and run Nexus
- use support helpers
- run generated skills
- use worktree and eval tooling

without ever needing to understand `gstack`.

`gstack` may remain:

- as a compatibility binary namespace
- as a compatibility state or dev-root fallback
- in historical documentation or archived test cases

But it must stop being the primary runtime support identity.

## 2. Support Helper Ownership Model

This milestone introduces a Nexus-primary support helper model.

### Primary Nexus support helpers

The implementation owner should move to Nexus-native names for retained support
capabilities, including at minimum:

- `nexus-analytics`
- `nexus-community-dashboard`
- `nexus-global-discover`
- `nexus-learnings-log`
- `nexus-learnings-search`
- `nexus-review-log`
- `nexus-review-read`
- `nexus-repo-mode`
- `nexus-slug`
- `nexus-telemetry-log`
- `nexus-telemetry-sync`

Additional support binaries may remain internal, but if they are invoked from
generated instructions or user-facing docs, their primary name must be `nexus-*`.

### Compatibility Gstack support helpers

The corresponding `gstack-*` commands remain supported only as compatibility
wrappers. They may exec or source Nexus-owned implementations, but they do not
own behavior, state paths, or documentation guidance.

### Helper rule

After this milestone:

- docs recommend only `nexus-*` helpers
- generated preamble and runtime instructions invoke `nexus-*` helpers first
- `gstack-*` helpers may remain executable, but only as shims

## 3. Host Support State Model

Milestone 8 introduced `~/.nexus` as the primary host support state root.
This milestone extends that rule to the retained support substrate.

Primary support writes must target `~/.nexus`, including at minimum:

- sessions
- analytics
- routing prompt markers
- telemetry prompt markers
- completeness prompt markers
- learnings journals and support metadata
- review support logs

Compatibility reads and migration fallbacks may still consult `~/.gstack`.

### State rule

Primary runtime code must not write new support state to `~/.gstack` except when
an explicit compatibility override or migration-safe fallback requires it.

## 4. Developer Substrate Model

The developer/test substrate also needs a Nexus-primary identity.

### Primary Nexus developer roots

- repo-local worktree scratch root: `.nexus-worktrees`
- user-level eval/harvest scratch root: `~/.nexus-dev`

### Compatibility legacy roots

- `.gstack-worktrees`
- `~/.gstack-dev`

### Developer substrate rule

New worktree, eval, and harvest writes should target Nexus roots first.
Legacy roots may remain readable or removable during compatibility cleanup, but
they must stop being the primary write path.

## 5. Generated Runtime And Doc Surface Rule

Generated runtime content must match the new ownership model.

That means:

- preamble output uses Nexus support helpers and Nexus support paths first
- generated `SKILL.md` content no longer presents Gstack support helpers as the
  primary commands
- README and install guidance stop instructing users to use Gstack support
  helpers for active runtime behavior
- build outputs compile Nexus-native support binaries as the primary artifacts

Historical references can remain where they are clearly historical or explicitly
compatibility-only.

## 6. Compatibility Boundary

This milestone keeps a strict compatibility boundary.

Allowed compatibility uses:

- `gstack-*` shim binaries that delegate to Nexus-owned helpers
- reads from legacy support roots during migration or fallback
- uninstall and cleanup flows that remove legacy roots
- tests that prove compatibility shims still behave correctly

Disallowed uses:

- primary runtime writes to legacy roots by default
- generated instructions that prefer `gstack-*` helpers over `nexus-*`
- docs that present Gstack helpers as active first-class support tools
- any legacy helper owning separate state semantics or lifecycle truth

## 7. Success Criteria

This milestone is complete when:

- new runtime support behavior uses Nexus-native helper names by default
- new support-state writes land in `~/.nexus`
- new developer substrate writes land in `.nexus-worktrees` and `~/.nexus-dev`
- `gstack-*` support commands are compatibility shims only
- build scripts generate Nexus-native support artifacts as the primary outputs
- generated docs and runtime instructions are Nexus-primary
- inventories explicitly classify remaining Gstack surfaces as compatibility-only
- regression tests prove:
  - Nexus support helpers are the implementation owners
  - compatibility shims still work
  - primary writes avoid legacy roots
  - governed lifecycle truth remains unchanged
