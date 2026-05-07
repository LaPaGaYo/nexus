import { describe, expect, test } from 'bun:test';
import {
  attachExternalInstalledSkillRecommendations,
  buildBuildCompletionAdvisor,
  buildCloseoutCompletionAdvisor,
  buildFrameCompletionAdvisor,
  buildHandoffCompletionAdvisor,
  buildPlanCompletionAdvisor,
  buildQaCompletionAdvisor,
  buildReviewCompletionAdvisor,
  buildShipCompletionAdvisor,
} from '../../lib/nexus/completion-advisor';
import { buildCompletionAdvisorWrite } from '../../lib/nexus/completion-advisor/writer';
import { stageCompletionAdvisorPath } from '../../lib/nexus/artifacts';
import { NEXUS_LEDGER_SCHEMA_VERSION } from '../../lib/nexus/types';
import type {
  CompletionAdvisorRecord,
  DeployReadinessRecord,
  PullRequestRecord,
  StageStatus,
} from '../../lib/nexus/types';
import { readyStatus, verificationMatrix } from './completion-advisor/helpers';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus completion advisor', () => {
  test('frame advisor surfaces plan as primary and design review only for design-bearing work', () => {
    const status: StageStatus = {
      ...readyStatus('frame'),
      design_impact: 'material',
      design_contract_required: true,
      design_verified: null,
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

  test('review advisor surfaces simplification, security, and performance follow-ons for categorized advisories', () => {
    const status: StageStatus = {
      ...readyStatus('review'),
      advisory_count: 3,
      advisory_disposition: null,
      advisory_categories: ['maintainability', 'security', 'performance'],
    };

    const advisor = buildReviewCompletionAdvisor(status, verificationMatrix('none'), '2026-04-20T00:00:00.000Z');

    expect(advisor).toMatchObject({
      interaction_mode: 'required_choice',
      requires_user_choice: true,
      choice_reason: 'review advisories require an explicit disposition',
    });
    expect(advisor.recommended_side_skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        surface: '/simplify',
        why_this_skill: expect.stringContaining('maintainability'),
        evidence_signal: expect.objectContaining({
          kind: 'review_advisory',
          checklist_categories: ['maintainability'],
        }),
      }),
      expect.objectContaining({
        surface: '/benchmark',
        evidence_signal: expect.objectContaining({
          checklist_categories: ['performance'],
        }),
      }),
      expect.objectContaining({
        surface: '/cso',
        evidence_signal: expect.objectContaining({
          checklist_categories: ['security'],
        }),
      }),
    ]));
  });

  test('plan advisor keeps design review visible without inventing a pre-handoff verification gap', () => {
    const status: StageStatus = {
      ...readyStatus('plan'),
      design_impact: 'material',
      design_contract_required: true,
      design_contract_path: '.planning/current/plan/design-contract.md',
      design_verified: null,
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
      project_setup_gaps: [],
    });
    expect(advisor.recommended_side_skills).toEqual([
      expect.objectContaining({
        surface: '/plan-design-review',
        visibility_reason: 'The verification matrix marks this run as design-bearing.',
      }),
    ]);
  });

  test('build advisor uses recommended choice mode when design follow-ups are surfaced', () => {
    const advisor = buildBuildCompletionAdvisor(
      readyStatus('build'),
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    expect(advisor.interaction_mode).toBe('recommended_choice');
    expect(advisor.default_action_id).toBe('run_review');
    expect(advisor.primary_next_actions).toEqual([
      expect.objectContaining({ surface: '/review' }),
    ]);
    expect(advisor.recommended_side_skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: '/design-review' }),
      expect.objectContaining({ surface: '/browse' }),
    ]));
    expect(advisor.recommended_side_skills.find((action) => action.surface === '/design-review')?.visibility_reason)
      .toContain('Checklist-backed rationale: design references/review/design-checklist.md');
    expect(advisor.recommended_side_skills.find((action) => action.surface === '/browse')?.visibility_reason)
      .toContain('Checklist-backed rationale: testing references/review/specialists/testing.md');
  });

  test('build advisor keeps the stage chooser visible even without side-skill follow-ups', () => {
    const advisor = buildBuildCompletionAdvisor(
      readyStatus('build'),
      verificationMatrix('none'),
      '2026-04-20T00:00:00.000Z',
    );

    expect(advisor.interaction_mode).toBe('recommended_choice');
    expect(advisor.default_action_id).toBe('run_review');
    expect(advisor.primary_next_actions).toEqual([
      expect.objectContaining({ surface: '/review' }),
    ]);
    expect(advisor.recommended_side_skills).toEqual([]);
    expect(advisor.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
  });

  test('support skill recommendations expose human why and structured evidence signals', () => {
    const advisor = buildBuildCompletionAdvisor(
      readyStatus('build'),
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    const designReview = advisor.recommended_side_skills.find((action) => action.surface === '/design-review');
    const browse = advisor.recommended_side_skills.find((action) => action.surface === '/browse');

    expect(designReview).toMatchObject({
      why_this_skill: 'Use this because the verification matrix ties this run to the design and accessibility checklists.',
      evidence_signal: {
        kind: 'verification_matrix',
        source_paths: ['references/review/design-checklist.md'],
        checklist_categories: ['design', 'accessibility'],
        summary: expect.stringContaining('design'),
      },
    });
    expect(browse).toMatchObject({
      why_this_skill: 'Use this because the verification matrix ties this run to the testing and accessibility checklists.',
      evidence_signal: {
        kind: 'verification_matrix',
        source_paths: ['references/review/specialists/testing.md', 'references/review/design-checklist.md'],
        checklist_categories: ['testing', 'accessibility'],
        summary: expect.stringContaining('testing'),
      },
    });
  });

  test('completion advisor write preserves verification-matrix context for external installed skill ranking', () => {
    const advisor = buildQaCompletionAdvisor(
      readyStatus('qa'),
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    const write = buildCompletionAdvisorWrite(advisor, {
      cwd: '/tmp/project',
      verificationMatrix: verificationMatrix('material'),
      externalSkills: [
        {
          name: 'brand-audit',
          surface: '/brand-audit',
          description: 'External brand audit for design-bearing interface work.',
          path: '/tmp/brand-audit/SKILL.md',
          source_root: '/tmp',
          namespace: 'external_installed',
          tags: ['design', 'design-review'],
        },
      ],
    });
    const persisted = JSON.parse(write.content) as CompletionAdvisorRecord;

    expect(persisted.recommended_external_skills?.map((action) => action.surface)).toEqual([
      '/brand-audit',
    ]);
    expect(persisted.recommended_external_skills?.[0].visibility_reason).toContain('design');
  });

  test('completion advisor write stamps the ledger schema version at the writer boundary', () => {
    const advisor = buildQaCompletionAdvisor(
      readyStatus('qa'),
      verificationMatrix('none'),
      '2026-04-20T00:00:00.000Z',
    );
    const advisorWithoutSchema = { ...advisor } as Partial<CompletionAdvisorRecord>;
    delete advisorWithoutSchema.schema_version;

    const write = buildCompletionAdvisorWrite(advisorWithoutSchema as CompletionAdvisorRecord, {
      cwd: '/tmp/project',
      verificationMatrix: verificationMatrix('none'),
      externalSkills: [],
    });
    const persisted = JSON.parse(write.content) as CompletionAdvisorRecord;

    expect(persisted.schema_version).toBe(NEXUS_LEDGER_SCHEMA_VERSION);
  });

  test('external skill recommendation attach stays inert without external skills', () => {
    const advisor = buildQaCompletionAdvisor(
      readyStatus('qa'),
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
    );

    expect(attachExternalInstalledSkillRecommendations(advisor)).toBe(advisor);
  });

  test('blocked front-half advisors do not surface ready-path actions', () => {
    const frameBlocked = buildFrameCompletionAdvisor({
      ...readyStatus('frame'),
      state: 'blocked',
      decision: 'not_ready',
      ready: false,
      design_impact: 'material',
      design_contract_required: true,
      design_verified: null,
      errors: ['Missing required input artifact: docs/product/idea-brief.md'],
    }, '2026-04-20T00:00:00.000Z');
    expect(frameBlocked).toMatchObject({
      interaction_mode: 'recommended_choice',
      stage_outcome: 'blocked',
      default_action_id: null,
      primary_next_actions: [],
    });
    expect(frameBlocked.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
    expect(frameBlocked.recommended_side_skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: '/plan-design-review' }),
      expect.objectContaining({ surface: '/design-consultation' }),
    ]));

    const planBlocked = buildPlanCompletionAdvisor({
      ...readyStatus('plan'),
      state: 'blocked',
      decision: 'not_ready',
      ready: false,
      design_impact: 'material',
      design_contract_required: true,
      design_contract_path: null,
      design_verified: null,
      errors: ['Plan is not ready for execution'],
    }, verificationMatrix('material'), '2026-04-20T00:00:00.000Z');
    expect(planBlocked).toMatchObject({
      interaction_mode: 'recommended_choice',
      stage_outcome: 'blocked',
      default_action_id: null,
      primary_next_actions: [],
    });
    expect(planBlocked.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
    expect(planBlocked.recommended_side_skills).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: '/plan-design-review' }),
      expect.objectContaining({ surface: '/design-consultation' }),
    ]));

    const handoffBlocked = buildHandoffCompletionAdvisor({
      ...readyStatus('handoff'),
      state: 'blocked',
      ready: false,
      errors: ['Governed route is not approved by Nexus'],
    }, '2026-04-20T00:00:00.000Z');
    expect(handoffBlocked).toMatchObject({
      stage_outcome: 'blocked',
      default_action_id: 'retry_handoff',
      primary_next_actions: [
        expect.objectContaining({
          surface: '/handoff',
          invocation: '/handoff',
        }),
      ],
    });
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
        visibility_reason: expect.stringContaining('Checklist-backed rationale: design references/review/design-checklist.md'),
      }),
      expect.objectContaining({
        surface: '/browse',
        visibility_reason: expect.stringContaining('Checklist-backed rationale: testing references/review/specialists/testing.md'),
      }),
      expect.objectContaining({
        surface: '/connect-chrome',
        visibility_reason: expect.stringContaining('Checklist-backed rationale: testing references/review/specialists/testing.md'),
      }),
    ]));
  });

  test('advisor keeps external installed skills separate from Nexus support skills', () => {
    const status: StageStatus = {
      ...readyStatus('review'),
      gate_decision: 'pass',
      advisory_count: 0,
      advisory_disposition: null,
      review_complete: true,
      audit_set_complete: true,
      provenance_consistent: true,
    };

    const advisor = buildReviewCompletionAdvisor(
      status,
      verificationMatrix('material'),
      '2026-04-20T00:00:00.000Z',
      [
        {
          name: 'brand-audit',
          surface: '/brand-audit',
          description: 'External visual design review and brand quality audit.',
          path: '/tmp/brand-audit/SKILL.md',
          source_root: '/tmp',
          namespace: 'external_installed',
          tags: ['design', 'design-review', 'audit'],
        },
        {
          name: 'review',
          surface: '/review',
          description: 'External code review skill.',
          path: '/tmp/review/SKILL.md',
          source_root: '/tmp',
          namespace: 'nexus_canonical',
          tags: ['code-review'],
        },
      ],
    );

    expect(advisor.recommended_side_skills.map((action) => action.surface)).toContain('/design-review');
    expect(advisor.recommended_external_skills?.map((action) => action.surface)).toEqual(['/brand-audit']);
    expect(advisor.recommended_external_skills?.[0]).toMatchObject({
      kind: 'external_installed_skill',
      label: 'Run installed skill `/brand-audit`',
    });
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
      '/land',
      '/land-and-deploy',
      '/closeout',
    ]);
    expect(shipAdvisor.recommended_side_skills.map((action) => action.surface)).toEqual([
      '/setup-deploy',
      '/document-release',
    ]);
    expect(shipAdvisor.recommended_side_skills.find((action) => action.surface === '/setup-deploy')).toMatchObject({
      why_this_skill: expect.stringContaining('deploy contract is still missing'),
      evidence_signal: {
        kind: 'stage_status',
        summary: expect.stringContaining('primary deploy contract is still missing'),
        source_paths: [],
        checklist_categories: [],
      },
    });

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
      '/land',
      '/land-and-deploy',
      '/retro',
      '/learn',
      '/document-release',
    ]);
    expect(closeoutAdvisor.hidden_utility_skills).toContain('/nexus-upgrade');
  });

  test('blocked tail advisors do not surface forward lifecycle actions', () => {
    const qaBlocked = buildQaCompletionAdvisor({
      ...readyStatus('qa'),
      state: 'blocked',
      ready: false,
      decision: 'qa_recorded',
      errors: ['Malformed QA response'],
      defect_count: 0,
    }, verificationMatrix('none'), '2026-04-20T00:00:00.000Z');
    expect(qaBlocked).toMatchObject({
      interaction_mode: 'required_choice',
      stage_outcome: 'requires_choice',
      default_action_id: 'retry_qa',
    });
    expect(qaBlocked.primary_next_actions.map((action) => action.surface)).toEqual(['/qa']);

    const qaFailed = buildQaCompletionAdvisor({
      ...readyStatus('qa'),
      ready: false,
      errors: ['Login form is broken'],
      defect_count: 1,
    }, verificationMatrix('none'), '2026-04-20T00:00:00.000Z');
    expect(qaFailed).toMatchObject({
      interaction_mode: 'required_choice',
      stage_outcome: 'requires_choice',
      default_action_id: 'run_build_fix_cycle',
    });
    expect(qaFailed.primary_next_actions.map((action) => action.surface)).toEqual(['/build']);

    const shipBlocked = buildShipCompletionAdvisor({
      ...readyStatus('ship'),
      state: 'blocked',
      ready: false,
      decision: 'ship_recorded',
      errors: ['Merge is not ready'],
    }, verificationMatrix('none'), null, '2026-04-20T00:00:00.000Z');
    expect(shipBlocked).toMatchObject({
      interaction_mode: 'summary_only',
      stage_outcome: 'blocked',
      default_action_id: null,
      primary_next_actions: [],
    });
    expect(shipBlocked.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));

    const closeoutBlocked = buildCloseoutCompletionAdvisor({
      ...readyStatus('closeout'),
      state: 'blocked',
      ready: false,
      decision: 'closeout_recorded',
      errors: ['Archive is required but missing'],
    }, null, null, false, false, '2026-04-20T00:00:00.000Z');
    expect(closeoutBlocked).toMatchObject({
      interaction_mode: 'summary_only',
      stage_outcome: 'blocked',
      default_action_id: null,
      primary_next_actions: [],
    });
    expect(closeoutBlocked.stop_action).toEqual(expect.objectContaining({ kind: 'stop' }));
  });

  test('commands persist completion-advisor artifacts with design-aware recommendations', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        discovery: {
          frame: async () => ({
            adapter_id: 'discovery',
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
        execution: {
          ship_discipline: async () => ({
            adapter_id: 'execution',
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
        planning: {
          plan: async () => ({
            adapter_id: 'planning',
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
            adapter_id: 'planning',
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
      const frameResult = await run('frame', adapters);
      const planResult = await run('plan', adapters);
      const handoffResult = await run('handoff');
      const buildResult = await run('build');
      const reviewResult = await run('review', adapters);
      const qaResult = await run('qa', adapters, undefined, {
        reviewAdvisoryDispositionOverride: 'continue_to_qa',
      });
      const shipResult = await run('ship', adapters);
      const closeoutResult = await run('closeout', adapters);

      expect(frameResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'frame' }));
      expect(planResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'plan' }));
      expect(handoffResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'handoff' }));
      expect(buildResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'build' }));
      expect(reviewResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'review' }));
      expect(qaResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'qa' }));
      expect(shipResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'ship' }));
      expect(closeoutResult.completion_advisor).toEqual(expect.objectContaining({ stage: 'closeout' }));

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
        expect.objectContaining({ surface: '/land' }),
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
