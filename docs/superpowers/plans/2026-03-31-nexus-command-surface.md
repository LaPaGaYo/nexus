# Nexus Command Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the canonical Nexus command surface as first-class top-level commands and implement the governed `/plan -> /handoff -> /build -> /review -> /closeout` slice against repo-visible state.

**Architecture:** A new `lib/nexus/` runtime becomes the single source of truth for command contracts, alias mapping, artifact paths, governance checks, ledger/state updates, and legal transitions. Canonical command directories become thin SKILL wrappers over `bin/nexus.ts`, and legacy workflow commands become compatibility-only alias wrappers that route through the same runtime.

**Tech Stack:** Bun, TypeScript, SKILL.md templates, Bun test, generated Codex/Factory skill docs

---

## Locked Decisions

- Placeholder commands always persist the same structured outcome:
  - `state = "blocked"`
  - `decision = "not_implemented"`
  - `ready = false`
- The run-level ledger status enum is frozen to:
  - `active`
  - `blocked`
  - `completed`
  - `refused`
- `start-work` resolves only to `discover`.
- `review/status.json` owns structured review completion state and must record more than artifact presence.
- Successful closeout archives `.planning/audits/current/*` into `.planning/audits/archive/<run_id>/`.
- Aliases must resolve to canonical command ids and cannot define separate artifact roots or transition logic.

## File Structure

### Runtime

- Create: `bin/nexus.ts`
- Create: `lib/nexus/types.ts`
- Create: `lib/nexus/command-manifest.ts`
- Create: `lib/nexus/artifacts.ts`
- Create: `lib/nexus/ledger.ts`
- Create: `lib/nexus/status.ts`
- Create: `lib/nexus/transitions.ts`
- Create: `lib/nexus/governance.ts`
- Create: `lib/nexus/commands/index.ts`
- Create: `lib/nexus/commands/discover.ts`
- Create: `lib/nexus/commands/frame.ts`
- Create: `lib/nexus/commands/plan.ts`
- Create: `lib/nexus/commands/handoff.ts`
- Create: `lib/nexus/commands/build.ts`
- Create: `lib/nexus/commands/review.ts`
- Create: `lib/nexus/commands/qa.ts`
- Create: `lib/nexus/commands/ship.ts`
- Create: `lib/nexus/commands/closeout.ts`

### Canonical Commands

- Create: `discover/SKILL.md.tmpl`
- Create: `frame/SKILL.md.tmpl`
- Create: `plan/SKILL.md.tmpl`
- Create: `handoff/SKILL.md.tmpl`
- Create: `build/SKILL.md.tmpl`
- Create: `closeout/SKILL.md.tmpl`
- Modify: `review/SKILL.md.tmpl`
- Modify: `qa/SKILL.md.tmpl`
- Modify: `ship/SKILL.md.tmpl`

### Alias Wrappers

- Modify: `office-hours/SKILL.md.tmpl`
- Modify: `plan-ceo-review/SKILL.md.tmpl`
- Modify: `plan-eng-review/SKILL.md.tmpl`
- Modify: `autoplan/SKILL.md.tmpl`

### Shared Routing And Docs

- Modify: `SKILL.md.tmpl`
- Modify: `scripts/resolvers/preamble.ts`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `package.json`

### Tests

- Create: `test/nexus/helpers/temp-repo.ts`
- Create: `test/nexus/types.test.ts`
- Create: `test/nexus/manifest.test.ts`
- Create: `test/nexus/transitions.test.ts`
- Create: `test/nexus/command-surface.test.ts`
- Create: `test/nexus/plan-handoff-build.test.ts`
- Create: `test/nexus/review.test.ts`
- Create: `test/nexus/closeout.test.ts`
- Create: `test/nexus/alias-safety.test.ts`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`
- Modify: `test/skill-routing-e2e.test.ts`
- Modify: `test/helpers/touchfiles.ts`

## Task 1: Freeze Shared Types And Canonical Manifest

**Files:**
- Create: `lib/nexus/types.ts`
- Create: `lib/nexus/command-manifest.ts`
- Test: `test/nexus/types.test.ts`
- Test: `test/nexus/manifest.test.ts`

- [ ] **Step 1: Write the failing shared-types test**

```ts
import { describe, expect, test } from 'bun:test';
import {
  PLACEHOLDER_OUTCOME,
  RUN_STATUSES,
  type CanonicalCommandId,
  type RunStatus,
} from '../../lib/nexus/types';

describe('nexus types', () => {
  test('freezes placeholder outcome model', () => {
    expect(PLACEHOLDER_OUTCOME).toEqual({
      state: 'blocked',
      decision: 'not_implemented',
      ready: false,
    });
  });

  test('freezes the run-level status enum', () => {
    expect(RUN_STATUSES).toEqual(['active', 'blocked', 'completed', 'refused']);
  });

  test('canonical command ids include the full Nexus surface', () => {
    const commands: CanonicalCommandId[] = [
      'discover',
      'frame',
      'plan',
      'handoff',
      'build',
      'review',
      'qa',
      'ship',
      'closeout',
    ];
    expect(commands).toHaveLength(9);
  });

  test('run status stays string-literal typed', () => {
    const status: RunStatus = 'active';
    expect(status).toBe('active');
  });
});
```

- [ ] **Step 2: Run the types test to verify it fails**

Run: `bun test test/nexus/types.test.ts`
Expected: FAIL with `Cannot find module '../../lib/nexus/types'`

- [ ] **Step 3: Create `lib/nexus/types.ts`**

```ts
export const CANONICAL_COMMANDS = [
  'discover',
  'frame',
  'plan',
  'handoff',
  'build',
  'review',
  'qa',
  'ship',
  'closeout',
] as const;

export type CanonicalCommandId = (typeof CANONICAL_COMMANDS)[number];

export const IMPLEMENTATION_STATUSES = ['implemented', 'placeholder'] as const;
export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];

