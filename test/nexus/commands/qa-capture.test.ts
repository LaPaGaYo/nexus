// test/nexus/commands/qa-capture.test.ts
//
// Tests for /qa ship-blocking cluster learning-candidate capture (SP1 Task 22).
//
// Option A: unit tests for the exported helpers (deriveQaKey, composeQaInsight).
// Option B: integration test verifying that a failing QA verdict writes a
// learning-candidates.json under .planning/current/qa/ with the expected
// schema_v2 shape.
// Option C: v1-merge regression guard — auditor-sourced v1 candidates must
// survive the Task 22 capture call (mirrors the Task 21 guard in review-capture.test.ts).

import { describe, test, expect } from 'bun:test';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { deriveQaKey, composeQaInsight, captureQaShipBlockingLearning } from '../../../lib/nexus/commands/qa';
import { makeFakeAdapters } from '../helpers/fake-adapters';
import { runInTempRepo } from '../helpers/temp-repo';

// ─── Option A: unit tests for the exported helpers ───────────────────────────

describe('deriveQaKey', () => {
  test('produces a kebab-case key with qa-defect prefix', () => {
    const key = deriveQaKey(['Homepage returns HTTP 500 on /checkout']);
    expect(key).toMatch(/^qa-defect-/);
    expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  test('max length is at most 40 chars', () => {
    const long = 'A very long defect description that exceeds the normal limit set by the helper function';
    const key = deriveQaKey([long]);
    expect(key.length).toBeLessThanOrEqual(40);
  });

  test('falls back gracefully when findings is empty', () => {
    const key = deriveQaKey([]);
    expect(key).toBe('qa-defect-cluster');
  });

  test('contains no special chars except hyphens', () => {
    const key = deriveQaKey(['Fix the N+1 query in cart/API!']);
    expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  test('uses the first finding when multiple are present', () => {
    const key = deriveQaKey(['auth endpoint failing', 'other defect']);
    // Should contain slug from 'auth endpoint failing'
    expect(key).toContain('auth');
    expect(key).not.toContain('other');
  });
});

describe('composeQaInsight', () => {
  test('returns a non-empty string', () => {
    const insight = composeQaInsight(['Test coverage is missing for the auth flow.']);
    expect(typeof insight).toBe('string');
    expect(insight.length).toBeGreaterThan(0);
  });

  test('mentions "fix cycle" for a real finding', () => {
    const insight = composeQaInsight(['Remove the legacy payment middleware.']);
    expect(insight.toLowerCase()).toContain('fix cycle');
  });

  test('includes the finding text for a single finding', () => {
    const finding = 'Cart API returns 500 on empty session.';
    const insight = composeQaInsight([finding]);
    expect(insight).toContain(finding);
  });

  test('mentions total count when multiple findings are present', () => {
    const insight = composeQaInsight(['first defect', 'second defect', 'third defect']);
    expect(insight).toContain('3 defects total');
  });

  test('produces fallback insight when findings is empty', () => {
    const insight = composeQaInsight([]);
    expect(insight.toLowerCase()).toContain('ship-blocking defects');
    expect(insight.length).toBeGreaterThan(0);
  });
});

// ─── Option B: integration test — failing QA writes a learning candidate ─────

/**
 * Adapters that produce a failing QA result (defects found, ready: false).
 */
function makeFailingQaAdapters(findings: string[]) {
  return makeFakeAdapters({
    ccb: {
      execute_qa: async (ctx) => ({
        adapter_id: 'ccb',
        outcome: 'success' as const,
        raw_output: {
          report_markdown: `# QA Report\n\nResult: fail\n\n## Defects\n${findings.map((f) => `- ${f}`).join('\n')}\n`,
          ready: false,
          findings,
          receipt: 'qa-fail',
        },
        requested_route: ctx.requested_route,
        actual_route: {
          provider: 'gemini' as const,
          route: ctx.requested_route?.generator ?? 'gemini-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: '.planning/current/qa/adapter-output.json',
        },
        notices: [],
        conflict_candidates: [],
        traceability: {
          nexus_stage_pack: 'nexus-qa-pack',
          absorbed_capability: 'ccb-qa',
          source_map: [],
        },
      }),
    },
  });
}

/**
 * Adapters that produce a passing QA result (no defects, ready: true).
 */
function makePassingQaAdapters() {
  return makeFakeAdapters({
    ccb: {
      execute_qa: async (ctx) => ({
        adapter_id: 'ccb',
        outcome: 'success' as const,
        raw_output: {
          report_markdown: '# QA Report\n\nResult: pass\n',
          ready: true,
          findings: [],
          receipt: 'qa-pass',
        },
        requested_route: ctx.requested_route,
        actual_route: {
          provider: 'gemini' as const,
          route: ctx.requested_route?.generator ?? 'gemini-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: '.planning/current/qa/adapter-output.json',
        },
        notices: [],
        conflict_candidates: [],
        traceability: {
          nexus_stage_pack: 'nexus-qa-pack',
          absorbed_capability: 'ccb-qa',
          source_map: [],
        },
      }),
    },
  });
}

describe('/qa ship-blocking capture integration', () => {
  test('writes a learning-candidate entry when QA finds defects (ready: false)', async () => {
    const findings = ['Cart API returns HTTP 500 on empty session.', 'Checkout button missing aria-label.'];
    const adapters = makeFailingQaAdapters(findings);

    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      // QA with a failing verdict — completes normally but ready: false; should capture a learning candidate
      await run('qa', adapters);

      expect(run.exists('.planning/current/qa/learning-candidates.json')).toBe(true);
      const record = await run.readJson('.planning/current/qa/learning-candidates.json');

      // Top-level record shape
      expect(record.schema_version).toBe(2);
      expect(record.stage).toBe('qa');
      expect(Array.isArray(record.candidates)).toBe(true);
      expect(record.candidates.length).toBeGreaterThanOrEqual(1);

      // Find our capture entry (writer_skill === 'qa' and subject_stage === 'qa')
      const captureEntry = record.candidates.find(
        (e: { writer_skill: string; subject_stage: string }) =>
          e.writer_skill === 'qa' && e.subject_stage === 'qa',
      );
      expect(captureEntry).toBeDefined();

      // Entry shape per SP1 plan
      expect(captureEntry.schema_version).toBe(2);
      expect(captureEntry.writer_skill).toBe('qa');
      expect(captureEntry.subject_skill).toBe('qa');
      expect(captureEntry.subject_stage).toBe('qa');
      expect(captureEntry.type).toBe('pitfall');
      expect(captureEntry.confidence).toBe(8);
      expect(captureEntry.evidence_type).toBe('multi-run-observation');
      expect(captureEntry.source).toBe('observed');
      expect(typeof captureEntry.id).toBe('string');
      expect(captureEntry.id).toMatch(/^lrn_/);
      expect(captureEntry.key).toMatch(/^qa-defect-/);
      expect(captureEntry.key).toMatch(/^[a-z0-9-]+$/);
      expect(captureEntry.key.length).toBeLessThanOrEqual(40);
      expect(captureEntry.insight.length).toBeGreaterThan(0);
      expect(Array.isArray(captureEntry.files)).toBe(true);
      expect(captureEntry.cluster_id).toBeNull();
      expect(Array.isArray(captureEntry.supersedes)).toBe(true);
      expect(captureEntry.supersedes_reason).toBeNull();
      expect(Array.isArray(captureEntry.derived_from)).toBe(true);
      expect(captureEntry.last_applied_at).toBeNull();
      expect(captureEntry.mirror).toBeNull();
    });
  });

  test('does NOT write a learning-candidate entry when QA passes (ready: true)', async () => {
    const adapters = makePassingQaAdapters();

    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa', adapters);

      // A passing QA should NOT write a candidate via the ship-blocking capture.
      // The passing adapters don't emit any learning_candidates, so the file
      // should not exist at all.
      expect(run.exists('.planning/current/qa/learning-candidates.json')).toBe(false);
    });
  });

  test('QA status is written correctly even when capture fires', async () => {
    // Verifies best-effort: the QA status is written correctly even when
    // the ship-blocking capture fires on the failing path.
    const findings = ['Payment flow throws uncaught exception on retry.'];
    const adapters = makeFailingQaAdapters(findings);

    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      // /qa completes normally even when defects are found (ready: false)
      await run('qa', adapters);

      // QA status is still written correctly despite capture
      const qaStatus = await run.readJson('.planning/current/qa/status.json');
      expect(qaStatus.stage).toBe('qa');
      expect(qaStatus.state).toBe('completed');
      expect(qaStatus.decision).toBe('qa_recorded');
      expect(qaStatus.ready).toBe(false);
      expect(qaStatus.defect_count).toBe(1);

      // And the learning candidate is present
      expect(run.exists('.planning/current/qa/learning-candidates.json')).toBe(true);
    });
  });
});

