# Nexus Integration Seams Design

## Goal

Define Milestone 2 as an adapter-and-inventory layer built on top of the current Gstack-hosted Nexus codebase.

Milestone 2 keeps the canonical Nexus command surface unchanged while adding backend capability seams for:

- PM Skills behind `/discover` and `/frame`
- GSD behind `/plan` and `/closeout`
- Superpowers discipline behind `/build`
- CCB-backed provider routing and execution transport where Nexus already owns the contract

Nexus remains the sole contract, artifact, transition, and governance owner. Backend systems contribute capability only after Nexus normalizes and writes canonical repo-visible artifacts.

## Scope

### In Scope

- Add backend adapter seams under `lib/nexus/` on top of the current Gstack host architecture.
- Keep the existing canonical Nexus command surface unchanged.
- Define the runtime ownership boundary between:
  - Gstack host wrappers
  - Nexus command runtime
  - backend capability adapters
  - CCB transport
  - canonical Nexus artifacts
- Define the inventory model for:
  - PM Skills
  - GSD
  - Superpowers
  - CCB
  - inherited Gstack-native host structures
- Add minimal repo-visible adapter traceability artifacts needed for Milestone 2.
- Keep reserved future seams for `/review` and `/ship` explicit but inactive.

### Out of Scope

- Broad cleanup or removal of legacy Gstack-native structures
- Any second front-end command surface for PM Skills, GSD, Superpowers, or CCB
- Making backend-native state the source of truth for governed lifecycle flow
- Full `/review` or `/ship` backend activation beyond reserved seam definitions
- Replacing CCB with another transport

## Core Decisions

1. Gstack remains the current host shell and generated command surface, but it does not own governed lifecycle truth.
2. Nexus remains the sole contract owner through `lib/nexus/` and repo-visible artifacts under `.planning/`.
3. PM Skills, GSD, and Superpowers are backend capability sources only. They do not own lifecycle stage advancement, artifact truth, or governance decisions.
4. CCB is infrastructure for routing and multi-model collaboration only. It is never a contract owner or persistence authority for governed truth.
5. Backend outputs only become governed truth after Nexus normalizes them and writes canonical repo-visible artifacts.
6. If backend state or tool state conflicts with Nexus repo state, Nexus records the conflict and blocks or refuses progression. It does not silently reconcile.
7. Inventory markdown is descriptive. `lib/nexus/adapters/registry.ts` is the runtime activation authority.
8. `adapt` is the expected dominant integration classification for Milestone 2.

## 1. Host vs Contract Ownership

### Gstack Host Layer

Gstack continues to own the current shell architecture:

- top-level command directories
- generated `SKILL.md` surface
- install and test substrate
- existing host dispatch conventions

Gstack-hosted wrappers may invoke Nexus, but they may not:

- advance lifecycle stage directly
- determine governed readiness
- determine governed pass/fail outcomes
- persist alternate source-of-truth lifecycle state

### Nexus Contract Layer

Nexus owns all governed lifecycle truth through `lib/nexus/` and `.planning/`.

Nexus is responsible for:

- canonical command identity
- command contracts
- stage transition legality
- ledger and stage status state
- governed artifact definitions
- normalization and writeback
- provenance and route records
- refusal and blocking logic
- closeout consistency checks

### Backend Capability Layers

Backend capability sources are injected behind Nexus commands:

- PM Skills for discovery and framing support
- GSD for planning and closeout method support
- Superpowers for execution-discipline support

These systems may return useful results, but those results are not governed truth until Nexus writes them into canonical artifacts and structured status.

### CCB Transport Layer

CCB is the routing and collaboration transport used to connect Nexus to external model paths such as Codex and Gemini.

CCB may provide:

- route resolution
- execution transport
- audit transport in future milestones
- provider receipts or execution metadata

CCB may not:

- persist governed lifecycle truth
- define artifact contracts
- advance lifecycle stage
- override Nexus governance decisions

### Conflict Rule

If inherited host state, backend state, or transport state conflicts with canonical Nexus repo state:

- Nexus writes a repo-visible conflict artifact
- Nexus marks the affected stage blocked or refused
- Nexus requires explicit follow-up instead of silent reconciliation

## 2. Command-to-Backend Seam Mapping

### `/discover`

