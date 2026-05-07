import type {
  DeployReadinessRecord,
  PullRequestRecord,
  StageStatus,
  VerificationChecklistCategory,
  VerificationMatrixChecklistRecord,
  VerificationMatrixRecord,
} from '../../../lib/nexus/types';

export const GENERATED_AT = '2026-04-20T00:00:00.000Z';

export function readyStatus(stage: StageStatus['stage']): StageStatus {
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
    started_at: GENERATED_AT,
    completed_at: GENERATED_AT,
    errors: [],
  };
}

export const CHECKLISTS: Record<VerificationChecklistCategory, VerificationMatrixChecklistRecord> = {
  testing: {
    category: 'testing',
    source_path: 'references/review/specialists/testing.md',
    applies: true,
    rationale: 'Testing checklist is always-on for review and release readiness.',
    triggers: ['always_on'],
    support_surfaces: ['/browse'],
  },
  security: {
    category: 'security',
    source_path: 'references/review/specialists/security.md',
    applies: false,
    rationale: 'Security checklist applies when auth, backend, or trust-boundary surfaces are in scope.',
    triggers: [],
    support_surfaces: ['/cso', '/setup-browser-cookies'],
  },
  maintainability: {
    category: 'maintainability',
    source_path: 'references/review/specialists/maintainability.md',
    applies: true,
    rationale: 'Maintainability checklist is always-on for complexity, readability, and behavior-preserving cleanup.',
    triggers: ['always_on'],
    support_surfaces: ['/simplify'],
  },
  performance: {
    category: 'performance',
    source_path: 'references/review/specialists/performance.md',
    applies: true,
    rationale: 'Performance checklist applies to frontend and backend execution surfaces.',
    triggers: ['frontend_surface'],
    support_surfaces: ['/benchmark'],
  },
  accessibility: {
    category: 'accessibility',
    source_path: 'references/review/design-checklist.md',
    applies: true,
    rationale: 'Accessibility checklist applies to browser-facing UI and interaction states.',
    triggers: ['browser_facing'],
    support_surfaces: ['/browse', '/connect-chrome', '/setup-browser-cookies', '/design-review'],
  },
  design: {
    category: 'design',
    source_path: 'references/review/design-checklist.md',
    applies: true,
    rationale: 'Design checklist applies to design-bearing UI work and visual system changes.',
    triggers: ['design_impact'],
    support_surfaces: ['/design-review'],
  },
};

function checklistRationale(...categories: Array<keyof typeof CHECKLISTS>) {
  return categories.map((category) => ({
    category,
    source_path: CHECKLISTS[category].source_path,
    rationale: CHECKLISTS[category].rationale,
  }));
}

function signal(suggested = false) {
  return {
    suggested,
    reason: suggested ? 'Resolver test support signal.' : null,
    checklist_rationale: [],
  };
}

export function verificationMatrix(
  designImpact: VerificationMatrixRecord['design_impact'] = 'none',
): VerificationMatrixRecord {
  return {
    schema_version: 1,
    run_id: 'run-1',
    generated_at: GENERATED_AT,
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
    checklists: {
      testing: CHECKLISTS.testing,
      security: CHECKLISTS.security,
      maintainability: CHECKLISTS.maintainability,
      performance: CHECKLISTS.performance,
      accessibility: {
        ...CHECKLISTS.accessibility,
        applies: designImpact !== 'none',
        triggers: designImpact !== 'none' ? ['browser_facing'] : [],
      },
      design: {
        ...CHECKLISTS.design,
        applies: designImpact !== 'none',
        triggers: designImpact !== 'none' ? ['design_impact'] : [],
      },
    },
    support_skill_signals: {
      design_review: {
        suggested: designImpact !== 'none',
        reason: designImpact !== 'none'
          ? 'Design-bearing work should expose `/design-review` as a first-class follow-on.'
          : null,
        checklist_rationale: designImpact !== 'none'
          ? checklistRationale('design', 'accessibility')
          : [],
      },
      browse: {
        suggested: designImpact !== 'none',
        reason: designImpact !== 'none'
          ? 'Browser-facing surfaces changed, so `/browse` should be available from the advisor.'
          : null,
        checklist_rationale: designImpact !== 'none'
          ? checklistRationale('testing', 'accessibility')
          : [],
      },
      benchmark: {
        suggested: true,
        reason: 'The verification matrix supports benchmark evidence for this run.',
        checklist_rationale: checklistRationale('performance'),
      },
      simplify: {
        suggested: true,
        reason: 'Maintainability review supports a behavior-preserving simplification pass when complexity advisories appear.',
        checklist_rationale: checklistRationale('maintainability'),
      },
      cso: signal(),
      connect_chrome: {
        suggested: designImpact !== 'none',
        reason: designImpact !== 'none'
          ? 'A browser-facing flow exists, so real-browser verification through `/connect-chrome` is available.'
          : null,
        checklist_rationale: designImpact !== 'none'
          ? checklistRationale('testing', 'accessibility')
          : [],
      },
      setup_browser_cookies: signal(),
    },
  };
}

export const pullRequest: PullRequestRecord = {
  provider: 'github',
  status: 'created',
  number: 72,
  url: 'https://example.com/pr/72',
  state: 'OPEN',
  head_branch: 'codex/run-1',
  head_sha: 'abc123',
  base_branch: 'main',
};

export const deployReadiness: DeployReadinessRecord = {
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
