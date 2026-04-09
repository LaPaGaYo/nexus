# Nexus Product Surface Unification Design

## Goal

Define the next product-level milestone after governed lifecycle completion:
make Nexus the primary product surface across package identity, install flow,
generated host assets, wrapper prose, and user-facing documentation.

The runtime and governed lifecycle are now Nexus-owned. The remaining mismatch is that
much of the host shell, install surface, and generated wrapper copy still presents
itself as `gstack`. That mismatch prevents the system from feeling like one finished
product.

This milestone is about fixing that product-surface split without breaking the current
governed runtime or forcing a risky state-root migration in the same pass.

## Scope

### In Scope

- make Nexus the primary product name in package metadata and user-facing docs
- make setup, uninstall, relink, and generated wrapper prose present Nexus as the
  product instead of Gstack
- make generated external-host skill naming and namespace strategy Nexus-primary
- reduce Gstack wording and product claims in `README.md`, `docs/skills.md`, and
  setup-time guidance
- keep `lib/nexus/` and canonical `.planning/` artifacts as the only lifecycle truth
- preserve compatibility for existing Gstack runtime paths and migration-era binaries
  where needed
- update host-surface tests, relink tests, uninstall tests, and generator tests so they
  lock the new Nexus-primary surface
- update migration inventories to reflect the new host-surface state

### Out Of Scope

- migrating `~/.gstack` state to `~/.nexus`
- deleting all Gstack compatibility binaries or directories in one pass
- changing the canonical Nexus lifecycle command set
- changing governed artifact ownership or `.planning/` truth rules
- absorbing CCB into Nexus business ownership
- redesigning utility/support skills beyond the branding, routing, and compatibility
  needed to keep the product surface coherent

## Current Problem

The current repository now has a split identity:

- governed lifecycle behavior is Nexus-owned
- runtime contracts and artifacts are Nexus-owned
- canonical lifecycle wrappers are Nexus-owned
- but package metadata, setup flow, generated host assets, README marketing copy,
  install commands, and large parts of the preamble still present `gstack` as the
  product

This creates a product contradiction:

- the system behaves like Nexus
- but it introduces itself, installs itself, and documents itself like Gstack

That contradiction is now the biggest remaining blocker to a finished Nexus surface.

## Approaches Considered

### 1. Docs-only rebrand

Update README and documentation to say Nexus, but leave package metadata, setup,
generated host assets, and preamble semantics mostly unchanged.

Pros:

- smallest blast radius
- quick visible improvement

Cons:

- leaves setup and generated assets speaking a different product language
- keeps install/runtime entrypoints visibly Gstack-branded
- does not actually unify the product surface

### 2. Nexus-primary surface with compatibility substrate

Make Nexus the primary product identity everywhere a user or host sees the system, while
keeping Gstack-compatible runtime paths and binaries as migration-era compatibility
substrate.

Pros:

- fixes the real user-facing mismatch
- preserves current installs and state while shifting the visible product identity
- keeps the milestone bounded away from risky state-root migration

Cons:

- requires coordinated edits across setup, generator, docs, tests, and compatibility
  helpers
- temporarily supports both Nexus-primary and Gstack-compat names behind the scenes

### 3. Full hard cut to Nexus everywhere

Rename package, install roots, config roots, binary names, state directories, and host
artifacts all at once.

Pros:

- cleanest conceptual end state

Cons:

- highest migration risk
- combines product-surface unification with state-root migration
- too broad for a stable next milestone

## Recommendation

Use approach 2.

The next correct move is to make Nexus the primary product surface without coupling that
change to a full `~/.gstack` state migration. Users should start seeing Nexus
everywhere now. Compatibility internals can remain underneath until a later, smaller,
explicit migration milestone.

## 1. Core Product Rule

After this milestone, a new user should be able to encounter the repository, install
instructions, generated host assets, and canonical wrappers and come away with one clear
impression:

- the product is Nexus

They should not need to understand Gstack in order to use the lifecycle.

Gstack may remain:

- a compatibility substrate
- a migration-era internal implementation detail
- a source of host-shell structure still being reduced

But it must stop being the dominant product surface.

## 2. Product Surface Boundary

This milestone treats the following as product-surface artifacts:

- `package.json` name and description
- `README.md`
- `docs/skills.md`
- setup output and install guidance
- generated `SKILL.md` frontmatter descriptions
- generated wrapper titles and body prose
- preamble prompts shown to users
- CLAUDE.md routing injection guidance
- external-host install roots and skill namespace guidance
- uninstall and relink messages

These surfaces must all describe the same product.

The following remain internal compatibility surfaces for now:

- `~/.gstack`
- `gstack-config`
- `gstack-repo-mode`
- `gstack-update-check`
- `gstack-relink`
- `gstack-uninstall`
- any other migration-era helper binary still needed for compatibility

Those internals may continue to exist, but they stop defining the user-facing product
name.

## 3. Compatibility Strategy

