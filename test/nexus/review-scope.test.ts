import { describe, expect, test } from 'bun:test';
import {
  boundedFixCycleReviewScopeFromAudits,
  normalizeReviewScopeRecord,
  resolveFixCycleReviewScope,
} from '../../lib/nexus/review-scope';

describe('nexus review scope', () => {
  test('deduplicates semantically equivalent blocking items across dual audits', () => {
    const codexMarkdown = [
      '# Codex Audit',
      '',
      'Result: fail',
      '',
      'Findings:',
      '- Phase 1 task `1.2` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:50-55` requires a seed script for development data, but the repo-visible database scripts still stop at generate/migrate.',
      '- Phase 1 task `1.5` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:67-70` requires a separate worker deployment pipeline, but the only GitHub workflow is CI.',
      '- The Phase 1 exit criterion for the web shell is still not met. `.planning/current/plan/execution-readiness-packet.md:77-82` requires `npm run dev` to show a blank page at localhost, but `apps/web/src/app/page.tsx` renders a styled foundation landing page instead.',
    ].join('\n');
    const geminiMarkdown = [
      '# Gemini Audit',
      '',
      'Result: fail',
      '',
      'Findings:',
      '- Phase 1 task `1.2` is incomplete: Verified that there is no seed script for development data in the repository.',
      '- Phase 1 task `1.5` is incomplete: No separate worker deployment pipeline exists.',
      '- Exit criterion missed: `apps/web/src/app/page.tsx` renders a fully designed foundation landing page, failing the Phase 1 exit criterion which explicitly requires `npm run dev` to show a blank page at localhost.',
    ].join('\n');

    expect(boundedFixCycleReviewScopeFromAudits(codexMarkdown, geminiMarkdown)).toEqual({
      mode: 'bounded_fix_cycle',
      source_stage: 'review',
      blocking_items: [
        'Phase 1 task `1.2` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:50-55` requires a seed script for development data, but the repo-visible database scripts still stop at generate/migrate.',
        'Phase 1 task `1.5` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:67-70` requires a separate worker deployment pipeline, but the only GitHub workflow is CI.',
        'The Phase 1 exit criterion for the web shell is still not met. `.planning/current/plan/execution-readiness-packet.md:77-82` requires `npm run dev` to show a blank page at localhost, but `apps/web/src/app/page.tsx` renders a styled foundation landing page instead.',
      ],
      advisory_policy: 'out_of_scope_advisory',
    });
  });

  test('normalizes an existing duplicated bounded fix-cycle scope before reuse', () => {
    const duplicatedScope = {
      mode: 'bounded_fix_cycle',
      source_stage: 'review',
      blocking_items: [
        'Phase 1 task `1.2` remains incomplete. Requires a seed script for development data.',
        'Phase 1 task `1.2` is incomplete: Verified that there is no seed script for development data in the repository.',
        'Exit criterion missed: `npm run dev` must show a blank page at localhost.',
        'The Phase 1 exit criterion for the web shell is still not met. `npm run dev` must show a blank page at localhost.',
      ],
      advisory_policy: 'out_of_scope_advisory',
    } as const;

    expect(normalizeReviewScopeRecord(duplicatedScope)).toEqual({
      mode: 'bounded_fix_cycle',
      source_stage: 'review',
      blocking_items: [
        'Phase 1 task `1.2` remains incomplete. Requires a seed script for development data.',
        'Exit criterion missed: `npm run dev` must show a blank page at localhost.',
      ],
      advisory_policy: 'out_of_scope_advisory',
    });

    expect(
      resolveFixCycleReviewScope('/unused', {
        run_id: 'run-1',
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        ready: false,
        inputs: [],
        outputs: [],
        started_at: '2026-04-13T00:00:00.000Z',
        completed_at: '2026-04-13T00:00:00.000Z',
        errors: ['Review gate failed; fix cycle required before QA, ship, or closeout'],
        review_scope: duplicatedScope,
      },
      ),
    ).toEqual({
      mode: 'bounded_fix_cycle',
      source_stage: 'review',
      blocking_items: [
        'Phase 1 task `1.2` remains incomplete. Requires a seed script for development data.',
        'Exit criterion missed: `npm run dev` must show a blank page at localhost.',
      ],
      advisory_policy: 'out_of_scope_advisory',
    });
  });
});
