# Nexus Integration Seams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PM Skills, GSD, Superpowers, and CCB integration seams behind the existing Nexus command surface while keeping Nexus as the only governed contract owner and repo-visible source of truth.

**Architecture:** Execute Milestone 2 on top of the existing Milestone 1 Nexus runtime branch, not on `main`. Extend `lib/nexus/` with adapter, normalization, conflict, and inventory layers so backend outputs become governed truth only after Nexus writes canonical artifacts and `status.json` files.

**Tech Stack:** Bun, TypeScript, Bun test, existing `bin/nexus.ts` command runtime, repo-visible `.planning/` artifacts, markdown inventories under `upstream-notes/`

---

## Execution Base

Current `main` only contains the Milestone 1 design docs. The implementation work in this plan must start from the existing Milestone 1 runtime branch:

- branch: `codex/nexus-command-surface`
- known baseline commits on that branch:
  - `859f083` `chore: rebaseline docs and tests for nexus command surface`
  - `da3213e` `feat: implement nexus closeout archive and consistency checks`

Do not start Milestone 2 tasks from `main`. Create the Milestone 2 worktree from `codex/nexus-command-surface` first.

## Locked Rules

- `status.json` and canonical stage artifacts are authoritative by definition.
- `adapter-output.json`, `normalization.json`, and backend-native output are traceability records only.
- If traceability artifacts disagree with canonical artifacts, canonical artifacts win unless Nexus explicitly rewrites them.
- If normalization logic finishes but canonical writeback partially fails, the stage must end `blocked`, emit conflict artifacts, and avoid any ready/completed lifecycle advancement.
- `/handoff` may use CCB for route availability checks, but transport availability is not route approval. Nexus must separately approve the route before the handoff stage can be `ready`.
- Reserved `/review` and `/ship` seams stay present in code shape but `reserved_future` in the runtime registry.

## Locked Route And Provenance Field Names

Use these exact field names everywhere in Milestone 2.

### Requested Route

```ts
export interface RequestedRouteRecord {
  command: CanonicalCommandId;
  governed: boolean;
  planner: string | null;
  generator: string | null;
  evaluator_a: string | null;
  evaluator_b: string | null;
  synthesizer: string | null;
  substrate: string | null;
  fallback_policy: 'disabled';
}
```

### Actual Route

```ts
export interface ActualRouteRecord {
  provider: string | null;
  route: string | null;
  substrate: string | null;
  transport: 'ccb' | null;
  receipt_path: string | null;
}
```

### Route Validation

```ts
export interface RouteValidationRecord {
  transport: 'ccb' | 'none';
  available: boolean;
  approved: boolean;
  reason: string;
}
```

### Implementation Provenance

```ts
export interface ImplementationProvenanceRecord {
  path: string;
  requested_route: RequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
}
```

### Destination Files

- `.planning/current/handoff/status.json`
  - `requested_route`
  - `route_validation`
- `.planning/current/build/build-request.json`
  - `requested_route`
- `.planning/current/build/status.json`
  - `requested_route`
  - `actual_route`
- `.planning/current/review/status.json`
  - `review_complete`
  - `audit_set_complete`
  - `provenance_consistent`
  - `gate_decision`
- `.planning/audits/current/meta.json`
  - `implementation.path`
  - `implementation.requested_route`
  - `implementation.actual_route`

## File Structure

### Existing Baseline Files To Modify

- `bin/nexus.ts`
- `lib/nexus/types.ts`
- `lib/nexus/artifacts.ts`
- `lib/nexus/command-manifest.ts`
- `lib/nexus/ledger.ts`
- `lib/nexus/status.ts`
- `lib/nexus/transitions.ts`
- `lib/nexus/governance.ts`
- `lib/nexus/commands/index.ts`
- `lib/nexus/commands/discover.ts`
- `lib/nexus/commands/frame.ts`
- `lib/nexus/commands/plan.ts`
- `lib/nexus/commands/handoff.ts`
- `lib/nexus/commands/build.ts`
- `lib/nexus/commands/review.ts`
- `lib/nexus/commands/closeout.ts`
- `test/nexus/helpers/temp-repo.ts`
- `test/nexus/types.test.ts`
- `test/nexus/plan-handoff-build.test.ts`
- `test/nexus/review.test.ts`
- `test/nexus/closeout.test.ts`
- `test/nexus/alias-safety.test.ts`

### New Runtime Files

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

### New Test Files

- `test/nexus/helpers/fake-adapters.ts`
- `test/nexus/status-precedence.test.ts`
- `test/nexus/adapter-registry.test.ts`
- `test/nexus/discover-frame.test.ts`
- `test/nexus/build-routing.test.ts`
- `test/nexus/build-discipline.test.ts`
- `test/nexus/inventory.test.ts`

### New Inventory Files

- `upstream-notes/pm-skills-inventory.md`
- `upstream-notes/gsd-inventory.md`
- `upstream-notes/superpowers-inventory.md`
- `upstream-notes/ccb-inventory.md`
- `upstream-notes/gstack-host-migration-inventory.md`

## Task 1: Freeze Shared Nexus Types, Artifact Paths, And Review Status Ownership

**Files:**
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/artifacts.ts`
- Modify: `test/nexus/types.test.ts`
- Create: `test/nexus/status-precedence.test.ts`
- Modify: `test/nexus/review.test.ts`

- [ ] **Step 1: Extend the failing type tests with the locked route/provenance fields**

```ts
import { describe, expect, test } from 'bun:test';
import {
  RUN_STATUSES,
  type RequestedRouteRecord,
  type ActualRouteRecord,
  type RouteValidationRecord,
  type ImplementationProvenanceRecord,
} from '../../lib/nexus/types';

describe('nexus route and provenance types', () => {
  test('freezes the Milestone 2 requested route shape', () => {
    const requested: RequestedRouteRecord = {
      command: 'build',
      governed: true,
      planner: 'claude+pm-gsd',
      generator: 'codex-via-ccb',
      evaluator_a: 'codex-via-ccb',
      evaluator_b: 'gemini-via-ccb',
      synthesizer: 'claude',
      substrate: 'superpowers-core',
      fallback_policy: 'disabled',
    };
    expect(requested.generator).toBe('codex-via-ccb');
  });

  test('freezes the Milestone 2 actual route shape', () => {
    const actual: ActualRouteRecord = {
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
      receipt_path: '.planning/current/build/adapter-output.json',
    };
    expect(actual.transport).toBe('ccb');
  });

  test('locks route validation and implementation provenance records', () => {
    const validation: RouteValidationRecord = {
      transport: 'ccb',
      available: true,
      approved: false,
      reason: 'availability alone does not approve the route',
    };
    const provenance: ImplementationProvenanceRecord = {
      path: '.planning/current/build/build-result.md',
      requested_route: {
        command: 'build',
        governed: true,
        planner: 'claude+pm-gsd',
        generator: 'codex-via-ccb',
        evaluator_a: 'codex-via-ccb',
        evaluator_b: 'gemini-via-ccb',
        synthesizer: 'claude',
        substrate: 'superpowers-core',
        fallback_policy: 'disabled',
      },
      actual_route: null,
    };
    expect(validation.approved).toBe(false);
    expect(provenance.path).toContain('build-result.md');
  });

  test('keeps the run-level status enum unchanged', () => {
    expect(RUN_STATUSES).toEqual(['active', 'blocked', 'completed', 'refused']);
  });
});
```

- [ ] **Step 2: Add failing path and precedence tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  stageAdapterOutputPath,
  stageConflictMarkdownPath,
  stageConflictPath,
  stageNormalizationPath,
} from '../../lib/nexus/artifacts';

describe('nexus canonical artifact precedence', () => {
  test('uses dedicated traceability paths that do not replace status.json', () => {
    expect(stageAdapterOutputPath('build')).toBe('.planning/current/build/adapter-output.json');
    expect(stageNormalizationPath('build')).toBe('.planning/current/build/normalization.json');
    expect(stageConflictPath('build', 'ccb')).toBe('.planning/current/conflicts/build-ccb.json');
    expect(stageConflictMarkdownPath('build', 'ccb')).toBe('.planning/current/conflicts/build-ccb.md');
  });
});
```