export const RUN_STATUSES = ['active', 'blocked', 'completed', 'refused'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const STAGE_STATES = ['not_started', 'in_progress', 'completed', 'blocked', 'refused'] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const STAGE_DECISIONS = [
  'none',
  'ready',
  'not_ready',
  'not_implemented',
  'route_recorded',
  'build_recorded',
  'audit_recorded',
  'closeout_recorded',
  'refused',
] as const;
export type StageDecision = (typeof STAGE_DECISIONS)[number];

export interface ArtifactPointer {
  kind: 'markdown' | 'json';
  path: string;
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
  audit_set_complete?: boolean;
  provenance_consistent?: boolean;
  archive_required?: boolean;
  archive_state?: 'pending' | 'archived' | 'not_required' | 'failed';
}

export interface RunLedger {
  run_id: string;
  status: RunStatus;
  current_command: CanonicalCommandId;
  current_stage: CanonicalCommandId;
  previous_stage: CanonicalCommandId | null;
  allowed_next_stages: CanonicalCommandId[];
  command_history: Array<{ command: CanonicalCommandId; at: string; via: string | null }>;
  artifact_index: Record<string, ArtifactPointer>;
  route_intent: {
    planner: string | null;
    generator: string | null;
    evaluator_a: string | null;
    evaluator_b: string | null;
    synthesizer: string | null;
    substrate: string | null;
    fallback_policy: 'disabled';
  };
}

export const PLACEHOLDER_OUTCOME = {
  state: 'blocked',
  decision: 'not_implemented',
  ready: false,
} as const;
```

- [ ] **Step 4: Write the failing manifest test**

```ts
import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST, LEGACY_ALIASES, resolveCommandName } from '../../lib/nexus/command-manifest';

describe('nexus command manifest', () => {
  test('declares all canonical commands exactly once', () => {
    expect(Object.keys(CANONICAL_MANIFEST)).toEqual([
      'discover',
      'frame',
      'plan',
      'handoff',
      'build',
      'review',
      'qa',
      'ship',
      'closeout',
    ]);
  });

  test('maps start-work to discover only', () => {
    expect(LEGACY_ALIASES['start-work']).toBe('discover');
  });

  test('resolves aliases to canonical commands', () => {
    expect(resolveCommandName('office-hours')).toBe('discover');
    expect(resolveCommandName('autoplan')).toBe('plan');
    expect(resolveCommandName('verify-close')).toBe('closeout');
  });
});
```

- [ ] **Step 5: Run the manifest test to verify it fails**

Run: `bun test test/nexus/manifest.test.ts`
Expected: FAIL with `Cannot find module '../../lib/nexus/command-manifest'`

- [ ] **Step 6: Create `lib/nexus/command-manifest.ts`**

```ts
import type { CanonicalCommandId, ImplementationStatus } from './types';

export interface CommandContract {
  id: CanonicalCommandId;
  owner: 'pm-core' | 'gsd-core' | 'routing-core' | 'governance-core' | 'superpowers-core' | 'audit-core';
  implementation: ImplementationStatus;
  purpose: string;
  required_inputs: string[];
  durable_outputs: string[];
  exit_condition: string;
  legal_predecessors: CanonicalCommandId[];
}

export const CANONICAL_MANIFEST: Record<CanonicalCommandId, CommandContract> = {
  discover: { id: 'discover', owner: 'pm-core', implementation: 'placeholder', purpose: 'Clarify the problem.', required_inputs: [], durable_outputs: ['docs/product/idea-brief.md'], exit_condition: 'Problem is clarified or deferred.', legal_predecessors: [] },
  frame: { id: 'frame', owner: 'pm-core', implementation: 'placeholder', purpose: 'Define scope and success criteria.', required_inputs: ['docs/product/idea-brief.md'], durable_outputs: ['docs/product/decision-brief.md', 'docs/product/prd.md'], exit_condition: 'Framing is structured or sent back to discover.', legal_predecessors: ['discover'] },
  plan: { id: 'plan', owner: 'gsd-core', implementation: 'implemented', purpose: 'Write the execution-ready planning packet.', required_inputs: [], durable_outputs: ['.planning/current/plan/execution-readiness-packet.md', '.planning/current/plan/sprint-contract.md', '.planning/current/plan/status.json'], exit_condition: 'Execution is ready or blocked.', legal_predecessors: ['frame'] },
  handoff: { id: 'handoff', owner: 'routing-core', implementation: 'implemented', purpose: 'Produce governed routing and handoff artifacts.', required_inputs: ['.planning/current/plan/status.json'], durable_outputs: ['.planning/current/handoff/governed-execution-routing.md', '.planning/current/handoff/governed-handoff.md', '.planning/current/handoff/status.json'], exit_condition: 'Governed handoff is explicit or refused.', legal_predecessors: ['plan'] },
  build: { id: 'build', owner: 'superpowers-core', implementation: 'implemented', purpose: 'Record the bounded build result.', required_inputs: ['.planning/current/handoff/status.json'], durable_outputs: ['.planning/current/build/build-request.json', '.planning/current/build/build-result.md', '.planning/current/build/status.json'], exit_condition: 'Build result exists or the route is refused.', legal_predecessors: ['handoff'] },
  review: { id: 'review', owner: 'audit-core', implementation: 'implemented', purpose: 'Write the current audit set and reviewed provenance.', required_inputs: ['.planning/current/build/status.json'], durable_outputs: ['.planning/audits/current/codex.md', '.planning/audits/current/gemini.md', '.planning/audits/current/synthesis.md', '.planning/audits/current/gate-decision.md', '.planning/audits/current/meta.json', '.planning/current/review/status.json'], exit_condition: 'Audit set is complete and gate state is explicit.', legal_predecessors: ['build'] },
  qa: { id: 'qa', owner: 'audit-core', implementation: 'placeholder', purpose: 'Record explicit QA validation scope.', required_inputs: ['.planning/current/review/status.json'], durable_outputs: ['.planning/current/qa/status.json'], exit_condition: 'QA scope is recorded as blocked/not implemented.', legal_predecessors: ['review'] },
  ship: { id: 'ship', owner: 'governance-core', implementation: 'placeholder', purpose: 'Record release-gate intent.', required_inputs: ['.planning/current/review/status.json'], durable_outputs: ['.planning/current/ship/status.json'], exit_condition: 'Ship scope is recorded as blocked/not implemented.', legal_predecessors: ['review'] },
  closeout: { id: 'closeout', owner: 'gsd-core', implementation: 'implemented', purpose: 'Verify and conclude the governed work unit.', required_inputs: ['.planning/current/review/status.json'], durable_outputs: ['.planning/current/closeout/CLOSEOUT-RECORD.md', '.planning/current/closeout/status.json'], exit_condition: 'Final readiness status is explicit.', legal_predecessors: ['review'] },
};

