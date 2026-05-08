import { describe, expect, test } from 'bun:test';
import { resolveStageAdvisor } from '../../../lib/nexus/completion-advisor/resolver';
import type {
  StageStatus,
  VerificationMatrixRecord,
} from '../../../lib/nexus/types';
import {
  DEPLOY_READINESS,
  GENERATED_AT,
  PULL_REQUEST,
  readyStatus,
  signal,
} from './helpers';

function verificationMatrix(): VerificationMatrixRecord {
  const checklist = {
    source_path: 'references/review/specialists/testing.md',
    applies: false,
    rationale: 'Resolver test checklist.',
    triggers: [],
    support_surfaces: [],
  };

  return {
    schema_version: 1,
    run_id: 'run-1',
    generated_at: GENERATED_AT,
    design_impact: 'none',
    verification_required: true,
    obligations: {
      build: {
        owner_stage: 'build',
        required: true,
        gate_affecting: true,
        expected_artifacts: [],
      },
      review: {
        owner_stage: 'review',
        required: true,
        gate_affecting: true,
        mode: 'full_acceptance',
        expected_artifacts: [],
      },
      qa: {
        owner_stage: 'qa',
        required: true,
        gate_affecting: true,
        design_verification_required: false,
        expected_artifacts: [],
      },
      ship: {
        owner_stage: 'ship',
        required: true,
        gate_affecting: true,
        deploy_readiness_required: true,
        expected_artifacts: [],
      },
    },
    attached_evidence: {
      benchmark: { supported: true, required: false },
      canary: { supported: true, required: false },
      qa_only: { supported: true, required: false },
    },
    checklists: {
      testing: { ...checklist, category: 'testing' },
      security: { ...checklist, category: 'security' },
      maintainability: { ...checklist, category: 'maintainability' },
      performance: { ...checklist, category: 'performance' },
      accessibility: { ...checklist, category: 'accessibility' },
      design: { ...checklist, category: 'design' },
    },
    support_skill_signals: {
      design_review: signal(),
      browse: signal(),
      benchmark: signal(),
      simplify: signal(),
      cso: signal(),
      connect_chrome: signal(),
      setup_browser_cookies: signal(),
    },
  };
}

// pullRequest + deployReadiness fixtures are imported from ./helpers.
// Local aliases keep the rest of the file readable.
const pullRequest = PULL_REQUEST;
const deployReadiness = DEPLOY_READINESS;