- Nexus owner: `lib/nexus/commands/discover.ts`
- backend seam: PM adapter
- expected Milestone 2 behavior:
  - invoke PM discovery capability through a Nexus adapter
  - normalize useful outputs into canonical Nexus artifacts
  - persist stage status under Nexus ownership
- canonical governed outputs remain Nexus-owned, such as:
  - `docs/product/idea-brief.md`
  - `.planning/current/discover/status.json`

### `/frame`

- Nexus owner: `lib/nexus/commands/frame.ts`
- backend seam: PM adapter
- expected Milestone 2 behavior:
  - invoke PM framing capability through a Nexus adapter
  - normalize framing outputs into canonical product documents and stage status
- canonical governed outputs remain Nexus-owned, such as:
  - `docs/product/decision-brief.md`
  - `docs/product/prd.md`
  - `.planning/current/frame/status.json`

### `/plan`

- Nexus owner: `lib/nexus/commands/plan.ts`
- backend seam: GSD adapter
- expected Milestone 2 behavior:
  - keep the existing Nexus planning contract and governed thin-slice artifacts
  - replace or enrich the Milestone 1 planning logic with GSD readiness method inputs
  - write normalized readiness decisions back into canonical plan artifacts and status
- canonical governed outputs remain Nexus-owned:
  - `.planning/current/plan/execution-readiness-packet.md`
  - `.planning/current/plan/sprint-contract.md`
  - `.planning/current/plan/status.json`

### `/handoff`

- Nexus owner: `lib/nexus/commands/handoff.ts`
- backend seam: CCB route-resolution adapter when Nexus needs transport-backed route validation
- expected Milestone 2 behavior:
  - keep Nexus as the owner of governed routing contract and handoff artifacts
  - consult CCB only when Nexus needs provider or route availability validation
  - record requested route separately from any actual route returned by transport
- canonical governed outputs remain Nexus-owned:
  - `.planning/current/handoff/governed-execution-routing.md`
  - `.planning/current/handoff/governed-handoff.md`
  - `.planning/current/handoff/status.json`

### `/build`

- Nexus owner: `lib/nexus/commands/build.ts`
- backend seams:
  - Superpowers execution-discipline adapter
  - CCB execution adapter
- expected Milestone 2 behavior:
  - enforce Superpowers-derived execution discipline without yielding lifecycle control
  - send generator execution through CCB where governed routing requires it
  - keep requested route and actual route separate
  - normalize accepted backend results into canonical build artifacts and stage status
- canonical governed outputs remain Nexus-owned:
  - `.planning/current/build/build-request.json`
  - `.planning/current/build/build-result.md`
  - `.planning/current/build/status.json`

### `/review`

- Nexus owner: `lib/nexus/commands/review.ts`
- Milestone 2 seam status:
  - Superpowers review discipline seam reserved
  - CCB audit transport seams reserved
- reserved seams stay present in code shape and inventory, but inactive in runtime registry

### `/ship`

- Nexus owner: `lib/nexus/commands/ship.ts`
- Milestone 2 seam status:
  - inventory records Superpowers or governance-adjacent ship candidates as reserved future seams
  - no backend seam is active in Milestone 2
- `/ship` remains unable to bypass Nexus review, audit, or closeout requirements

### `/closeout`

- Nexus owner: `lib/nexus/commands/closeout.ts`
- backend seam: GSD adapter
- expected Milestone 2 behavior:
  - preserve the conservative Nexus closeout gate from Milestone 1
  - inject GSD verification and closeout method inputs through a Nexus adapter
  - require artifact completeness, legal transitions, provenance consistency, and archive consistency before completion
- canonical governed outputs remain Nexus-owned:
  - `.planning/current/closeout/CLOSEOUT-RECORD.md`
  - `.planning/current/closeout/status.json`

## 3. Runtime Layer Model

Milestone 2 formalizes a five-layer runtime split.

### Host Wrapper Layer

The existing Gstack-hosted command wrappers remain the entry surface. Their job is to invoke Nexus and stop.

Host wrappers do not:

- own lifecycle rules
- own transition checks
- own artifact paths
- own alternate alias behavior

### Nexus Command Layer

The canonical Nexus command implementations in `lib/nexus/commands/` remain the only lifecycle and contract owners.

They are responsible for:

- validating predecessor artifacts
- loading ledger and stage status
- enforcing legal transitions
- invoking active adapters
- normalizing backend results
- writing canonical artifacts and status
- deciding blocked, refused, or completed outcomes

### Nexus Adapter Layer

Adapters translate Nexus requests into backend-specific calls and collect backend outputs. Adapter success does not imply lifecycle advancement.

Adapters may:

- transform inputs for PM Skills, GSD, Superpowers, or CCB
- return raw outputs
- return route data
- surface conflict candidates

Adapters may not:

- mark a stage complete
- set governed truth directly
- bypass normalization and writeback

### Transport and Collaboration Layer

CCB sits underneath Nexus adapters as provider-routing and multi-model transport infrastructure.

CCB is allowed to carry:

- requested route payloads
- actual execution route receipts
- collaboration results from external providers

CCB is not allowed to become:

- the governed state store
- the canonical provenance ledger
- the lifecycle source of truth

### Canonical Artifact Layer

Canonical repo-visible artifacts under `.planning/` and `docs/` remain the only governed truth.

Normalization and writeback is the only path from adapter output into governed lifecycle state.

Traceability records such as `adapter-output.json` and `normalization.json` are useful, but they are not lifecycle truth by themselves.

## 4. Adapter and Runtime Interfaces

Milestone 2 adds an adapter runtime under `lib/nexus/adapters/`.

Planned code layout:

- `lib/nexus/adapters/types.ts`
- `lib/nexus/adapters/registry.ts`
- `lib/nexus/adapters/pm.ts`
- `lib/nexus/adapters/gsd.ts`
- `lib/nexus/adapters/superpowers.ts`
- `lib/nexus/adapters/ccb.ts`
- `lib/nexus/normalizers/index.ts`
- `lib/nexus/normalizers/pm.ts`
- `lib/nexus/normalizers/gsd.ts`
- `lib/nexus/normalizers/superpowers.ts`
- `lib/nexus/normalizers/ccb.ts`
- `lib/nexus/conflicts.ts`

### Common Adapter Context

```ts
interface NexusAdapterContext {
  cwd: string;
  run_id: string;
  command: CanonicalCommandId;
  stage: CanonicalCommandId;
  ledger: RunLedger;
  manifest: CommandContract;
  predecessor_artifacts: ArtifactPointer[];
  requested_route: RequestedRouteRecord | null;
}
```

This context is built by Nexus from canonical repo-visible state. Adapters do not source their own lifecycle context.

### Common Adapter Result

```ts
interface AdapterResult<TRaw> {
  adapter_id: string;
  outcome: "success" | "blocked" | "refused" | "error";
  raw_output: TRaw;
  requested_route: RequestedRouteRecord | null;
  actual_route: ActualRouteRecord | null;
  notices: string[];
  conflict_candidates: ConflictCandidate[];
}
```

An adapter result provides traceability and candidate signals. It does not complete the stage on its own.

### Normalization Contract

```ts
interface NormalizationPlan {
  stage_artifacts: ArtifactWrite[];
  status_patch: Partial<StageStatus>;
  ledger_patch?: Partial<RunLedger>;
  conflict_records: ConflictRecord[];
}
```

Only Nexus normalizers may turn adapter results into:

- canonical markdown artifacts
- canonical status fields
- ledger updates
- repo-visible conflict records

`normalization.json` is a mapping and provenance record only. It is not an independent source of truth.

### PM Adapter Interface

```ts
interface PmAdapter {
  discover(ctx: NexusAdapterContext): Promise<AdapterResult<PmDiscoverRaw>>;
  frame(ctx: NexusAdapterContext): Promise<AdapterResult<PmFrameRaw>>;
}
```

### GSD Adapter Interface

```ts
interface GsdAdapter {
  plan(ctx: NexusAdapterContext): Promise<AdapterResult<GsdPlanRaw>>;
  closeout(ctx: NexusAdapterContext): Promise<AdapterResult<GsdCloseoutRaw>>;
}
```

### Superpowers Adapter Interface

```ts
interface SuperpowersAdapter {
  build_discipline(
    ctx: NexusAdapterContext
  ): Promise<AdapterResult<SuperpowersBuildRaw>>;
  review_discipline?(
    ctx: NexusAdapterContext
  ): Promise<AdapterResult<unknown>>;
  ship_discipline?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}
```

Only `build_discipline` is active in Milestone 2. `review_discipline` and `ship_discipline` stay reserved and inactive.

