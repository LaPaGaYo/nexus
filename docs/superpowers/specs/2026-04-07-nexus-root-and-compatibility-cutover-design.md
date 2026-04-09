# Nexus Root And Compatibility Cutover Design

## Goal

Define the next milestone after product-surface unification:
cut the remaining host roots, helper ownership, and compatibility state over to
Nexus-primary defaults while preserving migration safety for existing Gstack-era
installs.

The governed lifecycle, contracts, stage packs, and product surface are already
Nexus-owned. The remaining mismatch is lower in the host substrate:

- default install roots still use `gstack`
- host-generated sidecar/runtime roots still use `gstack`
- compatibility helpers still own real shell behavior
- host support state still defaults to `~/.gstack`

That means the visible product is now mostly Nexus, but the install roots and
host substrate are not yet fully cut over.

This milestone fixes that without changing governed lifecycle truth or forcing a
destructive legacy cleanup pass.

## Scope

### In Scope

- make `nexus` the default install root for Claude, Codex, Kiro, and Factory
- make generated sidecar/runtime roots default to `nexus`
- introduce a Nexus-primary host-state root at `~/.nexus`
- keep `~/.gstack` as a compatibility state root during migration
- make `nexus-config`, `nexus-relink`, `nexus-uninstall`, and
  `nexus-update-check` the real helper entrypoints
- demote `gstack-*` helpers to shim-only compatibility wrappers
- define explicit root-resolution and migration precedence rules
- keep `lib/nexus/` and canonical `.planning/` artifacts as the only governed
  lifecycle truth
- update setup, relink, uninstall, generated host assets, and tests so the new
  primary roots are locked in
- update inventories and closeout docs to reflect the new compatibility phase

### Out Of Scope

- deleting all `gstack-*` helpers or compatibility roots in one pass
- changing canonical Nexus lifecycle commands
- changing governed artifact ownership or stage-transition rules
- moving lifecycle truth into host state or setup scripts
- broad cleanup/removal of all Gstack-era host structures
- absorbing CCB into Nexus business ownership

## Current Problem

Milestone 7 made the product surface Nexus-first, but the host substrate still
has a split identity:

- setup still installs into `gstack` roots
- Codex and Factory runtime roots are still created as `gstack`
- Kiro rewrite rules still rewrite paths toward `gstack`
- helper wrappers named `nexus-*` still immediately hand ownership to
  `gstack-*`
- host support state is still anchored in `~/.gstack`

That leaves one remaining contradiction:

- the product introduces itself as Nexus
- but the host shell still installs and persists itself as Gstack

Until those defaults change, Nexus is not a fully cut-over product.

## Approaches Considered

### 1. Keep Gstack roots forever and treat them as implementation detail

Make no root or state migration. Leave the current substrate in place and rely
on documentation to explain that `gstack` is now only a compatibility detail.

Pros:

- smallest implementation blast radius
- avoids migration code

Cons:

- leaves the product visibly split at install time
- keeps host paths permanently branded as Gstack
- never delivers a fully cut-over Nexus

### 2. Nexus-primary dual-root cutover with compatibility migration

Make `nexus` the primary root and helper identity everywhere new installs and
host generation happen. Keep Gstack roots and helpers as compatibility fallbacks
and migration sources.

Pros:

- makes new installs unambiguously Nexus
- preserves existing user environments
- keeps the milestone bounded and reversible

Cons:

- requires coordinated root-resolution, migration, helper, and test changes
- temporarily supports both Nexus and Gstack host roots

### 3. Hard delete Gstack roots immediately

Rename everything to Nexus in one pass and remove Gstack compatibility support.

Pros:

- conceptually clean end state

Cons:

- too destructive for current installs
- couples cutover with cleanup/removal
- high regression risk across setup, uninstall, and generated assets

## Recommendation

Use approach 2.

The correct next move is a Nexus-primary dual-root cutover:

- `nexus` becomes the default host identity
- `gstack` remains available only as a compatibility substrate
- host state gets a new primary root at `~/.nexus`
- governed lifecycle truth remains exactly where it already is

This milestone should make fresh installs feel fully Nexus while keeping
existing installs alive through explicit compatibility rules.

## 1. Core Product Rule

After this milestone, a new user should be able to:

- clone or install the repo
- run `./setup`
- see generated host assets
- use helper commands

without ever needing to understand `gstack`.

`gstack` may remain:

- as a compatibility install root
- as a migration source root
- as a shim/helper compatibility namespace

But it must stop being the primary root or helper identity.

## 2. Root Ownership Model

This milestone introduces a formal dual-root model.

### Primary Nexus roots

These become the default roots for new installs and generated runtime assets:

- Claude global: `~/.claude/skills/nexus`
- Claude repo-local: `.claude/skills/nexus`
- Codex sidecar: `.agents/skills/nexus`
- Codex global runtime: `~/.codex/skills/nexus`
- Kiro global runtime: `~/.kiro/skills/nexus`
- Factory global runtime: `~/.factory/skills/nexus`

### Compatibility Gstack roots

These remain supported as migration-era fallbacks:

- `~/.claude/skills/gstack`
- `.claude/skills/gstack`
- `.agents/skills/gstack`
- `~/.codex/skills/gstack`
- `~/.kiro/skills/gstack`
- `~/.factory/skills/gstack`

### Root rule

Host install/generation code may read compatibility roots, migrate from them,
or create shim links for them. But all new writes and all new recommended paths
must target Nexus roots first.

## 3. Host State Root Model

This milestone introduces a Nexus-primary host state root:

- primary host support state root: `~/.nexus`
- compatibility host support state root: `~/.gstack`

This state remains host/support data only. It does not gain lifecycle truth.

### State contents covered by the cutover

The design assumes host support state includes at least:

- config
- installation metadata
- analytics
- sessions or background host state
- project convenience state
- local learnings or helper journals

### State precedence

The helper/runtime layer should resolve state in this order:

1. explicit Nexus override via `NEXUS_STATE_DIR`, if provided
2. explicit Gstack compatibility override via `GSTACK_STATE_DIR`, if provided
3. `~/.nexus` if initialized
4. one-time migration from `~/.gstack`
5. initialize a fresh `~/.nexus`

### Migration rule

Migration must be conservative:

- if `~/.nexus` does not exist and `~/.gstack` does, migrate or copy the host
  support state into `~/.nexus`
- if migration is partial or incomplete, do not silently treat the new root as
  complete
- emit a clear migration marker and preserve compatibility fallback
- if migration cannot complete cleanly, helpers should keep operating in a
  compatibility-safe way instead of corrupting host state

This migration still must not affect governed lifecycle truth. It only covers
host/support state.

## 4. Helper Ownership Cutover

Milestone 7 added Nexus-branded helpers, but they are still thin wrappers around
`gstack-*`. This milestone changes ownership:

- `nexus-config` becomes the real config entrypoint
- `nexus-relink` becomes the real relink entrypoint
- `nexus-uninstall` becomes the real uninstall entrypoint
- `nexus-update-check` becomes the real update-check entrypoint

The legacy helpers remain:

- `gstack-config`
- `gstack-relink`
- `gstack-uninstall`
- `gstack-update-check`

But only as shims that delegate into the Nexus-owned helper implementations.

### Helper rule

After this milestone:

- product docs recommend only the `nexus-*` helpers
- helper implementation authority belongs to `nexus-*`
- `gstack-*` scripts may remain executable, but they do not own behavior

## 5. Generated Host Asset Cutover

Generated host assets and runtime bundles should change from `gstack` roots to
`nexus` roots.

This includes:

- Codex sidecar root generation
- Codex runtime root creation
- Factory runtime root creation
- Kiro runtime root creation and path rewrites
- host-prelude path variables and helper references

### Namespacing rule

The lifecycle command surface remains canonical and flat:

- `/discover` through `/closeout`

When a namespace is required for host compatibility, the visible namespace is:

- `nexus-*`

The `gstack-*` namespace remains compatibility-only.

## 6. Root Resolution And Compatibility Rules

This milestone should add one explicit root-resolution contract used by setup,
helpers, and host generation code.

That contract should define:

- primary install root names per host
- compatibility install root names per host
- primary state root name
- compatibility state root name
- helper precedence
- migration detection rules

### Compatibility constraints

- Gstack roots may continue to exist after cutover
- new installs should not require them
- uninstall must avoid deleting unrelated Nexus roots or user data
- relink must preserve compatibility shims where required
- root cutover must not change `lib/nexus/` contract ownership

## 7. Governed Truth Boundary

This milestone must not blur the authority boundary already established in
earlier work.

Even after host root cutover:

- governed lifecycle truth still lives in `lib/nexus/`
- stage truth still lives in canonical repo-visible artifacts
- host roots and helper state remain convenience/support only
- `~/.nexus` is not a lifecycle ledger
- `~/.gstack` is not a lifecycle ledger

If host support state conflicts with canonical repo state, canonical Nexus state
still wins.

## 8. Testing Requirements

Milestone 8 should be considered complete only if tests lock all of the
following:

- product-surface constants now freeze Nexus primary roots and compatibility
  roots
- setup defaults to Nexus-primary install/runtime roots
- relink creates Nexus-primary links and retains Gstack compatibility shims only
  where intended
- helper binaries prove Nexus owns behavior and Gstack is shim-only
- state-root resolution prefers `~/.nexus`
- migration from `~/.gstack` is conservative and explicit
- uninstall removes Nexus-primary assets correctly while leaving compatibility
  paths predictable
- generated Codex/Factory/Kiro host assets point at Nexus roots rather than
  Gstack roots
- `lib/nexus/` and canonical `.planning/` truth remain untouched

## 9. Success Criteria

Milestone 8 is complete when:

- new installs default to Nexus roots, not Gstack roots
- new helper usage defaults to `nexus-*`
- new host state defaults to `~/.nexus`
- existing Gstack installs continue to work through explicit compatibility
  behavior
- generated host assets use Nexus roots and Nexus helper names
- no governed lifecycle truth moves into host state
- Gstack remains only as compatibility substrate, not as the default runtime
  identity