describe('completion advisor resolver', () => {
  test('resolves happy-path advisors for governed tail stages', () => {
    const matrix = verificationMatrix();
    // Issue #102: pin specific default_action_id per stage. The pre-PR
    // assertion used `expect.any(String)`, which would not have caught a
    // regression where (e.g.) the build resolver suddenly returned
    // `'run_qa'` instead of `'run_review'`. Pinning the IDs gives the
    // happy-path loop teeth without losing its concision.
    const cases: Array<{
      stage: StageStatus['stage'];
      status: StageStatus;
      expectedPrimarySurface: string;
      expectedActionId: string;
      options?: Parameters<typeof resolveStageAdvisor>[2];
    }> = [
      {
        stage: 'build',
        status: readyStatus('build'),
        expectedPrimarySurface: '/review',
        expectedActionId: 'run_review',
        options: { verification_matrix: matrix },
      },
      {
        stage: 'review',
        status: {
          ...readyStatus('review'),
          gate_decision: 'pass',
          advisory_count: 0,
          advisory_disposition: null,
          review_complete: true,
          audit_set_complete: true,
          provenance_consistent: true,
        },
        expectedPrimarySurface: '/qa',
        expectedActionId: 'run_qa',
        options: { verification_matrix: matrix },
      },
      {
        stage: 'qa',
        status: readyStatus('qa'),
        expectedPrimarySurface: '/ship',
        expectedActionId: 'run_ship',
        options: { verification_matrix: matrix },
      },
      {
        stage: 'ship',
        status: {
          ...readyStatus('ship'),
          pull_request: pullRequest,
        },
        expectedPrimarySurface: '/land',
        expectedActionId: 'run_land',
        options: { verification_matrix: matrix, deploy_readiness: deployReadiness },
      },
      {
        stage: 'closeout',
        status: {
          ...readyStatus('closeout'),
          pull_request: pullRequest,
          archive_required: true,
          archive_state: 'archived',
          learnings_recorded: true,
        },
        expectedPrimarySurface: '/discover',
        expectedActionId: 'run_discover',
        options: {
          ship_pull_request: pullRequest,
          deploy_result: null,
          documentation_synced: true,
          canary_attached: true,
        },
      },
    ];

    for (const { stage, status, expectedPrimarySurface, expectedActionId, options } of cases) {
      const advisor = resolveStageAdvisor(status, GENERATED_AT, options);

      expect(advisor).toMatchObject({
        schema_version: 1,
        run_id: 'run-1',
        stage,
        stage_outcome: 'ready',
        default_action_id: expectedActionId,
      });
      expect(advisor.primary_next_actions.map((action) => action.surface)).toContain(expectedPrimarySurface);
      expect(advisor.hidden_utility_skills).toContain('/nexus-upgrade');
    }
  });

  test('missing artifacts block forward actions and recommend investigation', () => {
    const advisor = resolveStageAdvisor({
      ...readyStatus('build'),
      state: 'blocked',
      decision: 'not_ready',
      ready: false,
      errors: ['Missing required input artifact: .planning/current/build/tdd-evidence.json'],
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });

    expect(advisor).toMatchObject({
      stage: 'build',
      stage_outcome: 'blocked',
      default_action_id: 'run_investigate',
      primary_next_actions: [
        expect.objectContaining({
          kind: 'support_skill',
          surface: '/investigate',
        }),
      ],
    });
    expect(advisor.primary_next_actions.map((action) => action.surface)).not.toContain('/review');
  });

  test('route conflicts resolve to handoff refresh instead of build retry', () => {
    const advisor = resolveStageAdvisor({
      ...readyStatus('build'),
      state: 'blocked',
      decision: 'not_ready',
      ready: false,
      errors: ['Route validation is stale after handoff changed.'],
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });

    expect(advisor).toMatchObject({
      stage: 'build',
      stage_outcome: 'blocked',
      default_action_id: 'refresh_handoff',
      primary_next_actions: [
        expect.objectContaining({
          kind: 'canonical_stage',
          surface: '/handoff',
        }),
      ],
    });
  });

  test('preserves discriminated failure paths for review and QA', () => {
    const reviewFailed = resolveStageAdvisor({
      ...readyStatus('review'),
      ready: false,
      gate_decision: 'fail',
      advisory_count: 0,
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });
    expect(reviewFailed).toMatchObject({
      stage: 'review',
      stage_outcome: 'requires_choice',
      interaction_mode: 'required_choice',
      choice_reason: 'review failed',
      default_action_id: 'run_build_fix_cycle',
      primary_next_actions: [
        expect.objectContaining({ surface: '/build' }),
      ],
    });

    const qaBlocked = resolveStageAdvisor({
      ...readyStatus('qa'),
      state: 'blocked',
      decision: 'qa_recorded',
      ready: false,
      errors: ['Malformed QA response'],
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });
    expect(qaBlocked).toMatchObject({
      stage: 'qa',
      stage_outcome: 'requires_choice',
      interaction_mode: 'required_choice',
      choice_reason: 'qa blocked',
      default_action_id: 'retry_qa',
      primary_next_actions: [
        expect.objectContaining({ surface: '/qa' }),
      ],
    });

    const qaFailed = resolveStageAdvisor({
      ...readyStatus('qa'),
      decision: 'qa_recorded',
      ready: false,
      errors: ['Regression found during QA.'],
      defect_count: 1,
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });
    expect(qaFailed).toMatchObject({
      stage: 'qa',
      stage_outcome: 'requires_choice',
      interaction_mode: 'required_choice',
      choice_reason: 'qa failed',
      default_action_id: 'run_build_fix_cycle',
      primary_next_actions: [
        expect.objectContaining({ surface: '/build' }),
      ],
    });
  });

  test('multi-provider review with conflicting verdicts requires advisory disposition', () => {
    // Issue #102 spec: "review advisor sees both Codex and Gemini reports
    // with different verdicts" — the resolver doesn't see the per-provider
    // receipts directly (those are synthesized upstream into gate_decision
    // + advisory_count), but the realistic post-synthesis shape for a
    // conflict is: gate_decision='pass' (the run is not blocked) with
    // advisory_count > 0 (the dissenting provider raised concerns) and no
    // disposition recorded yet. The resolver must then surface the
    // disposition choice rather than auto-advance to /qa.
    const conflictAfterSynthesis = resolveStageAdvisor({
      ...readyStatus('review'),
      gate_decision: 'pass',
      advisory_count: 2,
      advisory_disposition: null,
      review_complete: true,
      audit_set_complete: true,
      provenance_consistent: true,
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });

    expect(conflictAfterSynthesis).toMatchObject({
      stage: 'review',
      stage_outcome: 'requires_choice',
      interaction_mode: 'required_choice',
      requires_user_choice: true,
    });
    // Disposition is the chooser, not auto-advance — the surface set
    // must include the disposition action paths, not bare /qa.
    const actionIds = conflictAfterSynthesis.primary_next_actions.map((action) => action.id);
    expect(actionIds.length).toBeGreaterThan(0);
    expect(conflictAfterSynthesis.default_action_id).not.toBe('run_qa');
  });
});
