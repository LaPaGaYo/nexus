# Nexus Canonical Skill Internalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internalize the canonical Nexus lifecycle skill bodies so the user-facing commands are backed by Nexus-owned stage content rather than thin wrappers over absorbed upstream identity.

**Architecture:** Build on `codex/nexus-command-surface` after Milestone 4. Add a `lib/nexus/stage-content/` layer for lifecycle-stage instruction assets, teach the skill generator to render canonical wrappers from that layer, and keep runtime stage packs plus canonical `.planning/` artifacts as the only semantic authority.

**Tech Stack:** Bun, TypeScript, Markdown stage assets, existing `lib/nexus/` runtime, `scripts/gen-skill-docs.ts`, Bun test

---

## Execution Base

This plan should not execute from `main`.

Execution base:

- branch: `codex/nexus-command-surface`
- baseline: Milestone 4 complete

Do not begin implementation until the execution worktree is created from that branch and the Milestone 5 spec commit has been applied there.

## Locked Rules

- canonical Nexus commands remain unchanged
- `lib/nexus/` remains the only contract owner
- `.planning/` and canonical stage artifacts remain the only governed truth
- stage content may describe behavior, but it may not gain lifecycle authority
- PM Skills, GSD, and Superpowers become Nexus-owned lifecycle content assets, not parallel front doors
- CCB remains transport and dispatch only
- `/review`, `/qa`, and `/ship` may gain Nexus-owned content before full runtime depth, but that content must not imply unauthorized stage advancement
- imported upstream repos remain source material only

## File Structure

### Existing Files To Modify

- `scripts/gen-skill-docs.ts`
- `scripts/resolvers/index.ts`
- `scripts/resolvers/types.ts`
- `discover/SKILL.md.tmpl`
- `frame/SKILL.md.tmpl`
- `plan/SKILL.md.tmpl`
- `handoff/SKILL.md.tmpl`
- `build/SKILL.md.tmpl`
- `review/SKILL.md.tmpl`
- `qa/SKILL.md.tmpl`
- `ship/SKILL.md.tmpl`
- `closeout/SKILL.md.tmpl`
- `README.md`
- `docs/skills.md`
- `upstream-notes/pm-skills-inventory.md`
- `upstream-notes/gsd-inventory.md`
- `upstream-notes/superpowers-inventory.md`
- `upstream-notes/ccb-inventory.md`
- `upstream-notes/absorption-status.md`
- `test/gen-skill-docs.test.ts`
- `test/skill-validation.test.ts`
- `test/skill-routing-e2e.test.ts`

### New Nexus-Owned Stage Content Files

- `lib/nexus/stage-content/types.ts`
- `lib/nexus/stage-content/index.ts`
- `lib/nexus/stage-content/source-map.ts`
- `lib/nexus/stage-content/discover/index.ts`
- `lib/nexus/stage-content/discover/overview.md`
- `lib/nexus/stage-content/discover/checklist.md`
- `lib/nexus/stage-content/discover/artifact-contract.md`
- `lib/nexus/stage-content/discover/routing.md`
- `lib/nexus/stage-content/frame/index.ts`
- `lib/nexus/stage-content/frame/overview.md`
- `lib/nexus/stage-content/frame/checklist.md`
- `lib/nexus/stage-content/frame/artifact-contract.md`
- `lib/nexus/stage-content/frame/routing.md`
- `lib/nexus/stage-content/plan/index.ts`
- `lib/nexus/stage-content/plan/overview.md`
- `lib/nexus/stage-content/plan/checklist.md`
- `lib/nexus/stage-content/plan/artifact-contract.md`
- `lib/nexus/stage-content/plan/routing.md`
- `lib/nexus/stage-content/handoff/index.ts`
- `lib/nexus/stage-content/handoff/overview.md`
- `lib/nexus/stage-content/handoff/checklist.md`
- `lib/nexus/stage-content/handoff/artifact-contract.md`
- `lib/nexus/stage-content/handoff/routing.md`
- `lib/nexus/stage-content/build/index.ts`
- `lib/nexus/stage-content/build/overview.md`
- `lib/nexus/stage-content/build/checklist.md`
- `lib/nexus/stage-content/build/artifact-contract.md`
- `lib/nexus/stage-content/build/routing.md`
- `lib/nexus/stage-content/review/index.ts`
- `lib/nexus/stage-content/review/overview.md`
- `lib/nexus/stage-content/review/checklist.md`
- `lib/nexus/stage-content/review/artifact-contract.md`
- `lib/nexus/stage-content/review/routing.md`
- `lib/nexus/stage-content/qa/index.ts`
- `lib/nexus/stage-content/qa/overview.md`
- `lib/nexus/stage-content/qa/checklist.md`
- `lib/nexus/stage-content/qa/artifact-contract.md`
- `lib/nexus/stage-content/qa/routing.md`
- `lib/nexus/stage-content/ship/index.ts`
- `lib/nexus/stage-content/ship/overview.md`
- `lib/nexus/stage-content/ship/checklist.md`
- `lib/nexus/stage-content/ship/artifact-contract.md`
- `lib/nexus/stage-content/ship/routing.md`
- `lib/nexus/stage-content/closeout/index.ts`
- `lib/nexus/stage-content/closeout/overview.md`
- `lib/nexus/stage-content/closeout/checklist.md`
- `lib/nexus/stage-content/closeout/artifact-contract.md`
- `lib/nexus/stage-content/closeout/routing.md`
- `scripts/resolvers/nexus-stage-content.ts`
- `test/nexus/stage-content.test.ts`

