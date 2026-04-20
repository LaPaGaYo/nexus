import type {
  CompletionAdvisorActionKind,
  CompletionAdvisorActionRecord,
  CompletionAdvisorRecord,
  DeployReadinessRecord,
  DeployResultRecord,
  PullRequestRecord,
  ReviewAdvisoryDisposition,
  StageStatus,
  VerificationMatrixRecord,
} from './types';

const HIDDEN_COMPAT_ALIASES = ['/office-hours', '/autoplan', '/plan-ceo-review', '/plan-eng-review'] as const;
const HIDDEN_UTILITY_SKILLS = ['/careful', '/freeze', '/guard', '/unfreeze', '/nexus-upgrade'] as const;

function designBearing(designImpact: StageStatus['design_impact'] | VerificationMatrixRecord['design_impact'] | null | undefined): boolean {
  return (designImpact ?? 'none') !== 'none';
}

function action(
  id: string,
  kind: CompletionAdvisorActionKind,
  surface: string,
  invocation: string | null,
  label: string,
  description: string,
  recommended = false,
): CompletionAdvisorActionRecord {
  return {
    id,
    kind,
    surface,
    invocation,
    label,
    description,
    recommended,
  };
}

function outcomeForStatus(status: Pick<StageStatus, 'state' | 'ready'>): CompletionAdvisorRecord['stage_outcome'] {
  if (status.state === 'refused') {
    return 'refused';
  }
  if (status.state === 'blocked' || status.ready === false) {
    return 'blocked';
  }
  return 'ready';
}

function baseAdvisor(
  status: StageStatus,
  generatedAt: string,
  summary: string,
  overrides: Partial<Omit<CompletionAdvisorRecord, 'schema_version' | 'run_id' | 'stage' | 'generated_at' | 'summary'>>,
): CompletionAdvisorRecord {
  return {
    schema_version: 1,
    run_id: status.run_id,
    stage: status.stage,
    generated_at: generatedAt,
    stage_outcome: outcomeForStatus(status),
    summary,
    requires_user_choice: false,
    choice_reason: null,
    default_action_id: null,
    primary_next_actions: [],
    alternative_next_actions: [],
    recommended_side_skills: [],
    hidden_compat_aliases: [...HIDDEN_COMPAT_ALIASES],
    hidden_utility_skills: [...HIDDEN_UTILITY_SKILLS],
    ...overrides,
  };
}

export function buildFrameCompletionAdvisor(
  status: StageStatus,
  generatedAt: string,
): CompletionAdvisorRecord {
  const primary = action(
    'run_plan',
    'canonical_stage',
    '/plan',
    '/plan',
    'Run `/plan`',
    'Turn framing into an execution-ready packet.',
    true,
  );
  const sideSkills = designBearing(status.design_impact)
    ? [
        action(
          'run_plan_design_review',
          'support_skill',
          '/plan-design-review',
          '/plan-design-review',
          'Run `/plan-design-review`',
          'Tighten the design contract before execution on a design-bearing run.',
        ),
      ]
    : [];

  return baseAdvisor(
    status,
    generatedAt,
    'Framing is complete. The canonical next step is planning.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
      recommended_side_skills: sideSkills,
    },
  );
}

export function buildPlanCompletionAdvisor(
  status: StageStatus,
  verificationMatrix: VerificationMatrixRecord | null,
  generatedAt: string,
): CompletionAdvisorRecord {
  const primary = action(
    'run_handoff',
    'canonical_stage',
    '/handoff',
    '/handoff',
    'Run `/handoff`',
    'Freeze governed routing and provider intent before bounded execution.',
    true,
  );
  const sideSkills = designBearing(verificationMatrix?.design_impact ?? status.design_impact)
    ? [
        action(
          'run_plan_design_review',
          'support_skill',
          '/plan-design-review',
          '/plan-design-review',
          'Run `/plan-design-review`',
          'Review the execution packet from a design perspective before handoff.',
        ),
      ]
    : [];

  return baseAdvisor(
    status,
    generatedAt,
    'Planning is complete. Governed routing is the next canonical step.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
      recommended_side_skills: sideSkills,
    },
  );
}

export function buildHandoffCompletionAdvisor(
  status: StageStatus,
  generatedAt: string,
): CompletionAdvisorRecord {
  const primary = action(
    'run_build',
    'canonical_stage',
    '/build',
    '/build',
    'Run `/build`',
    'Execute the bounded governed implementation contract.',
    true,
  );

  return baseAdvisor(
    status,
    generatedAt,
    'Governed handoff is complete. Bounded implementation is the next step.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
    },
  );
}

