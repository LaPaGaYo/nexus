# Nexus Canonical Skill Internalization Design

## Goal

Define the next product-unification sub-project after active stage absorption:
rewrite the canonical Nexus lifecycle skills so their instruction content, checklists,
templates, and method structure become Nexus-owned stage assets rather than thin shells
over upstream identity.

This milestone is not about simply routing adapters. It is about making the visible
Nexus commands feel, read, and behave like Nexus's own skills.

## Scope

### In Scope

- define how the nine canonical Nexus lifecycle commands become backed by Nexus-owned skill content
- define the internal asset structure for absorbed stage content
- define how upstream PM Skills, GSD, and Superpowers methods are split and rewritten into Nexus-owned stage assets
- define how current runtime stage packs and future skill-content packs relate to each other
- define how `/review`, `/qa`, and `/ship` gain Nexus-owned content even before all runtime seams are fully active
- define the migration boundary so imported upstream repos remain source material only

### Out of Scope

- full package/install rename away from the current Gstack host substrate
- deleting all legacy aliases in this milestone
- migrating every utility/support command such as browser, safety, setup, and release helpers
- replacing the current `.planning/` artifact model
- granting CCB any lifecycle or contract ownership

## Approaches Considered

### 1. Per-command in-place rewrite

Rewrite each top-level `SKILL.md.tmpl` directly and inline the absorbed content there.

Pros:
- fast to start
- low new-architecture overhead

Cons:
- method structure gets duplicated across wrappers
- source tracing becomes fragile
- runtime packs and skill text drift more easily

### 2. Nexus-owned stage-content packs layered under canonical wrappers

Create a dedicated Nexus-owned content layer for lifecycle stages, and make canonical
wrappers render from that layer.

Pros:
- one internal source for stage prompt/checklist/template content
- clean separation between runtime stage semantics and skill-text content
- upstream method provenance stays explicit without leaving upstream identity in the front door

Cons:
- adds one more Nexus-owned internal layer to maintain
- requires generator integration work

### 3. Big-bang rewrite of lifecycle and utility surfaces together

Rewrite canonical stages, utility commands, install surface, and host packaging in one pass.

Pros:
- fastest route to a dramatically unified product surface

Cons:
- scope is too large
- higher regression risk across unrelated surfaces
- would blur lifecycle internalization with packaging cleanup

## Recommendation

Use approach 2.

Nexus should gain a dedicated stage-content layer so the product-facing lifecycle skills
become Nexus-owned in content as well as runtime semantics. Utility/support skill
internalization should follow as a separate track after lifecycle skill content is stable.

## 1. Decomposition Boundary

The phrase "pull all the skills down and make them Nexus skills" is larger than one
implementation cycle. This milestone should therefore target the first product-critical
subsystem only:

- lifecycle stage skills

That means:

- `/discover`
- `/frame`
- `/plan`
- `/handoff`
- `/build`
- `/review`
- `/qa`
- `/ship`
- `/closeout`

These commands define the product's core engineering operating model. They should be
internalized before utility/support surfaces such as browser tooling, safety guards,
setup helpers, release helpers, or host convenience commands.

Utility/support commands can later become either:

- Nexus-branded utility commands
- internal helper capabilities behind canonical Nexus stages
- deprecated migration surface

but they are not the first internalization target.

## 2. Core Decision

Nexus canonical lifecycle skills must become backed by Nexus-owned stage content.

The visible wrapper is not enough. The underlying skill content must also become Nexus's
own authored structure:

- Nexus-written purpose and operator framing
- Nexus-written stage checklist
- Nexus-written artifact expectations
- Nexus-written governance reminders
- Nexus-written next-step routing

Upstream methods may still contribute source material, but they must be rewritten into
Nexus-authored assets before they become the canonical skill body.

## 3. Internal Asset Model

Milestone 4 established runtime stage packs:

- `lib/nexus/stage-packs/`

Milestone 5 should add a parallel content layer for lifecycle skills:

- `lib/nexus/stage-content/discover/`
- `lib/nexus/stage-content/frame/`
- `lib/nexus/stage-content/plan/`
- `lib/nexus/stage-content/handoff/`
- `lib/nexus/stage-content/build/`
- `lib/nexus/stage-content/review/`
- `lib/nexus/stage-content/qa/`
- `lib/nexus/stage-content/ship/`
- `lib/nexus/stage-content/closeout/`

Each stage-content directory should define Nexus-owned lifecycle content such as:

- `source-map.ts`
- `overview.md`
- `checklist.md`
- `artifact-contract.md`
- `routing.md`
- `fragments/` for absorbed method blocks where needed

The responsibility split becomes:

- `lib/nexus/stage-packs/`: runtime semantics, typed ownership, adapter coordination, provenance identity
- `lib/nexus/stage-content/`: user-facing stage instructions, absorbed method narrative, checklists, and command-level contract language
- top-level canonical command directories: thin generated wrappers over Nexus-owned stage content

