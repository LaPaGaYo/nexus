# Nexus Phase Boundary Continuation + Compact Advisor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a canonical continuation advisory at fresh-run and phase boundaries so Nexus can distinguish lifecycle legality from host-session quality and recommend `continue_here`, `compact_then_continue`, or `fresh_session_continue` without pretending it controls host-native compaction.

**Architecture:** Keep the lifecycle unchanged and layer a discover-stage advisory on top of the existing next-run bootstrap flow. Fresh `/discover` will compute a repo-visible continuation advisory from the archived closeout bootstrap, current `continuation_mode`, and optional local history file presence, then write JSON/Markdown artifacts and expose them through discover status and docs. This is an advisory-only feature: no runtime transition gating and no direct `/compact` invocation.

**Tech Stack:** Bun, TypeScript in `lib/nexus/`, lifecycle artifacts under `.planning/current/`, generated stage-content docs, Nexus tests under `test/nexus/`

---

## File Structure

- Create: `lib/nexus/session-continuation-advice.ts`
  - Own the continuation advisory schema, recommendation rules, and markdown rendering.
- Modify: `lib/nexus/types.ts`
  - Add canonical types for continuation advice option and record shape.
- Modify: `lib/nexus/artifacts.ts`
  - Add discover-stage artifact path helpers for the advisory JSON/Markdown files.
- Modify: `lib/nexus/run-bootstrap.ts`
  - Expose the data needed to compute advice from the existing bootstrap seed.
- Modify: `lib/nexus/commands/discover.ts`
  - Generate and persist continuation advice during fresh-run discover bootstrapping.
- Modify: `lib/nexus/command-manifest.ts`
  - Add the advisory artifacts to the discover-stage durable output surface.
- Modify: `lib/nexus/stage-content/discover/artifact-contract.md`
  - Document the discover-stage advisory artifacts.
- Modify: `README.md`
  - Clarify that lifecycle continuation does not require a fresh session and point users to the advisory options.
- Modify: `docs/skills.md`
  - Keep the command-surface docs aligned with the new continuation guidance.
- Modify: `test/nexus/types.test.ts`
  - Lock the continuation advisory schema.
- Modify: `test/nexus/discover-frame.test.ts`
  - Lock fresh-run discover advisory generation and artifact persistence.
- Modify: `test/nexus/product-surface.test.ts`
  - Lock README / surface wording so lifecycle legality and session advice stay distinct.

## Task 1: Freeze the continuation advisory schema and artifact surface

**Files:**
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `test/nexus/types.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add tests that lock the new advisory enums and record shape:

```ts
expect(CONTINUATION_ADVICE_OPTIONS).toEqual([
  'continue_here',
  'compact_then_continue',
  'fresh_session_continue',
]);

const record: SessionContinuationAdviceRecord = {
  schema_version: 1,
  run_id: 'run-1',
  boundary_kind: 'fresh_run_phase',
  continuation_mode: 'phase',
  lifecycle_can_continue_here: true,
  recommended_option: 'compact_then_continue',
  available_options: ['continue_here', 'compact_then_continue', 'fresh_session_continue'],
  host_compact_supported: false,
  resume_artifacts: [
    '.planning/current/discover/NEXT-RUN.md',
    '.planning/current/discover/next-run-bootstrap.json',
  ],
  recommended_next_command: '/frame',
  summary: 'Nexus can continue in this session.',
  generated_at: '2026-04-16T00:00:00.000Z',
};

expect(record.recommended_option).toBe('compact_then_continue');
```

- [ ] **Step 2: Add the new canonical types**

Extend `lib/nexus/types.ts` with:

```ts
export const CONTINUATION_ADVICE_OPTIONS = [
  'continue_here',
  'compact_then_continue',
  'fresh_session_continue',
] as const;
export type ContinuationAdviceOption = (typeof CONTINUATION_ADVICE_OPTIONS)[number];

export interface SessionContinuationAdviceRecord {
  schema_version: 1;
  run_id: string;
  boundary_kind: 'fresh_run_phase';
  continuation_mode: ContinuationMode;
  lifecycle_can_continue_here: true;
  recommended_option: ContinuationAdviceOption;
  available_options: ContinuationAdviceOption[];
  host_compact_supported: boolean;
  resume_artifacts: string[];
  recommended_next_command: '/frame';
  summary: string;
  generated_at: string;
}
```

- [ ] **Step 3: Add canonical artifact helpers**

Extend `lib/nexus/artifacts.ts` with:

```ts
export function discoverSessionContinuationAdvicePath(): string {
  return `${CURRENT_ROOT}/discover/session-continuation-advice.json`;
}