### CCB Adapter Interface

```ts
interface CcbAdapter {
  resolve_route(ctx: NexusAdapterContext): Promise<AdapterResult<CcbRouteRaw>>;
  execute_generator(
    ctx: NexusAdapterContext
  ): Promise<AdapterResult<CcbExecutionRaw>>;
  execute_audit_a?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_b?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}
```

Milestone 2 only activates route resolution and build-time generator execution. Audit seams remain reserved and inactive.

### Runtime Activation Authority

Runtime activation lives in `lib/nexus/adapters/registry.ts`.

Suggested shape:

```ts
type AdapterActivationState = "inactive" | "reserved_future" | "active";

interface CommandAdapterBinding {
  command: CanonicalCommandId;
  pm?: AdapterActivationState;
  gsd?: AdapterActivationState;
  superpowers?: AdapterActivationState;
  ccb?: AdapterActivationState;
}
```

The registry determines what may execute in Milestone 2. Inventory markdown records intent and mapping, but it is never executable authority.

## 5. Artifact Additions and Writeback Rules

Milestone 2 adds minimal adapter traceability artifacts under `.planning/current/` while preserving existing canonical governed artifacts.

### Canonical Truth Artifacts

The source of truth remains:

- `.planning/nexus/current-run.json`
- `.planning/current/<stage>/status.json`
- canonical stage markdown or JSON artifacts already owned by Nexus

### New Traceability Artifacts

For any stage with an active adapter seam, Milestone 2 writes:

- `.planning/current/<stage>/adapter-request.json`
- `.planning/current/<stage>/adapter-output.json`
- `.planning/current/<stage>/normalization.json`

For conflict handling, Milestone 2 adds:

- `.planning/current/conflicts/<stage>-<adapter>.json`
- `.planning/current/conflicts/<stage>-<adapter>.md`

### Artifact Semantics

`adapter-request.json`

- Nexus-owned request prepared for a backend seam
- includes requested route data when the seam uses routed execution
- not lifecycle truth by itself

`adapter-output.json`

- repo-visible traceability for raw or lightly wrapped backend output
- includes actual route data when transport returns it
- not lifecycle truth

`normalization.json`

- repo-visible mapping from backend output into canonical artifacts, status fields, or conflict records
- provenance aid only
- not an independent source of truth

`status.json`

- canonical structured stage truth
- the only structured source used for readiness, completion, blocking, or refusal decisions

### Build Reuse Rule

For `/build`, Nexus reuses the existing canonical request artifact:

- `.planning/current/build/build-request.json`

Milestone 2 must not introduce a second truth-carrying build request file. If additional backend request tracing is needed, it must remain explicitly trace-only and subordinate to the canonical build request.

### Requested Route vs Actual Route

Where CCB is involved, requested route and actual route must remain separate in:

- the canonical build request
- `adapter-output.json`
- `normalization.json`
- conflict artifacts
- normalized status or provenance records where applicable

Requested route expresses what Nexus asked for. Actual route expresses what transport or provider execution actually returned.

### Conflict Rule

Any mismatch involving:

- requested route vs actual route
- backend readiness vs Nexus artifact state
- backend completion vs illegal transition state
- transport receipts vs canonical provenance records

must produce repo-visible conflict artifacts and a blocked or refused stage outcome until Nexus resolves the inconsistency through explicit writeback rules.

## 6. Inventory Structure

Milestone 2 adds repo-visible integration inventories under `upstream-notes/`.

Planned files:

- `upstream-notes/pm-skills-inventory.md`
- `upstream-notes/gsd-inventory.md`
- `upstream-notes/superpowers-inventory.md`
- `upstream-notes/ccb-inventory.md`
- `upstream-notes/gstack-host-migration-inventory.md`

### Common Mandatory Fields

Every inventory item must include:

- `inventory_id`
- `source_system`
- `source_path_or_ref`
- `capability_or_structure`
- `summary`
- `classification`
- `milestone_state`
- `canonical_nexus_commands`
- `nexus_adapter_seams`
- `governed_artifact_boundaries`
- `normalization_required`
- `conflict_policy`
- `conflict_artifact_paths`
- `notes`

These fields are mandatory across all inventories.

### Classification Model

Allowed `classification` values:

- `adopt`
- `adapt`
- `defer`
- `reject`