- [ ] **Step 3: Run the tests to confirm the new fields and artifact helpers are missing**

Run: `bun test test/nexus/types.test.ts test/nexus/status-precedence.test.ts`

Expected:

- FAIL because the new exported types are missing
- FAIL because the new artifact helper functions do not exist

- [ ] **Step 4: Update `lib/nexus/types.ts` with the locked records and review status fields**

```ts
export interface RequestedRouteRecord {
  command: CanonicalCommandId;
  governed: boolean;
  planner: string | null;
  generator: string | null;
  evaluator_a: string | null;
  evaluator_b: string | null;
  synthesizer: string | null;
  substrate: string | null;
  fallback_policy: 'disabled';
}

export interface ActualRouteRecord {
  provider: string | null;
  route: string | null;
  substrate: string | null;
  transport: 'ccb' | null;
  receipt_path: string | null;
}

export interface RouteValidationRecord {
  transport: 'ccb' | 'none';
  available: boolean;
  approved: boolean;
  reason: string;
}

export interface ImplementationProvenanceRecord {
  path: string;
  requested_route: RequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
}

export interface ConflictRecord {
  stage: CanonicalCommandId;
  adapter: string;
  kind:
    | 'route_mismatch'
    | 'partial_write_failure'
    | 'backend_conflict'
    | 'illegal_transition'
    | 'status_precedence';
  message: string;
  canonical_paths: string[];
  trace_paths: string[];
}

export interface StageStatus {
  run_id: string;
  stage: CanonicalCommandId;
  state: StageState;
  decision: StageDecision;
  ready: boolean;
  inputs: ArtifactPointer[];
  outputs: ArtifactPointer[];
  started_at: string;
  completed_at: string | null;
  errors: string[];
  requested_route?: RequestedRouteRecord | null;
  actual_route?: ActualRouteRecord | null;
  route_validation?: RouteValidationRecord | null;
  review_complete?: boolean;
  audit_set_complete?: boolean;
  provenance_consistent?: boolean;
  gate_decision?: 'pass' | 'fail' | 'blocked' | null;
  archive_required?: boolean;
  archive_state?: 'pending' | 'archived' | 'not_required' | 'failed';
}
```

- [ ] **Step 5: Add the new artifact helper functions in `lib/nexus/artifacts.ts`**

```ts
export function stageAdapterRequestPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/adapter-request.json`;
}

export function stageAdapterOutputPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/adapter-output.json`;
}

export function stageNormalizationPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/normalization.json`;
}

export function stageConflictPath(stage: CanonicalCommandId, adapter: string): string {
  return `${CURRENT_ROOT}/conflicts/${stage}-${adapter}.json`;
}

export function stageConflictMarkdownPath(stage: CanonicalCommandId, adapter: string): string {
  return `${CURRENT_ROOT}/conflicts/${stage}-${adapter}.md`;
}
```

- [ ] **Step 6: Make `review/status.json` own structured review completion state**

```ts
expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
  stage: 'review',
  state: 'completed',
  decision: 'audit_recorded',
  review_complete: true,
  audit_set_complete: true,
  provenance_consistent: true,
  gate_decision: 'pass',
});
```

- [ ] **Step 7: Re-run the targeted tests**

Run: `bun test test/nexus/types.test.ts test/nexus/status-precedence.test.ts test/nexus/review.test.ts`

Expected: PASS

- [ ] **Step 8: Commit the shared contract freeze**

```bash
git add lib/nexus/types.ts lib/nexus/artifacts.ts test/nexus/types.test.ts test/nexus/status-precedence.test.ts test/nexus/review.test.ts
git commit -m "feat: freeze nexus route and provenance contracts"
```

## Task 2: Add Adapter Registry, Test Injection, Canonical Writeback, And Partial Failure Handling

**Files:**
- Create: `lib/nexus/adapters/types.ts`
- Create: `lib/nexus/adapters/registry.ts`
- Create: `lib/nexus/conflicts.ts`
- Create: `lib/nexus/normalizers/index.ts`
- Modify: `lib/nexus/governance.ts`
- Modify: `lib/nexus/status.ts`
- Modify: `lib/nexus/commands/index.ts`
- Modify: `bin/nexus.ts`
- Create: `test/nexus/helpers/fake-adapters.ts`
- Modify: `test/nexus/helpers/temp-repo.ts`
- Create: `test/nexus/adapter-registry.test.ts`

- [ ] **Step 1: Write failing tests for activation state, precedence, and partial write failure**

```ts
import { describe, expect, test } from 'bun:test';
import {
  getDefaultAdapterRegistry,
} from '../../lib/nexus/adapters/registry';
import { applyNormalizationPlan } from '../../lib/nexus/normalizers';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus adapter registry', () => {
  test('keeps review and ship seams reserved', () => {
    const registry = getDefaultAdapterRegistry();
    expect(registry.review.superpowers).toBe('reserved_future');
    expect(registry.ship.superpowers).toBe('reserved_future');
  });
});

describe('nexus normalization writeback', () => {
  test('marks the stage blocked when canonical writeback partially fails', async () => {
    await runInTempRepo(async ({ run, cwd }) => {
      await expect(
        applyNormalizationPlan({
          cwd,
          stage: 'build',
          statusPath: '.planning/current/build/status.json',
          canonicalWrites: [
            {
              path: '.planning/current/build/build-result.md',
              content: '# Build Result\\n',
            },
            {
              path: '.planning/current/build/build-request.json',
              content: '{\"requested_route\":{}}\\n',
            },
          ],
          traceWrites: [],
          status: {
            run_id: 'run-1',
            stage: 'build',
            state: 'completed',
            decision: 'build_recorded',
            ready: true,
            inputs: [],
            outputs: [],
            started_at: '2026-04-01T00:00:00.000Z',
            completed_at: '2026-04-01T00:00:00.000Z',
            errors: [],
          },
          writeAtomicFile: (_cwd, relativePath) => {
            if (relativePath.endsWith('build-request.json')) {
              throw new Error('disk full');
            }
          },
        }),
      ).rejects.toThrow('Canonical writeback failed');

      expect(await run.readJson('.planning/current/build/status.json')).toMatchObject({
        stage: 'build',
        state: 'blocked',
        ready: false,
      });
      expect(await run.readJson('.planning/current/conflicts/build-normalizer.json')).toMatchObject({
        kind: 'partial_write_failure',
      });
    });
  });
});
```

- [ ] **Step 2: Run the new tests to confirm the adapter and normalizer runtime does not exist yet**

Run: `bun test test/nexus/adapter-registry.test.ts`

Expected:

- FAIL because `lib/nexus/adapters/registry.ts` does not exist
- FAIL because `applyNormalizationPlan` does not exist

- [ ] **Step 3: Create the adapter types and registry with explicit activation states**

```ts
export type AdapterActivationState = 'inactive' | 'reserved_future' | 'active';

