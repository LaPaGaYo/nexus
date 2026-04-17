# Nexus Learnings Mainline Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate `/learn` into the governed Nexus lifecycle by adding repo-visible learning candidates, closeout-owned canonical run learnings, archived learning records, and `/learn` surface support for those canonical records.

**Architecture:** Keep the canonical lifecycle unchanged and absorb learnings through artifacts rather than a new stage. `/review`, `/qa`, and `/ship` will gain optional candidate-learning outputs, `/closeout` will consolidate those candidates into canonical `LEARNINGS.md` and `learnings.json`, and the existing `/learn` tooling will continue to use the global JSONL store while also surfacing canonical run learnings when present.

**Tech Stack:** Bun, TypeScript in `lib/nexus/`, shell helpers in `bin/`, generated skill docs from `learn/SKILL.md.tmpl`, governed artifacts under `.planning/current/` and `.planning/archive/`, Nexus tests under `test/nexus/`

---

## File Structure

- Modify: `lib/nexus/types.ts`
  - Add canonical learning types and stage status fields.
- Modify: `lib/nexus/artifacts.ts`
  - Add candidate-learning and closeout-learning artifact helpers.
- Modify: `lib/nexus/command-manifest.ts`
  - Add learning artifacts to the documented durable outputs.
- Create: `lib/nexus/learnings.ts`
  - Own candidate record schemas, deduplication, closeout consolidation, markdown rendering, and operational-store bridging helpers.
- Modify: `lib/nexus/adapters/ccb.ts`
  - Extend governed review execution raw output to support optional learning candidates.
- Modify: `lib/nexus/adapters/local.ts`
  - Mirror the same optional review learning-candidate field for local-provider parity.
- Modify: `lib/nexus/adapters/superpowers.ts`
  - Extend QA and ship raw outputs to support optional learning candidates.
- Modify: `lib/nexus/adapters/types.ts`
  - Keep adapter result typing aligned with the new raw payload fields.
- Modify: `lib/nexus/adapters/prompt-contracts.ts`
  - Update review bounded/full-acceptance prompts so they may emit optional learning candidates without changing the canonical audit shape.
- Modify: `lib/nexus/commands/review.ts`
  - Persist optional `review/learning-candidates.json` and status metadata.
- Modify: `lib/nexus/commands/qa.ts`
  - Persist optional `qa/learning-candidates.json` and status metadata.
- Modify: `lib/nexus/commands/ship.ts`
  - Persist optional `ship/learning-candidates.json` and status metadata.
- Modify: `lib/nexus/commands/closeout.ts`
  - Collect candidate artifacts, write `LEARNINGS.md` and `learnings.json`, add them to the artifact index, and preserve them into archive.
- Modify: `lib/nexus/stage-content/review/artifact-contract.md`
  - Document the optional review learning-candidate artifact.
- Modify: `lib/nexus/stage-content/qa/artifact-contract.md`
  - Document the optional QA learning-candidate artifact.
- Modify: `lib/nexus/stage-content/ship/artifact-contract.md`
  - Document the optional ship learning-candidate artifact.
- Modify: `lib/nexus/stage-content/closeout/artifact-contract.md`
  - Document the canonical closeout learnings artifacts.
- Modify: `bin/nexus-learnings-search`
  - Merge canonical closeout learnings into the `/learn show/search/export` surface.
- Modify: `learn/SKILL.md.tmpl`
  - Update `/learn` instructions to mention canonical run learnings.
- Modify: `README.md`
  - Clarify that governed runs publish learnings at closeout.
- Modify: `docs/skills.md`
  - Keep the `/learn` and `/closeout` surface docs aligned.
- Modify: `test/nexus/types.test.ts`
  - Lock learning types and status fields.
- Modify: `test/nexus/review.test.ts`
  - Lock optional review learning-candidate persistence.
- Modify: `test/nexus/qa.test.ts`
  - Lock optional QA learning-candidate persistence.
- Modify: `test/nexus/ship.test.ts`
  - Lock optional ship learning-candidate persistence.
