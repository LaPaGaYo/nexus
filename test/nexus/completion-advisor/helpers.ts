/**
 * Shared test helpers for completion-advisor tests.
 *
 * Created in response to #102 (PR #99 follow-up). Both
 * `test/nexus/completion-advisor.test.ts` and
 * `test/nexus/completion-advisor/resolver.test.ts` previously carried
 * their own copies of `readyStatus`. Extracting it keeps the two test
 * files in sync when stage decisions or status shape evolve.
 *
 * Other helpers (`verificationMatrix`, `CHECKLISTS`) remain in each test
 * file because their shape is tailored to the test's coverage focus
 * (the resolver-suite version pins design_impact='none' and minimal
 * checklists; the advisor-suite version parameterizes design_impact and
 * uses a richer CHECKLISTS catalog).
 */

import type {
  DeployReadinessRecord,
  PullRequestRecord,
  StageStatus,
} from '../../../lib/nexus/types';

export const GENERATED_AT = '2026-04-20T00:00:00.000Z';

/**
 * Build a `StageStatus` for the happy "stage just completed" shape used
 * across the completion-advisor test suites. The `decision` arm is
 * keyed off `stage` so each canonical lifecycle stage gets its
 * stage-specific decision marker (`audit_recorded`, `qa_recorded`,
 * etc.) rather than the generic `'ready'`.
 */
export function readyStatus(stage: StageStatus['stage']): StageStatus {
  const decision =
    stage === 'review' ? 'audit_recorded' :
    stage === 'qa' ? 'qa_recorded' :
    stage === 'ship' ? 'ship_recorded' :
    stage === 'closeout' ? 'closeout_recorded' :
    stage === 'handoff' ? 'route_recorded' :
    stage === 'build' ? 'build_recorded' :
    'ready';

  return {
    run_id: 'run-1',
    stage,
    state: 'completed',
    decision,
    ready: true,
    inputs: [],
    outputs: [],
    started_at: GENERATED_AT,
    completed_at: GENERATED_AT,
    errors: [],
  };
}

/**
 * Compact factory for the support-skill signal shape that
 * `verificationMatrix` uses across resolver tests.
 */
export function signal(suggested = false): {
  suggested: boolean;
  reason: string | null;
  checklist_rationale: string[];
} {
  return {
    suggested,
    reason: suggested ? 'Resolver test support signal.' : null,
    checklist_rationale: [],
  };
}

/**
 * Canonical "open PR" record used as a happy-path fixture for
 * ship/closeout advisor tests.
 */
export const PULL_REQUEST: PullRequestRecord = {
  provider: 'github',
  status: 'created',
  number: 72,
  url: 'https://example.com/pr/72',
  state: 'OPEN',
  head_branch: 'codex/run-1',
  head_sha: 'abc123',
  base_branch: 'main',
};

/**
 * Canonical "deploy ready" record used as the ship-stage fixture.
 */
export const DEPLOY_READINESS: DeployReadinessRecord = {
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
