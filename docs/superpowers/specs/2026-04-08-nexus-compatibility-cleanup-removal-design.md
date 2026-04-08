# Nexus Compatibility Cleanup And Removal Design

## Goal

Define the next milestone after internal substrate cutover:
remove the remaining `gstack`-owned internal product and runtime identities
from the active Nexus path, while preserving only a narrow, explicit
compatibility budget for legacy entrypoints that still matter during migration.

The governed lifecycle is already complete and Nexus-owned:

- canonical lifecycle commands are Nexus-owned
- `lib/nexus/` is the only contract owner
- canonical `.planning/` artifacts are the only governed lifecycle truth
- host roots, support helpers, support state, and developer substrate are now
  Nexus-primary

The remaining problem is that too much internal runtime and compatibility logic
still behaves as though `gstack` were a live product boundary:

- utility binaries still exist only as `gstack-*`
- setup and relink still special-case `gstack-*` runtime identities
- generated helper guidance still references `gstack-relink`
- review and testing resolvers still invoke `gstack-*` internal utilities
- the upgrade skill still exists as `gstack-upgrade`
- several tests and eval suites still prove Gstack-native identities as though
  they were first-class, not legacy compatibility

That means Nexus is already the visible product, but some internal substrate
still leaks a second product identity.

This milestone closes that gap.

## Scope

### In Scope

- define a narrow compatibility budget for which `gstack` surfaces may remain
  temporarily
- promote Nexus-native names for all active internal utility and helper paths
- internalize the upgrade surface so the canonical product skill is
  `nexus-upgrade`
- replace active runtime calls to `gstack-*` internal utilities with Nexus
  equivalents
- update setup, relink, generation, and runtime docs to treat `gstack` as
  compatibility-only everywhere
- shrink compatibility tests so only explicit legacy-shim behavior remains
- update inventories and closeout docs to distinguish removed, retained, and
  deferred compatibility surfaces

### Out Of Scope

- changing canonical governed lifecycle commands
- changing `lib/nexus/` lifecycle contracts or `.planning/` truth ownership
- removing every external compatibility alias in one pass
- removing historical archive documents and old milestone records
- renaming the repository remote away from the historical GitHub `gstack` URL
- changing CCB ownership or routing rules

## Current Problem

Milestones 7 through 9 made Nexus the primary product and runtime identity, but
the repository still contains three kinds of `gstack` residue:

### 1. Internal utilities still use Gstack names

Examples:

- `bin/gstack-patch-names`
- `bin/gstack-diff-scope`
- `bin/gstack-platform-detect`
- `bin/gstack-open-url`
- `bin/gstack-extension`

These are not user-facing product identities anymore, but they still leak into
setup, relink, resolvers, and tests as if they were primary runtime tools.

### 2. Product-adjacent surfaces still preserve a Gstack name

The clearest example is `gstack-upgrade/`, which still carries a first-class
skill identity even though the visible product surface, docs, and setup flows
have already moved to `/nexus-upgrade`.

This split is especially bad because it keeps one top-level skill directory
standing outside the Nexus naming model.

### 3. Tests still validate Gstack-native behavior as active behavior

Several tests and E2E fixtures still assume:

- `gstack-relink` is the primary relink path
- `gstack-review-read` is the active runtime reader
- `gstack-upgrade` is the canonical upgrade skill
- `gstack-diff-scope` is the active review-army/runtime utility

That makes compatibility residue feel “required”, even where it should now be
legacy-only.

## Approaches Considered

### 1. Keep compatibility shims indefinitely

Leave current `gstack` internals in place and treat them as harmless
implementation detail.

Pros:

- lowest short-term change volume
- no rename churn in tests or helper scripts

Cons:

- Nexus never becomes a single internally coherent product
- internal docs, setup, and tests keep leaking Gstack identity
- future cleanup gets harder because compatibility keeps spreading inward

### 2. Remove all `gstack` surfaces immediately

Delete all compatibility binaries, aliases, and tests in one pass.

Pros:

- cleanest end state

Cons:

- too risky for existing users, installs, and legacy automation
- would couple internal cleanup with external breakage
- does not respect the staged migration model already used for roots and helpers

### 3. Narrow compatibility budget plus Nexus-only internal runtime

Move all active internal runtime/product identity to Nexus. Keep only a small,
intentional set of `gstack` compatibility entrypoints at the boundary.

Pros:

- gives Nexus a single internal identity
- preserves migration safety for users who still invoke a few legacy entrypoints
- lets tests prove compatibility as compatibility, not as active ownership

Cons:

- requires coordinated renames across utilities, setup, resolvers, skill docs,
  E2E fixtures, and tests
- still leaves a final cleanup/removal milestone for the outermost shims

## Recommendation

Use approach 3.

The next milestone should enforce a strict boundary:

- Nexus owns every active runtime, utility, and product-facing identity
- only a narrow external compatibility budget may continue to use `gstack`
- tests should stop proving Gstack-native paths as the primary happy path

This removes the remaining split identity without breaking migration abruptly.

## 1. Compatibility Budget

This milestone should introduce an explicit compatibility budget.

### Surfaces that may remain temporarily

Only boundary-level compatibility shims may remain after this milestone:

- `bin/gstack-config`
- `bin/gstack-relink`
- `bin/gstack-uninstall`
- `bin/gstack-update-check`
- selected install-root cleanup and detection paths for legacy Claude/Codex/
  Factory installations

These surfaces remain only because they bridge old installs to Nexus.

### Surfaces that should stop using `gstack`

The following should no longer remain Gstack-primary after this milestone:

- internal utility binaries
- canonical upgrade skill identity
- generated runtime notes and setup hints
- resolver/runtime references used by active Nexus skills
- primary test and E2E happy paths

## 2. Upgrade Surface Canonicalization

`gstack-upgrade` is the last obvious top-level product-surface mismatch.

After this milestone:

- the canonical skill directory and generated identity should be
  `nexus-upgrade`
- user-facing docs and generated wrappers should only present `/nexus-upgrade`
  as the primary upgrade command
- if a `gstack-upgrade` alias remains, it should exist only as an explicit
  compatibility alias with no independent contract or special handling

This is important because a single leftover top-level Gstack skill undermines
the “one complete Nexus” product requirement.

## 3. Internal Utility Ownership

Internal utility commands should also become Nexus-owned.

At minimum, this milestone should define Nexus-primary equivalents for:

- `gstack-patch-names`
- `gstack-diff-scope`
- `gstack-platform-detect`
- `gstack-open-url`
- `gstack-extension`

The active setup, relink, resolver, and runtime code should call the Nexus
names first.

If compatibility wrappers are kept, they must be thin delegators only.

## 4. Runtime And Resolver Rule

Any runtime or generated instruction that remains in the active Nexus path must
stop invoking internal `gstack-*` utilities as the default path.

This includes at minimum:

- setup
- relink
- skill generation warnings
- review-army specialist dispatch
- design diff-scope guidance
- testing plan artifact generation
- update-check telemetry wiring

The rule is simple:

- active path -> Nexus utility names
- compatibility fallback -> legacy names only where explicitly required

## 5. Test Surface Rule

Tests should stop treating Gstack-native identities as the canonical success
path.

That means:

- compatibility tests should explicitly say they are testing a legacy shim
- canonical runtime tests should target Nexus names
- E2E workflow suites should migrate from `gstack-upgrade` and
  `gstack-review-*` naming where those names are no longer product-primary
- test fixtures and touchfile maps should follow Nexus identities first

The goal is not to erase history; it is to stop reintroducing Gstack as the
active system through the test suite.

## 6. Inventory Rule

`upstream-notes/legacy-host-migration-history.md` should move from
“compatibility-only substrate remains” to a more explicit three-way model:

- removed from active path
- retained as compatibility shim
- deferred for final removal

That gives the next cleanup milestone a concrete exit list instead of another
broad “legacy remains” statement.

## 7. Success Criteria

This milestone is complete when:

- active setup, relink, generation, resolver, and runtime paths no longer
  depend on `gstack-*` internal utility names
- the canonical upgrade skill is Nexus-owned
- docs and generated guidance no longer present Gstack-native utilities as
  active paths
- compatibility tests are narrowed to boundary shims instead of primary runtime
  behavior
- inventories explicitly classify what compatibility remains and why
- full regression still passes with Nexus as the only primary product identity

## 8. Deferred After This Milestone

Still deferred:

- final deletion of the remaining external compatibility shims
- repository/remote rename away from `gstack`
- broad rewrite of historical archived docs and old eval fixtures that mention
  Gstack only as historical context

Those become much safer once the internal runtime and test surfaces are fully
Nexus-owned.
