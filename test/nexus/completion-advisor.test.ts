import { describe, expect, test } from 'bun:test';
import {
  buildCloseoutCompletionAdvisor,
  buildFrameCompletionAdvisor,
  buildPlanCompletionAdvisor,
  buildQaCompletionAdvisor,
  buildReviewCompletionAdvisor,
  buildShipCompletionAdvisor,
} from '../../lib/nexus/completion-advisor';
import { stageCompletionAdvisorPath } from '../../lib/nexus/artifacts';
import type {
  CompletionAdvisorRecord,
  DeployReadinessRecord,
  PullRequestRecord,
  StageStatus,
  VerificationMatrixRecord,
} from '../../lib/nexus/types';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

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
            : stage === 'handoff'
              ? 'route_recorded'
              : stage === 'build'
                ? 'build_recorded'
                : 'ready',
    ready: true,
    inputs: [],
    outputs: [],
    started_at: '2026-04-20T00:00:00.000Z',
    completed_at: '2026-04-20T00:00:00.000Z',
    errors: [],
  };
}

function verificationMatrix(designImpact: VerificationMatrixRecord['design_impact']): VerificationMatrixRecord {
  return {
    schema_version: 1,
    run_id: 'run-1',
    generated_at: '2026-04-20T00:00:00.000Z',
    design_impact: designImpact,
    verification_required: designImpact !== 'none',
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
        design_verification_required: designImpact !== 'none',
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
  };
}

