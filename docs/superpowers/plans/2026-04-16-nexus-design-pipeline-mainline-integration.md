# Nexus Design Pipeline Mainline Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate design-bearing work into the canonical Nexus lifecycle by adding conditional design gates, explicit design artifacts, and governed visual verification without adding new lifecycle stages.

**Architecture:** Keep the canonical lifecycle unchanged and make design a first-class contract inside it. `/frame` classifies design impact, `/plan` produces or requires a design contract for `material` work, `/build` and `/review` consume that contract as part of governed execution, and `/qa` plus `/ship` enforce visual verification for design-bearing runs. Existing design skills remain support surfaces, but their outputs are absorbed into canonical lifecycle artifacts instead of floating as parallel truth.

**Tech Stack:** Bun, TypeScript modules in `lib/nexus/`, stage-content absorption packs, JSON/Markdown lifecycle artifacts under `.planning/`, generated skill docs, Nexus tests under `test/nexus/`

---

## File Structure

- Modify: `lib/nexus/types.ts`
  - Add design impact and verification types to the canonical lifecycle schema.
- Modify: `lib/nexus/artifacts.ts`
  - Add canonical design artifact path helpers for frame, plan, and QA.
- Modify: `lib/nexus/command-manifest.ts`
  - Make design artifacts part of the documented stage contracts.
- Modify: `lib/nexus/adapters/pm.ts`
  - Extend `PmFrameRaw` so frame can emit canonical design intent data.
- Modify: `lib/nexus/adapters/gsd.ts`
  - Extend `GsdPlanRaw` so plan can emit canonical design contract data and readiness semantics.
- Modify: `lib/nexus/normalizers/pm.ts`
  - Normalize frame design intent into canonical artifacts.
- Modify: `lib/nexus/normalizers/gsd.ts`
  - Normalize plan design contract into canonical artifacts.
- Modify: `lib/nexus/commands/frame.ts`
  - Persist `design_impact` and frame-owned design intent into stage status and ledger-facing outputs.
- Modify: `lib/nexus/commands/plan.ts`
  - Enforce `material` design readiness, write `design-contract.md`, and block plan readiness when required design contract is missing.
- Modify: `lib/nexus/commands/handoff.ts`
  - Include design contract inputs in governed handoff when design-bearing work is present.
- Modify: `lib/nexus/commands/build.ts`
  - Treat design contract as part of the bounded build contract.
- Modify: `lib/nexus/commands/review.ts`
  - Limit design review behavior to contract presence and obvious violations.
- Modify: `lib/nexus/commands/qa.ts`
  - Record canonical design verification artifacts and status fields for design-bearing runs.
- Modify: `lib/nexus/commands/ship.ts`
  - Refuse readiness when required design verification is missing.
- Modify: `lib/nexus/adapters/prompt-contracts.ts`
  - Update build/review prompt contracts so design-bearing work uses explicit lifecycle rules instead of free-form design interpretation.
- Modify: `lib/nexus/stage-content/frame/artifact-contract.md`
  - Document frame-owned design intent artifact.
- Modify: `lib/nexus/stage-content/plan/artifact-contract.md`
  - Document plan-owned design contract artifact.
- Modify: `lib/nexus/stage-content/build/artifact-contract.md`
  - Document build consumption of design contract inputs.
- Modify: `lib/nexus/stage-content/review/artifact-contract.md`
  - Document review’s limited design-contract role.
- Modify: `lib/nexus/stage-content/qa/artifact-contract.md`
  - Document QA-owned design verification artifact.
- Modify: `lib/nexus/stage-content/ship/artifact-contract.md`
  - Document ship readiness dependence on design verification for design-bearing runs.
- Modify: `README.md`
  - Explain how design integrates into the mainline lifecycle.
- Modify: `docs/skills.md`
  - Clarify that design skills feed canonical lifecycle artifacts for UI-bearing runs.
- Modify: `test/nexus/types.test.ts`
  - Lock new design types and status fields.
- Modify: `test/nexus/discover-frame.test.ts`
  - Lock frame design classification and plan design readiness behavior.
- Modify: `test/nexus/build-routing.test.ts`
  - Lock handoff/build predecessor artifacts and prompt contract propagation.
- Modify: `test/nexus/review.test.ts`
  - Lock bounded design review semantics.
- Modify: `test/nexus/qa.test.ts`
  - Lock design verification recording.
