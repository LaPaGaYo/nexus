import { describe, expect, test } from 'bun:test';
import { resolveStageAdvisor } from '../../../lib/nexus/completion-advisor/resolver';
import type { StageStatus } from '../../../lib/nexus/types';
import {
  deployReadiness,
  GENERATED_AT,
  pullRequest,
  readyStatus,
  verificationMatrix,
} from './helpers';

describe('completion advisor resolver', () => {
  test('resolves happy-path advisors for governed tail stages', () => {
    const matrix = verificationMatrix();
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

  test('pins review verdict conflicts to a bounded build fix cycle', () => {
    const advisor = resolveStageAdvisor({
      ...readyStatus('review'),
      ready: false,
      gate_decision: 'fail',
      review_complete: true,
      audit_set_complete: true,
      provenance_consistent: true,
      audit_request_ids: {
        codex: 'codex-pass',
        gemini: 'gemini-fail',
      },
      errors: ['Codex audit result: pass; Gemini audit result: fail.'],
    }, GENERATED_AT, { verification_matrix: verificationMatrix() });

    expect(advisor).toMatchObject({
      stage: 'review',
      stage_outcome: 'requires_choice',
      interaction_mode: 'required_choice',
      choice_reason: 'review failed',
      default_action_id: 'run_build_fix_cycle',
      primary_next_actions: [
        expect.objectContaining({ surface: '/build' }),
      ],
    });
  });
});
