# Nexus Final Legacy Removal Design

## Goal

Define the final legacy-removal milestone that turns the repository from
Nexus-primary with retained `gstack` compatibility residue into a fully
Nexus-owned product and runtime surface.

After this milestone:

- Nexus is the only active product identity
- Nexus is the only host/runtime identity
- Nexus is the only helper and setup identity
- Nexus-owned repo-visible artifacts remain the only governed truth
- CCB remains transport and dispatch only

`gstack` may remain only in historical records and legacy migration notes. It
must no longer participate in active runtime lookup, helper dispatch, state
roots, generated instructions, or product documentation.

## Scope

### In Scope

- remove retained `gstack-*` compatibility shims from active helper ownership
- cut browse, browser-sidecar, and related support tooling from `.gstack` roots
  and `gstack` lookup paths to Nexus-owned paths
- cut uninstall, relink, config, and telemetry support scripts to Nexus-only
  names and state roots
- update `CLAUDE.md`, `README.md`, generated skill docs, and active templates so
  Nexus is the only live product identity
- update tests so Nexus is the only active-path identity and `gstack` survives
  only in historical docs/fixtures where explicitly expected
- update compatibility inventories and absorption notes to mark final removal

### Out Of Scope

- renaming the Git remote or repository slug away from historical `gstack`
- rewriting historical closeouts, plans, or design docs
- changing canonical Nexus lifecycle commands
- changing `lib/nexus/` lifecycle contracts or canonical `.planning/` truth
- making CCB a contract owner

## Current Problem

Milestones 1 through 10 already made Nexus the canonical command surface,
contract owner, governed state owner, host root, helper root, and developer
substrate. The remaining gap is that the active repository still leaks a second
product/runtime identity:

- `CLAUDE.md` still presents the repository as `gstack`
- browse runtime still uses `.gstack`, `gstack browse`, and `skills/gstack`
  lookup paths
- dev setup/teardown still assumes `~/.claude/skills/gstack`
- several active skill docs/templates still mention `gstack_contributor` or
  `gstack browse`
- retained `gstack-*` boundary shims still exist as real binaries
- tests still prove some `gstack` paths as living compatibility surface rather
  than historical residue

That means the repository is Nexus at the lifecycle layer but not yet Nexus all
the way down.

## Approaches Considered

### 1. Keep the remaining shims and runtime residue

Pros:

- lowest change volume

Cons:

- Nexus never becomes a complete standalone product
- future contributors still have to reason about dual runtime identities
- `gstack` remains present in actual execution paths

### 2. Delete every `gstack` mention immediately

Pros:

- fastest route to a clean tree

Cons:

- too blunt; would break historical docs, compatibility fixtures, and migration
  narratives that still have value
- risks overreaching into archived material instead of focusing on active paths

### 3. Remove `gstack` from every active path, preserve it only as history

Pros:

- gives Nexus a single live identity across runtime, helpers, docs, and tests
- keeps historical records intact without letting them influence active behavior
- matches the product requirement: users should feel they are using only Nexus

Cons:

- requires coordinated changes across helpers, browse tooling, templates,
  docs, and tests

## Recommendation

Use approach 3.

This milestone should define a simple rule:

- if a file or binary participates in current installation, current runtime,
  current setup, current generated skill output, or current verification, it
  must be Nexus-only
- if `gstack` remains, it must do so only as historical documentation or
  explicit archival context

## 1. Product Identity Rule

Nexus is the only live product identity.

That means:

- `README.md` presents Nexus only
- `CLAUDE.md` presents Nexus development only
- generated skills and templates use Nexus-owned contributor, tooling, and
  runtime language
- active install/setup commands point at Nexus repo paths and Nexus helper names

No active doc or generated wrapper should instruct a user or agent to rely on a
`gstack` product surface.

## 2. Runtime Identity Rule

Nexus is the only live runtime identity.

That means:

- browse state lives under `.nexus/`, not `.gstack/`
- support state lives under `~/.nexus`, not `~/.gstack`
- dev substrate lives under `.nexus-worktrees` and `~/.nexus-dev`, not legacy
  `gstack` roots
- runtime lookup paths for local/global installs prefer `skills/nexus` only

Compatibility fallback to `gstack` lookup is no longer part of the active
runtime. If a migration helper needs to detect old roots, it should do so only
as a one-time cleanup/import path, not as normal execution behavior.

## 3. Helper Identity Rule

Nexus is the only live helper identity.

That means:

- `nexus-config`, `nexus-relink`, `nexus-uninstall`, `nexus-update-check`, and
  other `nexus-*` helpers own the implementation
- retained `gstack-*` shims are removed
- active scripts, templates, and generated docs no longer reference
  `gstack-*` helpers

If a capability still exists, it should exist under a Nexus-owned helper name.

## 4. Active Template Rule

Active skill templates and generated `SKILL.md` content should use Nexus-owned
language only.

That includes:

- helper examples
- contributor/config references
- browse/control language
- artifact paths
- install guidance

Historical or archived docs may retain `gstack` wording, but active templates
must not emit it into the current product surface.

## 5. Test Rule

Tests should prove Nexus as the only active path.

That means:

- canonical tests target Nexus names, Nexus roots, and Nexus runtime output
- browse tests use `.nexus` and `skills/nexus`
- helper tests invoke `nexus-*` binaries
- inventory tests prove `gstack` has left the active path entirely

Historical text fixtures may still contain `gstack` where they intentionally
exercise archived content, but that must not define current behavior.

## 6. Inventory Rule

The host migration inventory and absorption status should mark final state
explicitly:

- active host/runtime/product paths are Nexus-only
- `gstack` compatibility shims are removed
- deferred cleanup roots are complete
- remaining `gstack` references are historical only

This is the milestone that closes the migration inventory as an active runtime
program.

## Success Criteria

Milestone 11 is complete when:

- no active helper binary is `gstack-*`
- no active runtime path writes to or reads from `.gstack`, `~/.gstack`, or
  `skills/gstack`
- `CLAUDE.md`, `README.md`, active templates, and generated skills present
  Nexus-only product identity
- tests prove Nexus-only active paths
- historical `gstack` references remain only in archived docs or deliberate
  historical notes