- Modify: `test/nexus/ship.test.ts`
  - Lock ship refusal when required design verification is missing.
- Modify: `test/nexus/product-surface.test.ts`
  - Lock user-facing documentation of design-mainline integration.

## Task 1: Freeze the design lifecycle schema and artifact surface

**Files:**
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `test/nexus/types.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests that prove the lifecycle can express design-bearing work:

```ts
expect(DESIGN_IMPACTS).toEqual(['none', 'touchup', 'material']);

const status: StageStatus = {
  run_id: 'run-1',
  stage: 'plan',
  state: 'completed',
  decision: 'ready',
  ready: true,
  inputs: [],
  outputs: [],
  started_at: '2026-04-16T00:00:00.000Z',
  completed_at: '2026-04-16T00:00:00.000Z',
  errors: [],
  design_impact: 'material',
  design_contract_required: true,
  design_contract_path: '.planning/current/plan/design-contract.md',
  design_verified: false,
};

expect(status.design_impact).toBe('material');
```

- [ ] **Step 2: Add the new canonical types**

Extend `lib/nexus/types.ts` with:

```ts
export const DESIGN_IMPACTS = ['none', 'touchup', 'material'] as const;
export type DesignImpact = (typeof DESIGN_IMPACTS)[number];

export interface DesignIntentRecord {
  impact: DesignImpact;
  affected_surfaces: string[];
  design_system_source: 'none' | 'design_md' | 'support_skill' | 'mixed';
  contract_required: boolean;
  verification_required: boolean;
}
```

And extend `StageStatus` with:

```ts
design_impact?: DesignImpact;
design_contract_required?: boolean;
design_contract_path?: string | null;
design_verified?: boolean | null;
```

- [ ] **Step 3: Add canonical artifact helpers**

Extend `lib/nexus/artifacts.ts` with:

```ts
export function frameDesignIntentPath(): string {
  return `${CURRENT_ROOT}/frame/design-intent.json`;
}

export function planDesignContractPath(): string {
  return `${CURRENT_ROOT}/plan/design-contract.md`;
}

export function qaDesignVerificationPath(): string {
  return `${CURRENT_ROOT}/qa/design-verification.md`;
}
```

- [ ] **Step 4: Update the manifest surface**

Update `lib/nexus/command-manifest.ts` so durable outputs include:

```ts
frame: [
  'docs/product/decision-brief.md',
  'docs/product/prd.md',
  '.planning/current/frame/design-intent.json',
  '.planning/current/frame/status.json',
]

plan: [
  '.planning/current/plan/execution-readiness-packet.md',
  '.planning/current/plan/sprint-contract.md',
  '.planning/current/plan/design-contract.md',
  '.planning/current/plan/status.json',
]

qa: [
  '.planning/current/qa/qa-report.md',
  '.planning/current/qa/design-verification.md',
  '.planning/current/qa/status.json',
]
```

- [ ] **Step 5: Verify the schema task**

Run:

```bash
bun test test/nexus/types.test.ts
```

Expected:
- PASS with design lifecycle schema and canonical artifact helpers locked

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/types.ts lib/nexus/artifacts.ts lib/nexus/command-manifest.ts test/nexus/types.test.ts
git commit -m "feat: add design lifecycle contract schema"
```

## Task 2: Make `/frame` classify design impact and write canonical design intent

**Files:**
- Modify: `lib/nexus/adapters/pm.ts`
- Modify: `lib/nexus/normalizers/pm.ts`
- Modify: `lib/nexus/commands/frame.ts`
- Modify: `lib/nexus/stage-content/frame/artifact-contract.md`
- Modify: `test/nexus/discover-frame.test.ts`

- [ ] **Step 1: Write failing frame tests**

Add tests that prove frame writes design intent:

```ts
test('frame writes design intent artifact for material UI work', async () => {
  // run discover -> frame
  // expect .planning/current/frame/design-intent.json
  // expect status.design_impact === 'material'
  // expect status.design_contract_required === true
});

test('frame defaults legacy non-UI work to design_impact none', async () => {
  // seed standard PM frame output without explicit design clues
  // expect design_impact === 'none'
});
```

- [ ] **Step 2: Extend PM frame raw output**

Update `PmFrameRaw` in `lib/nexus/adapters/pm.ts`:

```ts
export interface PmFrameRaw {
  decision_brief_markdown: string;
  prd_markdown: string;
  design_intent: DesignIntentRecord;
}
```