export function discoverSessionContinuationMarkdownPath(): string {
  return `${CURRENT_ROOT}/discover/SESSION-CONTINUATION.md`;
}
```

- [ ] **Step 4: Update the manifest surface**

Update `lib/nexus/command-manifest.ts` so discover durable outputs include:

```ts
[
  'docs/product/idea-brief.md',
  '.planning/current/discover/NEXT-RUN.md',
  '.planning/current/discover/next-run-bootstrap.json',
  '.planning/current/discover/session-continuation-advice.json',
  '.planning/current/discover/SESSION-CONTINUATION.md',
  '.planning/current/discover/status.json',
]
```

- [ ] **Step 5: Verify the schema task**

Run:

```bash
bun test test/nexus/types.test.ts
```

Expected:
- PASS with the continuation advisory schema and discover artifact helpers locked

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/types.ts lib/nexus/artifacts.ts lib/nexus/command-manifest.ts test/nexus/types.test.ts
git commit -m "feat: add continuation advisory lifecycle schema"
```

## Task 2: Implement the advisory builder and renderers

**Files:**
- Create: `lib/nexus/session-continuation-advice.ts`
- Modify: `lib/nexus/run-bootstrap.ts`
- Modify: `test/nexus/discover-frame.test.ts`

- [ ] **Step 1: Write failing advisory-builder tests**

Add tests that prove the recommendation logic is stable:

```ts
test('recommends continue_here for project reset runs', () => {
  const advice = buildSessionContinuationAdvice({
    runId: 'run-1',
    continuationMode: 'project_reset',
    hostCompactSupported: false,
    hasContextTransferFile: false,
    generatedAt: '2026-04-16T00:00:00.000Z',
  });

  expect(advice.recommended_option).toBe('continue_here');
});

test('recommends compact_then_continue for phase continuation', () => {
  const advice = buildSessionContinuationAdvice({
    runId: 'run-2',
    continuationMode: 'phase',
    hostCompactSupported: false,
    hasContextTransferFile: true,
    generatedAt: '2026-04-16T00:00:01.000Z',
  });

  expect(advice.recommended_option).toBe('compact_then_continue');
});
```

- [ ] **Step 2: Create the builder module**

Add `lib/nexus/session-continuation-advice.ts` with:

```ts
import type { ContinuationAdviceOption, ContinuationMode, SessionContinuationAdviceRecord } from './types';

function recommendedOption(mode: ContinuationMode): ContinuationAdviceOption {
  if (mode === 'phase') return 'compact_then_continue';
  return 'continue_here';
}

export function buildSessionContinuationAdvice(input: {
  runId: string;
  continuationMode: ContinuationMode;
  hostCompactSupported: boolean;
  hasContextTransferFile: boolean;
  generatedAt: string;
}): SessionContinuationAdviceRecord {
  const resumeArtifacts = [
    '.planning/current/discover/NEXT-RUN.md',
    '.planning/current/discover/next-run-bootstrap.json',
  ];

  return {
    schema_version: 1,
    run_id: input.runId,
    boundary_kind: 'fresh_run_phase',
    continuation_mode: input.continuationMode,
    lifecycle_can_continue_here: true,
    recommended_option: recommendedOption(input.continuationMode),
    available_options: ['continue_here', 'compact_then_continue', 'fresh_session_continue'],
    host_compact_supported: input.hostCompactSupported,
    resume_artifacts: input.hasContextTransferFile
      ? [...resumeArtifacts, '.ccb/history/<latest>.md']
      : resumeArtifacts,
    recommended_next_command: '/frame',
    summary: input.continuationMode === 'phase'
      ? 'Nexus can continue in this session. Because this is a new phase boundary, compacting first or resuming in a fresh session is recommended.'
      : 'Nexus can continue in this session.',
    generated_at: input.generatedAt,
  };
}

export function renderSessionContinuationMarkdown(record: SessionContinuationAdviceRecord): string {
  return [
    '# Session Continuation Advisory',
    '',
    `- Recommended option: ${record.recommended_option}`,
    `- Recommended next command: ${record.recommended_next_command}`,
    '',
    '## Summary',
    '',
    record.summary,
    '',
    '## Available Options',
    '',
    ...record.available_options.map((option) => `- ${option}`),
    '',
  ].join('\\n');
}
```

- [ ] **Step 3: Keep bootstrap helpers small and explicit**

Extend `lib/nexus/run-bootstrap.ts` with a focused helper:

```ts
export function bootstrapResumeArtifacts(): string[] {
  return [
    discoverBootstrapMarkdownPath(),
    discoverBootstrapJsonPath(),
  ];
}
```

Use this helper from the advisory builder instead of duplicating the artifact paths in multiple modules.

- [ ] **Step 4: Verify the builder task**

Run:

```bash
bun test test/nexus/discover-frame.test.ts
```

Expected:
- PASS with recommendation logic and advisory markdown rendering locked

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/session-continuation-advice.ts lib/nexus/run-bootstrap.ts test/nexus/discover-frame.test.ts
git commit -m "feat: add session continuation advisory builder"
```

## Task 3: Generate advisory artifacts during fresh-run discover

**Files:**
- Modify: `lib/nexus/commands/discover.ts`
- Modify: `lib/nexus/stage-content/discover/artifact-contract.md`
- Modify: `test/nexus/discover-frame.test.ts`

- [ ] **Step 1: Write failing discover integration tests**

Add tests that prove fresh-run discover writes the advisory artifacts:

```ts
test('fresh discover seeds continuation advice after archived closeout', async () => {
  // run a completed closeout, then fresh discover
  // expect session-continuation-advice.json and SESSION-CONTINUATION.md
  // expect recommended_next_command === '/frame'
  // expect lifecycle_can_continue_here === true
});

