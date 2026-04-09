# Nexus Governed Verification And Release Completion Design

## Goal

Define the next product-critical sub-project after canonical skill internalization:
finish the governed tail of the Nexus lifecycle so `/review`, `/qa`, and `/ship`
become real runtime stages rather than placeholders or thin persistence shims.

This milestone is about making the back half of the Nexus workflow genuinely usable:

- `/build` produces a governed implementation result
- `/review` performs a real dual-audit governed checkpoint
- `/qa` performs explicit governed validation
- `/ship` records a real release-gate decision
- `/closeout` verifies the full tail-end state conservatively

The product surface must still present as Nexus only. Upstream systems remain absorbed
capability sources, and CCB remains transport only.

## Scope

### In Scope

- implement a real governed `/review` runtime using Nexus-owned review stage runtime and CCB-backed dual audit transport
- implement a real governed `/qa` runtime using Nexus-owned QA runtime and repo-visible validation artifacts
- implement a real governed `/ship` runtime using Nexus-owned ship runtime and release-gate artifacts
- add runtime stage packs for `review`, `qa`, and `ship`
- activate only the adapter seams needed for the completed tail lifecycle
- extend governance and closeout checks so QA and ship state are enforced conservatively when present
- keep generated canonical wrappers, inventories, and docs aligned with the new runtime depth

### Out of Scope

- host-shell cleanup or Gstack preamble removal
- full install-surface rename away from current Gstack substrate
- replacing `.planning/` as the repo-visible truth model
- making CCB a contract owner or lifecycle owner
- reworking utility/support skills outside the canonical lifecycle surface
- implementing actual merge/push/PR automation as the meaning of `/ship`

## Approaches Considered

### 1. Review-only completion

Implement a real dual-audit `/review` and leave `/qa` and `/ship` as placeholders.

Pros:
- smallest immediate change set
- resolves the most obvious fake runtime

Cons:
- still leaves the lifecycle incomplete
- user still cannot run a full governed project flow through canonical commands alone
- does not satisfy the "complete Nexus" direction

### 2. Tail lifecycle completion as one bounded subsystem

Implement `/review`, `/qa`, `/ship`, and the closeout checks that consume them as one
governed verification/release subsystem.

Pros:
- finishes the lifecycle tail in one coherent pass
- gives Nexus a real end-to-end governed path
- keeps the work decomposed away from host cleanup and packaging concerns

Cons:
- larger than a review-only milestone
- requires new stage packs, new status fields, and new transition rules together

### 3. Full product-surface unification and host cleanup at the same time

Complete review/qa/ship and also reduce host-shell surface in the same milestone.

Pros:
- more dramatic visible unification

Cons:
- mixes product-surface cleanup with runtime completion
- larger blast radius
- weaker milestone isolation

## Recommendation

Use approach 2.

The next most valuable sub-project is the governed tail lifecycle. Nexus cannot feel
like a complete operating system while three canonical commands at the back of the flow
remain shallow. Completing that subsystem now is more important than further host-shell
cleanup.

## 1. Decomposition Boundary

This milestone targets exactly one subsystem:

- governed verification and release completion

That subsystem includes:

- `/review`
- `/qa`
- `/ship`
- the additional `/closeout` checks needed to consume their state correctly

It does not include:

- frontend product-surface cleanup
- install/packaging unification
- utility skill internalization

The milestone should therefore be judged on one question:

Can a user run the canonical Nexus lifecycle through governed implementation, governed
review, explicit QA, release gating, and conservative closeout without falling back to
non-Nexus product surfaces?

## 2. Core Decision

The canonical lifecycle tail must become backed by real Nexus-owned runtime stage packs,
not only Nexus-owned stage content.

Milestone 4 created active runtime stage packs for:

- `discover`
- `frame`
- `plan`
- `handoff`
- `build`
- `closeout`

Milestone 6 should add:

- `nexus-review-pack`
- `nexus-qa-pack`
- `nexus-ship-pack`

The responsibility split remains:

- `lib/nexus/stage-content/` owns user-facing lifecycle skill meaning
- `lib/nexus/stage-packs/` owns runtime stage identity and adapter coordination
- canonical `.planning/` artifacts and `status.json` remain the only governed truth

The new stage packs do not replace stage content. They complete the runtime side of the
same lifecycle stages.

## 3. Review Runtime Completion

`/review` must stop being a hardcoded audit file writer and become a governed review
stage with explicit subordinate contributors.

### Required runtime shape

`/review` should coordinate:

- Superpowers review discipline as a subordinate review method source
- CCB audit transport A for Codex
- CCB audit transport B for Gemini
- Nexus-authored synthesis and gate decision writeback

### Ownership rule

Neither Superpowers nor CCB can own review truth.

Their outputs become governed only after Nexus:

- validates predecessor build state
- normalizes audit results
- writes canonical audit files
- writes canonical `review/status.json`
- writes canonical `meta.json`

### Route/provenance rule

Review must preserve three distinct concepts:

- implementation requested route
- implementation actual route
- audit requested/actual routes for each audit provider

`meta.json` should therefore move to an explicit nested audit structure, for example:

```json
{
  "implementation": {
    "requested_route": {},
    "actual_route": {}
  },
  "audits": {
    "codex": {
      "provider": "codex",
      "path": ".planning/audits/current/codex.md",
      "requested_route": {},
      "actual_route": {}
    },
    "gemini": {
      "provider": "gemini",
      "path": ".planning/audits/current/gemini.md",
      "requested_route": {},
      "actual_route": {}
    }
  }
}
```

