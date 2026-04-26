import { describe, expect, test } from 'bun:test';
import {
  DESIGN_IMPACTS,
  CANONICAL_COMMANDS,
  ACTUAL_ROUTE_TRANSPORTS,
  CONTINUATION_ADVICE_OPTIONS,
  CANARY_EVIDENCE_STATUSES,
  COMPLETION_ADVISOR_INTERACTION_MODES,
  COMPLETION_ADVISOR_ACTION_KINDS,
  DEPLOY_CONFIG_SOURCES,
  DEPLOY_RESULT_CI_STATUSES,
  DEPLOY_RESULT_FAILURE_KINDS,
  DEPLOY_RESULT_NEXT_ACTIONS,
  DEPLOY_RESULT_PHASES,
  DEPLOY_PLATFORMS,
  DEPLOY_PROJECT_TYPES,
  DEPLOY_STATUS_KINDS,
  DEPLOY_TRIGGER_KINDS,
  LEARNING_SOURCES,
  LEARNING_TYPES,
  REPO_RETRO_ARCHIVE_MODES,
  type DeployContractRecord,
  type CompletionAdvisorRecord,
  type DeployResultRecord,
  type DiscoverRetroContinuityRecord,
  type DeployReadinessRecord,
  type FollowOnEvidenceSummaryRecord,
  type LearningCandidate,
  type RepoRetroArchiveRecord,
  type ReviewAuditReceiptRecord,
  type PullRequestRecord,
  type RunLearningsRecord,
  type StageLearningCandidatesRecord,
  type VerificationMatrixRecord,
  type SessionContinuationAdviceRecord,
  STAGE_DECISIONS,
  PLACEHOLDER_OUTCOME,
  RUN_STATUSES,
  ROUTE_VALIDATION_TRANSPORTS,
  type DesignImpact,
  type DesignIntentRecord,
  WORKSPACE_RETIREMENT_STATES,
  type ActualRouteRecord,
  type CanaryStatusRecord,
  type ImplementationProvenanceRecord,
  type RequestedRouteRecord,
  type RouteCheckRecord,
  type RouteValidationRecord,
  type RunLedger,
  type SessionRootRecord,
  type StageStatus,
  type WorkspaceRecord,
} from '../../lib/nexus/types';
import {
  frameDesignIntentPath,
  planDesignContractPath,
  planVerificationMatrixPath,
  stageCompletionAdvisorPath,
  qaPerfVerificationPath,
  discoverNextRunBootstrapJsonPath,
  discoverNextRunMarkdownPath,
  discoverRetroContinuityJsonPath,
  discoverRetroContinuityMarkdownPath,
  discoverSessionContinuationAdvicePath,
  discoverSessionContinuationMarkdownPath,
  deployContractJsonPath,
  deployContractMarkdownPath,
  retroArchiveJsonPath,
  retroArchiveMarkdownPath,
  reviewLearningCandidatesPath,
  reviewAttemptsRootPath,
  reviewAttemptAuditMarkdownPath,
  reviewAttemptAuditReceiptPath,
  qaLearningCandidatesPath,
  shipDeployReadinessPath,
  shipDeployResultPath,
  shipCanaryStatusPath,
  shipLearningCandidatesPath,
  closeoutLearningsMarkdownPath,
  closeoutLearningsJsonPath,
  closeoutFollowOnSummaryMarkdownPath,
  closeoutFollowOnSummaryJsonPath,
  closeoutDocumentationSyncPath,
  archivedCurrentArtifactPath,
} from '../../lib/nexus/artifacts';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { executionFieldsFromLedger, withExecutionSessionRoot } from '../../lib/nexus/execution-topology';