// ─── Option C: v1-merge regression guard ─────────────────────────────────────
//
// Regression guard for the data-loss bug fixed in Task 21 (c983df9).
// When applyNormalizationPlan writes a schema_version: 1 auditor record for
// the qa stage, THEN captureQaShipBlockingLearning calls writeLearningCandidate,
// the pre-fix `=== 2` guard would discard the v1 file and overwrite it.
// The fix extends the guard to `=== 1 || === 2` so both are merged.
//
// We use the "manual v1 file + direct helper call" form because wiring
// learning_candidates into the fake-adapter raw_output is disproportionate
// for this guard.

describe('/qa v1-merge integration: auditor candidates survive Task 22 capture', () => {
  test('pre-existing v1 auditor candidates are preserved after Task 22 capture call', async () => {
    // ORDERING NOTE: This test replicates the real execution order inside
    // runQa — applyNormalizationPlan runs first (writes the v1 auditor record),
    // then captureQaShipBlockingLearning calls writeLearningCandidate.
    // The capture MUST run after normalization; if the order were reversed,
    // normalization's removeWrites pass would delete the file.
    //
    // This is a focused integration test verifying the merge behavior that
    // guards against the overwrite bug, using the exported capture helper directly.

    await runInTempRepo(async ({ cwd }) => {
      // Step 1: simulate applyNormalizationPlan writing a v1 auditor record
      const candidatesPath = join(cwd, '.planning/current/qa/learning-candidates.json');
      mkdirSync(dirname(candidatesPath), { recursive: true });
      const v1Record = {
        schema_version: 1,
        stage: 'qa',
        run_id: 'integ-run-qa',
        generated_at: '2026-05-17T00:00:00Z',
        candidates: [
          {
            type: 'pitfall',
            key: 'auditor-qa-integ-candidate',
            insight: 'auditor-sourced qa insight',
            confidence: 7,
            source: 'observed',
            files: [],
          },
        ],
      };
      writeFileSync(candidatesPath, JSON.stringify(v1Record, null, 2) + '\n');

      // Step 2: Task 22 capture fires (same run_id, same stage)
      captureQaShipBlockingLearning(
        cwd,
        'integ-run-qa',
        ['Authentication endpoint returns 500 on invalid token.'],
      );

      // Step 3: assert both candidates survive in the merged record
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const merged = JSON.parse(require('fs').readFileSync(candidatesPath, 'utf8'));
      expect(merged.schema_version).toBe(2);
      expect(merged.stage).toBe('qa');
      expect(merged.run_id).toBe('integ-run-qa');
      expect(Array.isArray(merged.candidates)).toBe(true);
      // Both the auditor candidate and the Task 22 capture entry must be present
      expect(merged.candidates.length).toBeGreaterThanOrEqual(2);

      // Auditor candidate not discarded
      const auditorCand = merged.candidates.find(
        (c: { key: string }) => c.key === 'auditor-qa-integ-candidate',
      );
      expect(auditorCand).toBeDefined();
      expect(auditorCand.insight).toBe('auditor-sourced qa insight');

      // Task 22 capture entry present
      const captureCand = merged.candidates.find(
        (c: { writer_skill?: string }) => c.writer_skill === 'qa',
      );
      expect(captureCand).toBeDefined();
      expect(captureCand.schema_version).toBe(2);
      expect(captureCand.type).toBe('pitfall');
      expect(captureCand.key).toMatch(/^qa-defect-/);
    });
  });
});