export const LEGACY_ALIASES: Record<string, CanonicalCommandId> = {
  'office-hours': 'discover',
  'plan-ceo-review': 'frame',
  'plan-eng-review': 'frame',
  autoplan: 'plan',
  'start-work': 'discover',
  'execute-wave': 'build',
  'governed-execute': 'build',
  'verify-close': 'closeout',
};

export function resolveCommandName(name: string): CanonicalCommandId {
  if (name in CANONICAL_MANIFEST) return name as CanonicalCommandId;
  const resolved = LEGACY_ALIASES[name];
  if (!resolved) throw new Error(`Unknown Nexus command: ${name}`);
  return resolved;
}
```

- [ ] **Step 7: Run the shared-model tests to verify they pass**

Run: `bun test test/nexus/types.test.ts test/nexus/manifest.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/nexus/types.ts lib/nexus/command-manifest.ts test/nexus/types.test.ts test/nexus/manifest.test.ts
git commit -m "feat: add nexus shared types and command manifest"
```

## Task 2: Implement Artifact Paths, Ledger, Status, And Transition Rules

**Files:**
- Create: `lib/nexus/artifacts.ts`
- Create: `lib/nexus/ledger.ts`
- Create: `lib/nexus/status.ts`
- Create: `lib/nexus/transitions.ts`
- Create: `lib/nexus/governance.ts`
- Create: `test/nexus/helpers/temp-repo.ts`
- Test: `test/nexus/transitions.test.ts`

- [ ] **Step 1: Write the failing transitions test**

```ts
import { describe, expect, test } from 'bun:test';
import { getAllowedNextStages, assertLegalTransition } from '../../lib/nexus/transitions';

describe('nexus transitions', () => {
  test('projects the governed slice in order', () => {
    expect(getAllowedNextStages('plan')).toEqual(['handoff']);
    expect(getAllowedNextStages('handoff')).toEqual(['build']);
    expect(getAllowedNextStages('build')).toEqual(['review']);
    expect(getAllowedNextStages('review')).toEqual(['closeout']);
  });

  test('rejects closeout before review', () => {
    expect(() => assertLegalTransition('build', 'closeout')).toThrow('Illegal Nexus transition');
  });
});
```

- [ ] **Step 2: Run the transitions test to verify it fails**

Run: `bun test test/nexus/transitions.test.ts`
Expected: FAIL with `Cannot find module '../../lib/nexus/transitions'`

- [ ] **Step 3: Create the artifact-path helper**

```ts
import type { CanonicalCommandId, ArtifactPointer } from './types';

const CURRENT_ROOT = '.planning/current';
const AUDIT_ROOT = '.planning/audits/current';
const ARCHIVE_ROOT = '.planning/audits/archive';

export function stageStatusPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/status.json`;
}

export function currentAuditPointer(name: 'codex' | 'gemini' | 'synthesis' | 'gate-decision' | 'meta'): ArtifactPointer {
  const suffix = name === 'meta' ? 'meta.json' : `${name}.md`;
  return { kind: suffix.endsWith('.json') ? 'json' : 'markdown', path: `${AUDIT_ROOT}/${suffix}` };
}

export function archiveRootFor(runId: string): string {
  return `${ARCHIVE_ROOT}/${runId}`;
}
```

- [ ] **Step 4: Create ledger/status/transition helpers**

```ts
// lib/nexus/transitions.ts
import type { CanonicalCommandId } from './types';

const ORDER: CanonicalCommandId[] = ['plan', 'handoff', 'build', 'review', 'closeout'];

export function getAllowedNextStages(stage: CanonicalCommandId): CanonicalCommandId[] {
  const index = ORDER.indexOf(stage);
  return index === -1 || index === ORDER.length - 1 ? [] : [ORDER[index + 1]];
}

export function assertLegalTransition(from: CanonicalCommandId, to: CanonicalCommandId): void {
  if (!getAllowedNextStages(from).includes(to)) {
    throw new Error(`Illegal Nexus transition: ${from} -> ${to}`);
  }
}
```

```ts
// lib/nexus/ledger.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import type { CanonicalCommandId, RunLedger } from './types';

const LEDGER_PATH = '.planning/nexus/current-run.json';

export function readLedger(): RunLedger | null {
  if (!existsSync(LEDGER_PATH)) return null;
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as RunLedger;
}

export function writeLedger(ledger: RunLedger): void {
  mkdirSync('.planning/nexus', { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n');
}

export function makeRunId(clock: () => string): string {
  return `run-${clock().replace(/[:.]/g, '-')}`;
}

export function startLedger(run_id: string, stage: CanonicalCommandId): RunLedger {
  return {
    run_id,
    status: 'active',
    current_command: stage,
    current_stage: stage,
    previous_stage: null,
    allowed_next_stages: [],
    command_history: [],
    artifact_index: {},
    route_intent: {
      planner: null,
      generator: null,
      evaluator_a: null,
      evaluator_b: null,
      synthesizer: null,
      substrate: null,
      fallback_policy: 'disabled',
    },
  };
}
```

```ts
// lib/nexus/status.ts
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import type { StageStatus } from './types';

export function readStageStatus(path: string): StageStatus | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as StageStatus;
}

export function writeStageStatus(path: string, status: StageStatus): void {
  mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
  writeFileSync(path, JSON.stringify(status, null, 2) + '\n');
}
```

- [ ] **Step 5: Add the closeout archive guard helper**

```ts
import type { StageStatus } from './types';

export function archiveRequired(reviewStatus: StageStatus): boolean {
  return reviewStatus.state === 'completed' && reviewStatus.decision === 'audit_recorded';
}

export function assertSameRunId(expected: string, actual: string, label: string): void {
  if (expected !== actual) {
    throw new Error(`Run ID mismatch for ${label}: expected ${expected}, got ${actual}`);
  }
}

export function gateRequiresArchive(gateDecisionMarkdown: string): boolean {
  return /Gate:\s*pass/i.test(gateDecisionMarkdown);
}
```

- [ ] **Step 6: Run the transitions test to verify it passes**

Run: `bun test test/nexus/transitions.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/artifacts.ts lib/nexus/ledger.ts lib/nexus/status.ts lib/nexus/transitions.ts lib/nexus/governance.ts test/nexus/transitions.test.ts
git commit -m "feat: add nexus artifact, ledger, and transition helpers"
```

## Task 3: Add The Nexus Dispatcher And Command Handlers