## Task 1: Freeze The Nexus-Owned Stage Content Contract

**Files:**
- Create: `lib/nexus/stage-content/types.ts`
- Create: `lib/nexus/stage-content/index.ts`
- Create: `lib/nexus/stage-content/source-map.ts`
- Create: `test/nexus/stage-content.test.ts`

- [ ] **Step 1: Add failing tests for stage-content identity and section completeness**

Require:

- every canonical lifecycle stage has a Nexus-owned stage-content id
- every stage-content pack resolves to `overview`, `checklist`, `artifact-contract`, and `routing`
- stage-content provenance points to imported upstream files or Nexus-authored content roots

- [ ] **Step 2: Run the targeted stage-content test**

Run: `bun test test/nexus/stage-content.test.ts`
Expected: FAIL because the stage-content layer does not exist yet.

- [ ] **Step 3: Add the shared stage-content contract**

Define:

- `NexusStageContentId`
- `NexusStageContentSection`
- `NexusStageContentPack`
- a shared source-map binding from lifecycle stages to imported upstream files

- [ ] **Step 4: Export an empty-but-typed stage-content registry**

Create typed registry entries for:

- `discover`
- `frame`
- `plan`
- `handoff`
- `build`
- `review`
- `qa`
- `ship`
- `closeout`

- [ ] **Step 5: Re-run the targeted stage-content test**

