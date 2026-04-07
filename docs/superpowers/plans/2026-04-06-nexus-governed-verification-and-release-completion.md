# Nexus Governed Verification And Release Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the governed tail of the Nexus lifecycle by implementing real `/review`, `/qa`, and `/ship` runtimes with conservative `/closeout` enforcement.

**Architecture:** Add runtime stage packs for review, QA, and ship; activate only the required CCB and Superpowers seams; and preserve `status.json` plus canonical `.planning/` artifacts as the only lifecycle truth. Review remains a dual-audit checkpoint, QA becomes a governed validation stage, ship becomes a governed release-gate stage, and closeout remains the final conservative verifier.

**Tech Stack:** Bun, TypeScript, markdown/json canonical artifacts, `lib/nexus/` runtime, `scripts/gen-skill-docs.ts`, Bun test

---

## Execution Base

This plan should execute from:

- branch: `codex/nexus-governed-runtime-completion`
- baseline: Milestone 5 complete

## Locked Rules

- canonical Nexus commands remain unchanged
- `lib/nexus/` remains the only contract owner
- `.planning/` and canonical stage artifacts remain the only governed truth
- `status.json` wins over trace artifacts and backend-native output unless Nexus explicitly rewrites truth
- partial canonical write failure blocks the stage and emits conflict artifacts
- upstream repos remain source material only
- CCB remains transport only
- Superpowers remains discipline only
- `/review`, `/qa`, and `/ship` become real runtime stages in this milestone
- `/closeout` remains conservative and must not silently reconcile inconsistent tail state

## Task 1: Freeze Tail Lifecycle Contracts

**Files:**
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `lib/nexus/transitions.ts`
- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/adapters/types.ts`
- Modify: `lib/nexus/adapters/registry.ts`
- Test: `test/nexus/types.test.ts`
- Test: `test/nexus/manifest.test.ts`
- Test: `test/nexus/transitions.test.ts`

- [ ] **Step 1: Add failing tests for review/qa/ship contract completion**

Require:

- `qa` and `ship` are no longer placeholders in the manifest
- transition rules allow `review -> qa`, `review -> ship`, `qa -> ship`, `qa -> closeout`, and `ship -> closeout`
- stage decisions include the new tail lifecycle decisions
- adapter registry activates only `review.superpowers`, `review.ccb`, `qa.ccb`, and `ship.superpowers`

- [ ] **Step 2: Run the targeted contract tests**

Run:

```bash
bun test test/nexus/types.test.ts test/nexus/manifest.test.ts test/nexus/transitions.test.ts
```

Expected:

- FAIL because the tail lifecycle contract is still incomplete.

- [ ] **Step 3: Freeze the shared types and registry shape**

Add:

- explicit `qa_recorded` and `ship_recorded` stage decisions
- canonical artifact helpers for QA and ship outputs
- `qa` activation slot in `AdapterRegistryShape`
- active registry entries for review, qa, and ship

- [ ] **Step 4: Re-run the targeted contract tests**

Run:

```bash
bun test test/nexus/types.test.ts test/nexus/manifest.test.ts test/nexus/transitions.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/types.ts lib/nexus/command-manifest.ts lib/nexus/transitions.ts lib/nexus/artifacts.ts lib/nexus/adapters/types.ts lib/nexus/adapters/registry.ts test/nexus/types.test.ts test/nexus/manifest.test.ts test/nexus/transitions.test.ts
git commit -m "feat: freeze governed tail lifecycle contracts"
```

## Task 2: Add Runtime Stage Packs For Review, QA, And Ship

**Files:**
- Create: `lib/nexus/stage-packs/review.ts`
- Create: `lib/nexus/stage-packs/qa.ts`
- Create: `lib/nexus/stage-packs/ship.ts`
- Modify: `lib/nexus/stage-packs/index.ts`
- Modify: `lib/nexus/stage-packs/source-map.ts`
- Modify: `test/nexus/absorption-runtime.test.ts`
- Modify: `test/nexus/inventory.test.ts`

- [ ] **Step 1: Add failing tests for tail stage-pack identity**

Require:

- `review`, `qa`, and `ship` each expose a Nexus-owned runtime stage pack
- their traceability points to absorbed source material only
- reserved-future identities do not remain in the active runtime path for those stages

- [ ] **Step 2: Run the targeted stage-pack tests**

Run:

```bash
bun test test/nexus/absorption-runtime.test.ts test/nexus/inventory.test.ts
```

Expected:

- FAIL because the review/qa/ship stage packs do not exist yet.

- [ ] **Step 3: Add review, QA, and ship stage packs**

Implement:

- `nexus-review-pack`
- `nexus-qa-pack`
- `nexus-ship-pack`

Each pack should expose:

- source binding
- absorbed capability traceability
- stage-specific normalization helpers or raw-output builders

- [ ] **Step 4: Re-run the targeted stage-pack tests**

Run:

```bash
bun test test/nexus/absorption-runtime.test.ts test/nexus/inventory.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/stage-packs/review.ts lib/nexus/stage-packs/qa.ts lib/nexus/stage-packs/ship.ts lib/nexus/stage-packs/index.ts lib/nexus/stage-packs/source-map.ts test/nexus/absorption-runtime.test.ts test/nexus/inventory.test.ts
git commit -m "feat: add review qa and ship stage packs"
```

## Task 3: Implement Real Governed Review

**Files:**
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/adapters/superpowers.ts`
- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/normalizers/ccb.ts`
- Modify: `lib/nexus/governance.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `test/nexus/review.test.ts`
- Modify: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Add failing tests for dual-audit review**