This keeps runtime truth and skill content distinct while still making both layers
Nexus-owned.

## 4. Skill Generation Model

Canonical lifecycle wrappers should remain top-level command directories, but their
templates should stop behaving as the place where stage meaning is authored.

The intended flow is:

1. Nexus-owned stage content lives under `lib/nexus/stage-content/<stage>/`
2. skill generation reads that content
3. top-level `SKILL.md.tmpl` becomes a thin canonical wrapper
4. generated `SKILL.md` presents only Nexus-authored lifecycle language

This means canonical wrappers may continue to exist physically at:

- `discover/`
- `frame/`
- `plan/`
- `handoff/`
- `build/`
- `review/`
- `qa/`
- `ship/`
- `closeout/`

but their authored meaning should be sourced from Nexus-owned stage content, not from
host-era or upstream-native text.

## 5. Upstream Absorption Rules

### PM Skills

PM content should be mined for:

- discovery questioning structure
- framing structure
- PRD and strategy scaffolding

It should become Nexus-owned content for:

- `/discover`
- `/frame`

### GSD

GSD content should be mined for:

- planning structure
- readiness discipline
- closeout structure
- artifact/state/summary thinking
- verification structure relevant to review and QA

It should become Nexus-owned content for:

- `/plan`
- `/closeout`
- portions of `/review`
- portions of `/qa`

### Superpowers

Superpowers content should be mined for:

- build discipline
- verification-before-completion discipline
- review-before-completion patterns
- TDD and execution workflow
- finish-branch and release discipline

It should become Nexus-owned content for:

- `/build`
- `/review`
- `/qa`
- `/ship`

### Gstack

Gstack content should be mined for:

- command shell rhythm
- wrapper ergonomics
- workflow pacing
- product feel

It should not remain a competing product identity. Its surviving contribution should be
host behavior and UX patterns that have been rewritten into Nexus's own surface.

### CCB

CCB content should not become lifecycle skill identity. It remains:

- dispatch logic
- transport logic
- provider collaboration plumbing

CCB may contribute dispatch-oriented fragments to:

- `/handoff`
- `/build`
- `/review`
- `/ship`

but only as infrastructure language under Nexus-owned stage content.

## 6. Reserved And Placeholder Stages

This milestone should internalize stage content even where runtime implementation is not
yet fully mature.

That means:

- `/review` should gain Nexus-owned review content even if future transport/seam work remains
- `/qa` should gain Nexus-owned QA content before full QA runtime depth exists
- `/ship` should gain Nexus-owned ship content before the full release-gate runtime is complete

The important distinction is:

- content internalization may proceed ahead of runtime completion
- runtime lifecycle authority still remains governed by `lib/nexus/commands/*` and canonical artifacts

No content pack may silently grant stage advancement.

## 7. Migration Safety Rules

While this milestone rewrites skill content, the existing safety rules remain locked:

1. only canonical Nexus commands may advance lifecycle stage
2. only Nexus may write canonical stage status and run-ledger truth
3. imported upstream repos remain source material only
4. `CLAUDE.md` may assist routing but may not define lifecycle truth
5. stage-content packs describe behavior, but runtime packs and canonical artifacts still win on semantic authority

If stage content, upstream text, and runtime behavior disagree, Nexus runtime and
canonical artifacts win until content is rewritten.

## 8. Documentation And Inventory Impact

This milestone should extend repo-visible provenance so the new content layer is traceable.

Expected additions:

- inventory rows link not only to stage packs, but also to stage-content packs where active
- source maps tie upstream files to both runtime stage packs and stage-content assets
- docs begin describing canonical lifecycle skills as Nexus-authored content backed by absorbed source material

The inventories remain descriptive. Runtime activation authority still belongs to Nexus code.

## 9. Success Criteria

This milestone is complete when:

1. each canonical lifecycle command has a Nexus-owned stage-content directory
2. canonical lifecycle `SKILL.md.tmpl` files are thin wrappers over Nexus-owned stage content
3. active-stage lifecycle wrappers stop presenting upstream product identity as authored command meaning
4. `/review`, `/qa`, and `/ship` gain Nexus-owned content packs even if runtime completion is staged
5. upstream repos remain source material only
6. no new parallel front door is introduced

## 10. Next Decomposition After This Milestone

After canonical lifecycle skill internalization stabilizes, the next product-unification
track should target utility/support surface cleanup, including:

- safety utilities
- browser utilities
- setup/install utilities
- release/documentation helper surfaces
- remaining host-era naming and packaging

That later milestone can decide which utilities become:

- Nexus utility commands
- internal helper capabilities
- deprecated migration surface

but it should happen after the lifecycle command body is fully Nexus-owned.