test('same-run discover does not invent continuation advice', async () => {
  // initial discover without archived closeout
  // expect no session-continuation-advice.json unless a fresh-run seed exists
});
```

- [ ] **Step 2: Integrate advice generation into discover**

Update `lib/nexus/commands/discover.ts`:

```ts
const seededFromArchivedRun = predecessorArtifacts.some(
  (artifact) => artifact.path === discoverBootstrapJsonPath() || artifact.path === discoverBootstrapMarkdownPath(),
);

const continuationAdvice = seededFromArchivedRun
  ? buildSessionContinuationAdvice({
      runId: ledger.run_id,
      continuationMode: ledger.continuation_mode,
      hostCompactSupported: false,
      hasContextTransferFile: false,
      generatedAt: at,
    })
  : null;
```

Then append canonical writes:

```ts
...(continuationAdvice
  ? [
      {
        path: discoverSessionContinuationAdvicePath(),
        content: JSON.stringify(continuationAdvice, null, 2) + '\\n',
      },
      {
        path: discoverSessionContinuationMarkdownPath(),
        content: renderSessionContinuationMarkdown(continuationAdvice),
      },
    ]
  : []),
```

Also add the advisory paths to `artifact_index` when written.

- [ ] **Step 3: Update discover artifact contract docs**

Change `lib/nexus/stage-content/discover/artifact-contract.md` from:

```md
Writes `docs/product/idea-brief.md` and `.planning/current/discover/status.json`.
```

to:

```md
Writes `docs/product/idea-brief.md`, `.planning/current/discover/status.json`, and, for fresh runs seeded from archived closeout, `.planning/current/discover/NEXT-RUN.md`, `.planning/current/discover/next-run-bootstrap.json`, `.planning/current/discover/session-continuation-advice.json`, and `.planning/current/discover/SESSION-CONTINUATION.md`.
```

- [ ] **Step 4: Verify the discover integration**

Run:

```bash
bun test test/nexus/discover-frame.test.ts
```

Expected:
- PASS with fresh-run discover writing advisory artifacts and preserving same-run behavior

- [ ] **Step 5: Commit**

```bash
git add lib/nexus/commands/discover.ts lib/nexus/stage-content/discover/artifact-contract.md test/nexus/discover-frame.test.ts
git commit -m "feat: emit continuation advice for fresh discover runs"
```

## Task 4: Document the lifecycle/session distinction and lock the product surface

**Files:**
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Write failing product-surface tests**

Add assertions that the docs distinguish lifecycle legality from session advice:

```ts
expect(readme).toContain('Nexus can continue in the current session');
expect(readme).toContain('compact this session and continue');
expect(readme).toContain('start a fresh session and run /continue');
expect(readme).not.toContain('you must exit before /frame');
```

- [ ] **Step 2: Update README lifecycle guidance**

Add a short section near the canonical lifecycle / continuation mode guidance:

```md
## Session Continuation at Phase Boundaries

Nexus lifecycle transitions do not require a fresh session between `/discover`,
`/frame`, and later stages when the run state is legal.

When a fresh run or phase boundary is detected, Nexus may recommend one of
three operator paths:

- continue here
- compact this session and continue
- start a fresh session and run `/continue`

Those are session-quality recommendations, not lifecycle requirements.
```

- [ ] **Step 3: Update skills docs**

Add a concise note to `docs/skills.md` that fresh-run discover may emit session continuation advice and that `/continue` remains the new-session resume path.

- [ ] **Step 4: Verify the product surface**

Run:

```bash
bun test test/nexus/product-surface.test.ts
```

Expected:
- PASS with lifecycle/session wording locked

- [ ] **Step 5: Run the focused regression set**

Run:

```bash
bun test test/nexus/types.test.ts test/nexus/discover-frame.test.ts test/nexus/product-surface.test.ts
```

Expected:
- PASS with the advisory schema, discover integration, and docs surface all green

- [ ] **Step 6: Commit**

```bash
git add README.md docs/skills.md test/nexus/product-surface.test.ts
git commit -m "docs: clarify phase-boundary continuation advice"
```

## Self-Review

- Spec coverage:
  - advisory model, options, and messaging rules are covered by Tasks 1-2
  - discover-stage advisory artifacts and bootstrap integration are covered by Task 3
  - host-facing lifecycle/session wording is covered by Task 4
- Placeholder scan:
  - no `TODO`, `TBD`, or deferred implementation language remains
- Type consistency:
  - uses `ContinuationAdviceOption`, `SessionContinuationAdviceRecord`, and discover advisory artifact names consistently across all tasks

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-nexus-phase-boundary-continuation-compact-advisor.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