export interface AdapterResult<TRaw> {
  adapter_id: string;
  outcome: 'success' | 'blocked' | 'refused' | 'error';
  raw_output: TRaw;
  requested_route: RequestedRouteRecord | null;
  actual_route: ActualRouteRecord | null;
  notices: string[];
  conflict_candidates: ConflictRecord[];
}

export interface AdapterRegistryShape {
  discover: { pm: AdapterActivationState };
  frame: { pm: AdapterActivationState };
  plan: { gsd: AdapterActivationState };
  handoff: { ccb: AdapterActivationState };
  build: { superpowers: AdapterActivationState; ccb: AdapterActivationState };
  review: { superpowers: AdapterActivationState; ccb: AdapterActivationState };
  ship: { superpowers: AdapterActivationState };
  closeout: { gsd: AdapterActivationState };
}

const DEFAULT_REGISTRY: AdapterRegistryShape = {
  discover: { pm: 'active' },
  frame: { pm: 'active' },
  plan: { gsd: 'active' },
  handoff: { ccb: 'active' },
  build: { superpowers: 'active', ccb: 'active' },
  review: { superpowers: 'reserved_future', ccb: 'reserved_future' },
  ship: { superpowers: 'reserved_future' },
  closeout: { gsd: 'active' },
};

export interface NexusAdapters {
  registry: AdapterRegistryShape;
  pm: PmAdapter;
  gsd: GsdAdapter;
  superpowers: SuperpowersAdapter;
  ccb: CcbAdapter;
}

export function getDefaultNexusAdapters(): NexusAdapters {
  return {
    registry: DEFAULT_REGISTRY,
    pm: createDefaultPmAdapter(),
    gsd: createDefaultGsdAdapter(),
    superpowers: createDefaultSuperpowersAdapter(),
    ccb: createDefaultCcbAdapter(),
  };
}
```

- [ ] **Step 4: Implement canonical writeback with temp-file promotion and blocked failure behavior**

```ts
function writeAtomicRepoFile(cwd: string, relativePath: string, content: string): void {
  const absolute = join(cwd, relativePath);
  const temp = `${absolute}.tmp`;
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(temp, content);
  renameSync(temp, absolute);
}

function writeConflictArtifacts(cwd: string, stage: CanonicalCommandId, conflicts: ConflictRecord[]): void {
  for (const conflict of conflicts) {
    writeRepoFile(cwd, stageConflictPath(stage, conflict.adapter), JSON.stringify(conflict, null, 2) + '\n');
    writeRepoFile(
      cwd,
      stageConflictMarkdownPath(stage, conflict.adapter),
      `# Nexus Conflict\n\nKind: ${conflict.kind}\n\nMessage: ${conflict.message}\n`,
    );
  }
}

export async function applyNormalizationPlan(input: {
  cwd: string;
  stage: CanonicalCommandId;
  statusPath: string;
  canonicalWrites: Array<{ path: string; content: string }>;
  traceWrites: Array<{ path: string; content: string }>;
  status: StageStatus;
  ledger?: RunLedger;
  conflicts?: ConflictRecord[];
  writeAtomicFile?: (cwd: string, relativePath: string, content: string) => void;
}): Promise<void> {
  try {
    for (const trace of input.traceWrites) {
      writeRepoFile(input.cwd, trace.path, trace.content);
    }

    for (const write of input.canonicalWrites) {
      (input.writeAtomicFile ?? writeAtomicRepoFile)(input.cwd, write.path, write.content);
    }

    writeStageStatus(input.statusPath, input.status, input.cwd);
    if (input.ledger) {
      writeLedger(input.ledger, input.cwd);
    }
  } catch (error) {
    const blockedStatus: StageStatus = {
      ...input.status,
      state: 'blocked',
      ready: false,
      completed_at: null,
      errors: [
        ...input.status.errors,
        'Canonical writeback failed',
      ],
    };

    writeConflictArtifacts(input.cwd, input.stage, input.conflicts ?? [
      {
        stage: input.stage,
        adapter: 'normalizer',
        kind: 'partial_write_failure',
        message: error instanceof Error ? error.message : String(error),
        canonical_paths: input.canonicalWrites.map((write) => write.path),
        trace_paths: input.traceWrites.map((write) => write.path),
      },
    ]);
    writeStageStatus(input.statusPath, blockedStatus, input.cwd);
    throw new Error('Canonical writeback failed');
  }
}
```

- [ ] **Step 5: Thread the runtime registry through `CommandContext` and the temp repo helper**

```ts
export interface CommandContext {
  cwd: string;
  clock: () => string;
  via: string | null;
  adapters: NexusAdapters;
}

export function buildAdapterContext(
  stage: CanonicalCommandId,
  ctx: CommandContext,
  ledger: RunLedger,
  manifest: CommandContract,
  predecessor_artifacts: ArtifactPointer[],
  requested_route: RequestedRouteRecord | null,
): NexusAdapterContext {
  return {
    cwd: ctx.cwd,
    run_id: ledger.run_id,
    command: stage,
    stage,
    ledger,
    manifest,
    predecessor_artifacts,
    requested_route,
  };
}
```

```ts
const invocation = resolveInvocation(rawCommand);
const result = await invocation.handler({
  cwd: process.cwd(),
  clock: () => new Date().toISOString(),
  via: invocation.via,
  adapters: getDefaultNexusAdapters(),
});
```

```ts
await fn({
  cwd,
  run: async (command, adapters = makeFakeAdapters()) => {
    const invocation = resolveInvocation(command);
    await invocation.handler({
      cwd,
      clock: () => '2026-04-01T00:00:00.000Z',
      via: invocation.via,
      adapters,
    });
  },
  readFile: async (path) => readFileSync(join(cwd, path), 'utf8'),
});
```

```ts
export function makeFakeAdapters(overrides: Partial<NexusAdapters> = {}): NexusAdapters {
  return {
    ...getDefaultNexusAdapters(),
    ...overrides,
  };
}
```

```ts
export async function finalizeStageFromAdapter(
  stage: CanonicalCommandId,
  ctx: CommandContext,
  ledger: RunLedger,
  statusPath: string,
  result: AdapterResult<unknown>,
  normalized: {
    canonicalWrites: Array<{ path: string; content: string }>;
    traceWrites: Array<{ path: string; content: string }>;
    status: StageStatus;
    nextLedger: RunLedger;
    conflicts?: ConflictRecord[];
  },
): Promise<CommandResult> {
  await applyNormalizationPlan({
    cwd: ctx.cwd,
    stage,
    statusPath,
    canonicalWrites: normalized.canonicalWrites,
    traceWrites: normalized.traceWrites,
    status: normalized.status,
    ledger: normalized.nextLedger,
    conflicts: normalized.conflicts ?? result.conflict_candidates,
  });

  return { command: stage, status: normalized.status };
}
```

- [ ] **Step 6: Re-run the targeted registry and normalization tests**

Run: `bun test test/nexus/adapter-registry.test.ts test/nexus/status-precedence.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the registry and writeback runtime**