export function buildBuildCompletionAdvisor(
  status: StageStatus,
  verificationMatrix: VerificationMatrixRecord | null,
  generatedAt: string,
): CompletionAdvisorRecord {
  if (!status.ready) {
    const recoverySurface = status.errors.some((error) =>
      /(handoff|route|validation|stale)/i.test(error)
    ) ? '/handoff' : '/investigate';
    const recovery = action(
      recoverySurface === '/handoff' ? 'refresh_handoff' : 'run_investigate',
      recoverySurface === '/handoff' ? 'canonical_stage' : 'support_skill',
      recoverySurface,
      recoverySurface,
      recoverySurface === '/handoff' ? 'Refresh `/handoff`' : 'Run `/investigate`',
      recoverySurface === '/handoff'
        ? 'Refresh governed routing before retrying the build.'
        : 'Investigate the blocking condition before retrying execution.',
      true,
    );

    return baseAdvisor(
      status,
      generatedAt,
      'Build is not ready to advance. Resolve the blocking condition before review.',
      {
        stage_outcome: 'blocked',
        default_action_id: recovery.id,
        primary_next_actions: [recovery],
      },
    );
  }

  const primary = action(
    'run_review',
    'canonical_stage',
    '/review',
    '/review',
    'Run `/review`',
    'Persist the formal audit set before moving deeper into the governed tail.',
    true,
  );
  const sideSkills: CompletionAdvisorActionRecord[] = [];
  if (designBearing(verificationMatrix?.design_impact ?? status.design_impact)) {
    sideSkills.push(
      action(
        'run_design_review',
        'support_skill',
        '/design-review',
        '/design-review',
        'Run `/design-review`',
        'Do a focused visual audit on a design-bearing implementation before formal review.',
      ),
      action(
        'run_browse',
        'support_skill',
        '/browse',
        '/browse',
        'Run `/browse`',
        'Check the browser-facing surface directly before the governed audit.',
      ),
    );
  }

  return baseAdvisor(
    status,
    generatedAt,
    'Build is ready. Formal review is the canonical next stage.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
      recommended_side_skills: sideSkills,
    },
  );
}

function reviewDispositionActions(): CompletionAdvisorActionRecord[] {
  return [
    action(
      'fix_before_qa',
      'disposition',
      '/build',
      '/build --review-advisory-disposition fix_before_qa',
      'Fix advisories before QA',
      'Run a bounded fix cycle now, then return through `/review` before QA.',
      true,
    ),
    action(
      'continue_to_qa',
      'disposition',
      '/qa',
      '/qa --review-advisory-disposition continue_to_qa',
      'Continue to `/qa`',
      'Carry the advisories forward as non-blocking context and proceed into QA.',
    ),
    action(
      'defer_to_follow_on',
      'disposition',
      '/qa',
      '/qa --review-advisory-disposition defer_to_follow_on',
      'Defer to follow-on work',
      'Keep the mainline moving and record the advisories for `/ship`, `/closeout`, and follow-on work.',
    ),
  ];
}

export function buildReviewCompletionAdvisor(
  status: StageStatus,
  verificationMatrix: VerificationMatrixRecord | null,
  generatedAt: string,
): CompletionAdvisorRecord {
  if (status.gate_decision === 'fail') {
    const primary = action(
      'run_build_fix_cycle',
      'canonical_stage',
      '/build',
      '/build',
      'Run `/build`',
      'The review failed. A bounded fix cycle is required before QA.',
      true,
    );
    return baseAdvisor(
      status,
      generatedAt,
      'Review failed. The canonical next step is a bounded fix cycle through `/build`.',
      {
        stage_outcome: 'requires_choice',
        requires_user_choice: true,
        choice_reason: 'review failed',
        default_action_id: primary.id,
        primary_next_actions: [primary],
      },
    );
  }

  if ((status.advisory_count ?? 0) > 0 && !status.advisory_disposition) {
    const actions = reviewDispositionActions();
    return baseAdvisor(
      status,
      generatedAt,
      'Review passed with advisories. Choose whether to fix them now or carry them forward.',
      {
        stage_outcome: 'requires_choice',
        requires_user_choice: true,
        choice_reason: 'review advisories require an explicit disposition',
        default_action_id: actions[0]?.id ?? null,
        primary_next_actions: actions,
      },
    );
  }

  const primary = action(
    'run_qa',
    'canonical_stage',
    '/qa',
    '/qa',
    'Run `/qa`',
    'Record governed QA validation before the release gate.',
    true,
  );
  const alternatives = [
    action(
      'run_ship',
      'canonical_stage',
      '/ship',
      '/ship',
      'Run `/ship`',
      'Skip directly to the release gate when that is the intended governed path.',
    ),
  ];
  const sideSkills: CompletionAdvisorActionRecord[] = [];
  if (designBearing(verificationMatrix?.design_impact ?? status.design_impact)) {
    sideSkills.push(
      action(
        'run_design_review',
        'support_skill',
        '/design-review',
        '/design-review',
        'Run `/design-review`',
        'Polish the visual result before QA on a design-bearing run.',
      ),
    );
  }

  return baseAdvisor(
    status,
    generatedAt,
    'Review passed cleanly. QA is the recommended governed next step.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
      alternative_next_actions: alternatives,
      recommended_side_skills: sideSkills,
    },
  );
}