describe('nexus completion advisor', () => {
  test('frame advisor surfaces plan as primary and design review only for design-bearing work', () => {
    const status: StageStatus = {
      ...readyStatus('frame'),
      design_impact: 'material',
      design_contract_required: true,
      design_verified: false,
    };

    const advisor = buildFrameCompletionAdvisor(status, '2026-04-20T00:00:00.000Z');

    expect(advisor).toMatchObject({
      schema_version: 1,
      run_id: 'run-1',
      stage: 'frame',
      interaction_mode: 'recommended_choice',
      requires_user_choice: false,
      default_action_id: 'run_plan',
      hidden_compat_aliases: ['/office-hours', '/autoplan', '/plan-ceo-review', '/plan-eng-review'],
      hidden_utility_skills: ['/careful', '/freeze', '/guard', '/unfreeze', '/nexus-upgrade'],
      stop_action: expect.objectContaining({
        kind: 'stop',
        label: 'Stop here',
      }),
      project_setup_gaps: [
        'Design work is in scope, but no design contract artifact is attached yet.',
      ],
    });
    expect(advisor.primary_next_actions).toEqual([
      expect.objectContaining({
        id: 'run_plan',
        surface: '/plan',
        invocation: '/plan',
      }),
    ]);
    expect(advisor.recommended_side_skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: '/plan-design-review',
        visibility_reason: 'The run is design-bearing and should tighten the design contract before execution.',
      }),
      expect.objectContaining({
        surface: '/design-consultation',
        visibility_reason: 'Design work is in scope but no design contract artifact has been recorded yet.',
      }),
    ]));
    expect(advisor.suppressed_surfaces).toContain('/plan-ceo-review');
  });

  test('plan advisor is always interactive and carries design-aware setup gaps forward', () => {
    const status: StageStatus = {
      ...readyStatus('plan'),
      design_impact: 'material',
      design_contract_required: true,
      design_contract_path: null,
      design_verified: false,
    };

    const advisor = buildPlanCompletionAdvisor(
      status,
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    expect(advisor).toMatchObject({
      interaction_mode: 'recommended_choice',
      requires_user_choice: false,
      stop_action: expect.objectContaining({
        kind: 'stop',
        label: 'Stop here',
      }),
      project_setup_gaps: [
        'Design verification is still expected before handoff on this run.',
      ],
    });
    expect(advisor.recommended_side_skills).toEqual([
      expect.objectContaining({
        surface: '/plan-design-review',
        visibility_reason: 'The verification matrix marks this run as design-bearing.',
      }),
    ]);
  });

  test('review advisor makes advisory disposition a required runtime-owned choice', () => {
    const status: StageStatus = {
      ...readyStatus('review'),
      gate_decision: 'pass',
      advisory_count: 2,
      advisory_disposition: null,
      review_complete: true,
      audit_set_complete: true,
      provenance_consistent: true,
    };

    const advisor = buildReviewCompletionAdvisor(
      status,
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    expect(advisor.requires_user_choice).toBe(true);
    expect(advisor.interaction_mode).toBe('required_choice');
    expect(advisor.choice_reason).toContain('advisories');
    expect(advisor.stop_action).toBeNull();
    expect(advisor.primary_next_actions.map((action) => action.invocation)).toEqual([
      '/build --review-advisory-disposition fix_before_qa',
      '/qa --review-advisory-disposition continue_to_qa',
      '/qa --review-advisory-disposition defer_to_follow_on',
    ]);
    expect(advisor.recommended_side_skills).toEqual([]);
  });

  test('qa advisor always offers a stop path when ready and keeps design support in the surfaced options', () => {
    const status: StageStatus = {
      ...readyStatus('qa'),
      design_impact: 'material',
    };

    const advisor = buildQaCompletionAdvisor(
      status,
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    expect(advisor).toMatchObject({
      interaction_mode: 'recommended_choice',
      requires_user_choice: false,
      stop_action: expect.objectContaining({
        kind: 'stop',
        label: 'Stop here',
      }),
    });
    expect(advisor.recommended_side_skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: '/design-review',
        visibility_reason: 'Design-bearing runs should get a final visual audit before the release gate.',
      }),
      expect.objectContaining({
        surface: '/browse',
        visibility_reason: 'This run changes browser-facing surfaces and should be checked in the browser.',
      }),
    ]));
  });

  test('ship and closeout advisors surface deploy and follow-on work without exposing utilities', () => {
    const shipStatus: StageStatus = {
      ...readyStatus('ship'),
      design_impact: 'material',
      design_verified: true,
      deploy_configured: false,
      deploy_config_source: 'none',
      pull_request: {
        provider: 'github',
        status: 'created',
        number: 8,
        url: 'https://example.com/pr/8',
        state: 'OPEN',
        head_branch: 'codex/run-1',
        head_sha: 'abc123',
        base_branch: 'main',
      },
    };
    const deployReadiness: DeployReadinessRecord = {
      schema_version: 1,
      run_id: 'run-1',
      generated_at: '2026-04-20T00:00:00.000Z',
      configured: false,
      source: 'none',
      contract_path: null,
      primary_surface_label: null,
      platform: null,
      project_type: null,
      production_url: null,
      health_check: null,
      deploy_status_kind: 'none',
      deploy_status_command: null,
      deploy_workflow: null,
      staging_detected: false,
      secondary_surfaces: [],
      notes: [],
    };

    const shipAdvisor = buildShipCompletionAdvisor(
      shipStatus,
      verificationMatrix('material'),
      deployReadiness,
      '2026-04-20T00:00:00.000Z',
    );
    expect(shipAdvisor).toMatchObject({
      interaction_mode: 'recommended_choice',
      stop_action: expect.objectContaining({
        kind: 'stop',
        label: 'Stop here',
      }),
      project_setup_gaps: [
        'Deploy contract is not configured for the primary surface yet.',
      ],
    });
    expect(shipAdvisor.primary_next_actions.map((action) => action.surface)).toEqual([
      '/closeout',
      '/land-and-deploy',
    ]);
    expect(shipAdvisor.recommended_side_skills.map((action) => action.surface)).toEqual([
      '/setup-deploy',
      '/document-release',
    ]);

    const closeoutStatus: StageStatus = {
      ...readyStatus('closeout'),
      pull_request: shipStatus.pull_request,
      archive_required: true,
      archive_state: 'archived',
      learnings_recorded: true,
    };
    const closeoutAdvisor = buildCloseoutCompletionAdvisor(
      closeoutStatus,
      shipStatus.pull_request as PullRequestRecord,
      null,
      false,
      false,
      '2026-04-20T00:00:00.000Z',
    );
    expect(closeoutAdvisor).toMatchObject({
      interaction_mode: 'recommended_choice',
      stop_action: expect.objectContaining({
        kind: 'stop',
        label: 'Stop here',
      }),
    });
    expect(closeoutAdvisor.primary_next_actions.map((action) => action.surface)).toEqual(['/discover']);
    expect(closeoutAdvisor.recommended_side_skills.map((action) => action.surface)).toEqual([
      '/land-and-deploy',
      '/retro',
      '/learn',
      '/document-release',
    ]);
    expect(closeoutAdvisor.hidden_utility_skills).toContain('/nexus-upgrade');
  });

  test('commands persist completion-advisor artifacts with design-aware recommendations', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope\n',
              prd_markdown: '# PRD\n\nProduct\n',
              design_intent: {
                impact: 'material',
                affected_surfaces: ['apps/web/src/app/page.tsx'],
                design_system_source: 'design_md',
                contract_required: true,
                verification_required: true,
              },
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nAdvisories:\n- Tighten spacing consistency.\n',
              receipt: 'codex-audit',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nAdvisories:\n- none\n',
              receipt: 'gemini-audit',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_qa: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              report_markdown: '# QA Report\n\nResult: pass\n',
              ready: true,
              findings: [],
              advisories: [],
              receipt: 'qa-pass',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.generator ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/qa/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
        superpowers: {
          ship_discipline: async () => ({
            adapter_id: 'superpowers',
            outcome: 'success',
            raw_output: {
              release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
              checklist: {
                review_complete: true,
                qa_ready: true,
                merge_ready: true,
              },
              merge_ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        gsd: {
          plan: async () => ({
            adapter_id: 'gsd',
            outcome: 'success',
            raw_output: {
              execution_readiness_packet: '# Execution Readiness Packet\n\nReady\n',
              sprint_contract: '# Sprint Contract\n\nPhase 1\n',
              design_contract: '# Design Contract\n\nVisual system\n',
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
        },
      });

      await run('discover', adapters);
      await run('frame', adapters);
      await run('plan', adapters);
      await run('handoff');
      await run('build');
      await run('review', adapters);
      await run('qa', adapters, undefined, {
        reviewAdvisoryDispositionOverride: 'continue_to_qa',
      });
      await run('ship', adapters);
      await run('closeout', adapters);

      const frameAdvisor = await run.readJson(stageCompletionAdvisorPath('frame')) as CompletionAdvisorRecord;
      expect(frameAdvisor.recommended_side_skills).toEqual(expect.arrayContaining([
        expect.objectContaining({ surface: '/plan-design-review' }),
        expect.objectContaining({ surface: '/design-consultation' }),
      ]));
      expect(frameAdvisor.interaction_mode).toBe('recommended_choice');
      expect(frameAdvisor.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));

      const planAdvisor = await run.readJson(stageCompletionAdvisorPath('plan')) as CompletionAdvisorRecord;
      expect(planAdvisor.primary_next_actions).toEqual([
        expect.objectContaining({ surface: '/handoff' }),
      ]);
      expect(planAdvisor.interaction_mode).toBe('recommended_choice');
      expect(planAdvisor.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));

      const handoffAdvisor = await run.readJson(stageCompletionAdvisorPath('handoff')) as CompletionAdvisorRecord;
      expect(handoffAdvisor.primary_next_actions).toEqual([
        expect.objectContaining({ surface: '/build' }),
      ]);

      const reviewAdvisor = await run.readJson(stageCompletionAdvisorPath('review')) as CompletionAdvisorRecord;
      expect(reviewAdvisor.requires_user_choice).toBe(true);
      expect(reviewAdvisor.primary_next_actions.map((action) => action.invocation)).toEqual([
        '/build --review-advisory-disposition fix_before_qa',
        '/qa --review-advisory-disposition continue_to_qa',
        '/qa --review-advisory-disposition defer_to_follow_on',
      ]);
      expect(reviewAdvisor.interaction_mode).toBe('required_choice');
      expect(reviewAdvisor.stop_action).toBeNull();

      const qaAdvisor = await run.readJson(stageCompletionAdvisorPath('qa')) as CompletionAdvisorRecord;
      expect(qaAdvisor.primary_next_actions).toEqual([
        expect.objectContaining({ surface: '/ship' }),
      ]);
      expect(qaAdvisor.interaction_mode).toBe('recommended_choice');
      expect(qaAdvisor.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
      expect(qaAdvisor.recommended_side_skills).toEqual(expect.arrayContaining([
        expect.objectContaining({ surface: '/benchmark' }),
        expect.objectContaining({ surface: '/design-review' }),
        expect.objectContaining({ surface: '/browse' }),
      ]));

      const shipAdvisor = await run.readJson(stageCompletionAdvisorPath('ship')) as CompletionAdvisorRecord;
      expect(shipAdvisor.primary_next_actions).toEqual(expect.arrayContaining([
        expect.objectContaining({ surface: '/closeout' }),
        expect.objectContaining({ surface: '/land-and-deploy' }),
      ]));
      expect(shipAdvisor.interaction_mode).toBe('recommended_choice');
      expect(shipAdvisor.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
      expect(shipAdvisor.recommended_side_skills).toEqual(expect.arrayContaining([
        expect.objectContaining({ surface: '/setup-deploy' }),
        expect.objectContaining({ surface: '/document-release' }),
      ]));

      const closeoutAdvisor = await run.readJson(stageCompletionAdvisorPath('closeout')) as CompletionAdvisorRecord;
      expect(closeoutAdvisor.primary_next_actions).toEqual([
        expect.objectContaining({ surface: '/discover' }),
      ]);
      expect(closeoutAdvisor.interaction_mode).toBe('recommended_choice');
      expect(closeoutAdvisor.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
      expect(closeoutAdvisor.recommended_side_skills).toEqual(expect.arrayContaining([
        expect.objectContaining({ surface: '/retro' }),
        expect.objectContaining({ surface: '/learn' }),
        expect.objectContaining({ surface: '/document-release' }),
      ]));
    });
  });
});