- Modify: `test/nexus/closeout.test.ts`
  - Lock closeout canonical learnings output and archival.
- Modify: `test/learnings.test.ts`
  - Lock `nexus-learnings-search` behavior when canonical run learnings exist.
- Modify: `test/nexus/product-surface.test.ts`
  - Lock README and skills wording.

## Task 1: Freeze the learning artifact schema and lifecycle surface

**Files:**
- Modify: `lib/nexus/types.ts`
- Modify: `lib/nexus/artifacts.ts`
- Modify: `lib/nexus/command-manifest.ts`
- Modify: `test/nexus/types.test.ts`

- [ ] **Step 1: Write the failing schema tests**

Add tests that lock the canonical learning record surface:

```ts
expect(LEARNING_TYPES).toEqual([
  'pattern',
  'pitfall',
  'preference',
  'architecture',
  'tool',
]);

expect(LEARNING_SOURCES).toEqual([
  'observed',
  'user-stated',
  'inferred',
  'cross-model',
]);

const candidate: LearningCandidate = {
  type: 'pitfall',
  key: 'owner-mutation-requires-db-lock',
  insight: 'Concurrent owner mutations must serialize through the database.',
  confidence: 8,
  source: 'observed',
  files: ['apps/web/src/server/workspaces/service.ts'],
};

const status: StageStatus = {
  run_id: 'run-1',
  stage: 'review',
  state: 'completed',
  decision: 'audit_recorded',
  ready: true,
  inputs: [],
  outputs: [],
  started_at: '2026-04-16T00:00:00.000Z',
  completed_at: '2026-04-16T00:00:00.000Z',
  errors: [],
  learning_candidates_path: '.planning/current/review/learning-candidates.json',
  learnings_recorded: true,
};

expect(candidate.type).toBe('pitfall');
expect(status.learning_candidates_path).toBe('.planning/current/review/learning-candidates.json');
```

- [ ] **Step 2: Add the canonical learning types**

Extend `lib/nexus/types.ts` with:

```ts
export const LEARNING_TYPES = [
  'pattern',
  'pitfall',
  'preference',
  'architecture',
  'tool',
] as const;
export type LearningType = (typeof LEARNING_TYPES)[number];

export const LEARNING_SOURCES = [
  'observed',
  'user-stated',
  'inferred',
  'cross-model',
] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

export interface LearningCandidate {
  type: LearningType;
  key: string;
  insight: string;
  confidence: number;
  source: LearningSource;
  files: string[];
}

export interface StageLearningCandidatesRecord {
  schema_version: 1;
  run_id: string;
  stage: 'review' | 'qa' | 'ship';
  generated_at: string;
  candidates: LearningCandidate[];
}

export interface RunLearningsRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  source_candidates: string[];
  learnings: Array<LearningCandidate & { origin_stage: 'review' | 'qa' | 'ship' }>;
}
```

And extend `StageStatus` with:

```ts
learning_candidates_path?: string | null;
learnings_recorded?: boolean | null;
```

- [ ] **Step 3: Add canonical artifact helpers**

Extend `lib/nexus/artifacts.ts` with:

```ts
export function reviewLearningCandidatesPath(): string {
  return `${CURRENT_ROOT}/review/learning-candidates.json`;
}

export function qaLearningCandidatesPath(): string {
  return `${CURRENT_ROOT}/qa/learning-candidates.json`;
}

export function shipLearningCandidatesPath(): string {
  return `${CURRENT_ROOT}/ship/learning-candidates.json`;
}

export function closeoutLearningsMarkdownPath(): string {
  return `${CURRENT_ROOT}/closeout/LEARNINGS.md`;
}

export function closeoutLearningsJsonPath(): string {
  return `${CURRENT_ROOT}/closeout/learnings.json`;
}
```

- [ ] **Step 4: Update the manifest surface**

Update `lib/nexus/command-manifest.ts`:

```ts
review: {
  durable_outputs: [
    '.planning/audits/current/codex.md',
    '.planning/audits/current/gemini.md',
    '.planning/audits/current/synthesis.md',
    '.planning/audits/current/gate-decision.md',
    '.planning/audits/current/meta.json',
    '.planning/current/review/learning-candidates.json',
    '.planning/current/review/status.json',
  ],
}

qa: {
  durable_outputs: [
    '.planning/current/qa/qa-report.md',
    '.planning/current/qa/design-verification.md',
    '.planning/current/qa/learning-candidates.json',
    '.planning/current/qa/status.json',
  ],
}

ship: {
  durable_outputs: [
    '.planning/current/ship/release-gate-record.md',
    '.planning/current/ship/checklist.json',
    '.planning/current/ship/pull-request.json',
    '.planning/current/ship/learning-candidates.json',
    '.planning/current/ship/status.json',
  ],
}

closeout: {
  durable_outputs: [
    '.planning/current/closeout/CLOSEOUT-RECORD.md',
    '.planning/current/closeout/LEARNINGS.md',
    '.planning/current/closeout/learnings.json',
    '.planning/current/closeout/NEXT-RUN.md',
    '.planning/current/closeout/next-run-bootstrap.json',
    '.planning/current/closeout/status.json',
  ],
}
```

- [ ] **Step 5: Verify the schema task**

Run:

```bash
bun test test/nexus/types.test.ts
```

Expected:
- PASS with learning types, status fields, and artifact helpers locked

- [ ] **Step 6: Commit**

```bash
git add lib/nexus/types.ts lib/nexus/artifacts.ts lib/nexus/command-manifest.ts test/nexus/types.test.ts
git commit -m "feat: add governed learnings artifact schema"
```

## Task 2: Build the learning consolidation module

**Files:**
- Create: `lib/nexus/learnings.ts`
- Modify: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Write the failing learnings-module tests**

Add tests for deduplication, origin preservation, and markdown rendering:

```ts
import {
  collectRunLearnings,
  renderRunLearningsMarkdown,
} from '../../lib/nexus/learnings';

test('collectRunLearnings deduplicates by key and type with latest stage winner', () => {
  const record = collectRunLearnings({
    runId: 'run-1',
    generatedAt: '2026-04-16T00:00:00.000Z',
    candidates: [
      {
        path: '.planning/current/review/learning-candidates.json',
        stage: 'review',
        candidates: [{ type: 'pitfall', key: 'same-key', insight: 'old', confidence: 6, source: 'observed', files: [] }],
      },
      {
        path: '.planning/current/qa/learning-candidates.json',
        stage: 'qa',
        candidates: [{ type: 'pitfall', key: 'same-key', insight: 'new', confidence: 8, source: 'observed', files: [] }],
      },
    ],
  });

  expect(record.learnings).toEqual([
    {
      type: 'pitfall',
      key: 'same-key',
      insight: 'new',
      confidence: 8,
      source: 'observed',
      origin_stage: 'qa',
      files: [],
    },
  ]);
});

test('renderRunLearningsMarkdown groups learnings by type', () => {
  const markdown = renderRunLearningsMarkdown({
    schema_version: 1,
    run_id: 'run-1',
    generated_at: '2026-04-16T00:00:00.000Z',
    source_candidates: ['.planning/current/review/learning-candidates.json'],
    learnings: [
      {
        type: 'pattern',
        key: 'lock-owner-mutations',
        insight: 'Use database serialization for concurrent owner changes.',
        confidence: 8,
        source: 'observed',
        origin_stage: 'review',
        files: ['apps/web/src/server/workspaces/service.ts'],
      },
    ],
  });

  expect(markdown).toContain('# Run Learnings');
  expect(markdown).toContain('## Patterns');
  expect(markdown).toContain('lock-owner-mutations');
});
```

- [ ] **Step 2: Implement the learnings module**

Create `lib/nexus/learnings.ts`:

```ts
import type {
  LearningCandidate,
  RunLearningsRecord,
  StageLearningCandidatesRecord,
} from './types';

type CandidateInput = {
  path: string;
  stage: 'review' | 'qa' | 'ship';
  candidates: LearningCandidate[];
};

export function collectRunLearnings(input: {
  runId: string;
  generatedAt: string;
  candidates: CandidateInput[];
}): RunLearningsRecord {
  const winners = new Map<string, LearningCandidate & { origin_stage: 'review' | 'qa' | 'ship' }>();

  for (const source of input.candidates) {
    for (const candidate of source.candidates) {
      winners.set(`${candidate.type}|${candidate.key}`, {
        ...candidate,
        origin_stage: source.stage,
      });
    }
  }

  return {
    schema_version: 1,
    run_id: input.runId,
    generated_at: input.generatedAt,
    source_candidates: input.candidates.map((source) => source.path),
    learnings: Array.from(winners.values()).sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key)),
  };
}

export function renderRunLearningsMarkdown(record: RunLearningsRecord): string {
  const buckets = new Map<string, typeof record.learnings>();

  for (const learning of record.learnings) {
    const bucket = buckets.get(learning.type) ?? [];
    bucket.push(learning);
    buckets.set(learning.type, bucket);
  }

  const lines = [
    '# Run Learnings',
    '',
    `- Run: ${record.run_id}`,
    `- Generated at: ${record.generated_at}`,
    `- Source candidates: ${record.source_candidates.length}`,
    '',
  ];

  for (const [type, learnings] of buckets) {
    lines.push(`## ${type.charAt(0).toUpperCase()}${type.slice(1)}s`, '');
    for (const learning of learnings) {
      lines.push(
        `- **${learning.key}** (${learning.origin_stage}, confidence ${learning.confidence}/10, ${learning.source})`,
        `  ${learning.insight}${learning.files.length ? ` (files: ${learning.files.join(', ')})` : ''}`,
      );
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
}

export function hasLearningCandidates(record: StageLearningCandidatesRecord | null | undefined): boolean {
  return Boolean(record && record.candidates.length > 0);
}
```

- [ ] **Step 3: Verify the learnings module**

Run:

```bash
bun test test/nexus/closeout.test.ts
```

Expected:
- FAIL first on missing functions, then PASS after implementation

- [ ] **Step 4: Commit**

```bash
git add lib/nexus/learnings.ts test/nexus/closeout.test.ts
git commit -m "feat: add canonical run learnings helpers"
```

## Task 3: Persist optional learning candidates from `/review`, `/qa`, and `/ship`

**Files:**
- Modify: `lib/nexus/adapters/ccb.ts`
- Modify: `lib/nexus/adapters/local.ts`
- Modify: `lib/nexus/adapters/superpowers.ts`
- Modify: `lib/nexus/adapters/types.ts`
- Modify: `lib/nexus/adapters/prompt-contracts.ts`
- Modify: `lib/nexus/commands/review.ts`
- Modify: `lib/nexus/commands/qa.ts`
- Modify: `lib/nexus/commands/ship.ts`
- Modify: `lib/nexus/stage-content/review/artifact-contract.md`
- Modify: `lib/nexus/stage-content/qa/artifact-contract.md`
- Modify: `lib/nexus/stage-content/ship/artifact-contract.md`
- Modify: `test/nexus/review.test.ts`
- Modify: `test/nexus/qa.test.ts`
- Modify: `test/nexus/ship.test.ts`

- [ ] **Step 1: Write the failing stage tests**

Add one test per stage that proves optional candidates are persisted when raw
outputs include them:

```ts
test('review writes learning-candidates.json when audit output provides candidates', async () => {
  // seed adapter result with raw_output.learning_candidates
  // run review
  // expect .planning/current/review/learning-candidates.json to exist
  // expect status.learning_candidates_path to match
});

test('qa writes learning-candidates.json when QA output provides candidates', async () => {
  // same pattern under .planning/current/qa/
});