export function buildQaCompletionAdvisor(
  status: StageStatus,
  verificationMatrix: VerificationMatrixRecord | null,
  generatedAt: string,
): CompletionAdvisorRecord {
  if (!status.ready) {
    const primary = action(
      'run_build_fix_cycle',
      'canonical_stage',
      '/build',
      '/build',
      'Run `/build`',
      'QA failed. A bounded fix cycle is required before ship.',
      true,
    );
    return baseAdvisor(
      status,
      generatedAt,
      'QA failed. The canonical next step is a fix cycle through `/build`.',
      {
        stage_outcome: 'requires_choice',
        requires_user_choice: true,
        choice_reason: 'qa failed',
        default_action_id: primary.id,
        primary_next_actions: [primary],
      },
    );
  }

  const primary = action(
    'run_ship',
    'canonical_stage',
    '/ship',
    '/ship',
    'Run `/ship`',
    'Record the release-gate decision and PR/deploy handoff.',
    true,
  );
  const sideSkills: CompletionAdvisorActionRecord[] = [];
  if (verificationMatrix?.attached_evidence.benchmark.supported) {
    sideSkills.push(
      action(
        'run_benchmark',
        'support_skill',
        '/benchmark',
        '/benchmark',
        'Run `/benchmark`',
        'Attach performance evidence before the release gate.',
      ),
    );
  }
  if (designBearing(verificationMatrix?.design_impact ?? status.design_impact)) {
    sideSkills.push(
      action(
        'run_design_review',
        'support_skill',
        '/design-review',
        '/design-review',
        'Run `/design-review`',
        'Audit the visual result after QA on a design-bearing run.',
      ),
      action(
        'run_browse',
        'support_skill',
        '/browse',
        '/browse',
        'Run `/browse`',
        'Use the browser to verify the shipped UI path directly.',
      ),
    );
  }

  return baseAdvisor(
    status,
    generatedAt,
    'QA is complete. Ship is the next governed step.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
      recommended_side_skills: sideSkills,
    },
  );
}

export function buildShipCompletionAdvisor(
  status: StageStatus,
  verificationMatrix: VerificationMatrixRecord | null,
  deployReadiness: DeployReadinessRecord | null,
  generatedAt: string,
): CompletionAdvisorRecord {
  const primary = [
    action(
      'run_closeout',
      'canonical_stage',
      '/closeout',
      '/closeout',
      'Run `/closeout`',
      'Conclude the governed run and archive its canonical artifacts.',
      true,
    ),
    action(
      'run_land_and_deploy',
      'support_skill',
      '/land-and-deploy',
      '/land-and-deploy',
      'Run `/land-and-deploy`',
      'Merge, deploy, and verify the primary deploy surface using the ship handoff.',
    ),
  ];
  const sideSkills: CompletionAdvisorActionRecord[] = [
    action(
      'run_document_release',
      'support_skill',
      '/document-release',
      '/document-release',
      'Run `/document-release`',
      'Sync release notes and docs to the shipped surface.',
    ),
  ];
  if (!deployReadiness?.configured && verificationMatrix?.obligations.ship.deploy_readiness_required !== false) {
    sideSkills.unshift(
      action(
        'run_setup_deploy',
        'support_skill',
        '/setup-deploy',
        '/setup-deploy',
        'Run `/setup-deploy`',
        'Author the canonical deploy contract before landing and deployment.',
      ),
    );
  }

  return baseAdvisor(
    status,
    generatedAt,
    'Ship recorded the release gate. Close out the governed run or move into landing and deployment.',
    {
      default_action_id: primary[0]?.id ?? null,
      primary_next_actions: primary,
      recommended_side_skills: sideSkills,
    },
  );
}