Require:

- review runs active Superpowers review discipline plus dual CCB audit transport
- `meta.json` writes nested audit provenance
- review blocks on audit route divergence or partial canonical write failure
- review status carries structured completion state beyond markdown presence

- [ ] **Step 2: Run the targeted review tests**

Run:

```bash
bun test test/nexus/review.test.ts test/nexus/closeout.test.ts
```

Expected:

- FAIL because review still uses the shallow milestone-2 writer.

- [ ] **Step 3: Implement review adapter flow and canonical writeback**

Make `/review`:

- load build truth first
- run Superpowers review discipline
- dispatch Codex and Gemini audits through active CCB seams
- synthesize canonical audit markdown through Nexus
- write nested audit provenance into `meta.json`
- write `review/status.json` as the truth source

- [ ] **Step 4: Re-run the targeted review tests**

Run:

```bash
bun test test/nexus/review.test.ts test/nexus/closeout.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/adapters/ccb.ts lib/nexus/adapters/superpowers.ts lib/nexus/commands/review.ts lib/nexus/normalizers/ccb.ts lib/nexus/governance.ts lib/nexus/types.ts test/nexus/review.test.ts test/nexus/closeout.test.ts
git commit -m "feat: implement governed dual-audit review"
```

## Task 4: Implement Governed QA

**Files:**
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/commands/qa.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/governance.ts`
- Modify: `test/nexus/command-surface.test.ts`
- Create or Modify: `test/nexus/qa.test.ts`
- Modify: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Add failing tests for QA runtime completion**

Require:

- `/qa` writes `qa-report.md` and `status.json`
- QA records provider route explicitly
- QA can end ready or not ready based on findings
- closeout blocks if QA was run and ended not ready

- [ ] **Step 2: Run the targeted QA tests**

Run:

```bash
bun test test/nexus/qa.test.ts test/nexus/command-surface.test.ts test/nexus/closeout.test.ts
```

Expected:

- FAIL because `/qa` is still a placeholder.

- [ ] **Step 3: Implement QA runtime**

Make `/qa`:

- verify review predecessor truth
- dispatch QA validation through CCB
- normalize provider output into `qa-report.md`
- write canonical `status.json`
- emit conflict artifacts on blocked/refused/partial-write paths

- [ ] **Step 4: Re-run the targeted QA tests**

Run:

```bash
bun test test/nexus/qa.test.ts test/nexus/command-surface.test.ts test/nexus/closeout.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/adapters/ccb.ts lib/nexus/commands/qa.ts lib/nexus/types.ts lib/nexus/governance.ts test/nexus/qa.test.ts test/nexus/command-surface.test.ts test/nexus/closeout.test.ts
git commit -m "feat: implement governed qa runtime"
```

## Task 5: Implement Governed Ship

**Files:**
- Modify: `lib/nexus/adapters/superpowers.ts`
- Modify: `lib/nexus/commands/ship.ts`
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/governance.ts`
- Create or Modify: `test/nexus/ship.test.ts`
- Modify: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Add failing tests for ship runtime completion**