Run: `bun test test/nexus/stage-content.test.ts`
Expected: PASS for the contract shape.

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/stage-content/types.ts lib/nexus/stage-content/index.ts lib/nexus/stage-content/source-map.ts test/nexus/stage-content.test.ts
git commit -m "feat: freeze nexus stage content contracts"
```

## Task 2: Internalize Discover, Frame, And Plan Content

**Files:**
- Create: `lib/nexus/stage-content/discover/index.ts`
- Create: `lib/nexus/stage-content/discover/overview.md`
- Create: `lib/nexus/stage-content/discover/checklist.md`
- Create: `lib/nexus/stage-content/discover/artifact-contract.md`
- Create: `lib/nexus/stage-content/discover/routing.md`
- Create: `lib/nexus/stage-content/frame/index.ts`
- Create: `lib/nexus/stage-content/frame/overview.md`
- Create: `lib/nexus/stage-content/frame/checklist.md`
- Create: `lib/nexus/stage-content/frame/artifact-contract.md`
- Create: `lib/nexus/stage-content/frame/routing.md`
- Create: `lib/nexus/stage-content/plan/index.ts`
- Create: `lib/nexus/stage-content/plan/overview.md`
- Create: `lib/nexus/stage-content/plan/checklist.md`
- Create: `lib/nexus/stage-content/plan/artifact-contract.md`
- Create: `lib/nexus/stage-content/plan/routing.md`
- Modify: `test/nexus/stage-content.test.ts`

- [ ] **Step 1: Add failing tests for PM/GSD-derived stage content**

Require:

- `discover` content is Nexus-authored but traceable to PM source material
- `frame` content is Nexus-authored but traceable to PM source material
- `plan` content is Nexus-authored but traceable to GSD source material
- active content sections do not use PM- or GSD-native front-door language

- [ ] **Step 2: Run the targeted stage-content test**

Run: `bun test test/nexus/stage-content.test.ts`
Expected: FAIL until the stage content exists.

- [ ] **Step 3: Write the Nexus-owned content packs**

Author stage content that makes explicit:

- stage purpose
- operator checklist
- artifact expectations
- next-stage routing

Keep the authored voice Nexus-owned while preserving upstream source-map traceability.

- [ ] **Step 4: Re-run the targeted test**

Run: `bun test test/nexus/stage-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/stage-content/discover lib/nexus/stage-content/frame lib/nexus/stage-content/plan test/nexus/stage-content.test.ts
git commit -m "feat: add nexus content packs for discover frame and plan"
```

## Task 3: Internalize Handoff, Build, And Closeout Content

**Files:**
- Create: `lib/nexus/stage-content/handoff/index.ts`
- Create: `lib/nexus/stage-content/handoff/overview.md`
- Create: `lib/nexus/stage-content/handoff/checklist.md`
- Create: `lib/nexus/stage-content/handoff/artifact-contract.md`
- Create: `lib/nexus/stage-content/handoff/routing.md`
- Create: `lib/nexus/stage-content/build/index.ts`
- Create: `lib/nexus/stage-content/build/overview.md`
- Create: `lib/nexus/stage-content/build/checklist.md`
- Create: `lib/nexus/stage-content/build/artifact-contract.md`
- Create: `lib/nexus/stage-content/build/routing.md`
- Create: `lib/nexus/stage-content/closeout/index.ts`
- Create: `lib/nexus/stage-content/closeout/overview.md`
- Create: `lib/nexus/stage-content/closeout/checklist.md`
- Create: `lib/nexus/stage-content/closeout/artifact-contract.md`
- Create: `lib/nexus/stage-content/closeout/routing.md`
- Modify: `test/nexus/stage-content.test.ts`

- [ ] **Step 1: Add failing tests for handoff/build/closeout content**

Require:

- `handoff` content preserves the rule that route availability is not approval
- `build` content presents Superpowers and CCB as subordinate contributors only
- `closeout` content preserves archive/provenance/legal-transition conservatism

- [ ] **Step 2: Run the targeted stage-content test**

Run: `bun test test/nexus/stage-content.test.ts`
Expected: FAIL until these content packs exist.

- [ ] **Step 3: Write the Nexus-owned content packs**

Ensure:

- `handoff` language is Nexus-authored governance language
- `build` language is Nexus-authored implementation discipline language
- `closeout` language is Nexus-authored verification/closure language

- [ ] **Step 4: Re-run the targeted test**

Run: `bun test test/nexus/stage-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/stage-content/handoff lib/nexus/stage-content/build lib/nexus/stage-content/closeout test/nexus/stage-content.test.ts
git commit -m "feat: add nexus content packs for handoff build and closeout"
```

## Task 4: Internalize Review, QA, And Ship Content Without Granting Runtime Authority

**Files:**
- Create: `lib/nexus/stage-content/review/index.ts`
- Create: `lib/nexus/stage-content/review/overview.md`
- Create: `lib/nexus/stage-content/review/checklist.md`
- Create: `lib/nexus/stage-content/review/artifact-contract.md`
- Create: `lib/nexus/stage-content/review/routing.md`
- Create: `lib/nexus/stage-content/qa/index.ts`
- Create: `lib/nexus/stage-content/qa/overview.md`
- Create: `lib/nexus/stage-content/qa/checklist.md`
- Create: `lib/nexus/stage-content/qa/artifact-contract.md`
- Create: `lib/nexus/stage-content/qa/routing.md`
- Create: `lib/nexus/stage-content/ship/index.ts`
- Create: `lib/nexus/stage-content/ship/overview.md`
- Create: `lib/nexus/stage-content/ship/checklist.md`
- Create: `lib/nexus/stage-content/ship/artifact-contract.md`
- Create: `lib/nexus/stage-content/ship/routing.md`
- Modify: `test/nexus/stage-content.test.ts`
- Modify: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Add failing tests for staged content on review/qa/ship**

Require:

- `review` content is Nexus-owned even while `review.superpowers` and `review.ccb` stay reserved
- `qa` content is Nexus-owned without implying implemented runtime authority
- `ship` content is Nexus-owned without implying that release-gate runtime is complete

- [ ] **Step 2: Run the targeted tests**

Run: `bun test test/nexus/stage-content.test.ts test/nexus/inventory.test.ts`
Expected: FAIL until the staged content packs exist.

- [ ] **Step 3: Write the staged Nexus-owned content packs**

Keep explicit:

- current runtime state
- required predecessor artifacts
- future-facing absorbed discipline areas
- blocked/not-yet-implemented boundaries where applicable

- [ ] **Step 4: Re-run the targeted tests**

Run: `bun test test/nexus/stage-content.test.ts test/nexus/inventory.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/stage-content/review lib/nexus/stage-content/qa lib/nexus/stage-content/ship test/nexus/stage-content.test.ts test/nexus/inventory.test.ts
git commit -m "feat: add nexus content packs for review qa and ship"
```

## Task 5: Route Canonical Templates Through Nexus-Owned Stage Content

**Files:**
- Create: `scripts/resolvers/nexus-stage-content.ts`
- Modify: `scripts/resolvers/index.ts`
- Modify: `scripts/resolvers/types.ts`
- Modify: `scripts/gen-skill-docs.ts`
- Modify: `discover/SKILL.md.tmpl`
- Modify: `frame/SKILL.md.tmpl`
- Modify: `plan/SKILL.md.tmpl`
- Modify: `handoff/SKILL.md.tmpl`
- Modify: `build/SKILL.md.tmpl`
- Modify: `review/SKILL.md.tmpl`
- Modify: `qa/SKILL.md.tmpl`
- Modify: `ship/SKILL.md.tmpl`
- Modify: `closeout/SKILL.md.tmpl`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `upstream-notes/pm-skills-inventory.md`
- Modify: `upstream-notes/gsd-inventory.md`
- Modify: `upstream-notes/superpowers-inventory.md`
- Modify: `upstream-notes/ccb-inventory.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`
- Modify: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Add failing generator and wrapper tests**

Require:

- canonical lifecycle templates render from Nexus-owned stage-content placeholders
- generated wrapper text references Nexus-owned stage content, not upstream-native identity
- routing E2E still resolves the canonical commands correctly

- [ ] **Step 2: Run the generator and wrapper tests**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
Expected: FAIL until the generator and templates are updated.

- [ ] **Step 3: Add the stage-content resolver layer**

Implement resolvers that can render:

- stage overview
- stage checklist
- artifact contract
- routing / next-step guidance

from `lib/nexus/stage-content/<stage>/`.

- [ ] **Step 4: Convert the canonical lifecycle templates into thin wrappers**

Each canonical wrapper should:

- keep frontmatter and invocation shape
- delegate body meaning to the Nexus-owned stage-content layer
- avoid embedding backend product identity as authored command meaning

- [ ] **Step 5: Update docs and inventories**

Make explicit:

- canonical lifecycle skill meaning now comes from Nexus-owned stage content
- stage-content packs are separate from runtime stage packs
- upstream repos remain source material only

- [ ] **Step 6: Re-run the generator and wrapper tests**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
Expected: PASS.

- [ ] **Step 7: Refresh generated skills**

Run: `bun run gen:skill-docs --host codex`
Expected: exits 0 and updates generated wrappers.

- [ ] **Step 8: Commit**

```bash
git add scripts/resolvers/nexus-stage-content.ts scripts/resolvers/index.ts scripts/resolvers/types.ts scripts/gen-skill-docs.ts discover/SKILL.md.tmpl frame/SKILL.md.tmpl plan/SKILL.md.tmpl handoff/SKILL.md.tmpl build/SKILL.md.tmpl review/SKILL.md.tmpl qa/SKILL.md.tmpl ship/SKILL.md.tmpl closeout/SKILL.md.tmpl README.md docs/skills.md upstream-notes/pm-skills-inventory.md upstream-notes/gsd-inventory.md upstream-notes/superpowers-inventory.md upstream-notes/ccb-inventory.md upstream-notes/absorption-status.md test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
git commit -m "feat: render canonical wrappers from nexus stage content"
```

## Task 6: Run Full Regression And Lock The Milestone 5 Baseline

**Files:**
- Create: `docs/superpowers/closeouts/2026-04-06-nexus-canonical-skill-internalization-closeout.md`
- Test: `test/nexus/*.test.ts`
- Test: `test/gen-skill-docs.test.ts`
- Test: `test/skill-validation.test.ts`
- Test: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Run the Nexus regression suite**

Run: `bun test test/nexus/*.test.ts`
Expected: PASS.

- [ ] **Step 2: Run the host/generator regression suite**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`
Expected: PASS.

- [ ] **Step 3: Refresh generated wrapper docs**

Run: `bun run gen:skill-docs --host codex`
Expected: exits 0.

- [ ] **Step 4: Write the closeout note**

Record:

- canonical lifecycle skill content is now Nexus-owned
- runtime stage packs remain the semantic owner of stage identity
- upstream repos remain source material only
- CCB remains transport only
- canonical Nexus commands remain the only lifecycle front door

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/closeouts/2026-04-06-nexus-canonical-skill-internalization-closeout.md
git commit -m "docs: add canonical skill internalization closeout"
```

## Self-Review Checklist

- The plan only targets one decomposed sub-project: canonical lifecycle skill internalization.
- The canonical Nexus command surface remains unchanged.
- No task reintroduces backend-native or host-native lifecycle entrypoints.
- No task grants stage-content packs lifecycle authority.
- No task grants CCB contract, stage, or truth ownership.
- Every task preserves repo-visible Nexus truth and runtime authority while making lifecycle skill content Nexus-owned.