Milestone 2 should treat `adapt` as the expected default for real integration work.

- `adopt`: reuse mostly as-is behind a Nexus adapter
- `adapt`: reshape interfaces, sequencing, or outputs to fit Nexus contracts
- `defer`: explicitly inventoried but non-active in Milestone 2
- `reject`: intentionally not integrated because it conflicts with Nexus ownership or governed state rules

Any item that cannot link to a canonical Nexus command, a Nexus adapter seam, or a governed artifact boundary must remain non-active as `defer` or `reject`.

### Milestone State Model

Allowed `milestone_state` values:

- `identified`
- `mapped`
- `integrating`
- `verified`
- `blocked`

State meanings:

- `identified`
  - the item is inventoried but has no active runtime binding
- `mapped`
  - the item has valid links to commands, seams, or artifact boundaries
  - mapping alone does not activate runtime behavior
- `integrating`
  - adapter code or runtime wiring exists
  - backend outputs are captured into traceability artifacts when the seam is exercised
  - lifecycle truth still depends on normalization and canonical writeback
- `verified`
  - tests prove the seam behaves correctly under Nexus governance
  - backend-native output is still not trusted directly
- `blocked`
  - the item cannot safely progress due to unresolved contract, artifact, or conflict issues

### Per-Inventory Extensions

`upstream-notes/pm-skills-inventory.md`

- `pm_function`
- `target_stage`
- `target_docs`
- `open_questions_to_normalize`

`upstream-notes/gsd-inventory.md`

- `gsd_method`
- `target_stage`
- `readiness_or_closeout_checks`
- `nexus_status_fields_affected`

`upstream-notes/superpowers-inventory.md`

- `discipline_type`
- `target_stage`
- `enforcement_mode`
- `activation_state`

`upstream-notes/ccb-inventory.md`

- `transport_operation`
- `requested_route_artifact`
- `actual_route_artifact`
- `provider_paths`
- `activation_state`

`upstream-notes/gstack-host-migration-inventory.md`

- `host_structure`
- `current_host_role`
- `truth_risk`
- `host_disposition`
- `cleanup_phase`

### Activation and Cleanup Rules

- Inventory markdown is identification and mapping only.
- Inventory entries do not activate code paths.
- `upstream-notes/gstack-host-migration-inventory.md` is identification-only in Milestone 2.
- Inventorying a host structure does not authorize cleanup, migration, or host-state truth.
- Reserved future seams for `/review` and `/ship` must still appear in inventory, but remain non-active with:
  - `classification = defer`
  - `activation_state = reserved_future`

## 7. Inventory-to-Runtime Progression

Milestone 2 uses a strict progression from inventory to active governed seam:

1. `identified`
   - item exists only as repo-visible inventory
   - no runtime binding
2. `mapped`
   - item is tied to a canonical command, adapter seam, or governed artifact boundary
   - still non-active unless registry enables it
3. `integrating`
   - adapter and normalization code are present
   - runtime captures backend outputs into traceability artifacts when the seam is exercised
   - lifecycle truth still cannot advance without canonical writeback
4. `verified`
   - tests prove adapter behavior, normalization behavior, conflict handling, and blocked or refused outcomes under Nexus governance

At every stage of this progression:

- backend output alone is insufficient for lifecycle advancement
- adapter success alone is insufficient for lifecycle advancement
- only canonical Nexus writeback can change governed truth

## 8. Milestone 2 Completion Criteria

Milestone 2 is complete when:

- the canonical Nexus command surface remains unchanged
- PM adapter seams exist behind `/discover` and `/frame`
- GSD adapter seams exist behind `/plan` and `/closeout`
- Superpowers execution-discipline seam exists behind `/build`
- CCB route-resolution and build execution seams are available as transport-only infrastructure
- `lib/nexus/adapters/registry.ts` controls seam activation
- new adapter traceability artifacts exist without becoming lifecycle truth
- requested route and actual route remain distinct in runtime records where CCB is involved
- conflict artifacts are first-class repo-visible records
- upstream inventories exist for PM Skills, GSD, Superpowers, CCB, and inherited Gstack host structures
- reserved future seams for `/review` and `/ship` are inventoried and represented in code shape, but remain inactive
- inherited Gstack-native structures are identified for later migration or removal without starting a broad cleanup pass
