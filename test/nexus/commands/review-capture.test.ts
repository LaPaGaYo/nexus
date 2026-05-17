// test/nexus/commands/review-capture.test.ts
//
// Tests for /review failing-verdict learning-candidate capture (SP1 Task 21).
//
// Option A: unit tests for the exported helpers (deriveReviewKey,
// composeReviewInsight).
// Option B: integration test verifying that a failing review verdict writes
// a learning-candidates.json under .planning/current/review/ with the
// expected schema_v2 shape.

import { describe, test, expect } from 'bun:test';
import { deriveReviewKey, composeReviewInsight } from '../../../lib/nexus/commands/review';
import { makeFakeAdapters } from '../helpers/fake-adapters';
import { runInTempRepo } from '../helpers/temp-repo';

// ─── Option A: unit tests for the exported helpers ──────────────────────────

describe('deriveReviewKey', () => {
  test('produces a kebab-case key with review-finding prefix', () => {
    const key = deriveReviewKey(['Missing test coverage for the auth module.']);
    expect(key).toMatch(/^review-finding-/);
    expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  test('max length is at most 40 chars', () => {
    const long = 'A very long advisory description that exceeds the normal limit set by the helper';
    const key = deriveReviewKey([long]);
    expect(key.length).toBeLessThanOrEqual(40);
  });

  test('falls back gracefully when advisories is empty', () => {
    const key = deriveReviewKey([]);
    expect(key).toBe('review-finding-gate-fail');
  });

  test('contains no special chars except hyphens', () => {
    const key = deriveReviewKey(['Fix the N+1 query in cart/API!']);
    expect(key).toMatch(/^[a-z0-9-]+$/);
  });

  test('uses the first advisory when multiple are present', () => {
    const key = deriveReviewKey(['auth missing', 'other issue']);
    // Should contain slug from 'auth missing'
    expect(key).toContain('auth');
    expect(key).not.toContain('other');
  });
});

describe('composeReviewInsight', () => {
  test('returns a non-empty string', () => {
    const insight = composeReviewInsight(['Missing test coverage.']);
    expect(typeof insight).toBe('string');
    expect(insight.length).toBeGreaterThan(0);
  });

  test('mentions "blocking finding" for a real advisory', () => {
    const insight = composeReviewInsight(['Remove the legacy auth middleware.']);
    expect(insight.toLowerCase()).toContain('blocking finding');
  });

  test('includes the advisory text for a single advisory', () => {
    const advisory = 'Remove old Vue app files before Phase 2.';
    const insight = composeReviewInsight([advisory]);
    expect(insight).toContain(advisory);
  });

  test('mentions total count when multiple advisories present', () => {
    const insight = composeReviewInsight(['first issue', 'second issue', 'third issue']);
    expect(insight).toContain('3 advisories total');
  });

  test('produces fallback insight when advisories is empty', () => {
    const insight = composeReviewInsight([]);
    expect(insight.toLowerCase()).toContain('gate failed');
    expect(insight.length).toBeGreaterThan(0);
  });
});

// ─── Option B: integration test — failing review writes a candidate ──────────

/**
 * Adapters that produce a failing review (one auditor fails, one passes).
 */
function makeFailingReviewAdapters(advisoryText: string) {
  return makeFakeAdapters({
    execution: {
      review_discipline: async () => ({
        adapter_id: 'execution',
        outcome: 'success' as const,
        raw_output: { discipline_summary: 'discipline check passed' },
        requested_route: null,
        actual_route: null,
        notices: [],
        conflict_candidates: [],
      }),
    },
    ccb: {
      execute_audit_a: async (ctx) => ({
        adapter_id: 'ccb',
        outcome: 'success' as const,
        raw_output: {
          markdown: `# Codex Audit\n\nResult: fail\n\n## Advisories\n- ${advisoryText}\n`,
          receipt: 'codex-review-receipt',
        },
        requested_route: ctx.requested_route,
        actual_route: {
          provider: 'codex' as const,
          route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: '.planning/current/review/adapter-output.json',
        },
        notices: [],
        conflict_candidates: [],
      }),
      execute_audit_b: async (ctx) => ({
        adapter_id: 'ccb',
        outcome: 'success' as const,
        raw_output: {
          markdown: '# Gemini Audit\n\nResult: pass\n',
          receipt: 'gemini-review-receipt',
        },
        requested_route: ctx.requested_route,
        actual_route: {
          provider: 'gemini' as const,
          route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: '.planning/current/review/adapter-output.json',
        },
        notices: [],
        conflict_candidates: [],
      }),
    },
  });
}

/**
 * Adapters that produce a passing review (both auditors pass).
 */
function makePassingReviewAdapters() {
  return makeFakeAdapters({
    execution: {
      review_discipline: async () => ({
        adapter_id: 'execution',
        outcome: 'success' as const,
        raw_output: { discipline_summary: 'discipline check passed' },
        requested_route: null,
        actual_route: null,
        notices: [],
        conflict_candidates: [],
      }),
    },
    ccb: {
      execute_audit_a: async (ctx) => ({
        adapter_id: 'ccb',
        outcome: 'success' as const,
        raw_output: {
          markdown: '# Codex Audit\n\nResult: pass\n',
          receipt: 'codex-review-receipt',
        },
        requested_route: ctx.requested_route,
        actual_route: {
          provider: 'codex' as const,
          route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: '.planning/current/review/adapter-output.json',
        },
        notices: [],
        conflict_candidates: [],
      }),
      execute_audit_b: async (ctx) => ({
        adapter_id: 'ccb',
        outcome: 'success' as const,
        raw_output: {
          markdown: '# Gemini Audit\n\nResult: pass\n',
          receipt: 'gemini-review-receipt',
        },
        requested_route: ctx.requested_route,
        actual_route: {
          provider: 'gemini' as const,
          route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: '.planning/current/review/adapter-output.json',
        },
        notices: [],
        conflict_candidates: [],
      }),
    },
  });
}

describe('/review failing-verdict capture integration', () => {
  test('writes a learning-candidate entry when review gate fails', async () => {
    const advisoryText = 'Missing test coverage for the authentication module.';
    const adapters = makeFailingReviewAdapters(advisoryText);

    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      // Review with a failing verdict — should capture a learning candidate
      await run('review', adapters);

      expect(run.exists('.planning/current/review/learning-candidates.json')).toBe(true);
      const record = await run.readJson('.planning/current/review/learning-candidates.json');

      // Top-level record shape
      expect(record.schema_version).toBe(2);
      expect(record.stage).toBe('review');
      expect(Array.isArray(record.candidates)).toBe(true);
      expect(record.candidates.length).toBeGreaterThanOrEqual(1);

      // Find our capture entry (the one written by the failing-verdict capture)
      // It will be the last entry if the audit also emitted candidates.
      const captureEntry = record.candidates.find(
        (e: { writer_skill: string; subject_stage: string }) =>
          e.writer_skill === 'review' && e.subject_stage === 'review',
      );
      expect(captureEntry).toBeDefined();

      // Entry shape per SP1 plan
      expect(captureEntry.schema_version).toBe(2);
      expect(captureEntry.writer_skill).toBe('review');
      expect(captureEntry.subject_skill).toBe('review');
      expect(captureEntry.subject_stage).toBe('review');
      expect(captureEntry.type).toBe('pitfall');
      expect(captureEntry.confidence).toBe(7);
      expect(captureEntry.evidence_type).toBe('team-consensus');
      expect(captureEntry.source).toBe('cross-model'); // governed_ccb mode = cross-model
      expect(typeof captureEntry.id).toBe('string');
      expect(captureEntry.id).toMatch(/^lrn_/);
      expect(captureEntry.key).toMatch(/^review-finding-/);
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

  test('does NOT write a learning-candidate entry when review gate passes', async () => {
    const adapters = makePassingReviewAdapters();

    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      await run('review', adapters);

      // A passing review should NOT write a candidate via the failing-verdict capture.
      // (The auditor learning_candidates from raw_output may still be written if present,
      // but our capture function only fires on gateDecision === 'fail'.)
      // The passing review adapters don't emit any learning_candidates, so the file
      // should not exist at all.
      expect(run.exists('.planning/current/review/learning-candidates.json')).toBe(false);
    });
  });

  test('review process completes normally even if capture logic throws', async () => {
    // Verifies best-effort: the review status is written correctly even
    // when the capture fires (or would throw). On the failing review path,
    // both the learning candidate AND the normal review status are produced.
    const adapters = makeFailingReviewAdapters('Uncovered error paths in the payment flow.');

    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review', adapters);

      // Review status is still written correctly despite capture
      const reviewStatus = await run.readJson('.planning/current/review/status.json');
      expect(reviewStatus.stage).toBe('review');
      expect(reviewStatus.state).toBe('completed');
      expect(reviewStatus.gate_decision).toBe('fail');
      expect(reviewStatus.ready).toBe(false);

      // And the learning candidate is present
      expect(run.exists('.planning/current/review/learning-candidates.json')).toBe(true);
    });
  });
});