```bash
git add bin/nexus.ts lib/nexus/adapters lib/nexus/conflicts.ts lib/nexus/normalizers/index.ts lib/nexus/governance.ts lib/nexus/status.ts lib/nexus/commands/index.ts test/nexus/helpers/fake-adapters.ts test/nexus/helpers/temp-repo.ts test/nexus/adapter-registry.test.ts
git commit -m "feat: add nexus adapter registry and canonical writeback"
```

## Task 3: Integrate PM Skills Behind `/discover` And `/frame`

**Files:**
- Create: `lib/nexus/adapters/pm.ts`
- Create: `lib/nexus/normalizers/pm.ts`
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/commands/frame.ts`
- Create: `test/nexus/discover-frame.test.ts`
- Create: `upstream-notes/pm-skills-inventory.md`

- [ ] **Step 1: Write failing discover/frame seam tests**

```ts
import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus discover/frame PM seams', () => {
  test('normalizes a happy-path discover result into canonical docs and status', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          discover: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              idea_brief_markdown: '# Idea Brief\\n\\nProblem: governed seams\\n',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('discover', adapters);

      expect(await run.readJson('.planning/current/discover/status.json')).toMatchObject({
        stage: 'discover',
        state: 'completed',
        ready: true,
      });
      expect(await run.readFile('docs/product/idea-brief.md')).toContain('Idea Brief');
    });
  });

  test('blocks discover when normalized PM output conflicts with canonical writeback', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          discover: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              idea_brief_markdown: '',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('discover', adapters)).rejects.toThrow('Canonical writeback failed');
      expect(await run.readJson('.planning/current/discover/status.json')).toMatchObject({
        stage: 'discover',
        state: 'blocked',
        ready: false,
      });
    });
  });

  test('records refused framing without advancing the lifecycle', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'refused',
            raw_output: { reason: 'missing product context' },
            requested_route: null,
            actual_route: null,
            notices: ['missing context'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('frame', adapters)).rejects.toThrow('PM framing refused');
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm discover/frame still use the Milestone 1 placeholder path**

Run: `bun test test/nexus/discover-frame.test.ts`

Expected:

- FAIL because `discover` and `frame` still route through `runPlaceholder`
- FAIL because `lib/nexus/adapters/pm.ts` and `lib/nexus/normalizers/pm.ts` do not exist

- [ ] **Step 3: Create the PM adapter and normalizer**

```ts
export interface PmAdapter {
  discover(ctx: NexusAdapterContext): Promise<AdapterResult<{
    idea_brief_markdown: string;
  }>>;
  frame(ctx: NexusAdapterContext): Promise<AdapterResult<{
    decision_brief_markdown: string;
    prd_markdown: string;
  }>>;
}

export function createDefaultPmAdapter(): PmAdapter {
  return {
    discover: async () => ({
      adapter_id: 'pm',
      outcome: 'success',
      raw_output: {
        idea_brief_markdown: '# Idea Brief\n\nProblem: normalized by Nexus\n',
      },
      requested_route: null,
      actual_route: null,
      notices: [],
      conflict_candidates: [],
    }),
    frame: async () => ({
      adapter_id: 'pm',
      outcome: 'success',
      raw_output: {
        decision_brief_markdown: '# Decision Brief\n\nScope: Nexus command seam\n',
        prd_markdown: '# PRD\n\nSuccess: repo-visible governed state\n',
      },
      requested_route: null,
      actual_route: null,
      notices: [],
      conflict_candidates: [],
    }),
  };
}
```

```ts
export function normalizeDiscover(
  result: AdapterResult<{ idea_brief_markdown: string }>,
  ledger: RunLedger,
  ctx: CommandContext,
) {
  if (!result.raw_output.idea_brief_markdown.trim()) {
    throw new Error('Canonical writeback failed');
  }

  const startedAt = ctx.clock();
  const statusPath = '.planning/current/discover/status.json';
  const outputs = [
    { kind: 'markdown', path: 'docs/product/idea-brief.md' },
    { kind: 'json', path: statusPath },
  ];

  return {
    canonicalWrites: [
      {
        path: 'docs/product/idea-brief.md',
        content: result.raw_output.idea_brief_markdown,
      },
    ],
    traceWrites: [],
    status: {
      run_id: ledger.run_id,
      stage: 'discover',
      state: 'completed',
      decision: 'ready',
      ready: true,
      inputs: [],
      outputs,
      started_at: startedAt,
      completed_at: startedAt,
      errors: [],
    },
    nextLedger: {
      ...ledger,
      status: 'active',
      current_command: 'discover',
      current_stage: 'discover',
      previous_stage: ledger.current_stage ?? null,
      allowed_next_stages: ['frame'],
      command_history: [
        ...ledger.command_history,
        { command: 'discover', at: startedAt, via: ctx.via },
      ],
    },
  };
}
```

- [ ] **Step 4: Replace the placeholder discover/frame handlers with PM-backed handlers**

```ts
const COMMAND_HANDLERS: Record<CanonicalCommandId, CommandHandler> = {
  discover: runDiscover,
  frame: runFrame,
  plan: runPlan,
  handoff: runHandoff,
  build: runBuild,
  review: runReview,
  qa: async (ctx) => runPlaceholder('qa', ctx),
  ship: async (ctx) => runPlaceholder('ship', ctx),
  closeout: runCloseout,
};
```

```ts
export async function runDiscover(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd) ?? startLedger(makeRunId(ctx.clock), 'discover');
  const manifest = CANONICAL_MANIFEST.discover;
  const result = await ctx.adapters.pm.discover(
    buildAdapterContext('discover', ctx, ledger, manifest, [], null),
  );
  const normalized = normalizeDiscover(result, ledger, ctx);
  return finalizeStageFromAdapter(
    'discover',
    ctx,
    ledger,
    '.planning/current/discover/status.json',
    result,
    normalized,
  );
}
```

- [ ] **Step 5: Create the PM inventory with the mandatory schema and real initial items**

```md
# PM Skills Inventory

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | pm_function | target_stage | target_docs | open_questions_to_normalize | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pm-discover-idea-brief | pm-skills | external:pm-skills | idea brief drafting | adapt | integrating | discover | pm-discover | docs/product/idea-brief.md, .planning/current/discover/status.json | rewrite raw PM markdown into canonical idea brief and structured status | block_or_refuse | .planning/current/conflicts/discover-pm.json | discovery synthesis | discover | docs/product/idea-brief.md | normalize empty or multi-document output to one canonical brief | M2 active seam |
| pm-frame-prd | pm-skills | external:pm-skills | decision brief and PRD drafting | adapt | integrating | frame | pm-frame | docs/product/decision-brief.md, docs/product/prd.md, .planning/current/frame/status.json | rewrite framing output into canonical docs and stage status | block_or_refuse | .planning/current/conflicts/frame-pm.json | framing synthesis | frame | docs/product/decision-brief.md; docs/product/prd.md | ensure PRD and decision brief are separate files | M2 active seam |
```

- [ ] **Step 6: Re-run the PM seam tests**

Run: `bun test test/nexus/discover-frame.test.ts test/nexus/alias-safety.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the PM seam**

```bash
git add lib/nexus/adapters/pm.ts lib/nexus/normalizers/pm.ts lib/nexus/commands/discover.ts lib/nexus/commands/frame.ts test/nexus/discover-frame.test.ts upstream-notes/pm-skills-inventory.md
git commit -m "feat: integrate pm seams for discover and frame"
```

## Task 4: Integrate GSD Behind `/plan` And `/closeout`

**Files:**
- Create: `lib/nexus/adapters/gsd.ts`
- Create: `lib/nexus/normalizers/gsd.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/governance.ts`
- Modify: `test/nexus/plan-handoff-build.test.ts`
- Modify: `test/nexus/closeout.test.ts`
- Create: `upstream-notes/gsd-inventory.md`

- [ ] **Step 1: Add failing GSD tests for happy path, blocked path, and conservative closeout**

```ts
test('normalizes a GSD-ready plan into canonical planning artifacts', async () => {
  await runInTempRepo(async ({ run }) => {
    const adapters = makeFakeAdapters({
      gsd: {
        plan: async () => ({
          adapter_id: 'gsd',
          outcome: 'success',
          raw_output: {
            execution_readiness_packet: '# Execution Readiness Packet\\n\\nReady\\n',
            sprint_contract: '# Sprint Contract\\n\\nWave 1\\n',
            ready: true,
          },
          requested_route: null,
          actual_route: null,
          notices: [],
          conflict_candidates: [],
        }),
      },
    });

    await run('plan', adapters);

    expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
      stage: 'plan',
      state: 'completed',
      decision: 'ready',
      ready: true,
    });
  });
});

