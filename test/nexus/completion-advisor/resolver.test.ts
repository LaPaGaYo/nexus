import { describe, expect, test } from 'bun:test';
import { resolveStageAdvisor } from '../../../lib/nexus/completion-advisor/resolver';
import type {
  DeployReadinessRecord,
  PullRequestRecord,
  StageStatus,
  VerificationMatrixRecord,
} from '../../../lib/nexus/types';

const GENERATED_AT = '2026-04-20T00:00:00.000Z';

function readyStatus(stage: StageStatus['stage']): StageStatus {
  return {
    run_id: 'run-1',
    stage,
    state: 'completed',
    decision: stage === 'review'
      ? 'audit_recorded'
      : stage === 'qa'
        ? 'qa_recorded'
        : stage === 'ship'
          ? 'ship_recorded'
          : stage === 'closeout'
            ? 'closeout_recorded'
            : stage === 'build'
              ? 'build_recorded'
              : 'ready',
    ready: true,
    inputs: [],
    outputs: [],
    started_at: GENERATED_AT,
    completed_at: GENERATED_AT,
    errors: [],
  };
}

function signal(suggested = false) {
  return {
    suggested,
    reason: suggested ? 'Resolver test support signal.' : null,
    checklist_rationale: [],
  };
}

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

const pullRequest: PullRequestRecord = {
  provider: 'github',
  status: 'created',
  number: 72,
  url: 'https://example.com/pr/72',
  state: 'OPEN',
  head_branch: 'codex/run-1',
  head_sha: 'abc123',
  base_branch: 'main',
};

const deployReadiness: DeployReadinessRecord = {
  schema_version: 1,
  run_id: 'run-1',
  generated_at: GENERATED_AT,
  configured: true,
  source: 'canonical_contract',
  contract_path: '.planning/current/ship/deploy-readiness.json',
  primary_surface_label: 'web',
  platform: 'github_actions',
  project_type: 'web_app',
  production_url: 'https://example.com',
  health_check: 'https://example.com/healthz',
  deploy_status_kind: 'github_actions',
  deploy_status_command: null,
  deploy_workflow: '.github/workflows/deploy.yml',
  staging_detected: false,
  secondary_surfaces: [],
  notes: [],
};

describe('completion advisor resolver', () => {
  test('resolves happy-path advisors for governed tail stages', () => {
    const matrix = verificationMatrix();
    const cases: Array<{
      stage: StageStatus['stage'];
      status: StageStatus;
      expectedPrimarySurface: string;
      options?: Parameters<typeof resolveStageAdvisor>[2];
    }> = [
      {
        stage: 'build',
        status: readyStatus('build'),
        expectedPrimarySurface: '/review',
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
        options: { verification_matrix: matrix },
      },
      {
        stage: 'qa',
        status: readyStatus('qa'),
        expectedPrimarySurface: '/ship',
        options: { verification_matrix: matrix },
      },
      {
        stage: 'ship',
        status: {
          ...readyStatus('ship'),
          pull_request: pullRequest,
        },
        expectedPrimarySurface: '/land',
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
        options: {
          ship_pull_request: pullRequest,
          deploy_result: null,
          documentation_synced: true,
          canary_attached: true,
        },
      },
    ];

    for (const { stage, status, expectedPrimarySurface, options } of cases) {
      const advisor = resolveStageAdvisor(status, GENERATED_AT, options);

      expect(advisor).toMatchObject({
        schema_version: 1,
        run_id: 'run-1',
        stage,
        stage_outcome: 'ready',
        default_action_id: expect.any(String),
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
});