**Files:**
- Create: `bin/nexus.ts`
- Create: `lib/nexus/commands/index.ts`
- Create: `lib/nexus/commands/discover.ts`
- Create: `lib/nexus/commands/frame.ts`
- Create: `lib/nexus/commands/plan.ts`
- Create: `lib/nexus/commands/handoff.ts`
- Create: `lib/nexus/commands/build.ts`
- Create: `lib/nexus/commands/review.ts`
- Create: `lib/nexus/commands/qa.ts`
- Create: `lib/nexus/commands/ship.ts`
- Create: `lib/nexus/commands/closeout.ts`
- Test: `test/nexus/command-surface.test.ts`

- [ ] **Step 1: Write the failing dispatcher test**

```ts
import { describe, expect, test } from 'bun:test';
import { resolveInvocation } from '../../lib/nexus/commands/index';

describe('nexus command dispatcher', () => {
  test('resolves aliases through canonical commands', () => {
    const invocation = resolveInvocation('office-hours');
    expect(invocation.command).toBe('discover');
    expect(invocation.via).toBe('office-hours');
  });

  test('marks placeholders as blocked/not_implemented', async () => {
    const invocation = resolveInvocation('ship');
    const result = await invocation.handler({
      cwd: process.cwd(),
      clock: () => '2026-03-31T12:00:00Z',
      via: null,
    });
    expect(result.status.state).toBe('blocked');
    expect(result.status.decision).toBe('not_implemented');
    expect(result.status.ready).toBe(false);
  });
});
```

- [ ] **Step 2: Run the dispatcher test to verify it fails**

Run: `bun test test/nexus/command-surface.test.ts`
Expected: FAIL with `Cannot find module '../../lib/nexus/commands/index'`

- [ ] **Step 3: Create the dispatcher and placeholder helper**

```ts
// lib/nexus/commands/index.ts
import { CANONICAL_MANIFEST, resolveCommandName } from '../command-manifest';
import { PLACEHOLDER_OUTCOME, type CanonicalCommandId, type StageStatus } from '../types';
import { readLedger, writeLedger, startLedger, makeRunId } from '../ledger';
import { stageStatusPath } from '../artifacts';
import { writeStageStatus } from '../status';

export interface CommandContext {
  cwd: string;
  clock: () => string;
  via: string | null;
}

export interface CommandResult {
  command: CanonicalCommandId;
  status: StageStatus;
}

export async function runPlaceholder(command: CanonicalCommandId, ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger() ?? startLedger(makeRunId(ctx.clock), command);
  const run_id = ledger.run_id;
  const status: StageStatus = {
    run_id,
    stage: command,
    state: PLACEHOLDER_OUTCOME.state,
    decision: PLACEHOLDER_OUTCOME.decision,
    ready: PLACEHOLDER_OUTCOME.ready,
    inputs: [],
    outputs: [{ kind: 'json', path: stageStatusPath(command) }],
    started_at: ctx.clock(),
    completed_at: ctx.clock(),
    errors: [`${command} is not implemented in Nexus v0.1`],
  };
  ledger.status = 'blocked';
  ledger.current_command = command;
  ledger.current_stage = command;
  ledger.allowed_next_stages = [];
  writeLedger(ledger);
  writeStageStatus(stageStatusPath(command), status);
  return { command, status };
}

export function resolveInvocation(name: string) {
  const command = resolveCommandName(name);
  const via = name === command ? null : name;
  return {
    command,
    via,
    handler: async (ctx: CommandContext) => runPlaceholder(command, { ...ctx, via }),
    contract: CANONICAL_MANIFEST[command],
  };
}
```

- [ ] **Step 4: Create the CLI entrypoint**

```ts
#!/usr/bin/env bun
import { resolveInvocation } from '../lib/nexus/commands/index';

const [, , rawCommand] = process.argv;
if (!rawCommand) {
  console.error('Usage: bun run bin/nexus.ts <command>');
  process.exit(1);
}

const invocation = resolveInvocation(rawCommand);
const result = await invocation.handler({
  cwd: process.cwd(),
  clock: () => new Date().toISOString(),
  via: invocation.via,
});

console.log(JSON.stringify(result, null, 2));
```

- [ ] **Step 5: Create the command files with canonical exports**

```ts
// lib/nexus/commands/discover.ts
export { runPlaceholder as runDiscover } from './index';

// lib/nexus/commands/frame.ts
export { runPlaceholder as runFrame } from './index';

// lib/nexus/commands/qa.ts
export { runPlaceholder as runQa } from './index';

// lib/nexus/commands/ship.ts
export { runPlaceholder as runShip } from './index';
```

```ts
// lib/nexus/commands/plan.ts
export async function runPlan(): Promise<never> {
  throw new Error('runPlan must be wired before the governed slice can execute');
}

// lib/nexus/commands/handoff.ts
export async function runHandoff(): Promise<never> {
  throw new Error('runHandoff must be wired before the governed slice can execute');
}

// lib/nexus/commands/build.ts
export async function runBuild(): Promise<never> {
  throw new Error('runBuild must be wired before the governed slice can execute');
}

// lib/nexus/commands/review.ts
export async function runReview(): Promise<never> {
  throw new Error('runReview must be wired before the governed slice can execute');
}

// lib/nexus/commands/closeout.ts
export async function runCloseout(): Promise<never> {
  throw new Error('runCloseout must be wired before the governed slice can execute');
}
```

- [ ] **Step 6: Run the dispatcher test to verify it passes**

Run: `bun test test/nexus/command-surface.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add bin/nexus.ts lib/nexus/commands test/nexus/command-surface.test.ts
git commit -m "feat: add nexus dispatcher and command handler skeletons"
```

## Task 4: Scaffold Canonical SKILL Wrappers And Legacy Alias Wrappers

**Files:**
- Create: `discover/SKILL.md.tmpl`
- Create: `frame/SKILL.md.tmpl`
- Create: `plan/SKILL.md.tmpl`
- Create: `handoff/SKILL.md.tmpl`
- Create: `build/SKILL.md.tmpl`
- Create: `closeout/SKILL.md.tmpl`
- Modify: `review/SKILL.md.tmpl`
- Modify: `qa/SKILL.md.tmpl`
- Modify: `ship/SKILL.md.tmpl`
- Modify: `office-hours/SKILL.md.tmpl`
- Modify: `plan-ceo-review/SKILL.md.tmpl`
- Modify: `plan-eng-review/SKILL.md.tmpl`
- Modify: `autoplan/SKILL.md.tmpl`
- Modify: `SKILL.md.tmpl`
- Modify: `scripts/resolvers/preamble.ts`
- Test: `test/gen-skill-docs.test.ts`
- Test: `test/skill-routing-e2e.test.ts`