Compatibility fields may remain temporarily if needed, but nested provenance becomes
authoritative.

### Review outputs

Canonical review outputs remain:

- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`
- `.planning/audits/current/synthesis.md`
- `.planning/audits/current/gate-decision.md`
- `.planning/audits/current/meta.json`
- `.planning/current/review/status.json`

Optional traceability output may exist at:

- `.planning/current/review/adapter-output.json`

but it is never truth.

## 4. QA Runtime Completion

`/qa` must stop being a placeholder and become a real governed validation stage.

### Runtime role

QA is validation beyond code review. It should record:

- validation scope exercised
- provider used
- explicit findings
- blocking vs non-blocking outcome
- a canonical QA report

### Provider model

This milestone should use CCB as QA transport infrastructure. QA may use a single
provider by default if that keeps the milestone bounded, but the provider choice must
still be explicit and persisted.

The recommended default is:

- primary QA transport through CCB
- default provider policy selected by Nexus-owned QA stage pack

### QA outputs

Canonical QA outputs should be:

- `.planning/current/qa/qa-report.md`
- `.planning/current/qa/status.json`

Optional traceability output may exist at:

- `.planning/current/qa/adapter-output.json`

### QA authority rule

QA findings do not advance lifecycle simply because a provider returned a report.
They advance only when Nexus writes canonical status and report artifacts.

## 5. Ship Runtime Completion

`/ship` must stop being a placeholder and become a real governed release-gate stage.

### Runtime role

Ship is not push/deploy automation in this milestone. It is the governed stage that
records whether the work is ready for merge or release according to Nexus rules.

### Provider/method model

Ship should activate:

- Superpowers ship discipline as a subordinate method source
- Nexus governance checks as the semantic owner

CCB is not required to own ship runtime in this milestone.

### Ship outputs

Canonical ship outputs should be:

- `.planning/current/ship/release-gate-record.md`
- `.planning/current/ship/checklist.json`
- `.planning/current/ship/status.json`

Optional traceability output may exist at:

- `.planning/current/ship/adapter-output.json`

### Ship rule

Ship must never imply bypass of:

- review
- audit persistence
- QA findings when QA has been run
- closeout

## 6. Transition Model

The canonical command surface stays unchanged, but legal tail transitions should expand
to reflect real review/qa/ship sequencing.

Recommended legal transitions:

- `review -> qa`
- `review -> ship`
- `review -> closeout`
- `qa -> ship`
- `qa -> closeout`
- `ship -> closeout`

The conservative rule is:

- if `qa` was run and ended blocked or not ready, `ship` and `closeout` must block
- if `ship` was run and ended blocked or not ready, `closeout` must block
- if `qa` or `ship` were never run, `closeout` may still proceed under current policy

This preserves the earlier "QA/ship optional by policy" rule while making their recorded
state meaningful once they are invoked.

## 7. Artifact And Status Model

Markdown artifacts remain human-readable contracts, but `status.json` remains the source
of truth for runtime logic everywhere.

### Status precedence

If any of these disagree:

- `status.json`
- canonical markdown artifacts
- `adapter-output.json`
- backend-native output

then canonical Nexus artifacts win by definition unless Nexus rewrites them explicitly.

### Partial write rule

If adapter work succeeds conceptually but canonical writeback partially fails, the stage:

- ends blocked
- emits conflict artifacts
- does not advance lifecycle

### Decision/state additions

Milestone 6 should add explicit stage decisions for the newly-real stages, for example:

- `qa_recorded`
- `ship_recorded`

The exact literal names should be frozen once chosen and then used consistently across:

- shared types
- command implementations
- transition logic
- tests

## 8. Adapter And Registry Activation

The runtime registry should become:

- `review.superpowers = active`
- `review.ccb = active`
- `qa.ccb = active`
- `ship.superpowers = active`

No other reserved seam should be activated implicitly.

This likely requires:

- extending `AdapterRegistryShape` with a `qa` section
- extending `CcbAdapter` with a QA transport method
- adding review/qa/ship stage-pack traceability bindings

Inventory markdown remains descriptive only. Runtime activation still belongs to the
registry.

## 9. Governance And Closeout

`/closeout` must remain conservative after tail completion.

It should verify:

- review completeness
- audit persistence completeness
- implementation and audit provenance consistency
- QA readiness if QA artifacts exist
- ship readiness if ship artifacts exist
- archive consistency
- legal transition history

It must not silently repair or silently reconcile conflicting tail-stage state.

If QA or ship state is inconsistent with canonical review/implementation state, closeout
must block and emit conflict records.

## 10. Success Criteria

This milestone is complete when:

- `/review` runs through active Superpowers and CCB seams but Nexus still owns truth
- `/qa` is implemented and writes real governed QA artifacts
- `/ship` is implemented and writes real governed release-gate artifacts
- `review`, `qa`, and `ship` each have Nexus-owned runtime stage packs
- transition rules and closeout checks reflect the real tail lifecycle
- generated canonical wrappers and docs remain Nexus-first
- all relevant Nexus and generator regressions pass

At that point, the canonical lifecycle will be operational from discovery through release
gating and closeout inside Nexus, with CCB remaining only the transport layer underneath.
