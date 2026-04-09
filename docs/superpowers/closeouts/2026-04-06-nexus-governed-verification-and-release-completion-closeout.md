# Milestone 6 Closeout: Nexus Governed Verification and Release Completion

Date: 2026-04-06

Branch: `codex/nexus-governed-runtime-completion`

## Outcome

Milestone 6 is complete.

The governed tail lifecycle is now real runtime, not scaffold. `/review`, `/qa`, and
`/ship` all execute through Nexus-owned runtime contracts, write repo-visible canonical
artifacts, and feed a conservative `/closeout`. Nexus remains the only lifecycle,
contract, and artifact authority. CCB remains routing and transport only. Superpowers
remains discipline only.

## What Landed

### Governed review is now a real dual-audit stage

`/review` now:

- runs Superpowers review discipline before review completion is accepted
- dispatches dual audit transport through CCB for Codex and Gemini paths
- writes the required current audit set under `.planning/audits/current/`
- writes structured review completion truth to `.planning/current/review/status.json`
- records nested reviewed provenance in `.planning/audits/current/meta.json`

### Governed QA is now a real validation stage

`/qa` now:

- requires completed governed review as its predecessor
- dispatches QA validation through CCB without granting CCB lifecycle authority
- writes `.planning/current/qa/qa-report.md`
- writes `.planning/current/qa/status.json`
- records requested and actual route separately
- blocks when validation is not ready or when route provenance diverges

### Governed ship is now a real release-gate stage

`/ship` now:

- requires completed governed review
- requires ready QA whenever QA artifacts exist
- applies Superpowers ship discipline as release-gate input only
- writes `.planning/current/ship/release-gate-record.md`
- writes `.planning/current/ship/checklist.json`
- writes `.planning/current/ship/status.json`
- records explicit ready or blocked release-gate state

### Closeout now governs the full tail lifecycle conservatively

`/closeout` now:

- accepts review-only completion when QA and ship were not run
- accepts `review -> qa -> closeout` when QA exists and is ready
- accepts `review -> ship -> closeout` when ship exists and is ready
- accepts `review -> qa -> ship -> closeout` when both optional stages exist and are ready
- rejects illegal tail-stage history
- rejects missing or inconsistent reviewed provenance
- rejects incomplete archive state
- blocks when QA exists and is not ready
- blocks when ship exists and is not ready

## Authority Boundaries Preserved

- canonical Nexus commands remain the only lifecycle front door
- `lib/nexus/` remains the only contract owner
- `.planning/` and canonical stage artifacts remain the only governed truth
- CCB remains dispatch and transport only
- Superpowers remains discipline only
- backend outputs still become truth only after Nexus normalization and canonical writeback
- `CLAUDE.md` routing guidance remains command-discovery help only and does not define contract truth

## Documentation and Surface Alignment

The canonical surface now reflects the tail runtime truth:

- `README.md` and `docs/skills.md` describe `/qa` and `/ship` as implemented governed stages
- `lib/nexus/stage-content/review/`
- `lib/nexus/stage-content/qa/`
- `lib/nexus/stage-content/ship/`

Inventory notes now reflect the active governed tail seams:

- `upstream-notes/absorption-status.md`
- `upstream-notes/ccb-inventory.md`
- `upstream-notes/superpowers-inventory.md`

## Verification Evidence

Nexus regression:

```bash
bun test test/nexus/*.test.ts
```

Result:

- 96 passed
- 0 failed

Host and wrapper regression:

```bash
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Result:

- 431 passed
- 225 skipped
- 0 failed

Generated wrapper refresh:

```bash
bun run gen:skill-docs --host codex
```

Result:

- exited 0
- regenerated Codex wrapper docs successfully

Formatting check:

```bash
git diff --check
```

Result:

- clean

## Baseline Locked

- `/review`, `/qa`, and `/ship` are real governed runtime stages
- `/qa` and `/ship` are no longer placeholder canonical wrappers
- governed tail routes remain explicit and repo-visible
- requested route and actual route remain separate wherever CCB participates
- closeout remains conservative and repo-visible across the full tail lifecycle

## Remaining Deliberate Gaps

- final host-shell reduction and surface unification still remain future work
- the product still carries migration-era Gstack host structure even though Nexus owns the governed lifecycle
- CCB remains infrastructure and is not absorbed as a business-layer Nexus system

## Commit Trail

- `85eef58` docs: define governed verification and release completion
- `c9c75be` feat: freeze governed tail lifecycle contracts
- `44fc5a1` feat: add review qa and ship stage packs
- `63f4263` feat: implement governed dual-audit review
- `573dcde` feat: implement governed qa runtime
- `3a8dd7c` feat: implement governed ship runtime
- `a63fc04` feat: tighten closeout for governed verification tail

## Next Step

Continue from the completed governed lifecycle baseline toward the finished Nexus
product surface:

- keep absorbing remaining upstream method identity into Nexus-only product language
- keep reducing migration-era Gstack host ownership
- continue toward a finished Nexus where users only experience Claude invoking Nexus and Nexus dispatching through CCB