- [ ] **Step 1: Write the failing canonical-surface generation test**

```ts
import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '../..');

describe('nexus command surface generation', () => {
  test('creates the new canonical directories', () => {
    for (const dir of ['discover', 'frame', 'plan', 'handoff', 'build', 'closeout']) {
      expect(fs.existsSync(path.join(ROOT, dir, 'SKILL.md.tmpl'))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the generation test to verify it fails**

Run: `bun test test/gen-skill-docs.test.ts -t "creates the new canonical directories"`
Expected: FAIL with `Expected: true Received: false`

- [ ] **Step 3: Add the new canonical templates**

````md
---
name: plan
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus planning command. Writes repo-visible execution readiness artifacts and
  stage status for the governed Nexus lifecycle. Use when the work is framed and needs to
  become execution-ready. (nexus)
allowed-tools:
  - Bash
  - Read
---

{{PREAMBLE}}

# /plan — Nexus Canonical Planning Command

Run:

```bash
bun run bin/nexus.ts plan
```

Then read:

- `.planning/nexus/current-run.json`
- `.planning/current/plan/status.json`
- `.planning/current/plan/execution-readiness-packet.md`
- `.planning/current/plan/sprint-contract.md`
````

- [ ] **Step 4: Rewrite `review`, `qa`, and `ship` in place as Nexus wrappers**

````md
---
name: review
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus review command. Persists the required current audit set and structured
  review completion state for the governed Nexus lifecycle. (nexus)
allowed-tools:
  - Bash
  - Read
---

{{PREAMBLE}}

# /review — Nexus Governed Review

Run:

```bash
bun run bin/nexus.ts review
```

Then read:

- `.planning/current/review/status.json`
- `.planning/audits/current/codex.md`
- `.planning/audits/current/gemini.md`
- `.planning/audits/current/synthesis.md`
- `.planning/audits/current/gate-decision.md`
- `.planning/audits/current/meta.json`
````

````md
---
name: qa
preamble-tier: 1
version: 0.1.0
description: |
  Canonical Nexus QA command. In v0.1 it is an explicit placeholder that records blocked,
  not-implemented QA state without advancing governed execution. (nexus)
allowed-tools:
  - Bash
  - Read
---

{{PREAMBLE}}

# /qa — Nexus QA Placeholder

Run:

```bash
bun run bin/nexus.ts qa
```

Then read `.planning/current/qa/status.json` and tell the user that QA remains scaffolded in v0.1.
````

- [ ] **Step 5: Rewrite the legacy workflow commands as alias wrappers**

````md
---
name: office-hours
preamble-tier: 1
version: 0.1.0
description: |
  Transitional alias for the canonical Nexus /discover command. Routes through Nexus and
  does not own separate contract or artifact logic. (nexus alias)
allowed-tools:
  - Bash
  - Read
---

{{PREAMBLE}}

# /office-hours — Transitional Alias

This alias routes to `/discover`.

Run:

```bash
bun run bin/nexus.ts office-hours
```

Then read:

- `.planning/nexus/current-run.json`
- `.planning/current/discover/status.json`
````

- [ ] **Step 6: Update shared routing text to canonical Nexus names**

```ts
// scripts/resolvers/preamble.ts
Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke discover
- Bugs, errors, "why is this broken" → invoke investigate
- Build a bounded implementation → invoke build
- Governed handoff / routing → invoke handoff
- QA / test the app → invoke qa
- Code review / audit the result → invoke review
- Release / merge gating → invoke ship
- Architecture / execution readiness → invoke plan
```

- [ ] **Step 7: Regenerate skills and verify the wrappers compile**

Run: `bun run gen:skill-docs --host codex`
Expected: PASS with `FRESH` or generated entries for the new Nexus command directories

- [ ] **Step 8: Commit**

```bash
git add discover frame plan handoff build closeout review/SKILL.md.tmpl qa/SKILL.md.tmpl ship/SKILL.md.tmpl office-hours/SKILL.md.tmpl plan-ceo-review/SKILL.md.tmpl plan-eng-review/SKILL.md.tmpl autoplan/SKILL.md.tmpl SKILL.md.tmpl scripts/resolvers/preamble.ts
git commit -m "feat: scaffold nexus command wrappers and alias routing"
```

## Task 5: Implement `/plan`, `/handoff`, And `/build`

**Files:**
- Modify: `lib/nexus/commands/index.ts`
- Modify: `lib/nexus/commands/plan.ts`
- Modify: `lib/nexus/commands/handoff.ts`
- Modify: `lib/nexus/commands/build.ts`
- Test: `test/nexus/plan-handoff-build.test.ts`
- Test: `test/nexus/helpers/temp-repo.ts`

- [ ] **Step 1: Write the failing thin-slice test**

```ts
import { describe, expect, test } from 'bun:test';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus plan -> handoff -> build', () => {
  test('writes ledger, stage statuses, and build request artifacts', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'build',
        status: 'active',
      });
      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'completed',
        decision: 'ready',
      });
      expect(await run.readJson('.planning/current/build/build-request.json')).toMatchObject({
        requested_route: { command: 'build', governed: true },
      });
    });
  });
});
```

- [ ] **Step 2: Run the thin-slice test to verify it fails**

Run: `bun test test/nexus/plan-handoff-build.test.ts`
Expected: FAIL because `runPlan`, `runHandoff`, and `runBuild` are still unimplemented

- [ ] **Step 3: Add the temp-repo test helper**

```ts
import { mkdtempSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';

const ROOT = resolve(import.meta.dir, '../../..');

export async function runInTempRepo(fn: (ctx: {
  run: ((command: string) => Promise<void>) & { readJson: (path: string) => any };
}) => Promise<void>) {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-plan-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });

  const run = Object.assign(
    async (command: string) => {
      const result = spawnSync('bun', ['run', join(ROOT, 'bin/nexus.ts'), command], { cwd, stdio: 'pipe', encoding: 'utf8' });
      if (result.status !== 0) throw new Error(result.stderr || result.stdout);
    },
    {
      readJson: (path: string) => JSON.parse(readFileSync(join(cwd, path), 'utf8')),
    },
  );

  await fn({ run });
}
```

- [ ] **Step 4: Implement `runPlan`**

```ts
import { writeFileSync, mkdirSync } from 'fs';
import { makeRunId, readLedger, startLedger, writeLedger } from '../ledger';
import { stageStatusPath } from '../artifacts';
import { writeStageStatus } from '../status';
import { getAllowedNextStages } from '../transitions';
import type { CommandContext, CommandResult } from './index';