Default adapter behavior should be conservative:

```ts
design_intent: {
  impact: 'none',
  affected_surfaces: [],
  design_system_source: 'none',
  contract_required: false,
  verification_required: false,
}
```

- [ ] **Step 3: Normalize frame design intent**

Extend `normalizePmFrame()` so it writes:

```ts
{
  path: '.planning/current/frame/design-intent.json',
  content: JSON.stringify(result.raw_output.design_intent, null, 2) + '\n',
}
```

- [ ] **Step 4: Persist design intent into frame status**

Update `runFrame()` so completed status carries:

```ts
design_impact: result.raw_output.design_intent.impact,
design_contract_required: result.raw_output.design_intent.contract_required,
design_verified: result.raw_output.design_intent.impact === 'none' ? null : false,
```

And make `artifact_index` include:

```ts
'.planning/current/frame/design-intent.json': artifactPointerFor('.planning/current/frame/design-intent.json')
```

- [ ] **Step 5: Update the frame artifact contract**

Change `lib/nexus/stage-content/frame/artifact-contract.md` to say:

```md
Writes `docs/product/decision-brief.md`, `docs/product/prd.md`,
`.planning/current/frame/design-intent.json`, and `.planning/current/frame/status.json`.
```

- [ ] **Step 6: Verify the frame task**

Run:

```bash
bun test test/nexus/discover-frame.test.ts
```

Expected:
- PASS
- frame writes canonical design intent artifact and status fields

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/adapters/pm.ts lib/nexus/normalizers/pm.ts lib/nexus/commands/frame.ts lib/nexus/stage-content/frame/artifact-contract.md test/nexus/discover-frame.test.ts
git commit -m "feat: classify design impact during framing"
```

## Task 3: Make `/plan` the readiness gate for material design work

**Files:**
- Modify: `lib/nexus/adapters/gsd.ts`
- Modify: `lib/nexus/normalizers/gsd.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/stage-content/plan/artifact-contract.md`
- Modify: `test/nexus/discover-frame.test.ts`

- [ ] **Step 1: Write failing plan tests**

Add tests for the two key paths:

```ts
test('plan blocks material design work without a design contract', async () => {
  // seed frame status with design_impact=material
  // plan result missing design_contract
  // expect plan status.ready === false
  // expect status.errors to mention missing design contract
});

test('plan records design contract for material design work', async () => {
  // seed material frame status
  // plan emits design contract
  // expect .planning/current/plan/design-contract.md
  // expect status.design_contract_path populated
});
```

- [ ] **Step 2: Extend GSD plan raw output**

Update `GsdPlanRaw`:

```ts
export interface GsdPlanRaw {
  execution_readiness_packet: string;
  sprint_contract: string;
  design_contract: string | null;
  ready: boolean;
}
```

Default adapter behavior should be:

```ts
design_contract: null,
```

until the stage pack learns to emit a real contract.

- [ ] **Step 3: Normalize the design contract artifact**

Extend `normalizeGsdPlan()` so:

```ts
if (result.raw_output.design_contract?.trim()) {
  canonicalWrites.push({
    path: '.planning/current/plan/design-contract.md',
    content: result.raw_output.design_contract,
  });
}
```

- [ ] **Step 4: Gate readiness on frame design intent**

Update `runPlan()` to read frame status and frame design intent. Enforce:

```ts
const isMaterial = frameStatus?.design_impact === 'material';
const hasDesignContract = Boolean(result.raw_output.design_contract?.trim());

if (isMaterial && !hasDesignContract) {
  status.state = 'blocked';
  status.decision = 'not_ready';
  status.ready = false;
  status.errors = ['Material design work requires .planning/current/plan/design-contract.md'];
}
```

Also populate:

```ts
status.design_impact = frameStatus?.design_impact ?? 'none';
status.design_contract_required = isMaterial;
status.design_contract_path = hasDesignContract ? '.planning/current/plan/design-contract.md' : null;
status.design_verified = frameStatus?.design_impact === 'none' ? null : false;
```

- [ ] **Step 5: Update the plan artifact contract**

Change `lib/nexus/stage-content/plan/artifact-contract.md` to include:

```md
Writes `.planning/current/plan/execution-readiness-packet.md`,
`.planning/current/plan/sprint-contract.md`,
`.planning/current/plan/design-contract.md`, and
`.planning/current/plan/status.json`.
```

- [ ] **Step 6: Verify the plan task**

Run:

```bash
bun test test/nexus/discover-frame.test.ts
```

Expected:
- PASS
- material runs without design contract are `not_ready`
- material runs with a design contract record the canonical artifact

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/adapters/gsd.ts lib/nexus/normalizers/gsd.ts lib/nexus/commands/plan.ts lib/nexus/stage-content/plan/artifact-contract.md test/nexus/discover-frame.test.ts
git commit -m "feat: gate material design work at plan"
```