test('blocks closeout when the archive is required but missing', async () => {
  await runInTempRepo(async ({ cwd, run }) => {
    await run('plan', makeFakeAdapters());
    await run('handoff', makeFakeAdapters());
    await run('build', makeFakeAdapters());
    await run('review', makeFakeAdapters());
    rmSync(join(cwd, '.planning/audits/current/gemini.md'));
    await expect(run('closeout', makeFakeAdapters())).rejects.toThrow('Missing required audit artifact');
  });
});
```

- [ ] **Step 2: Run the targeted plan/closeout tests to confirm the baseline implementation is still stubbed**

Run: `bun test test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts`

Expected:

- FAIL because `plan` ignores adapter data
- FAIL because `closeout` does not normalize GSD output yet

- [ ] **Step 3: Add the GSD adapter and normalizer**

```ts
export interface GsdAdapter {
  plan(ctx: NexusAdapterContext): Promise<AdapterResult<{
    execution_readiness_packet: string;
    sprint_contract: string;
    ready: boolean;
  }>>;
  closeout(ctx: NexusAdapterContext): Promise<AdapterResult<{
    closeout_record: string;
    archive_required: boolean;
    merge_ready: boolean;
  }>>;
}

export function createDefaultGsdAdapter(): GsdAdapter {
  return {
    plan: async () => ({
      adapter_id: 'gsd',
      outcome: 'success',
      raw_output: {
        execution_readiness_packet: '# Execution Readiness Packet\n\nStatus: ready\n',
        sprint_contract: '# Sprint Contract\n\nScope: Milestone 2 seams\n',
        ready: true,
      },
      requested_route: null,
      actual_route: null,
      notices: [],
      conflict_candidates: [],
    }),
    closeout: async () => ({
      adapter_id: 'gsd',
      outcome: 'success',
      raw_output: {
        closeout_record: '# Closeout Record\n\nResult: merge ready\n',
        archive_required: true,
        merge_ready: true,
      },
      requested_route: null,
      actual_route: null,
      notices: [],
      conflict_candidates: [],
    }),
  };
}
```

```ts
export function normalizePlan(result: AdapterResult<{
  execution_readiness_packet: string;
  sprint_contract: string;
  ready: boolean;
}>, ledger: RunLedger, ctx: CommandContext) {
  const startedAt = ctx.clock();
  const statusPath = '.planning/current/plan/status.json';

  return {
    canonicalWrites: [
      {
        path: '.planning/current/plan/execution-readiness-packet.md',
        content: result.raw_output.execution_readiness_packet,
      },
      {
        path: '.planning/current/plan/sprint-contract.md',
        content: result.raw_output.sprint_contract,
      },
    ],
    traceWrites: [],
    status: {
      run_id: ledger.run_id,
      stage: 'plan',
      state: result.raw_output.ready ? 'completed' : 'blocked',
      decision: result.raw_output.ready ? 'ready' : 'not_ready',
      ready: result.raw_output.ready,
      inputs: [],
      outputs: [
        { kind: 'markdown', path: '.planning/current/plan/execution-readiness-packet.md' },
        { kind: 'markdown', path: '.planning/current/plan/sprint-contract.md' },
        { kind: 'json', path: statusPath },
      ],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [],
    },
    nextLedger: {
      ...ledger,
      status: result.raw_output.ready ? 'active' : 'blocked',
      current_command: 'plan',
      current_stage: 'plan',
      allowed_next_stages: result.raw_output.ready ? ['handoff'] : [],
      command_history: [
        ...ledger.command_history,
        { command: 'plan', at: startedAt, via: ctx.via },
      ],
    },
  };
}

export function normalizeCloseout(
  result: AdapterResult<{
    closeout_record: string;
    archive_required: boolean;
    merge_ready: boolean;
  }>,
  ledger: RunLedger,
  ctx: CommandContext,
  reviewStatus: StageStatus,
) {
  const startedAt = ctx.clock();
  const statusPath = '.planning/current/closeout/status.json';

  return {
    canonicalWrites: [
      {
        path: '.planning/current/closeout/CLOSEOUT-RECORD.md',
        content: result.raw_output.closeout_record,
      },
    ],
    traceWrites: [],
    status: {
      run_id: ledger.run_id,
      stage: 'closeout',
      state: result.raw_output.merge_ready ? 'completed' : 'blocked',
      decision: 'closeout_recorded',
      ready: result.raw_output.merge_ready,
      inputs: reviewStatus.inputs,
      outputs: [
        { kind: 'markdown', path: '.planning/current/closeout/CLOSEOUT-RECORD.md' },
        { kind: 'json', path: statusPath },
      ],
      started_at: startedAt,
      completed_at: startedAt,
      errors: [],
      archive_required: result.raw_output.archive_required,
      archive_state: result.raw_output.archive_required ? 'archived' : 'not_required',
      provenance_consistent: true,
    },
    nextLedger: {
      ...ledger,
      status: result.raw_output.merge_ready ? 'completed' : 'blocked',
      current_command: 'closeout',
      current_stage: 'closeout',
      allowed_next_stages: [],
      command_history: [
        ...ledger.command_history,
        { command: 'closeout', at: startedAt, via: ctx.via },
      ],
    },
  };
}
```

- [ ] **Step 4: Update `/closeout` to keep archive and transition checks conservative**

```ts
export function assertArchiveConsistency(
  runId: string,
  reviewStatus: StageStatus,
  cwd = process.cwd(),
): void {
  if (reviewStatus.archive_required !== true) {
    return;
  }

  const archiveRoot = join(cwd, '.planning', 'audits', 'archive', runId);
  for (const file of ['codex.md', 'gemini.md', 'synthesis.md', 'gate-decision.md', 'meta.json']) {
    if (!existsSync(join(archiveRoot, file))) {
      throw new Error(`Missing archived audit artifact: ${file}`);
    }
  }
}