export function buildCloseoutCompletionAdvisor(
  status: StageStatus,
  shipPullRequest: PullRequestRecord | null,
  deployResult: DeployResultRecord | null,
  documentationSynced: boolean,
  canaryAttached: boolean,
  generatedAt: string,
): CompletionAdvisorRecord {
  const primary = action(
    'run_discover',
    'canonical_stage',
    '/discover',
    '/discover',
    'Run `/discover`',
    'Start the next governed run from the archived closeout context.',
    true,
  );
  const sideSkills: CompletionAdvisorActionRecord[] = [];
  if (shipPullRequest?.status === 'created' || shipPullRequest?.status === 'reused') {
    if (!deployResult || deployResult.merge_status === 'pending') {
      sideSkills.push(
        action(
          'run_land_and_deploy',
          'support_skill',
          '/land-and-deploy',
          '/land-and-deploy',
          'Run `/land-and-deploy`',
          'Use the ship handoff to merge and verify the primary deploy surface.',
        ),
      );
    }
  }
  if (deployResult?.merge_status === 'merged' && !canaryAttached) {
    sideSkills.push(
      action(
        'run_canary',
        'support_skill',
        '/canary',
        '/canary',
        'Run `/canary`',
        'Add post-deploy health evidence after landing the change.',
      ),
    );
  }
  sideSkills.push(
    action(
      'run_retro',
      'support_skill',
      '/retro',
      '/retro',
      'Run `/retro`',
      'Capture retrospective findings from this completed run.',
    ),
    action(
      'run_learn',
      'support_skill',
      '/learn',
      '/learn',
      'Run `/learn`',
      'Review or export durable learnings from this run.',
    ),
  );
  if (!documentationSynced) {
    sideSkills.push(
      action(
        'run_document_release',
        'support_skill',
        '/document-release',
        '/document-release',
        'Run `/document-release`',
        'Sync docs to match what was just shipped before the next cycle starts.',
      ),
    );
  }

  return baseAdvisor(
    status,
    generatedAt,
    'Closeout is complete. Start the next run or continue with follow-on work from the archived context.',
    {
      default_action_id: primary.id,
      primary_next_actions: [primary],
      recommended_side_skills: sideSkills,
    },
  );
}

export function buildCompletionAdvisorWrite(record: CompletionAdvisorRecord): { path: string; content: string } {
  return {
    path: `.planning/current/${record.stage}/completion-advisor.json`,
    content: JSON.stringify(record, null, 2) + '\n',
  };
}

export function buildStageCompletionAdvisor(
  status: StageStatus,
  generatedAt: string,
  options: {
    verification_matrix?: VerificationMatrixRecord | null;
    deploy_readiness?: DeployReadinessRecord | null;
    ship_pull_request?: PullRequestRecord | null;
    deploy_result?: DeployResultRecord | null;
    documentation_synced?: boolean;
    canary_attached?: boolean;
  } = {},
): CompletionAdvisorRecord {
  switch (status.stage) {
    case 'frame':
      return buildFrameCompletionAdvisor(status, generatedAt);
    case 'plan':
      return buildPlanCompletionAdvisor(status, options.verification_matrix ?? null, generatedAt);
    case 'handoff':
      return buildHandoffCompletionAdvisor(status, generatedAt);
    case 'build':
      return buildBuildCompletionAdvisor(status, options.verification_matrix ?? null, generatedAt);
    case 'review':
      return buildReviewCompletionAdvisor(status, options.verification_matrix ?? null, generatedAt);
    case 'qa':
      return buildQaCompletionAdvisor(status, options.verification_matrix ?? null, generatedAt);
    case 'ship':
      return buildShipCompletionAdvisor(
        status,
        options.verification_matrix ?? null,
        options.deploy_readiness ?? null,
        generatedAt,
      );
    case 'closeout':
      return buildCloseoutCompletionAdvisor(
        status,
        options.ship_pull_request ?? null,
        options.deploy_result ?? null,
        options.documentation_synced ?? false,
        options.canary_attached ?? false,
        generatedAt,
      );
    case 'discover':
      return baseAdvisor(status, generatedAt, 'Discovery completed.', {});
  }
}

export function reviewDispositionInvocation(
  disposition: ReviewAdvisoryDisposition,
): string {
  switch (disposition) {
    case 'fix_before_qa':
      return '/build --review-advisory-disposition fix_before_qa';
    case 'continue_to_qa':
      return '/qa --review-advisory-disposition continue_to_qa';
    case 'defer_to_follow_on':
      return '/qa --review-advisory-disposition defer_to_follow_on';
  }
}