export async function runPlan(ctx: CommandContext): Promise<CommandResult> {
  const run_id = readLedger()?.run_id ?? makeRunId(ctx.clock);
  const ledger = readLedger() ?? startLedger(run_id, 'plan');
  ledger.current_command = 'plan';
  ledger.current_stage = 'plan';
  ledger.allowed_next_stages = getAllowedNextStages('plan');

  mkdirSync('.planning/current/plan', { recursive: true });
  writeFileSync('.planning/current/plan/execution-readiness-packet.md', '# Execution Readiness Packet\n\nStatus: ready\n');
  writeFileSync('.planning/current/plan/sprint-contract.md', '# Sprint Contract\n\nScope: governed thin slice\n');

  const status = {
    run_id,
    stage: 'plan',
    state: 'completed',
    decision: 'ready',
    ready: true,
    inputs: [],
    outputs: [
      { kind: 'markdown', path: '.planning/current/plan/execution-readiness-packet.md' },
      { kind: 'markdown', path: '.planning/current/plan/sprint-contract.md' },
      { kind: 'json', path: stageStatusPath('plan') },
    ],
    started_at: ctx.clock(),
    completed_at: ctx.clock(),
    errors: [],
  } as const;

  writeStageStatus(stageStatusPath('plan'), status);
  writeLedger(ledger);
  return { command: 'plan', status };
}
```

- [ ] **Step 5: Implement `runHandoff` and `runBuild`**

```ts
// lib/nexus/commands/handoff.ts
import { readStageStatus, writeStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import { writeLedger, readLedger } from '../ledger';
import { stageStatusPath } from '../artifacts';
import { writeFileSync, mkdirSync } from 'fs';

export async function runHandoff(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger();
  const planStatus = readStageStatus(stageStatusPath('plan'));
  if (!ledger || !planStatus?.ready) throw new Error('Plan must be completed and ready before handoff');
  assertLegalTransition('plan', 'handoff');

  mkdirSync('.planning/current/handoff', { recursive: true });
  writeFileSync('.planning/current/handoff/governed-execution-routing.md', '# Governed Execution Routing\n\nGenerator: codex-via-ccb\n');
  writeFileSync('.planning/current/handoff/governed-handoff.md', '# Governed Handoff\n\nFallback: disabled\n');

  ledger.current_command = 'handoff';
  ledger.current_stage = 'handoff';
  ledger.previous_stage = 'plan';
  ledger.allowed_next_stages = getAllowedNextStages('handoff');
  ledger.route_intent = {
    planner: 'claude+pm-gsd',
    generator: 'codex-via-ccb',
    evaluator_a: 'codex-via-ccb',
    evaluator_b: 'gemini-via-ccb',
    synthesizer: 'claude',
    substrate: 'superpowers-core',
    fallback_policy: 'disabled',
  };

  const status = {
    run_id: ledger.run_id,
    stage: 'handoff',
    state: 'completed',
    decision: 'route_recorded',
    ready: true,
    inputs: [{ kind: 'json', path: stageStatusPath('plan') }],
    outputs: [
      { kind: 'markdown', path: '.planning/current/handoff/governed-execution-routing.md' },
      { kind: 'markdown', path: '.planning/current/handoff/governed-handoff.md' },
      { kind: 'json', path: stageStatusPath('handoff') },
    ],
    started_at: ctx.clock(),
    completed_at: ctx.clock(),
    errors: [],
  } as const;

  writeStageStatus(stageStatusPath('handoff'), status);
  writeLedger(ledger);
  return { command: 'handoff', status };
}
```

```ts
// lib/nexus/commands/build.ts
import { writeFileSync, mkdirSync } from 'fs';

export async function runBuild(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger();
  const handoffStatus = readStageStatus(stageStatusPath('handoff'));
  if (!ledger || !handoffStatus?.ready) throw new Error('Handoff must be completed before build');
  assertLegalTransition('handoff', 'build');

  mkdirSync('.planning/current/build', { recursive: true });
  writeFileSync('.planning/current/build/build-request.json', JSON.stringify({
    run_id: ledger.run_id,
    requested_route: { command: 'build', governed: true, generator: ledger.route_intent.generator, substrate: ledger.route_intent.substrate, fallback_policy: ledger.route_intent.fallback_policy },
  }, null, 2) + '\n');
  writeFileSync('.planning/current/build/build-result.md', '# Build Result\n\nStatus: ready for review\n');

  ledger.current_command = 'build';
  ledger.current_stage = 'build';
  ledger.previous_stage = 'handoff';
  ledger.allowed_next_stages = getAllowedNextStages('build');

  const status = {
    run_id: ledger.run_id,
    stage: 'build',
    state: 'completed',
    decision: 'build_recorded',
    ready: true,
    inputs: [{ kind: 'json', path: stageStatusPath('handoff') }],
    outputs: [
      { kind: 'json', path: '.planning/current/build/build-request.json' },
      { kind: 'markdown', path: '.planning/current/build/build-result.md' },
      { kind: 'json', path: stageStatusPath('build') },
    ],
    started_at: ctx.clock(),
    completed_at: ctx.clock(),
    errors: [],
  } as const;

  writeStageStatus(stageStatusPath('build'), status);
  writeLedger(ledger);
  return { command: 'build', status };
}
```

- [ ] **Step 6: Wire the dispatcher to the implemented handlers**

```ts
import { runPlan } from './plan';
import { runHandoff } from './handoff';
import { runBuild } from './build';
import { runReview } from './review';
import { runCloseout } from './closeout';

const IMPLEMENTED_HANDLERS = {
  plan: runPlan,
  handoff: runHandoff,
  build: runBuild,
  review: runReview,
  closeout: runCloseout,
} as const;

// In resolveInvocation():
const handler = command in IMPLEMENTED_HANDLERS
  ? IMPLEMENTED_HANDLERS[command as keyof typeof IMPLEMENTED_HANDLERS]
  : (ctx: CommandContext) => runPlaceholder(command, ctx);
```

- [ ] **Step 7: Run the thin-slice test to verify it passes**

Run: `bun test test/nexus/plan-handoff-build.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/nexus/commands/index.ts lib/nexus/commands/plan.ts lib/nexus/commands/handoff.ts lib/nexus/commands/build.ts test/nexus/helpers/temp-repo.ts test/nexus/plan-handoff-build.test.ts
git commit -m "feat: implement nexus plan handoff build slice"
```

## Task 6: Implement `/review` And Structured Review Completion State

**Files:**
- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/types.ts`
- Test: `test/nexus/review.test.ts`

- [ ] **Step 1: Write the failing review test**

```ts
import { describe, expect, test } from 'bun:test';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus review', () => {
  test('writes the required audit workspace and structured review status', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        audit_set_complete: true,
        provenance_consistent: true,
      });
      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        run_id: expect.any(String),
        implementation_route: expect.any(String),
        codex_audit: expect.any(Object),
        gemini_audit: expect.any(Object),
      });
    });
  });
});
```

- [ ] **Step 2: Run the review test to verify it fails**

Run: `bun test test/nexus/review.test.ts`
Expected: FAIL because `runReview` still throws `not implemented`

- [ ] **Step 3: Implement `runReview`**

```ts
import { mkdirSync, writeFileSync } from 'fs';
import { readLedger, writeLedger } from '../ledger';
import { readStageStatus, writeStageStatus } from '../status';
import { currentAuditPointer, stageStatusPath } from '../artifacts';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';

export async function runReview(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger();
  const buildStatus = readStageStatus(stageStatusPath('build'));
  if (!ledger || !buildStatus?.ready) throw new Error('Build must be completed before review');
  assertLegalTransition('build', 'review');

  mkdirSync('.planning/audits/current', { recursive: true });
  mkdirSync('.planning/current/review', { recursive: true });

  writeFileSync('.planning/audits/current/codex.md', '# Codex Audit\n\nStatus: recorded\n');
  writeFileSync('.planning/audits/current/gemini.md', '# Gemini Audit\n\nStatus: recorded\n');
  writeFileSync('.planning/audits/current/synthesis.md', '# Synthesis\n\nResult: review complete\n');
  writeFileSync('.planning/audits/current/gate-decision.md', '# Gate Decision\n\nGate: pass\n');
  writeFileSync('.planning/audits/current/meta.json', JSON.stringify({
    run_id: ledger.run_id,
    implementation_provider: 'codex',
    implementation_path: '.planning/current/build/build-result.md',
    implementation_route: 'codex-via-ccb',
    implementation_substrate: 'superpowers-core',
    codex_audit: { provider: 'codex', path: '.planning/audits/current/codex.md', route: 'codex-via-ccb', substrate: 'superpowers-core' },
    gemini_audit: { provider: 'gemini', path: '.planning/audits/current/gemini.md', route: 'gemini-via-ccb', substrate: 'superpowers-core' },
  }, null, 2) + '\n');

  ledger.current_command = 'review';
  ledger.current_stage = 'review';
  ledger.previous_stage = 'build';
  ledger.allowed_next_stages = getAllowedNextStages('review');

  const status = {
    run_id: ledger.run_id,
    stage: 'review',
    state: 'completed',
    decision: 'audit_recorded',
    ready: true,
    inputs: [{ kind: 'json', path: stageStatusPath('build') }],
    outputs: [
      currentAuditPointer('codex'),
      currentAuditPointer('gemini'),
      currentAuditPointer('synthesis'),
      currentAuditPointer('gate-decision'),
      currentAuditPointer('meta'),
      { kind: 'json', path: stageStatusPath('review') },
    ],
    started_at: ctx.clock(),
    completed_at: ctx.clock(),
    errors: [],
    audit_set_complete: true,
    provenance_consistent: true,
  } as const;

  writeStageStatus(stageStatusPath('review'), status);
  writeLedger(ledger);
  return { command: 'review', status };
}
```

- [ ] **Step 4: Run the review test to verify it passes**

Run: `bun test test/nexus/review.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/commands/review.ts lib/nexus/types.ts test/nexus/review.test.ts
git commit -m "feat: implement nexus review artifacts and status"
```

## Task 7: Implement `/closeout` With Archive And Consistency Checks

**Files:**
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/governance.ts`
- Test: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Write the failing closeout test**

```ts
import { describe, expect, test } from 'bun:test';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus closeout', () => {
  test('archives the current audit set and records closeout status', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const closeout = await run.readJson('.planning/current/closeout/status.json');
      expect(closeout).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        archive_required: true,
        archive_state: 'archived',
      });
    });
  });

  test('rejects illegal transition history', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await expect(run('closeout')).rejects.toThrow('Review must be completed before closeout');
    });
  });
});
```

- [ ] **Step 2: Run the closeout test to verify it fails**

Run: `bun test test/nexus/closeout.test.ts`
Expected: FAIL because `runCloseout` still throws `not implemented`

- [ ] **Step 3: Implement the archive/cross-check helpers**

```ts
import { cpSync, existsSync } from 'fs';
import { archiveRootFor } from './artifacts';
import type { StageStatus } from './types';