assertExpectedHistory(ledger, ['plan', 'handoff', 'build', 'review']);
assertReviewReadyForCloseout(reviewStatus, ctx.cwd);
assertArchiveConsistency(ledger.run_id, reviewStatus, ctx.cwd);

const manifest = CANONICAL_MANIFEST.closeout;
const result = await ctx.adapters.gsd.closeout(
  buildAdapterContext(
    'closeout',
    ctx,
    ledger,
    manifest,
    [
      artifactPointerFor(reviewStatusPath),
      artifactPointerFor('.planning/audits/current/meta.json'),
    ],
    null,
  ),
);
const normalized = normalizeCloseout(result, ledger, ctx, reviewStatus);
return finalizeStageFromAdapter(
  'closeout',
  ctx,
  ledger,
  '.planning/current/closeout/status.json',
  result,
  normalized,
);
```

- [ ] **Step 5: Create the GSD inventory**

```md
# GSD Inventory

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | gsd_method | target_stage | readiness_or_closeout_checks | nexus_status_fields_affected | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gsd-plan-readiness | gsd | external:gsd | execution readiness method | adapt | integrating | plan | gsd-plan | .planning/current/plan/execution-readiness-packet.md, .planning/current/plan/sprint-contract.md, .planning/current/plan/status.json | normalize GSD readiness output into canonical plan docs and status | block_or_refuse | .planning/current/conflicts/plan-gsd.json | readiness packet synthesis | plan | readiness, bounded scope, explicit ready/not-ready | state, decision, ready | M2 active seam |
| gsd-closeout-verification | gsd | external:gsd | closeout verification method | adapt | integrating | closeout | gsd-closeout | .planning/current/closeout/CLOSEOUT-RECORD.md, .planning/current/closeout/status.json | normalize closeout output after Nexus archive and provenance checks pass | block_or_refuse | .planning/current/conflicts/closeout-gsd.json | closeout verification | closeout | audit completeness, archive, transition legality, provenance consistency | state, decision, archive_required, archive_state, provenance_consistent | M2 active seam |
```

- [ ] **Step 6: Re-run the GSD tests**

Run: `bun test test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the GSD seam**

```bash
git add lib/nexus/adapters/gsd.ts lib/nexus/normalizers/gsd.ts lib/nexus/commands/plan.ts lib/nexus/commands/closeout.ts lib/nexus/governance.ts test/nexus/plan-handoff-build.test.ts test/nexus/closeout.test.ts upstream-notes/gsd-inventory.md
git commit -m "feat: integrate gsd seams for plan and closeout"
```

## Task 5: Add Conservative CCB Routing For `/handoff` And Routed Provenance For `/build` And `/review`

**Files:**
- Create: `lib/nexus/adapters/ccb.ts`
- Create: `lib/nexus/normalizers/ccb.ts`
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/commands/closeout.ts`
- Create: `test/nexus/build-routing.test.ts`
- Modify: `test/nexus/review.test.ts`
- Modify: `test/nexus/closeout.test.ts`
- Create: `upstream-notes/ccb-inventory.md`

- [ ] **Step 1: Write failing routing and provenance tests**

```ts
test('records route availability and explicit Nexus approval as separate fields', async () => {
  await runInTempRepo(async ({ run }) => {
    const adapters = makeFakeAdapters({
      ccb: {
        resolve_route: async () => ({
          adapter_id: 'ccb',
          outcome: 'success',
          raw_output: { available: true, provider: 'codex' },
          requested_route: null,
          actual_route: {
            provider: 'codex',
            route: 'codex-via-ccb',
            substrate: 'superpowers-core',
            transport: 'ccb',
            receipt_path: '.planning/current/handoff/adapter-output.json',
          },
          notices: [],
          conflict_candidates: [],
        }),
      },
    });

    await run('plan', makeFakeAdapters());
    await run('handoff', adapters);

    expect(await run.readJson('.planning/current/handoff/status.json')).toMatchObject({
      route_validation: {
        available: true,
        approved: true,
      },
    });
  });
});