describe('nexus types', () => {
  test('freezes placeholder outcome model', () => {
    expect(PLACEHOLDER_OUTCOME).toEqual({
      state: 'blocked',
      decision: 'not_implemented',
      ready: false,
    });
  });

  test('freezes the run-level status enum', () => {
    expect(RUN_STATUSES).toEqual(['active', 'blocked', 'completed', 'refused']);
  });

  test('freezes the design impact model', () => {
    expect(DESIGN_IMPACTS).toEqual(['none', 'touchup', 'material']);

    const impact: DesignImpact = 'material';
    const intent: DesignIntentRecord = {
      impact,
      affected_surfaces: ['apps/web/src/app/page.tsx'],
      design_system_source: 'design_md',
      contract_required: true,
      verification_required: true,
    };

    const stage: StageStatus = {
      run_id: 'run-1',
      stage: 'frame',
      state: 'in_progress',
      decision: 'none',
      ready: false,
      inputs: [],
      outputs: [],
      started_at: '2026-04-13T00:00:00.000Z',
      completed_at: null,
      errors: [],
      design_impact: impact,
      design_contract_required: intent.contract_required,
      design_contract_path: '.planning/current/plan/design-contract.md',
      design_verified: null,
    };

    expect(stage.design_impact).toBe('material');
    expect(stage.design_contract_required).toBe(true);
    expect(stage.design_contract_path).toBe('.planning/current/plan/design-contract.md');
    expect(stage.design_verified).toBeNull();
  });

  test('freezes the workspace retirement states and fresh-run source', () => {
    expect(WORKSPACE_RETIREMENT_STATES).toEqual([
      'active',
      'retired_pending_cleanup',
      'retained',
      'removed',
    ]);

    const workspace: WorkspaceRecord = {
      path: '/tmp/nexus-worktree',
      kind: 'worktree',
      branch: 'branch/run-1',
      source: 'allocated:fresh_run',
      run_id: 'run-1',
      retirement_state: 'active',
    };

    expect(workspace.source).toBe('allocated:fresh_run');
    expect(workspace.retirement_state).toBe('active');
  });

  test('canonical command ids include the full Nexus surface', () => {
    expect(CANONICAL_COMMANDS).toEqual([
      'discover',
      'frame',
      'plan',
      'handoff',
      'build',
      'review',
      'qa',
      'ship',
      'closeout',
    ]);
  });

  test('freezes the Milestone 2 requested route shape', () => {
    const requested: RequestedRouteRecord = {
      command: 'build',
      governed: true,
      execution_mode: 'governed_ccb',
      primary_provider: 'codex',
      provider_topology: 'multi_session',
      transport: 'ccb',
      planner: 'claude+pm-gsd',
      generator: 'codex-via-ccb',
      evaluator_a: 'codex-via-ccb',
      evaluator_b: 'gemini-via-ccb',
      synthesizer: 'claude',
      substrate: 'superpowers-core',
      fallback_policy: 'disabled',
    };

    expect(requested.generator).toBe('codex-via-ccb');
  });

  test('freezes the Milestone 2 actual route shape', () => {
    const actual: ActualRouteRecord = {
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
      receipt_path: '.planning/current/build/adapter-output.json',
    };

    expect(actual.transport).toBe('ccb');
    expect(ACTUAL_ROUTE_TRANSPORTS).toEqual(['ccb', 'local', null]);
  });

  test('locks route validation and implementation provenance records', () => {
    const validation: RouteValidationRecord = {
      transport: 'ccb',
      available: true,
      approved: false,
      reason: 'availability alone does not approve the route',
      mounted_providers: ['codex', 'gemini'],
      provider_checks: [
        {
          provider: 'codex',
          available: true,
          mounted: true,
          reason: 'CCB codex route check passed',
        },
        {
          provider: 'gemini',
          available: true,
          mounted: true,
          reason: 'CCB gemini route check passed',
        },
      ],
    };
    const provenance: ImplementationProvenanceRecord = {
      path: '.planning/current/build/build-result.md',
      requested_route: {
        command: 'build',
        governed: true,
        execution_mode: 'governed_ccb',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        transport: 'ccb',
        planner: 'claude+pm-gsd',
        generator: 'codex-via-ccb',
        evaluator_a: 'codex-via-ccb',
        evaluator_b: 'gemini-via-ccb',
        synthesizer: 'claude',
        substrate: 'superpowers-core',
        fallback_policy: 'disabled',
      },
      actual_route: null,
    };

    expect(validation.approved).toBe(false);
    expect(validation.provider_checks?.[1]?.provider).toBe('gemini');
    expect(provenance.path).toContain('build-result.md');
    expect(ROUTE_VALIDATION_TRANSPORTS).toEqual(['ccb', 'local', 'none']);
  });

  test('locks the run-level route check shape to the per-provider governed truth', () => {
    const routeCheck: RouteCheckRecord = {
      checked_at: '2026-04-13T00:00:00.000Z',
      requested_route: {
        command: 'build',
        governed: true,
        execution_mode: 'governed_ccb',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        transport: 'ccb',
        planner: 'claude+pm-gsd',
        generator: 'codex-via-ccb',
        evaluator_a: 'codex-via-ccb',
        evaluator_b: 'gemini-via-ccb',
        synthesizer: 'claude',
        substrate: 'superpowers-core',
        fallback_policy: 'disabled',
      },
      route_validation: {
        transport: 'ccb',
        available: true,
        approved: true,
        reason: 'Nexus approved the requested governed route',
        mounted_providers: ['codex', 'gemini'],
        provider_checks: [
          {
            provider: 'codex',
            available: true,
            mounted: true,
            reason: 'CCB codex route check passed',
          },
          {
            provider: 'gemini',
            available: true,
            mounted: true,
            reason: 'CCB gemini route check passed',
          },
        ],
      },
    };

    const ledger: RunLedger = {
      run_id: 'run-1',
      continuation_mode: 'project_reset',
      status: 'active',
      current_command: 'handoff',
      current_stage: 'handoff',
      previous_stage: 'plan',
      allowed_next_stages: ['build'],
      command_history: [],
      artifact_index: {},
      execution: {
        mode: 'governed_ccb',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        requested_path: 'codex-via-ccb',
        actual_path: null,
      },
      route_intent: {
        planner: 'claude+pm-gsd',
        generator: 'codex-via-ccb',
        evaluator_a: 'codex-via-ccb',
        evaluator_b: 'gemini-via-ccb',
        synthesizer: 'claude',
        substrate: 'superpowers-core',
        fallback_policy: 'disabled',
      },
      route_check: routeCheck,
    };

    expect(ledger.route_check?.route_validation.provider_checks?.[1]?.provider).toBe('gemini');
    expect(ledger.route_check?.requested_route.generator).toBe('codex-via-ccb');
  });

  test('threads session root through run ledgers and stage status', () => {
    const sessionRoot: SessionRootRecord = {
      path: '/Users/henry/Documents/nexus',
      kind: 'repo_root',
      source: 'ccb_root',
    };
    const workspace: WorkspaceRecord = {
      path: '/Users/henry/Documents/nexus/.nexus-worktrees/run-1',
      kind: 'worktree',
      branch: 'branch/run-1',
      source: 'allocated:fresh_run',
      run_id: 'run-1',
      retirement_state: 'active',
    };
    const ledger: RunLedger = {
      run_id: 'run-1',
      continuation_mode: 'project_reset',
      status: 'active',
      current_command: 'handoff',
      current_stage: 'handoff',
      previous_stage: 'plan',
      allowed_next_stages: ['build'],
      command_history: [],
      artifact_index: {},
      execution: {
        mode: 'governed_ccb',
        primary_provider: 'codex',
        provider_topology: 'multi_session',
        workspace,
        session_root: sessionRoot,
        requested_path: 'codex-via-ccb',
        actual_path: null,
      },
      route_intent: {
        planner: 'claude+pm-gsd',
        generator: 'codex-via-ccb',
        evaluator_a: 'codex-via-ccb',
        evaluator_b: 'gemini-via-ccb',
        synthesizer: 'claude',
        substrate: 'superpowers-core',
        fallback_policy: 'disabled',
      },
      route_check: null,
    };

    const updatedLedger = withExecutionSessionRoot(ledger, sessionRoot);
    const status: StageStatus = {
      run_id: 'run-1',
      stage: 'handoff',
      state: 'in_progress',
      decision: 'none',
      ready: false,
      inputs: [],
      outputs: [],
      started_at: '2026-04-13T00:00:00.000Z',
      completed_at: null,
      errors: [],
      ...executionFieldsFromLedger(updatedLedger),
    };

    expect(updatedLedger.execution.session_root).toEqual(sessionRoot);
    expect(status.session_root).toEqual(sessionRoot);
    expect(status.workspace).toEqual(workspace);
  });

  test('freezes the governed tail lifecycle decisions', () => {
    expect(STAGE_DECISIONS).toContain('qa_recorded');
    expect(STAGE_DECISIONS).toContain('ship_recorded');
  });

  test('freezes the design artifact helper paths', () => {
    expect(frameDesignIntentPath()).toBe('.planning/current/frame/design-intent.json');
  });

  test('freezes the completion-advisor interaction contract', () => {
    expect(COMPLETION_ADVISOR_INTERACTION_MODES).toEqual([
      'required_choice',
      'recommended_choice',
      'summary_only',
    ]);
    expect(COMPLETION_ADVISOR_ACTION_KINDS).toContain('external_installed_skill');
    expect(stageCompletionAdvisorPath('review')).toBe('.planning/current/review/completion-advisor.json');

    const advisor: CompletionAdvisorRecord = {
      schema_version: 1,
      run_id: 'run-1',
      stage: 'review',
      generated_at: '2026-04-20T00:00:00.000Z',
      stage_outcome: 'requires_choice',
      interaction_mode: 'required_choice',
      summary: 'Review passed with advisories. Choose a disposition before QA.',
      requires_user_choice: true,
      choice_reason: 'review advisories require an explicit disposition',
      default_action_id: 'fix_before_qa',
      primary_next_actions: [
        {
          id: 'fix_before_qa',
          kind: 'disposition',
          surface: '/build',
          invocation: '/build --review-advisory-disposition fix_before_qa',
          label: 'Fix advisories before QA',
          description: 'Run a bounded fix cycle now, then return through `/review` before QA.',
          recommended: true,
          visibility_reason: 'Use this when you want to tighten non-blocking findings before formal QA.',
          why_this_skill: null,
          evidence_signal: null,
        },
      ],
      alternative_next_actions: [],
      recommended_side_skills: [],
      stop_action: null,
      project_setup_gaps: [],
      hidden_compat_aliases: ['/office-hours', '/autoplan', '/plan-ceo-review', '/plan-eng-review'],
      hidden_utility_skills: ['/careful', '/freeze', '/guard', '/unfreeze', '/nexus-upgrade'],
      suppressed_surfaces: [
        '/office-hours',
        '/autoplan',
        '/plan-ceo-review',
        '/plan-eng-review',
        '/careful',
        '/freeze',
        '/guard',
        '/unfreeze',
        '/nexus-upgrade',
      ],
    };

    expect(advisor.stop_action).toBeNull();
    expect(advisor.primary_next_actions[0]?.visibility_reason).toContain('formal QA');
    expect(advisor.primary_next_actions[0]?.why_this_skill).toBeNull();
    expect(advisor.primary_next_actions[0]?.evidence_signal).toBeNull();
  });

  test('freezes the learning schema and artifact helpers', () => {
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
    expect(reviewLearningCandidatesPath()).toBe(
      '.planning/current/review/learning-candidates.json',
    );
    expect(qaLearningCandidatesPath()).toBe('.planning/current/qa/learning-candidates.json');
    expect(shipLearningCandidatesPath()).toBe('.planning/current/ship/learning-candidates.json');
    expect(closeoutLearningsMarkdownPath()).toBe('.planning/current/closeout/LEARNINGS.md');
    expect(closeoutLearningsJsonPath()).toBe('.planning/current/closeout/learnings.json');
    expect(closeoutFollowOnSummaryMarkdownPath()).toBe('.planning/current/closeout/FOLLOW-ON-SUMMARY.md');
    expect(closeoutFollowOnSummaryJsonPath()).toBe('.planning/current/closeout/follow-on-summary.json');

    const followOnSummary: FollowOnEvidenceSummaryRecord = {
      schema_version: 1,
      run_id: 'run-1',
      generated_at: '2026-04-18T00:00:00.000Z',
      source_artifacts: [
        '.planning/current/qa/perf-verification.md',
        '.planning/current/ship/canary-status.json',
      ],
      evidence: {
        qa: {
          perf_verification_path: '.planning/current/qa/perf-verification.md',
        },
        ship: {
          canary_status_path: '.planning/current/ship/canary-status.json',
          canary_status: 'healthy',
          deploy_result_path: '.planning/current/ship/deploy-result.json',
          deploy_status: 'verified',
          verification_status: 'healthy',
          production_url: 'https://example.com',
        },
        closeout: {
          documentation_sync_path: '.planning/current/closeout/documentation-sync.md',
        },
      },
      summary: 'QA performance evidence recorded. Ship canary evidence recorded (healthy).',
    };
    expect(followOnSummary.evidence.ship.deploy_status).toBe('verified');

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
    const stageLearningCandidates: StageLearningCandidatesRecord = {
      schema_version: 1,
      run_id: 'run-1',
      stage: 'review',
      generated_at: '2026-04-16T00:00:00.000Z',
      candidates: [candidate],
    };
    const runLearnings: RunLearningsRecord = {
      schema_version: 1,
      run_id: 'run-1',
      generated_at: '2026-04-16T00:00:00.000Z',
      source_candidates: ['.planning/current/review/learning-candidates.json'],
      learnings: [
        {
          ...candidate,
          origin_stage: 'review',
        },
      ],
    };

    expect(candidate.type).toBe('pitfall');
    expect(status.learning_candidates_path).toBe(
      '.planning/current/review/learning-candidates.json',
    );
    expect(stageLearningCandidates.candidates).toHaveLength(1);
    expect(runLearnings.learnings[0]?.origin_stage).toBe('review');
  });

  test('freezes the continuation advisory schema and artifact helpers', () => {
    expect(CONTINUATION_ADVICE_OPTIONS).toEqual([
      'continue_here',
      'compact_then_continue',
      'fresh_session_continue',
    ]);
    expect(discoverNextRunMarkdownPath()).toBe('.planning/current/discover/NEXT-RUN.md');
    expect(discoverNextRunBootstrapJsonPath()).toBe(
      '.planning/current/discover/next-run-bootstrap.json',
    );
    expect(discoverSessionContinuationAdvicePath()).toBe(
      '.planning/current/discover/session-continuation-advice.json',
    );
    expect(discoverSessionContinuationMarkdownPath()).toBe(
      '.planning/current/discover/SESSION-CONTINUATION.md',
    );
    expect(discoverRetroContinuityJsonPath()).toBe(
      '.planning/current/discover/retro-continuity.json',
    );
    expect(discoverRetroContinuityMarkdownPath()).toBe(
      '.planning/current/discover/RETRO-CONTINUITY.md',
    );

    const record: SessionContinuationAdviceRecord = {
      schema_version: 1,
      run_id: 'run-1',
      boundary_kind: 'fresh_run_phase',
      continuation_mode: 'phase',
      lifecycle_can_continue_here: true,
      recommended_option: 'compact_then_continue',
      available_options: [
        'continue_here',
        'compact_then_continue',
        'fresh_session_continue',
      ],
      host_compact_supported: false,
      resume_artifacts: [
        '.planning/current/discover/NEXT-RUN.md',
        '.planning/current/discover/next-run-bootstrap.json',
      ],
      supporting_context_artifacts: [
        '.planning/current/discover/retro-continuity.json',
        '.planning/current/discover/RETRO-CONTINUITY.md',
      ],
      recommended_next_command: '/frame',
      summary: 'Nexus can continue in this session.',
      generated_at: '2026-04-16T00:00:00.000Z',
    };

    expect(record.recommended_option).toBe('compact_then_continue');
  });

  test('freezes the retro archive schema and artifact helpers', () => {
    expect(REPO_RETRO_ARCHIVE_MODES).toEqual(['repo', 'compare']);
    expect(retroArchiveJsonPath('2026-04-17-01')).toBe(
      '.planning/archive/retros/2026-04-17-01/retro.json',
    );
    expect(retroArchiveMarkdownPath('2026-04-17-01')).toBe(
      '.planning/archive/retros/2026-04-17-01/RETRO.md',
    );

    const archive: RepoRetroArchiveRecord = {
      schema_version: 1,
      retro_id: '2026-04-17-01',
      mode: 'repo',
      date: '2026-04-17',
      window: '7d',
      generated_at: '2026-04-17T00:00:00.000Z',
      repository_root: '/tmp/repo',
      linked_run_ids: ['run-1'],
      source_artifacts: [
        '.planning/archive/runs/run-1/closeout/CLOSEOUT-RECORD.md',
        '.planning/archive/runs/run-1/closeout/learnings.json',
      ],
      summary: 'Fresh run should continue with recent retro context.',
      key_findings: ['Review latency is improving.'],
      recommended_attention_areas: ['auth boundary cleanup'],
    };
    const continuity: DiscoverRetroContinuityRecord = {
      schema_version: 1,
      run_id: 'run-2',
      generated_at: '2026-04-17T00:00:01.000Z',
      source_retro_artifacts: [
        '.planning/archive/retros/2026-04-17-01/retro.json',
      ],
      recent_findings: ['Review latency is improving.'],
      recommended_attention_areas: ['auth boundary cleanup'],
      summary: 'Fresh run is continuing with 1 recent retrospective as historical context.',
    };

    expect(archive.mode).toBe('repo');
    expect(continuity.source_retro_artifacts).toContain(
      '.planning/archive/retros/2026-04-17-01/retro.json',
    );
  });

  test('freezes the canonical deploy contract schema and artifact helpers', () => {
    expect(DEPLOY_PLATFORMS).toEqual([
      'fly',
      'render',
      'vercel',
      'netlify',
      'heroku',
      'railway',
      'github_actions',
      'custom',
      'none',
      'unknown',
    ]);
    expect(DEPLOY_PROJECT_TYPES).toEqual([
      'web_app',
      'api',
      'cli',
      'library',
      'service',
      'unknown',
    ]);
    expect(DEPLOY_TRIGGER_KINDS).toEqual(['auto_on_push', 'github_actions', 'command', 'manual', 'none']);
    expect(DEPLOY_STATUS_KINDS).toEqual(['http', 'command', 'github_actions', 'none']);
    expect(DEPLOY_CONFIG_SOURCES).toEqual(['canonical_contract', 'legacy_claude', 'none']);
    expect(DEPLOY_RESULT_PHASES).toEqual(['pre_merge', 'merge_queue', 'post_merge']);
    expect(DEPLOY_RESULT_FAILURE_KINDS).toEqual([
      'pre_merge_ci_failed',
      'pre_merge_conflict',
      'merge_queue_failed',
      'post_merge_deploy_failed',
    ]);
    expect(DEPLOY_RESULT_CI_STATUSES).toEqual(['passed', 'pending', 'failed', 'skipped', 'unknown']);
    expect(DEPLOY_RESULT_NEXT_ACTIONS).toEqual([
      'rerun_land_and_deploy',
      'rerun_ship',
      'rerun_build_review_qa_ship',
      'investigate_deploy',
      'revert',
      'none',
    ]);
    expect(deployContractJsonPath()).toBe('.planning/deploy/deploy-contract.json');
    expect(deployContractMarkdownPath()).toBe('.planning/deploy/DEPLOY-CONTRACT.md');
    expect(shipDeployReadinessPath()).toBe('.planning/current/ship/deploy-readiness.json');
    expect(shipDeployResultPath()).toBe('.planning/current/ship/deploy-result.json');

    const pullRequest: PullRequestRecord = {
      provider: 'github',
      status: 'created',
      number: 42,
      url: 'https://github.com/LaPaGaYo/nexus/pull/42',
      state: 'OPEN',
      head_branch: 'codex/qa-advisories-fix-cycle',
      head_sha: 'abc123def456',
      base_branch: 'main',
      reason: null,
    };
    expect(pullRequest.head_sha).toBe('abc123def456');

    const contract: DeployContractRecord = {
      schema_version: 1,
      configured_at: '2026-04-17T00:00:00.000Z',
      primary_surface_label: 'web',
      platform: 'fly',
      project_type: 'web_app',
      production: {
        url: 'https://my-app.fly.dev',
        health_check: 'https://my-app.fly.dev/health',
      },
      staging: {
        url: 'https://staging.my-app.fly.dev',
        workflow: '.github/workflows/staging.yml',
      },
      deploy_trigger: {
        kind: 'auto_on_push',
        details: 'merge to main triggers deploy',
      },
      deploy_workflow: '.github/workflows/deploy.yml',
      deploy_status: {
        kind: 'command',
        command: 'fly status --app my-app',
      },
      custom_hooks: {
        pre_merge: ['bun test'],
        post_merge: [],
      },
      secondary_surfaces: [
        {
          label: 'worker',
          platform: 'github_actions',
          project_type: 'service',
          production: {
            url: null,
            health_check: null,
          },
          deploy_trigger: {
            kind: 'github_actions',
            details: '.github/workflows/worker-deploy.yml',
          },
          deploy_workflow: '.github/workflows/worker-deploy.yml',
          deploy_status: {
            kind: 'github_actions',
            command: null,
          },
          notes: ['Optional worker deploy path.'],
          sources: ['.github/workflows/worker-deploy.yml'],
        },
      ],
      notes: ['Custom Fly.io domain configured separately'],
      sources: ['fly.toml', '.github/workflows/deploy.yml'],
    };
    const readiness: DeployReadinessRecord = {
      schema_version: 1,
      run_id: 'run-1',
      generated_at: '2026-04-17T00:00:00.000Z',
      configured: true,
      source: 'canonical_contract',
      contract_path: deployContractJsonPath(),
      primary_surface_label: 'web',
      platform: 'fly',
      project_type: 'web_app',
      production_url: 'https://my-app.fly.dev',
      health_check: 'https://my-app.fly.dev/health',
      deploy_status_kind: 'command',
      deploy_status_command: 'fly status --app my-app',
      deploy_workflow: '.github/workflows/deploy.yml',
      staging_detected: true,
      secondary_surfaces: [
        {
          label: 'worker',
          platform: 'github_actions',
          project_type: 'service',
          production_url: null,
          health_check: null,
          deploy_status_kind: 'github_actions',
          deploy_status_command: null,
          deploy_workflow: '.github/workflows/worker-deploy.yml',
          blocking: false,
          notes: ['Optional worker deploy path.'],
        },
      ],
      notes: [],
    };

    expect(contract.platform).toBe('fly');
    expect(contract.primary_surface_label).toBe('web');
    expect(contract.secondary_surfaces[0]?.label).toBe('worker');
    expect(readiness.source).toBe('canonical_contract');
    expect(readiness.contract_path).toBe('.planning/deploy/deploy-contract.json');
    expect(readiness.secondary_surfaces[0]?.platform).toBe('github_actions');

    const deployResult: DeployResultRecord = {
      schema_version: 1,
      generated_at: '2026-04-18T00:00:00.000Z',
      source: 'land-and-deploy',
      phase: 'post_merge',
      failure_kind: null,
      ci_status: 'passed',
      ship_handoff_head_sha: 'abc123def456',
      pull_request_head_sha: 'abc123def456',
      ship_handoff_current: true,
      next_action: 'none',
      production_url: 'https://my-app.fly.dev',
      pull_request_path: '.planning/current/ship/pull-request.json',
      deploy_readiness_path: '.planning/current/ship/deploy-readiness.json',
      canary_status_path: '.planning/current/ship/canary-status.json',
      merge_status: 'merged',
      deploy_status: 'verified',
      verification_status: 'healthy',
      report_markdown_path: '.nexus/deploy-reports/2026-04-18-pr42-deploy.md',
      summary: 'PR #42 merged, deployed, and verified healthy in production.',
    };

    expect(deployResult.source).toBe('land-and-deploy');
    expect(deployResult.deploy_status).toBe('verified');
  });

  test('freezes the verification-matrix schema and artifact helper', () => {
    expect(planVerificationMatrixPath()).toBe('.planning/current/plan/verification-matrix.json');
    expect(qaPerfVerificationPath()).toBe('.planning/current/qa/perf-verification.md');
    expect(shipCanaryStatusPath()).toBe('.planning/current/ship/canary-status.json');
    expect(closeoutDocumentationSyncPath()).toBe('.planning/current/closeout/documentation-sync.md');
    expect(archivedCurrentArtifactPath('run-1', qaPerfVerificationPath())).toBe(
      '.planning/archive/runs/run-1/qa/perf-verification.md',
    );
    expect(archivedCurrentArtifactPath('run-1', shipCanaryStatusPath())).toBe(
      '.planning/archive/runs/run-1/ship/canary-status.json',
    );
    expect(CANARY_EVIDENCE_STATUSES).toEqual(['healthy', 'degraded', 'broken']);

    const matrix: VerificationMatrixRecord = {
      schema_version: 1,
      run_id: 'run-1',
      generated_at: '2026-04-17T00:00:00.000Z',
      design_impact: 'touchup',
      verification_required: true,
      obligations: {
        build: {
          owner_stage: 'build',
          required: true,
          gate_affecting: true,
          expected_artifacts: [
            '.planning/current/build/build-result.md',
            '.planning/current/build/status.json',
          ],
        },
        review: {
          owner_stage: 'review',
          required: true,
          gate_affecting: true,
          mode: 'full_acceptance',
          expected_artifacts: [
            '.planning/audits/current/codex.md',
            '.planning/audits/current/gemini.md',
            '.planning/audits/current/synthesis.md',
            '.planning/audits/current/gate-decision.md',
            '.planning/audits/current/meta.json',
            '.planning/current/review/status.json',
          ],
        },
        qa: {
          owner_stage: 'qa',
          required: true,
          gate_affecting: true,
          design_verification_required: true,
          expected_artifacts: [
            '.planning/current/qa/qa-report.md',
            '.planning/current/qa/status.json',
            '.planning/current/qa/design-verification.md',
          ],
        },
        ship: {
          owner_stage: 'ship',
          required: true,
          gate_affecting: true,
          deploy_readiness_required: true,
          expected_artifacts: [
            '.planning/current/ship/release-gate-record.md',
            '.planning/current/ship/checklist.json',
            '.planning/current/ship/deploy-readiness.json',
            '.planning/current/ship/pull-request.json',
            '.planning/current/ship/status.json',
          ],
        },
      },
      attached_evidence: {
        benchmark: {
          supported: true,
          required: false,
        },
        canary: {
          supported: true,
          required: false,
        },
        qa_only: {
          supported: true,
          required: false,
        },
      },
      checklists: {
        testing: {
          category: 'testing',
          source_path: 'review/specialists/testing.md',
          applies: true,
          rationale: 'Testing checklist is always-on for negative paths, edge cases, isolation, and regression coverage.',
          triggers: ['always_on'],
          support_surfaces: ['/browse', '/connect-chrome'],
        },
        security: {
          category: 'security',
          source_path: 'review/specialists/security.md',
          applies: true,
          rationale: 'Security checklist applies to auth, authorization, backend, webhook, secret, and trust-boundary changes.',
          triggers: ['auth_surface', 'security_sensitive_surface'],
          support_surfaces: ['/cso', '/setup-browser-cookies'],
        },
        maintainability: {
          category: 'maintainability',
          source_path: 'review/specialists/maintainability.md',
          applies: true,
          rationale: 'Maintainability checklist is always-on for complexity, readability, and behavior-preserving cleanup.',
          triggers: ['always_on'],
          support_surfaces: ['/simplify'],
        },
        performance: {
          category: 'performance',
          source_path: 'review/specialists/performance.md',
          applies: true,
          rationale: 'Performance checklist applies to frontend or backend execution paths where rendering, query, bundle, or latency regressions are plausible.',
          triggers: ['browser_facing'],
          support_surfaces: ['/benchmark'],
        },
        accessibility: {
          category: 'accessibility',
          source_path: 'review/design-checklist.md',
          applies: true,
          rationale: 'Accessibility checklist applies to browser-facing UI, keyboard focus, interaction states, and touch targets.',
          triggers: ['browser_facing', 'design_impact'],
          support_surfaces: ['/browse', '/connect-chrome', '/setup-browser-cookies', '/design-review'],
        },
        design: {
          category: 'design',
          source_path: 'review/design-checklist.md',
          applies: true,
          rationale: 'Design checklist applies to design-bearing UI work and visual-system consistency.',
          triggers: ['design_impact'],
          support_surfaces: ['/design-review', '/plan-design-review'],
        },
      },
      support_skill_signals: {
        design_review: {
          suggested: true,
          reason: 'Design-bearing work should expose `/design-review` as a first-class follow-on.',
          checklist_rationale: [
            {
              category: 'design',
              source_path: 'review/design-checklist.md',
              rationale: 'Design checklist applies to design-bearing UI work and visual-system consistency.',
            },
          ],
        },
        browse: {
          suggested: true,
          reason: 'Browser-facing surfaces changed, so `/browse` should be available from the advisor.',
          checklist_rationale: [
            {
              category: 'testing',
              source_path: 'review/specialists/testing.md',
              rationale: 'Testing checklist is always-on for negative paths, edge cases, isolation, and regression coverage.',
            },
          ],
        },
        benchmark: {
          suggested: true,
          reason: 'The verification matrix supports benchmark evidence for this run.',
          checklist_rationale: [
            {
              category: 'performance',
              source_path: 'review/specialists/performance.md',
              rationale: 'Performance checklist applies to frontend or backend execution paths where rendering, query, bundle, or latency regressions are plausible.',
            },
          ],
        },
        simplify: {
          suggested: true,
          reason: 'Maintainability review supports a behavior-preserving simplification pass when complexity advisories appear.',
          checklist_rationale: [
            {
              category: 'maintainability',
              source_path: 'review/specialists/maintainability.md',
              rationale: 'Maintainability checklist is always-on for complexity, readability, and behavior-preserving cleanup.',
            },
          ],
        },
        cso: {
          suggested: true,
          reason: 'Auth, permission, webhook, or security-sensitive surfaces changed, so `/cso` should be available.',
          checklist_rationale: [
            {
              category: 'security',
              source_path: 'review/specialists/security.md',
              rationale: 'Security checklist applies to auth, authorization, backend, webhook, secret, and trust-boundary changes.',
            },
          ],
        },
        connect_chrome: {
          suggested: true,
          reason: 'A browser-facing flow exists, so real-browser verification through `/connect-chrome` is available.',
          checklist_rationale: [
            {
              category: 'accessibility',
              source_path: 'review/design-checklist.md',
              rationale: 'Accessibility checklist applies to browser-facing UI, keyboard focus, interaction states, and touch targets.',
            },
          ],
        },
        setup_browser_cookies: {
          suggested: true,
          reason: 'Authenticated browser verification is likely relevant, so `/setup-browser-cookies` should be available.',
          checklist_rationale: [
            {
              category: 'security',
              source_path: 'review/specialists/security.md',
              rationale: 'Security checklist applies to auth, authorization, backend, webhook, secret, and trust-boundary changes.',
            },
            {
              category: 'accessibility',
              source_path: 'review/design-checklist.md',
              rationale: 'Accessibility checklist applies to browser-facing UI, keyboard focus, interaction states, and touch targets.',
            },
          ],
        },
      },
    };

    expect(matrix.obligations.review.mode).toBe('full_acceptance');
    expect(matrix.obligations.qa.design_verification_required).toBe(true);
    expect(matrix.attached_evidence.qa_only.required).toBe(false);
    expect(matrix.checklists.design.source_path).toBe('review/design-checklist.md');
    expect(matrix.support_skill_signals.benchmark.checklist_rationale[0]?.category).toBe('performance');
    expect(matrix.support_skill_signals.cso.suggested).toBe(true);

    const canary: CanaryStatusRecord = {
      schema_version: 1,
      generated_at: '2026-04-18T00:00:00.000Z',
      source: 'canary',
      url: 'https://example.com',
      duration_minutes: 10,
      pages_monitored: ['/', '/settings'],
      status: 'healthy',
      alerts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 1,
        total: 1,
      },
      baseline_path: '.nexus/canary-reports/baseline.json',
      report_markdown_path: '.nexus/canary-reports/2026-04-18-canary.md',
      report_json_path: '.nexus/canary-reports/2026-04-18-canary.json',
      screenshots_dir: '.nexus/canary-reports/screenshots',
      summary: 'No persistent regressions were observed during the monitoring window.',
    };

    expect(canary.status).toBe('healthy');
    expect(canary.source).toBe('canary');
  });

  test('freezes the review receipt schema and artifact helpers', () => {
    const receipt: ReviewAuditReceiptRecord = {
      schema_version: 1,
      review_attempt_id: 'review-2026-04-21T01-23-45-678Z',
      provider: 'codex',
      request_id: '20260421-123456-1',
      generated_at: '2026-04-21T01:23:45.678Z',
      requested_route: {
        provider: 'codex',
        route: 'codex-via-ccb',
        substrate: 'superpowers-core',
        transport: 'ccb',
      },
      actual_route: {
        provider: 'codex',
        route: 'codex-via-ccb',
        substrate: 'superpowers-core',
        transport: 'ccb',
        receipt_path: '.planning/current/review/adapter-output.json',
      },
      verdict: 'pass',
      markdown_path: '.planning/current/review/attempts/review-2026-04-21T01-23-45-678Z/codex.md',
    };

    expect(receipt).toMatchObject({
      schema_version: 1,
      provider: 'codex',
      verdict: 'pass',
    });
    expect(reviewAttemptAuditMarkdownPath('review-2026-04-21T01-23-45-678Z', 'codex')).toBe(
      '.planning/current/review/attempts/review-2026-04-21T01-23-45-678Z/codex.md',
    );
    expect(reviewAttemptsRootPath()).toBe('.planning/current/review/attempts');
    expect(reviewAttemptAuditReceiptPath('review-2026-04-21T01-23-45-678Z', 'gemini')).toBe(
      '.planning/current/review/attempts/review-2026-04-21T01-23-45-678Z/gemini.json',
    );
  });

  test('locks the plan manifest input contract', () => {
    expect(CANONICAL_MANIFEST.plan.required_inputs).toEqual([
      '.planning/current/frame/status.json',
    ]);
    expect(CANONICAL_MANIFEST.plan.durable_outputs).toEqual([
      '.planning/current/plan/execution-readiness-packet.md',
      '.planning/current/plan/sprint-contract.md',
      '.planning/current/plan/verification-matrix.json',
      '.planning/current/plan/status.json',
    ]);
    expect(CANONICAL_MANIFEST.plan.optional_outputs).toEqual([
      planDesignContractPath(),
      stageCompletionAdvisorPath('plan'),
    ]);
  });

  test('locks the frame design-bearing command manifest output', () => {
    expect(CANONICAL_MANIFEST.frame.durable_outputs).toContain(
      '.planning/current/frame/design-intent.json',
    );
  });

  test('locks the learning artifact manifest outputs', () => {
    expect(CANONICAL_MANIFEST.review.durable_outputs).toEqual([
      '.planning/audits/current/codex.md',
      '.planning/audits/current/gemini.md',
      '.planning/audits/current/synthesis.md',
      '.planning/audits/current/gate-decision.md',
      '.planning/audits/current/meta.json',
      '.planning/current/review/status.json',
    ]);
    expect(CANONICAL_MANIFEST.review.optional_outputs).toEqual([
      stageCompletionAdvisorPath('review'),
    ]);
    expect(CANONICAL_MANIFEST.qa.durable_outputs).toEqual([
      '.planning/current/qa/qa-report.md',
      '.planning/current/qa/status.json',
    ]);
    expect(CANONICAL_MANIFEST.qa.optional_outputs).toEqual([
      '.planning/current/qa/design-verification.md',
      stageCompletionAdvisorPath('qa'),
    ]);
    expect(CANONICAL_MANIFEST.ship.durable_outputs).toEqual([
      '.planning/current/ship/release-gate-record.md',
      '.planning/current/ship/checklist.json',
      '.planning/current/ship/deploy-readiness.json',
      '.planning/current/ship/pull-request.json',
      '.planning/current/ship/status.json',
    ]);
    expect(CANONICAL_MANIFEST.ship.optional_outputs).toEqual([
      stageCompletionAdvisorPath('ship'),
    ]);
    expect(CANONICAL_MANIFEST.closeout.durable_outputs).toEqual([
      '.planning/current/closeout/CLOSEOUT-RECORD.md',
      '.planning/current/closeout/FOLLOW-ON-SUMMARY.md',
      '.planning/current/closeout/follow-on-summary.json',
      '.planning/current/closeout/NEXT-RUN.md',
      '.planning/current/closeout/next-run-bootstrap.json',
      '.planning/current/closeout/status.json',
    ]);
    expect(CANONICAL_MANIFEST.closeout.optional_outputs).toEqual([
      stageCompletionAdvisorPath('closeout'),
    ]);
  });

  test('locks the discover manifest outputs for continuation advisory artifacts', () => {
    expect(CANONICAL_MANIFEST.discover.durable_outputs).toEqual([
      'docs/product/idea-brief.md',
      '.planning/current/discover/status.json',
    ]);
    expect(CANONICAL_MANIFEST.discover.optional_outputs).toEqual([
      '.planning/current/discover/NEXT-RUN.md',
      '.planning/current/discover/next-run-bootstrap.json',
      '.planning/current/discover/retro-continuity.json',
      '.planning/current/discover/RETRO-CONTINUITY.md',
      '.planning/current/discover/session-continuation-advice.json',
      '.planning/current/discover/SESSION-CONTINUATION.md',
    ]);
  });
});