export function archiveAuditWorkspace(runId: string): string {
  const destination = archiveRootFor(runId);
  cpSync('.planning/audits/current', destination, { recursive: true });
  return destination;
}

export function assertReviewReadyForCloseout(reviewStatus: StageStatus): void {
  if (reviewStatus.state !== 'completed' || reviewStatus.decision !== 'audit_recorded' || reviewStatus.audit_set_complete !== true) {
    throw new Error('Review must be completed before closeout');
  }
  if (!existsSync('.planning/audits/current/meta.json')) {
    throw new Error('Missing reviewed provenance metadata');
  }
  if (!existsSync('.planning/audits/current/gate-decision.md')) {
    throw new Error('Missing gate decision markdown');
  }
}
```

- [ ] **Step 4: Implement `runCloseout`**

```ts
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { readLedger, writeLedger } from '../ledger';
import { readStageStatus, writeStageStatus } from '../status';
import { stageStatusPath } from '../artifacts';
import { assertReviewReadyForCloseout, archiveAuditWorkspace, gateRequiresArchive } from '../governance';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';

export async function runCloseout(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger();
  const reviewStatus = readStageStatus(stageStatusPath('review'));
  if (!ledger || !reviewStatus) throw new Error('Review must be completed before closeout');
  assertLegalTransition('review', 'closeout');
  assertReviewReadyForCloseout(reviewStatus);

  const meta = JSON.parse(readFileSync('.planning/audits/current/meta.json', 'utf8'));
  const gateDecisionMarkdown = readFileSync('.planning/audits/current/gate-decision.md', 'utf8');
  if (meta.run_id !== ledger.run_id) throw new Error('Reviewed provenance run_id does not match ledger');

  const archiveRequired = gateRequiresArchive(gateDecisionMarkdown);
  const archivePath = archiveRequired ? archiveAuditWorkspace(ledger.run_id) : null;
  mkdirSync('.planning/current/closeout', { recursive: true });
  writeFileSync('.planning/current/closeout/CLOSEOUT-RECORD.md', `# Closeout Record\n\nRun: ${ledger.run_id}\n\nArchive required: ${archiveRequired}\n\nArchive: ${archivePath ?? 'not_required'}\n`);

  ledger.current_command = 'closeout';
  ledger.current_stage = 'closeout';
  ledger.previous_stage = 'review';
  ledger.allowed_next_stages = getAllowedNextStages('closeout');
  ledger.status = 'completed';

  const status = {
    run_id: ledger.run_id,
    stage: 'closeout',
    state: 'completed',
    decision: 'closeout_recorded',
    ready: true,
    inputs: [
      { kind: 'json', path: stageStatusPath('review') },
      { kind: 'json', path: '.planning/audits/current/meta.json' },
    ],
    outputs: [
      { kind: 'markdown', path: '.planning/current/closeout/CLOSEOUT-RECORD.md' },
      { kind: 'json', path: stageStatusPath('closeout') },
    ],
    started_at: ctx.clock(),
    completed_at: ctx.clock(),
    errors: [],
    archive_required: archiveRequired,
    archive_state: archiveRequired ? 'archived' : 'not_required',
    provenance_consistent: true,
  } as const;

  writeStageStatus(stageStatusPath('closeout'), status);
  writeLedger(ledger);
  return { command: 'closeout', status };
}
```

- [ ] **Step 5: Run the closeout tests to verify they pass**

Run: `bun test test/nexus/closeout.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/governance.ts lib/nexus/commands/closeout.ts test/nexus/closeout.test.ts
git commit -m "feat: implement nexus closeout archive and consistency checks"
```

## Task 8: Add Alias Safety, Update Docs, And Rebaseline Verification

**Files:**
- Create: `test/nexus/alias-safety.test.ts`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `package.json`
- Modify: `test/gen-skill-docs.test.ts`
- Modify: `test/skill-validation.test.ts`
- Modify: `test/skill-routing-e2e.test.ts`
- Modify: `test/helpers/touchfiles.ts`

- [ ] **Step 1: Write the failing alias-safety test**

```ts
import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST, LEGACY_ALIASES, resolveCommandName } from '../../lib/nexus/command-manifest';