test('blocks build when requested and actual route diverge', async () => {
  await runInTempRepo(async ({ run }) => {
    const adapters = makeFakeAdapters({
      ccb: {
        execute_generator: async () => ({
          adapter_id: 'ccb',
          outcome: 'success',
          raw_output: { receipt: 'ccb-1' },
          requested_route: {
            command: 'build',
            governed: true,
            planner: 'claude+pm-gsd',
            generator: 'codex-via-ccb',
            evaluator_a: 'codex-via-ccb',
            evaluator_b: 'gemini-via-ccb',
            synthesizer: 'claude',
            substrate: 'superpowers-core',
            fallback_policy: 'disabled',
          },
          actual_route: {
            provider: 'claude',
            route: 'local-claude',
            substrate: 'local-agent',
            transport: 'ccb',
            receipt_path: '.planning/current/build/adapter-output.json',
          },
          notices: [],
          conflict_candidates: [],
        }),
      },
    });

    await run('plan', makeFakeAdapters());
    await run('handoff', makeFakeAdapters());
    await expect(run('build', adapters)).rejects.toThrow('Requested and actual route diverged');
  });
});
```

- [ ] **Step 2: Run the new routing tests**

Run: `bun test test/nexus/build-routing.test.ts test/nexus/review.test.ts test/nexus/closeout.test.ts`

Expected:

- FAIL because `/handoff` does not consult CCB or write `route_validation`
- FAIL because `/build` does not store `actual_route`
- FAIL because `/review` still writes flat implementation route fields

- [ ] **Step 3: Add the CCB adapter and handoff/build normalizers**

```ts
export interface CcbAdapter {
  resolve_route(ctx: NexusAdapterContext): Promise<AdapterResult<{
    available: boolean;
    provider: string;
  }>>;
  execute_generator(ctx: NexusAdapterContext): Promise<AdapterResult<{
    receipt: string;
  }>>;
  execute_audit_a?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_b?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export function createDefaultCcbAdapter(): CcbAdapter {
  return {
    resolve_route: async () => ({
      adapter_id: 'ccb',
      outcome: 'success',
      raw_output: { available: true, provider: 'codex' },
      requested_route: null,
      actual_route: {
        provider: 'codex',
        route: 'codex-via-ccb',
        substrate: 'superpowers-core',
        transport: 'ccb',
        receipt_path: '.planning/current/handoff/adapter-output.json',
      },
      notices: [],
      conflict_candidates: [],
    }),
    execute_generator: async () => ({
      adapter_id: 'ccb',
      outcome: 'success',
      raw_output: { receipt: 'ccb-default' },
      requested_route: null,
      actual_route: {
        provider: 'codex',
        route: 'codex-via-ccb',
        substrate: 'superpowers-core',
        transport: 'ccb',
        receipt_path: '.planning/current/build/adapter-output.json',
      },
      notices: [],
      conflict_candidates: [],
    }),
  };
}
```

```ts
export function normalizeHandoffRouteValidation(
  requestedRoute: RequestedRouteRecord,
  result: AdapterResult<{ available: boolean; provider: string }>,
) {
  return {
    statusPatch: {
      requested_route: requestedRoute,
      route_validation: {
        transport: 'ccb',
        available: result.raw_output.available,
        approved: result.raw_output.available && requestedRoute.generator === 'codex-via-ccb',
        reason: result.raw_output.available
          ? 'Nexus approved the requested governed route'
          : 'CCB reported the requested route unavailable',
      },
    },
  };
}
```

- [ ] **Step 4: Keep `/handoff` Nexus-authored and update review provenance to the locked nested shape**

```ts
if (status.route_validation?.approved !== true) {
  throw new Error('Governed route is not approved by Nexus');
}
```

```ts
writeRepoFile(
  ctx.cwd,
  metaPath,
  JSON.stringify(
    {
      run_id: ledger.run_id,
      implementation: {
        path: '.planning/current/build/build-result.md',
        requested_route: buildStatus.requested_route,
        actual_route: buildStatus.actual_route,
      },
      codex_audit: {
        provider: 'codex',
        path: codexPath,
        route: ledger.route_intent.evaluator_a,
        substrate: ledger.route_intent.substrate,
      },
      gemini_audit: {
        provider: 'gemini',
        path: geminiPath,
        route: ledger.route_intent.evaluator_b,
        substrate: ledger.route_intent.substrate,
      },
    },
    null,
    2,
  ) + '\n',
);
```

- [ ] **Step 5: Create the CCB inventory**

```md
# CCB Inventory

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | transport_operation | requested_route_artifact | actual_route_artifact | provider_paths | activation_state | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ccb-handoff-route-validation | ccb | bfly123/claude_code_bridge | route availability validation | adapt | integrating | handoff | ccb-routing | .planning/current/handoff/status.json, .planning/current/handoff/governed-execution-routing.md | copy availability into route_validation but require separate Nexus approval | block_or_refuse | .planning/current/conflicts/handoff-ccb.json | route-resolution | .planning/current/handoff/status.json | .planning/current/handoff/adapter-output.json | codex, gemini | active_m2 | M2 active seam |
| ccb-build-generator | ccb | bfly123/claude_code_bridge | generator execution transport | adapt | integrating | build | ccb-execution | .planning/current/build/build-request.json, .planning/current/build/status.json, .planning/audits/current/meta.json | keep requested and actual route separate through build and review | block_or_refuse | .planning/current/conflicts/build-ccb.json | generator-execution | .planning/current/build/build-request.json | .planning/current/build/adapter-output.json | codex | active_m2 | M2 active seam |
| ccb-review-audit | ccb | bfly123/claude_code_bridge | audit transport | defer | mapped | review | ccb-audit | .planning/audits/current/meta.json | reserved future review transport | block_or_refuse | .planning/current/conflicts/review-ccb.json | audit-transport | .planning/audits/current/meta.json | .planning/current/review/adapter-output.json | codex, gemini | reserved_future | inventory only in M2 |
```

- [ ] **Step 6: Re-run routing, review, and closeout tests**

Run: `bun test test/nexus/build-routing.test.ts test/nexus/review.test.ts test/nexus/closeout.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the CCB routing and provenance work**

```bash
git add lib/nexus/adapters/ccb.ts lib/nexus/normalizers/ccb.ts lib/nexus/commands/handoff.ts lib/nexus/commands/build.ts lib/nexus/commands/review.ts lib/nexus/commands/closeout.ts test/nexus/build-routing.test.ts test/nexus/review.test.ts test/nexus/closeout.test.ts upstream-notes/ccb-inventory.md
git commit -m "feat: add conservative ccb routing and provenance"
```

## Task 6: Add Superpowers Build Discipline Behind `/build`

**Files:**
- Create: `lib/nexus/adapters/superpowers.ts`
- Create: `lib/nexus/normalizers/superpowers.ts`
- Modify: `lib/nexus/commands/build.ts`
- Create: `test/nexus/build-discipline.test.ts`
- Create: `upstream-notes/superpowers-inventory.md`

- [ ] **Step 1: Write failing Superpowers build-discipline tests**

```ts
import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus superpowers build discipline', () => {
  test('records a disciplined build and then executes through the approved route', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        superpowers: {
          build_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              verification_summary: 'TDD checks passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan', makeFakeAdapters());
      await run('handoff', makeFakeAdapters());
      await run('build', adapters);

      expect(await run.readFile('.planning/current/build/build-result.md')).toContain('TDD checks passed');
    });
  });

  test('blocks build when Superpowers discipline fails before generator transport starts', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        superpowers: {
          build_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'blocked',
            raw_output: {
              verification_summary: 'tests missing',
            },
            requested_route: null,
            actual_route: null,
            notices: ['missing tests'],
            conflict_candidates: [],
          }),
        },
      });

      await run('plan', makeFakeAdapters());
      await run('handoff', makeFakeAdapters());
      await expect(run('build', adapters)).rejects.toThrow('Superpowers discipline blocked build');
    });
  });
});
```

- [ ] **Step 2: Run the build-discipline tests to confirm `/build` does not use Superpowers yet**

Run: `bun test test/nexus/build-discipline.test.ts`

Expected:

- FAIL because `lib/nexus/adapters/superpowers.ts` does not exist
- FAIL because `/build` does not run discipline before transport

- [ ] **Step 3: Create the Superpowers adapter and normalizer**

```ts
export interface SuperpowersAdapter {
  build_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<{
    verification_summary: string;
  }>>;
  review_discipline?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  ship_discipline?(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export function createDefaultSuperpowersAdapter(): SuperpowersAdapter {
  return {
    build_discipline: async () => ({
      adapter_id: 'superpowers',
      outcome: 'success',
      raw_output: {
        verification_summary: 'TDD checks passed',
      },
      requested_route: null,
      actual_route: null,
      notices: [],
      conflict_candidates: [],
    }),
  };
}
```

```ts
export function normalizeBuildDiscipline(
  result: AdapterResult<{ verification_summary: string }>,
) {
  if (result.outcome === 'blocked') {
    throw new Error('Superpowers discipline blocked build');
  }

  return {
    buildResultPrefix: `Verification: ${result.raw_output.verification_summary}\n\n`,
  };
}
```

- [ ] **Step 4: Run Superpowers discipline before CCB execution in `/build`**

```ts
const manifest = CANONICAL_MANIFEST.build;
const requestedRoute = handoffStatus.requested_route!;
const predecessorArtifacts = [artifactPointerFor(handoffStatusPath)];
const discipline = await ctx.adapters.superpowers.build_discipline(
  buildAdapterContext('build', ctx, ledger, manifest, predecessorArtifacts, requestedRoute),
);
const normalizedDiscipline = normalizeBuildDiscipline(discipline);
const transport = await ctx.adapters.ccb.execute_generator(
  buildAdapterContext('build', ctx, ledger, manifest, predecessorArtifacts, requestedRoute),
);

const buildResultMarkdown = [
  '# Build Result',
  '',
  normalizedDiscipline.buildResultPrefix.trimEnd(),
  'Status: ready for review',
  '',
  `Actual route: ${transport.actual_route?.route ?? 'unknown'}`,
  '',
].join('\n');
```

- [ ] **Step 5: Create the Superpowers inventory**

```md
# Superpowers Inventory

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | discipline_type | target_stage | enforcement_mode | activation_state | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| superpowers-build-discipline | superpowers | external:superpowers | TDD and verification discipline | adapt | integrating | build | superpowers-build-discipline | .planning/current/build/build-result.md, .planning/current/build/status.json | rewrite verification output into build result and blocked/refused status | block_or_refuse | .planning/current/conflicts/build-superpowers.json | tdd | build | required | active_m2 | M2 active seam |
| superpowers-review-discipline | superpowers | external:superpowers | review discipline | defer | mapped | review | superpowers-review-discipline | .planning/current/review/status.json | reserved future review discipline | block_or_refuse | .planning/current/conflicts/review-superpowers.json | review-before-completion | review | reserved | reserved_future | inventory only in M2 |
| superpowers-ship-discipline | superpowers | external:superpowers | ship discipline | defer | mapped | ship | superpowers-ship-discipline | .planning/current/ship/status.json | reserved future ship discipline | block_or_refuse | .planning/current/conflicts/ship-superpowers.json | finish-branch | ship | reserved | reserved_future | inventory only in M2 |
```

- [ ] **Step 6: Re-run the build discipline tests**

Run: `bun test test/nexus/build-discipline.test.ts test/nexus/build-routing.test.ts`

Expected: PASS

- [ ] **Step 7: Commit the Superpowers seam**

```bash
git add lib/nexus/adapters/superpowers.ts lib/nexus/normalizers/superpowers.ts lib/nexus/commands/build.ts test/nexus/build-discipline.test.ts upstream-notes/superpowers-inventory.md
git commit -m "feat: add superpowers build discipline seam"
```

## Task 7: Add Inventory Validation, Host Migration Inventory, And Full Regression Coverage

**Files:**
- Create: `upstream-notes/gstack-host-migration-inventory.md`
- Create: `test/nexus/inventory.test.ts`
- Modify: `test/nexus/alias-safety.test.ts`

- [ ] **Step 1: Write failing inventory and alias safety tests**

```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';

const INVENTORIES = [
  'upstream-notes/pm-skills-inventory.md',
  'upstream-notes/gsd-inventory.md',
  'upstream-notes/superpowers-inventory.md',
  'upstream-notes/ccb-inventory.md',
  'upstream-notes/gstack-host-migration-inventory.md',
];

describe('nexus inventories', () => {
  test.each(INVENTORIES)('%s includes the mandatory fields', (path) => {
    const markdown = readFileSync(path, 'utf8');
    expect(markdown).toContain('classification');
    expect(markdown).toContain('milestone_state');
    expect(markdown).toContain('canonical_nexus_commands');
    expect(markdown).toContain('nexus_adapter_seams');
    expect(markdown).toContain('governed_artifact_boundaries');
    expect(markdown).toContain('normalization_required');
    expect(markdown).toContain('conflict_policy');
    expect(markdown).toContain('conflict_artifact_paths');
  });
});
```

```ts
test('legacy aliases do not define separate artifact roots or transition rules', async () => {
  const invocation = resolveInvocation('office-hours');
  expect(invocation.command).toBe('discover');
  expect(invocation.via).toBe('office-hours');
  expect(invocation.contract.durable_outputs).toEqual(
    CANONICAL_MANIFEST.discover.durable_outputs,
  );
});
```

- [ ] **Step 2: Run the new validation tests**

Run: `bun test test/nexus/inventory.test.ts test/nexus/alias-safety.test.ts`

Expected:

- FAIL because the host migration inventory does not exist
- FAIL if alias safety does not explicitly compare canonical durable outputs

- [ ] **Step 3: Add the host migration inventory as identification-only**

```md
# Gstack Host Migration Inventory

| inventory_id | source_system | source_path_or_ref | capability_or_structure | classification | milestone_state | canonical_nexus_commands | nexus_adapter_seams | governed_artifact_boundaries | normalization_required | conflict_policy | conflict_artifact_paths | host_structure | current_host_role | truth_risk | host_disposition | cleanup_phase | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gstack-skill-shell | gstack | top-level command directories | generated skill shell | defer | identified | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; no governed writeback | block_or_refuse | .planning/current/conflicts/host-skill-shell.json | top-level command wrappers | shell entrypoint | high | retain_as_host | post-m2 | identification only; not source of truth |
| gstack-scripts-routing | gstack | scripts/resolvers/preamble.ts | host routing preamble | defer | identified | discover, frame, plan, handoff, build, review, qa, ship, closeout | none | none | host only; alias routing must terminate in lib/nexus | block_or_refuse | .planning/current/conflicts/host-routing.json | resolver preamble | wrapper dispatch | medium | retain_until_adapter_stable | post-m2 | identification only; no cleanup in M2 |
```

- [ ] **Step 4: Re-run the validation suite plus full Nexus regression**

Run:

```bash
bun test \
  test/nexus/types.test.ts \
  test/nexus/status-precedence.test.ts \
  test/nexus/adapter-registry.test.ts \
  test/nexus/discover-frame.test.ts \
  test/nexus/plan-handoff-build.test.ts \
  test/nexus/build-routing.test.ts \
  test/nexus/build-discipline.test.ts \
  test/nexus/review.test.ts \
  test/nexus/closeout.test.ts \
  test/nexus/inventory.test.ts \
  test/nexus/alias-safety.test.ts
```

Expected: PASS

- [ ] **Step 5: Run the broader host regression**

Run: `bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts`

Expected: PASS

- [ ] **Step 6: Commit the inventories and regression updates**

```bash
git add upstream-notes/gstack-host-migration-inventory.md test/nexus/inventory.test.ts test/nexus/alias-safety.test.ts
git commit -m "test: lock nexus inventories and alias safety"
```

## Spec Coverage Check

- Host vs contract boundary: Task 2 registry/writeback, Task 5 conservative handoff, Task 7 alias safety
- PM `/discover` and `/frame` seam: Task 3
- GSD `/plan` and `/closeout` seam: Task 4
- Superpowers `/build` seam: Task 6
- CCB routing and transport seam: Task 5
- `status.json` precedence: Tasks 1 and 2
- partial write failure blocked behavior: Task 2
- requested vs actual route normalization: Tasks 1 and 5
- inventory layer and later migration identification: Tasks 3 through 7
- reserved future `/review` and `/ship` seams: Tasks 2, 6, and 7

## Final Verification

After all tasks are complete, run:

```bash
bun test test/nexus/*.test.ts
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts
```

Then inspect:

- `.planning/current/*/status.json`
- `.planning/current/conflicts/*.json`
- `.planning/audits/current/meta.json`
- `upstream-notes/*.md`

Confirm before claiming success:

- canonical Nexus artifacts remain the only governed truth
- requested route and actual route remain distinct
- partial write failures block lifecycle advancement
- `/handoff` never treats transport availability as implicit approval
- aliases still resolve through canonical Nexus runtime only