Require:

- `/ship` writes `release-gate-record.md`, `checklist.json`, and `status.json`
- ship blocks without completed review
- ship blocks when QA exists and is not ready
- ship records merge/release readiness conservatively

- [ ] **Step 2: Run the targeted ship tests**

Run:

```bash
bun test test/nexus/ship.test.ts test/nexus/closeout.test.ts
```

Expected:

- FAIL because `/ship` is still a placeholder.

- [ ] **Step 3: Implement ship runtime**

Make `/ship`:

- verify review predecessor truth
- consult QA status when present
- run Superpowers ship discipline as subordinate input
- write canonical release-gate markdown and checklist json
- write canonical ship status

- [ ] **Step 4: Re-run the targeted ship tests**

Run:

```bash
bun test test/nexus/ship.test.ts test/nexus/closeout.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/adapters/superpowers.ts lib/nexus/commands/ship.ts lib/nexus/types.ts lib/nexus/governance.ts test/nexus/ship.test.ts test/nexus/closeout.test.ts
git commit -m "feat: implement governed ship runtime"
```

## Task 6: Tighten Closeout And Tail-Lifecycle Governance

**Files:**
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/governance.ts`
- Modify: `test/nexus/closeout.test.ts`
- Modify: `test/nexus/migration-safety.test.ts`

- [ ] **Step 1: Add failing tests for closeout tail-state enforcement**

Require:

- closeout passes when qa/ship were not run and policy does not require them
- closeout blocks when QA exists and is not ready
- closeout blocks when ship exists and is not ready
- closeout refuses inconsistent tail-stage provenance or illegal tail-stage history

- [ ] **Step 2: Run the targeted closeout tests**

Run:

```bash
bun test test/nexus/closeout.test.ts test/nexus/migration-safety.test.ts
```

Expected:

- FAIL until closeout and governance consume the completed tail lifecycle correctly.

- [ ] **Step 3: Implement conservative closeout enforcement**

Make `/closeout`:

- consume QA and ship status only from canonical artifacts
- block on inconsistent or not-ready tail-stage state
- preserve the earlier archive and provenance checks
- keep backend-native invocation outside lifecycle authority

- [ ] **Step 4: Re-run the targeted closeout tests**

Run:

```bash
bun test test/nexus/closeout.test.ts test/nexus/migration-safety.test.ts
```

Expected:

- PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/commands/closeout.ts lib/nexus/governance.ts test/nexus/closeout.test.ts test/nexus/migration-safety.test.ts
git commit -m "feat: tighten closeout for governed verification tail"
```

## Task 7: Refresh Canonical Surface And Lock The Milestone

**Files:**
- Modify: `lib/nexus/stage-content/review/*`
- Modify: `lib/nexus/stage-content/qa/*`
- Modify: `lib/nexus/stage-content/ship/*`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `upstream-notes/absorption-status.md`
- Modify: `upstream-notes/ccb-inventory.md`
- Modify: `upstream-notes/superpowers-inventory.md`
- Create: `docs/superpowers/closeouts/2026-04-06-nexus-governed-verification-and-release-completion-closeout.md`

- [ ] **Step 1: Update canonical stage content and docs**

Make explicit:

- review, QA, and ship are now real governed runtime stages
- CCB remains transport only
- Superpowers remains discipline only
- closeout stays the final conservative verifier

- [ ] **Step 2: Run the full regression suite**

Run:

```bash
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
bun run gen:skill-docs --host codex
```

Expected:

- all tests PASS
- generated docs refresh cleanly

- [ ] **Step 3: Write the milestone closeout**

Record:

- review, QA, and ship are now real governed stages
- runtime stage packs and canonical artifacts remain the only semantic owners
- upstream systems remain source material or transport only
- canonical Nexus commands remain the only lifecycle front door

- [ ] **Step 4: Commit**

```bash
git add lib/nexus/stage-content/review lib/nexus/stage-content/qa lib/nexus/stage-content/ship README.md docs/skills.md upstream-notes/absorption-status.md upstream-notes/ccb-inventory.md upstream-notes/superpowers-inventory.md docs/superpowers/closeouts/2026-04-06-nexus-governed-verification-and-release-completion-closeout.md
git commit -m "docs: close out governed verification and release completion"
```