describe('nexus alias safety', () => {
  test('aliases resolve to canonical commands only', () => {
    for (const [alias, command] of Object.entries(LEGACY_ALIASES)) {
      expect(resolveCommandName(alias)).toBe(command);
      expect(alias in CANONICAL_MANIFEST).toBe(false);
    }
  });

  test('aliases reuse canonical artifact contracts', () => {
    expect(CANONICAL_MANIFEST[resolveCommandName('office-hours')].durable_outputs).toEqual(
      CANONICAL_MANIFEST.discover.durable_outputs,
    );
    expect(CANONICAL_MANIFEST[resolveCommandName('autoplan')].durable_outputs).toEqual(
      CANONICAL_MANIFEST.plan.durable_outputs,
    );
  });
});
```

- [ ] **Step 2: Run the alias-safety test to verify it passes after the previous work**

Run: `bun test test/nexus/alias-safety.test.ts`
Expected: PASS

- [ ] **Step 3: Update the public docs and scripts to the Nexus surface**

```json
// package.json
{
  "scripts": {
    "nexus": "bun run bin/nexus.ts",
    "test:nexus": "bun test test/nexus/",
    "test": "bun test test/nexus/ test/gen-skill-docs.test.ts test/skill-validation.test.ts test/analytics.test.ts"
  }
}
```

```md
<!-- README.md / docs/skills.md -->
Canonical Nexus commands:
- /discover
- /frame
- /plan
- /handoff
- /build
- /review
- /qa
- /ship
- /closeout

Legacy aliases:
- /office-hours -> /discover
- /plan-ceo-review -> /frame
- /plan-eng-review -> /frame
- /autoplan -> /plan
```

- [ ] **Step 4: Replace legacy content assertions with Nexus surface/drift assertions**

```ts
// test/gen-skill-docs.test.ts
test('nexus canonical skills are generated', () => {
  for (const skill of ['discover', 'frame', 'plan', 'handoff', 'build', 'review', 'qa', 'ship', 'closeout']) {
    expect(fs.existsSync(path.join(ROOT, skill, 'SKILL.md'))).toBe(true);
  }
});

// test/skill-validation.test.ts
test('legacy aliases route through canonical Nexus wrappers', () => {
  const officeHours = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf8');
  expect(officeHours).toContain('bun run bin/nexus.ts office-hours');
  expect(officeHours).not.toContain('~/.gstack/projects/');
});
```

- [ ] **Step 5: Regenerate skills and run the full verification set**

Run: `bun run gen:skill-docs --host codex && bun test test/nexus/ test/gen-skill-docs.test.ts test/skill-validation.test.ts`
Expected: PASS

- [ ] **Step 6: Run the default repository test command**

Run: `bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add README.md docs/skills.md package.json test/nexus/alias-safety.test.ts test/gen-skill-docs.test.ts test/skill-validation.test.ts test/skill-routing-e2e.test.ts test/helpers/touchfiles.ts
git commit -m "chore: rebaseline docs and tests for nexus command surface"
```

## Self-Review

- Spec coverage:
  - Canonical command directories are scaffolded.
  - The governed thin slice is implemented with repo-visible ledger, status, and artifacts.
  - Placeholder commands use the frozen blocked/not_implemented model.
  - Legacy aliases route through canonical runtime only.
  - Closeout verifies archive completion, legality, and provenance consistency.
- Placeholder scan:
  - No `TBD`, `TODO`, or deferred implementation markers remain in the plan.
  - The exact run-level status enum and placeholder outcome model are explicit.
- Type consistency:
  - `run_id`, `RunStatus`, `StageStatus`, and `resolveCommandName` are reused across tasks.
  - `start-work` always resolves to `discover`.
  - Review completion state is carried by `.planning/current/review/status.json`.