test('ship writes learning-candidates.json when ship output provides candidates', async () => {
  // same pattern under .planning/current/ship/
});
```

- [ ] **Step 2: Extend the raw output contracts**

Add optional fields:

```ts
learning_candidates?: LearningCandidate[];
```

to:

- review raw outputs in `lib/nexus/adapters/ccb.ts`
- review raw outputs in `lib/nexus/adapters/local.ts`
- QA and ship raw outputs in `lib/nexus/adapters/superpowers.ts`

And keep the parser conservative:

```ts
function normalizeLearningCandidates(raw: unknown): LearningCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((candidate): candidate is LearningCandidate => (
    candidate
    && typeof candidate === 'object'
    && typeof (candidate as LearningCandidate).type === 'string'
    && typeof (candidate as LearningCandidate).key === 'string'
    && typeof (candidate as LearningCandidate).insight === 'string'
    && typeof (candidate as LearningCandidate).confidence === 'number'
    && typeof (candidate as LearningCandidate).source === 'string'
    && Array.isArray((candidate as LearningCandidate).files)
  ));
}
```

- [ ] **Step 3: Update prompt contracts**

In `lib/nexus/adapters/prompt-contracts.ts`, add an optional learnings tail to
governed review/qa/ship prompts:

```md
Optional:
- If you discovered a genuine reusable lesson, include a `Learning Candidates` section
  in JSON with entries shaped like:
  [{"type":"pitfall","key":"short-key","insight":"One sentence.","confidence":8,"source":"observed","files":["path/to/file.ts"]}]
- If there are no genuine learning candidates, omit the section.
```

Do not change the required canonical audit/result lines.

- [ ] **Step 4: Persist candidate artifacts in commands**

In `lib/nexus/commands/review.ts`:

```ts
const learningCandidatesPath = reviewLearningCandidatesPath();
const learningCandidates = normalizeLearningCandidates(result.raw_output.learning_candidates);

const learningWrites = learningCandidates.length
  ? [{
      path: learningCandidatesPath,
      content: JSON.stringify({
        schema_version: 1,
        run_id: ledger.run_id,
        stage: 'review',
        generated_at: startedAt,
        candidates: learningCandidates,
      }, null, 2) + '\n',
    }]
  : [];
```

Mirror the same pattern in:

- `lib/nexus/commands/qa.ts`
- `lib/nexus/commands/ship.ts`

and update each stage status:

```ts
learning_candidates_path: learningCandidates.length ? learningCandidatesPath : null,
learnings_recorded: learningCandidates.length > 0,
```

- [ ] **Step 5: Update stage-content artifact docs**

Document the optional candidate artifacts:

```md
Optional artifact: `.planning/current/review/learning-candidates.json`

Written only when governed review discovers a genuine reusable learning.
This artifact is not required for review completion, but if present it becomes
an input to `/closeout` learning consolidation.
```

Mirror for QA and ship with their respective paths.

- [ ] **Step 6: Verify stage persistence**

Run:

```bash
bun test test/nexus/review.test.ts test/nexus/qa.test.ts test/nexus/ship.test.ts
```

Expected:
- PASS with optional learning candidate persistence locked

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/adapters/ccb.ts lib/nexus/adapters/local.ts lib/nexus/adapters/superpowers.ts lib/nexus/adapters/types.ts lib/nexus/adapters/prompt-contracts.ts lib/nexus/commands/review.ts lib/nexus/commands/qa.ts lib/nexus/commands/ship.ts lib/nexus/stage-content/review/artifact-contract.md lib/nexus/stage-content/qa/artifact-contract.md lib/nexus/stage-content/ship/artifact-contract.md test/nexus/review.test.ts test/nexus/qa.test.ts test/nexus/ship.test.ts
git commit -m "feat: persist governed learning candidate artifacts"
```

## Task 4: Make `/closeout` publish canonical run learnings and archive them

**Files:**
- Modify: `lib/nexus/commands/closeout.ts`
- Modify: `lib/nexus/stage-content/closeout/artifact-contract.md`
- Modify: `test/nexus/closeout.test.ts`

- [ ] **Step 1: Write the failing closeout tests**

Add tests that prove closeout consolidates and archives learnings:

```ts
test('closeout writes LEARNINGS.md and learnings.json from available candidate artifacts', async () => {
  // seed review/qa learning-candidates.json before closeout
  // run closeout
  // expect .planning/current/closeout/LEARNINGS.md
  // expect .planning/current/closeout/learnings.json
  // expect archived copies under .planning/archive/runs/<run-id>/closeout/
});

test('closeout omits learnings artifacts when no candidates exist', async () => {
  // standard plan -> handoff -> build -> review -> closeout
  // expect no learnings files
});
```

- [ ] **Step 2: Collect candidate artifacts inside closeout**

In `lib/nexus/commands/closeout.ts`, add:

```ts
const candidateSources = [
  { path: reviewLearningCandidatesPath(), stage: 'review' as const },
  { path: qaLearningCandidatesPath(), stage: 'qa' as const },
  { path: shipLearningCandidatesPath(), stage: 'ship' as const },
].filter((source) => existsSync(join(ctx.cwd, source.path)));
```

Read the available records, pass them to `collectRunLearnings()`, and only emit
closeout learnings writes when the consolidated record is non-empty.

- [ ] **Step 3: Write canonical closeout learnings**

Still in `lib/nexus/commands/closeout.ts`, add:

```ts
const runLearnings = collectRunLearnings({
  runId: ledger.run_id,
  generatedAt: startedAt,
  candidates: candidateSources.map((source) => {
    const record = JSON.parse(readFileSync(join(ctx.cwd, source.path), 'utf8')) as StageLearningCandidatesRecord;
    return { path: source.path, stage: source.stage, candidates: record.candidates };
  }),
});

const learningsWrites = runLearnings.learnings.length
  ? [
      {
        path: closeoutLearningsJsonPath(),
        content: JSON.stringify(runLearnings, null, 2) + '\n',
      },
      {
        path: closeoutLearningsMarkdownPath(),
        content: renderRunLearningsMarkdown(runLearnings),
      },
    ]
  : [];
```

Append these writes to `canonicalWrites`, `outputs`, and `artifact_index`, and
set:

```ts
learnings_recorded: runLearnings.learnings.length > 0,
```

- [ ] **Step 4: Preserve learnings in archive**

Ensure the archived closeout directory includes:

```ts
`.planning/archive/runs/${ledger.run_id}/closeout/learnings.json`
`.planning/archive/runs/${ledger.run_id}/closeout/LEARNINGS.md`
```

If the current archive helper already mirrors the whole `closeout/` directory,
assert it in tests rather than building a second archive path.

- [ ] **Step 5: Update closeout artifact-contract docs**

Add:

```md
Optional canonical outputs:
- `.planning/current/closeout/LEARNINGS.md`
- `.planning/current/closeout/learnings.json`

These are written when governed stage learning candidates exist and are
consolidated by `/closeout`.
```

- [ ] **Step 6: Verify closeout learnings**

Run:

```bash
bun test test/nexus/closeout.test.ts
```

Expected:
- PASS with canonical run learnings and archive persistence locked

- [ ] **Step 7: Commit**

```bash
git add lib/nexus/commands/closeout.ts lib/nexus/stage-content/closeout/artifact-contract.md test/nexus/closeout.test.ts
git commit -m "feat: record canonical run learnings at closeout"
```

## Task 5: Teach `/learn` to surface canonical run learnings

**Files:**
- Modify: `bin/nexus-learnings-search`
- Modify: `learn/SKILL.md.tmpl`
- Modify: `README.md`
- Modify: `docs/skills.md`
- Modify: `test/learnings.test.ts`
- Modify: `test/nexus/product-surface.test.ts`

- [ ] **Step 1: Write the failing search and docs tests**

Add tests that prove canonical run learnings appear in the `/learn` surface:

```ts
test('nexus-learnings-search includes canonical closeout learnings when present', () => {
  // seed tmpDir/.planning/archive/runs/run-1/closeout/learnings.json
  // seed or omit operational JSONL
  // expect output to contain the canonical run learning key
});
```

Add product-surface assertions:

```ts
expect(readme).toContain('Governed runs may publish canonical learnings at `/closeout`.');
expect(skills).toContain('`/learn` surfaces both operational JSONL learnings and canonical run learnings when available.');
```

- [ ] **Step 2: Extend the search script**