## Task 4: Thread the design contract through governed handoff, build, and review

**Files:**
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/adapters/prompt-contracts.ts`
- Modify: `lib/nexus/stage-content/build/artifact-contract.md`
- Modify: `lib/nexus/stage-content/review/artifact-contract.md`
- Modify: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/review.test.ts`

- [ ] **Step 1: Write failing governed-stage tests**

Add tests that prove:

```ts
test('handoff includes plan design contract in predecessor artifacts when present', async () => {
  // expect handoff/build predecessor artifacts to include design-contract.md
});

test('build prompt treats design contract as part of the bounded implementation contract', async () => {
  // expect prompt text to mention design-bearing work and required constraints
});

test('review blocks material runs that lack required design contract provenance', async () => {
  // expect blocked or fail depending on contract presence semantics
});
```

- [ ] **Step 2: Add design contract to predecessor artifact sets**

Update handoff/build/review path selection to include:

```ts
const designContractPath = '.planning/current/plan/design-contract.md';
if (existsSync(join(ctx.cwd, designContractPath))) {
  predecessorArtifacts.push(artifactPointerFor(designContractPath));
}
```

- [ ] **Step 3: Tighten build prompt contract**

In `lib/nexus/adapters/prompt-contracts.ts`, add explicit bounded language for design-bearing runs:

```ts
if (status.design_impact === 'material' && status.design_contract_path) {
  lines.push('This run is design-bearing.');
  lines.push(`Approved design contract: ${status.design_contract_path}`);
  lines.push('Treat the design contract as part of the bounded implementation contract, not optional reference material.');
}
```

- [ ] **Step 4: Tighten review semantics**

In `runReview()`, enforce:

```ts
if (planStatus?.design_impact === 'material' && !planStatus.design_contract_path) {
  throw new Error('Material design run cannot be reviewed without design contract provenance');
}
```

And keep review scope narrow:

```ts
// advisories may note visual concerns
// fail only on contract absence or clear divergence from explicit constraints
```

- [ ] **Step 5: Update stage artifact contracts**

Update:

`lib/nexus/stage-content/build/artifact-contract.md`

```md
Consumes `.planning/current/plan/design-contract.md` when the run is design-bearing.
```

`lib/nexus/stage-content/review/artifact-contract.md`

```md
Checks required design contract presence and obvious implementation divergence for design-bearing runs.
```

- [ ] **Step 6: Verify governed design propagation**

Run:

```bash
bun test test/nexus/build-routing.test.ts test/nexus/review.test.ts
```

Expected:
- PASS
- handoff/build/review consume the same design contract
- review remains bounded instead of turning into open-ended design critique

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/commands/handoff.ts lib/nexus/commands/build.ts lib/nexus/commands/review.ts lib/nexus/adapters/prompt-contracts.ts lib/nexus/stage-content/build/artifact-contract.md lib/nexus/stage-content/review/artifact-contract.md test/nexus/build-routing.test.ts test/nexus/review.test.ts
git commit -m "feat: thread design contract through governed execution"
```

## Task 5: Record design verification in QA and gate ship readiness on it

**Files:**
- Modify: `lib/nexus/commands/qa.ts`
- Modify: `lib/nexus/commands/ship.ts`
- Modify: `lib/nexus/stage-content/qa/artifact-contract.md`
- Modify: `lib/nexus/stage-content/ship/artifact-contract.md`
- Modify: `test/nexus/qa.test.ts`
- Modify: `test/nexus/ship.test.ts`

- [ ] **Step 1: Write failing QA and ship tests**

Add tests:

```ts
test('qa writes design verification for touchup runs', async () => {
  // expect .planning/current/qa/design-verification.md
  // expect status.design_verified === true when ready
});

