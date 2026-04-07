# Nexus Product Unification Design

## Goal

Define the end-state product target for Nexus as a single usable system, not a long-lived integration experiment.

Nexus must become:

- directly usable
- able to run real projects end to end
- evolvable over time
- maintainable as one product
- externally legible as one unified system

The final user experience must feel like using Nexus only. It must not feel like using Gstack, PM Skills, GSD, Superpowers, and CCB side by side.

## Product End State

The final product surface is:

- one command system
- one lifecycle
- one state model
- one artifact model
- one governance model
- one runtime ownership model

The canonical Nexus command surface remains:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

These commands remain the only lifecycle front door. Everything else is either internal implementation detail, compatibility-only migration surface, or infrastructure.

## Core Product Rule

Nexus is not a bundle of connected packages.

Nexus is a single product that absorbs multiple upstream systems, preserves their strongest methods, removes their duplicated or conflicting identities, and exposes one coherent operating model.

The correct end state is not:

- Gstack plus PM Skills plus GSD plus Superpowers
- Nexus wrappers over several still-independent products
- multiple command systems that happen to share a repo

The correct end state is:

- Nexus owns the product identity
- Nexus owns the engineering identity
- upstream systems survive only as absorbed capability DNA

## What Must Be Absorbed

### Gstack

Retain:

- host architecture
- command shell patterns
- workflow rhythm
- product feel

Do not retain as a separate long-term product boundary:

- independent skill identity
- independent lifecycle semantics
- independent truth model

### PM Skills

Retain:

- discovery method
- framing method
- PRD method
- strategy method
- product-thinking prompts and structures

Do not retain as a separate long-term product boundary:

- PM-native command surface
- PM-native artifact ownership
- PM-native lifecycle authority

### GSD

Retain:

- planning method
- readiness logic
- closeout structure
- artifact-driven operating model
- state and summary thinking

Do not retain as a separate long-term product boundary:

- GSD-native command surface
- GSD-native stage advancement
- GSD-native truth ownership

### Superpowers

Retain:

- engineering discipline
- build discipline
- verification discipline
- agentic execution workflow
- TDD and workflow enforcement patterns

Do not retain as a separate long-term product boundary:

- Superpowers-native command surface
- Superpowers-native execution ownership
- Superpowers-native lifecycle or governance authority

## What Must Be Removed

Nexus should not preserve everything merely because it exists upstream.

The unification program must:

- merge duplicated concepts
- resolve conflicting concepts
- delete redundant layers
- remove historical packaging baggage
- strip out anything that does not serve the Nexus end state

The final system cannot keep:

- multiple command surfaces
- multiple state ledgers
- multiple truth sources
- multiple governance semantics
- multiple lifecycle owners

## Nexus Uniqueness Rules

The following belong only to Nexus:

- commands
- lifecycle progression
- state
- artifacts
- governance
- runtime ownership
- project advancement logic

Upstream systems may contribute methods, templates, prompts, checklists, and execution patterns, but only Nexus may convert those into authoritative project behavior.

Repo-visible Nexus artifacts remain the only governed truth.

Backend output does not become truth until Nexus normalizes and writes it back into canonical artifacts and structured status.

## CCB Boundary

CCB is not part of the product core in the same way as Gstack, PM Skills, GSD, and Superpowers.

CCB remains:

- dispatch infrastructure
- transport infrastructure
- routing infrastructure
- tmux-based multi-model collaboration plumbing

CCB may be deeply integrated, but it does not become:

- a contract owner
- a truth layer
- a lifecycle owner
- a governance owner

Nexus owns the decision. CCB carries the task.

## Target Operating Model

The intended runtime experience is:

1. start tmux
2. start `ccb claude codex gemini`
3. enter Claude
4. ask Claude to run the project through Nexus

The control flow is:

1. the human interacts only with Claude
2. Claude invokes Nexus
3. Nexus owns commands, phases, state, artifacts, and governance
4. Nexus dispatches bounded work through CCB
5. CCB transports work to Codex and Gemini
6. returned outputs only become governed truth after Nexus normalizes and writes them back

This operating model is the target user experience and the target architecture.

## Structural Requirements

The following rules remain locked:

1. Gstack may remain the host shell during migration.
2. Nexus remains the only contract owner and source of truth.
3. PM Skills, GSD, and Superpowers must be absorbed into Nexus rather than preserved as long-lived parallel systems.
4. CCB remains the underlying dispatch and transport layer.
5. repo-visible Nexus artifacts and status remain under Nexus ownership only.
6. canonical Nexus commands remain stable unless a Nexus-owned product decision explicitly changes them.
7. all new seams must enter Nexus-owned runtime and artifact layers, not create parallel truth layers.
8. backend output only counts after Nexus normalization and writeback.

## Program Decomposition

This end state is too large for one undifferentiated implementation push. It should be executed as a product unification program.

### Track A: Active Stage Asset Absorption

Convert currently active command behavior into Nexus-owned stage assets for:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/closeout`

The immediate goal is not merely adapter routing. The goal is to replace backend-facing method identity with Nexus-owned internal stage packs while preserving proven behavior.

### Track B: Reserved Stage Internalization

Internalize the future-facing method sets for:

- `/review`
- `/qa`
- `/ship`

This includes absorbed review discipline, verification discipline, and governed ship discipline, still under Nexus-owned lifecycle control.

### Track C: Host Reduction And Surface Cleanup

Reduce the remaining Gstack-native shell semantics until the host layer is bootstrap and presentation only.

This includes:

- wrapper generation cleanup
- README and install flow cleanup
- removal of remaining product-surface references that imply gstack is the product

### Track D: Packaging And Runtime Productization

Make Nexus installable and operable as a real product rather than a migration state.

This includes:

- package identity
- install path identity
- runtime root identity
- operator docs
- maintenance path

## Implementation Priority

The next implementation slice should be:

### Milestone 4: Active Stage Asset Absorption

Reason:

- it moves the active governed path closer to true Nexus ownership
- it reduces dependence on upstream-native stage identity
- it keeps the canonical command surface unchanged
- it prepares later host cleanup without losing working behavior

This milestone should focus on turning upstream methods into Nexus-owned internal stage packs, not on broad cleanup or full packaging replacement.

## Success Criteria

The unification program succeeds only when all of the following are true:

1. users experience one product called Nexus
2. canonical Nexus commands are the only lifecycle front door
3. repo-visible Nexus artifacts remain the only governed truth
4. Gstack, PM Skills, GSD, and Superpowers no longer survive as separate product identities
5. CCB remains infrastructure only
6. the system can be operated through Claude as the single interaction entrypoint
7. the resulting product is maintainable and evolvable as one system

## Non-Goals

This design does not require:

- preserving every upstream skill intact
- preserving upstream naming
- preserving upstream command identities
- making CCB a product-semantic owner
- keeping migration-era compatibility surfaces forever

The objective is a finished Nexus product, not permanent coexistence.