In `bin/nexus-learnings-search`, add canonical closeout record ingestion before
the Bun formatter:

```bash
CANONICAL_FILES=()
while IFS= read -r f; do
  CANONICAL_FILES+=("$f")
done < <(find .planning/archive/runs -path "*/closeout/learnings.json" -type f 2>/dev/null | sort)

TMP_CANONICAL="$(mktemp)"
for f in "${CANONICAL_FILES[@]}"; do
  bun -e "
    const record = JSON.parse(await Bun.file('${f}').text());
    for (const learning of record.learnings || []) {
      console.log(JSON.stringify({
        ts: record.generated_at,
        key: learning.key,
        type: learning.type,
        insight: learning.insight,
        confidence: learning.confidence,
        source: learning.source,
        files: learning.files || [],
      }));
    }
  " >> \"$TMP_CANONICAL\"
done
```

Then append `"$TMP_CANONICAL"` to the searched files when it is non-empty.

- [ ] **Step 3: Update `/learn` docs**

In `learn/SKILL.md.tmpl`, update the default/show/export wording:

```md
`/learn` now surfaces:
- operational learnings from `~/.nexus/projects/<slug>/learnings.jsonl`
- canonical run learnings published by governed `/closeout` when present
```

And in `README.md` and `docs/skills.md`, add:

```md
Governed runs may publish canonical learnings at `/closeout`.
`/learn` uses those records alongside the operational JSONL learning store.
```

- [ ] **Step 4: Verify the `/learn` surface**

Run:

```bash
bun test test/learnings.test.ts test/nexus/product-surface.test.ts
```

Expected:
- PASS with canonical run learnings visible in `/learn`

- [ ] **Step 5: Commit**

```bash
git add bin/nexus-learnings-search learn/SKILL.md.tmpl README.md docs/skills.md test/learnings.test.ts test/nexus/product-surface.test.ts
git commit -m "feat: surface canonical run learnings in learn workflow"
```

## Task 6: Full regression and release-readiness check

**Files:**
- Verify only

- [ ] **Step 1: Run the governed targeted suite**

Run:

```bash
bun test test/nexus/types.test.ts test/nexus/review.test.ts test/nexus/qa.test.ts test/nexus/ship.test.ts test/nexus/closeout.test.ts test/learnings.test.ts test/nexus/product-surface.test.ts
```

Expected:
- PASS with learnings mainline integration locked end-to-end

- [ ] **Step 2: Run the full Nexus suite**

Run:

```bash
bun test test/nexus/*.test.ts
```

Expected:
- PASS with no lifecycle regressions

- [ ] **Step 3: Regenerate skill docs**

Run:

```bash
bun run gen:skill-docs
bun run gen:skill-docs --host codex
bun run gen:skill-docs --host factory
```

Expected:
- No unexpected diff outside the intended learnings docs updates

- [ ] **Step 4: Check formatting and staged diff**

Run:

```bash
git diff --check
git status --short
```

Expected:
- `git diff --check` clean
- only the planned learnings integration files modified

- [ ] **Step 5: Commit the verification state**

```bash
git add .
git commit -m "test: verify learnings mainline integration"
```

## Self-Review

### Spec coverage

- repo-visible learning candidates: covered in Task 3
- closeout-owned canonical run learnings: covered in Task 4
- archived learning record: covered in Task 4
- existing global JSONL compatibility: covered in Task 5
- no new lifecycle stage: preserved across all tasks

### Placeholder scan

- No `TODO`, `TBD`, or "implement later" placeholders remain
- Each code-changing step includes exact files and concrete snippets
- Each verification step includes explicit commands and expected results

### Type consistency

- `LearningCandidate`, `StageLearningCandidatesRecord`, and `RunLearningsRecord`
  are defined once in Task 1 and reused consistently afterward
- candidate artifact paths are introduced once in Task 1 and reused by stage
  commands and closeout
- `/learn` search integration consumes canonical `RunLearningsRecord` instead of
  inventing a second repo-visible schema

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-16-nexus-learnings-mainline-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