test('ship blocks design-bearing runs without design verification', async () => {
  // expect ship throws or records blocked status if plan/review indicate design-bearing work
});
```

- [ ] **Step 2: Write canonical QA design verification**

Update `runQa()` to write:

```ts
const designVerificationPath = '.planning/current/qa/design-verification.md';
const designBearing = reviewStatus.design_impact && reviewStatus.design_impact !== 'none';

const designVerification = designBearing
  ? [
      '# Design Verification',
      '',
      `- Design impact: ${reviewStatus.design_impact}`,
      `- Design contract: ${reviewStatus.design_contract_path ?? 'none'}`,
      `- Result: ${ready ? 'verified' : 'not verified'}`,
    ].join('\n')
  : null;
```

Only write the artifact when `designBearing` is true.

- [ ] **Step 3: Persist QA design verification status**

Extend QA status with:

```ts
design_impact: reviewStatus.design_impact ?? 'none',
design_contract_path: reviewStatus.design_contract_path ?? null,
design_verified: designBearing ? ready : null,
```

- [ ] **Step 4: Enforce ship readiness**

Update `runShip()`:

```ts
const designBearing = (qaStatus?.design_impact ?? reviewStatus.design_impact) !== 'none';
const designVerified = qaStatus?.design_verified ?? null;

if (designBearing && designVerified !== true) {
  throw new Error('Design-bearing runs require QA design verification before ship');
}
```

And extend ship checklist payload expectations so design verification is visible in release-gate reporting.

- [ ] **Step 5: Update QA and ship artifact contracts**

Update `lib/nexus/stage-content/qa/artifact-contract.md`:

```md
Writes `.planning/current/qa/qa-report.md`,
`.planning/current/qa/design-verification.md`, and
`.planning/current/qa/status.json`.
```

Update `lib/nexus/stage-content/ship/artifact-contract.md`:

```md
Requires design verification for design-bearing runs before recording ready ship state.
```

- [ ] **Step 6: Verify design verification gating**

Run:

```bash
bun test test/nexus/qa.test.ts test/nexus/ship.test.ts
```

Expected:
- PASS
- QA records design verification for design-bearing work
- ship refuses readiness when required design verification is missing

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/commands/qa.ts lib/nexus/commands/ship.ts lib/nexus/stage-content/qa/artifact-contract.md lib/nexus/stage-content/ship/artifact-contract.md test/nexus/qa.test.ts test/nexus/ship.test.ts
git commit -m "feat: require design verification for design-bearing ship readiness"
```

## Task 6: Align product docs and regression surface

**Files:**
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Write failing surface tests**

Add assertions that the docs now describe:

```ts
expect(readme).toContain('`/frame` classifies design impact');
expect(readme).toContain('`/plan` requires a design contract for material UI work');
expect(skillsDoc).toContain('design verification');
```

- [ ] **Step 2: Update user-facing lifecycle docs**

In `README.md`, add a short section under the canonical lifecycle or support surface:

```md
For design-bearing runs, `/frame` classifies design impact, `/plan` records the
design contract for material UI work, and `/qa` records visual verification
before `/ship`.
```

In `docs/skills.md`, update the design command descriptions to say they feed
canonical lifecycle artifacts for UI-bearing runs.

- [ ] **Step 3: Verify the documentation task**

Run:

```bash
bun test test/nexus/product-surface.test.ts
```

Expected:
- PASS
- docs explain the new design-mainline lifecycle semantics

- [ ] **Step 4: Final verification**

Run:

```bash
bun test test/nexus/*.test.ts
git diff --check
```

Expected:
- all Nexus tests pass
- diff check is clean

- [ ] **Step 5: Commit**

```bash
git add README.md docs/skills.md test/nexus/product-surface.test.ts
git commit -m "docs: describe design pipeline lifecycle integration"
```

## Self-Review

### Spec coverage

- design impact classification: Task 1 and Task 2
- material design gate at `/plan`: Task 3
- governed design contract consumption: Task 4
- visual verification in `/qa`: Task 5
- ship readiness on design verification: Task 5
- product-facing documentation: Task 6

No spec requirement is left without a corresponding task.

### Placeholder scan

- no `TBD`, `TODO`, or “implement later” placeholders remain
- every task includes explicit files, commands, and expected outcomes
- every gating behavior is named concretely

### Type consistency

The plan consistently uses:

- `design_impact`
- `design_contract_required`
- `design_contract_path`
- `design_verified`

No alternate field names are introduced later in the plan.