This milestone should adopt an explicit compatibility policy:

### Nexus-primary rule

All newly generated or newly documented product-facing surfaces should use:

- `Nexus` as the product name
- Nexus-first install language
- Nexus-first operator guidance
- Nexus-first skill namespace guidance

### Gstack-compat rule

Existing Gstack runtime paths and helper commands may remain functional, but they are:

- compatibility-only
- secondary in documentation
- never the recommended primary product language

### No truth migration in this milestone

Compatibility does not mean authority.

The milestone must not move lifecycle truth away from:

- `lib/nexus/`
- canonical `.planning/` artifacts
- canonical `status.json` files

It also must not treat `~/.gstack` as lifecycle truth. That state remains convenience
or host support only.

## 4. Package And Install Identity

The repository package identity should become Nexus-primary.

This includes:

- `package.json` name
- `package.json` description
- install snippets in `README.md`
- setup output shown to users
- install-root guidance for Claude, Codex, and Factory-compatible hosts

The implementation should make a clear distinction between:

- primary product identity: `nexus`
- compatibility runtime substrate: existing Gstack-compatible layout where still needed

This milestone should not require a full state-root rename, but it should make new
install guidance and setup messaging Nexus-first.

## 5. Generated Host Skill Identity

Generated host assets should stop presenting `gstack-*` as the primary namespaced skill
strategy.

The new rule should be:

- flat canonical lifecycle commands remain `/discover` through `/closeout`
- if a namespace is needed for host compatibility, the namespace becomes `nexus-`
- legacy `gstack-*` names remain compatibility aliases where necessary during migration

This means setup, relink, patch-name behavior, and generated external-host metadata must
be updated together.

The goal is not to create another parallel command surface. The goal is to ensure that
when a namespace is visible at all, it still reinforces the Nexus product identity.

## 6. Preamble And CLAUDE Guidance

The preamble currently does useful host work, but it still speaks heavily in Gstack
product language.

This milestone should preserve the host behavior while reducing product-surface
ownership in the copy:

- proactive prompts should reference Nexus, not Gstack, as the product
- telemetry prompts should talk about improving Nexus
- install and update prompts should talk about Nexus
- CLAUDE.md routing injection should remain discovery-only and Nexus-owned
- the preamble must not reintroduce Gstack as the lifecycle owner

The preamble can still call compatibility binaries if needed, but its user-facing prose
must match the Nexus product surface.

## 7. README And Docs Reframe

`README.md` and `docs/skills.md` should now be treated as primary product documents, not
migration notes with a Nexus banner at the top.

They should:

- present Nexus as the product from the first screen
- treat Gstack as host heritage or compatibility detail, not the main narrative
- describe canonical lifecycle commands first
- keep absorbed systems framed as internal capability sources
- keep CCB framed as transport and dispatch infrastructure only
- move remaining Gstack-specific guidance into explicit compatibility or migration
  sections rather than the main product story

The docs should no longer require a new user to mentally translate from “gstack” to
“Nexus.”

## 8. Utility And Compatibility Surface Rule

This milestone does not need to redesign every non-lifecycle utility skill. But it does
need a strict presentation rule:

- utility or compatibility commands that still carry Gstack names must be clearly marked
  as compatibility tools
- they must not dominate the main product narrative
- they must not be presented as the primary way to understand the system

If the product surface needs an upgrade, relink, or uninstall entrypoint, the milestone
may add Nexus-branded entrypoints that delegate to current compatibility implementations.

## 9. Verification Requirements

This milestone should add or update tests that prove:

- package metadata is Nexus-primary
- README and docs present Nexus as the product
- generated wrappers no longer describe Gstack as the product owner
- preamble copy is Nexus-primary while preserving compatibility behavior
- setup output and host namespace logic are Nexus-primary
- relink and uninstall flows still preserve migration compatibility
- canonical lifecycle routing remains unchanged
- Gstack-compatible paths remain compatibility-only and do not regain lifecycle truth

Verification should continue to include:

- `bun test test/nexus/*.test.ts`
- `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/relink.test.ts test/uninstall.test.ts`
- `bun run gen:skill-docs --host codex`
- `git diff --check`

## 10. Success Criteria

This milestone is complete when:

- package, setup, generated wrapper prose, and docs all present Nexus as the product
- canonical lifecycle commands remain unchanged
- external-host generated assets use Nexus-primary identity
- Gstack-compatible binaries and paths remain functional but clearly secondary
- no product-facing artifact implies that Gstack owns lifecycle semantics
- governed runtime and `.planning/` truth remain unchanged and Nexus-owned

## 11. Recommended Next Step

After this milestone, the remaining work should be narrower and more explicit:

- final compatibility cleanup of Gstack-only helper names and roots
- optional migration from `~/.gstack` to a Nexus-native state root
- packaging and runtime polish for the final standalone Nexus product experience

That later work should happen only after the visible product surface is already unified.
