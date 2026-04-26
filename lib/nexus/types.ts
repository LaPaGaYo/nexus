export const CANONICAL_COMMANDS = [
  'discover',
  'frame',
  'plan',
  'handoff',
  'build',
  'review',
  'qa',
  'ship',
  'closeout',
] as const;

export type CanonicalCommandId = (typeof CANONICAL_COMMANDS)[number];

export const ABSORBED_SOURCE_SYSTEMS = ['pm-skills', 'gsd', 'superpowers', 'ccb'] as const;
export type AbsorbedSourceSystem = (typeof ABSORBED_SOURCE_SYSTEMS)[number];

export const NEXUS_STAGE_PACKS = [
  'nexus-discover-pack',
  'nexus-frame-pack',
  'nexus-plan-pack',
  'nexus-handoff-pack',
  'nexus-build-pack',
  'nexus-review-pack',
  'nexus-qa-pack',
  'nexus-ship-pack',
  'nexus-closeout-pack',
] as const;
export type NexusStagePackId = (typeof NEXUS_STAGE_PACKS)[number];

export const NEXUS_STAGE_CONTENT = [
  'nexus-discover-content',
  'nexus-frame-content',
  'nexus-plan-content',
  'nexus-handoff-content',
  'nexus-build-content',
  'nexus-review-content',
  'nexus-qa-content',
  'nexus-ship-content',
  'nexus-closeout-content',
] as const;
export type NexusStageContentId = (typeof NEXUS_STAGE_CONTENT)[number];

export const IMPLEMENTATION_STATUSES = ['implemented', 'placeholder'] as const;
export type ImplementationStatus = (typeof IMPLEMENTATION_STATUSES)[number];

export const RUN_STATUSES = ['active', 'blocked', 'completed', 'refused'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const EXECUTION_MODES = ['governed_ccb', 'local_provider'] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const PRIMARY_PROVIDERS = ['claude', 'codex', 'gemini'] as const;
export type PrimaryProvider = (typeof PRIMARY_PROVIDERS)[number];

export const PROVIDER_TOPOLOGIES = ['single_agent', 'subagents', 'multi_session'] as const;
export type ProviderTopology = (typeof PROVIDER_TOPOLOGIES)[number];

export const WORKSPACE_KINDS = ['root', 'worktree'] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

export const WORKSPACE_RETIREMENT_STATES = [
  'active',
  'retired_pending_cleanup',
  'retained',
  'removed',
] as const;
export type WorkspaceRetirementState = (typeof WORKSPACE_RETIREMENT_STATES)[number];

export const STAGE_STATES = ['not_started', 'in_progress', 'completed', 'blocked', 'refused'] as const;
export type StageState = (typeof STAGE_STATES)[number];

export const STAGE_DECISIONS = [
  'none',
  'ready',
  'not_ready',
  'not_implemented',
  'route_recorded',
  'build_recorded',
  'audit_recorded',
  'qa_recorded',
  'ship_recorded',
  'closeout_recorded',
  'refused',
] as const;
export type StageDecision = (typeof STAGE_DECISIONS)[number];

export const ROUTE_VALIDATION_TRANSPORTS = ['ccb', 'local', 'none'] as const;
export type RouteValidationTransport = (typeof ROUTE_VALIDATION_TRANSPORTS)[number];

export const ACTUAL_ROUTE_TRANSPORTS = ['ccb', 'local', null] as const;
export type ActualRouteTransport = (typeof ACTUAL_ROUTE_TRANSPORTS)[number];

export const REVIEW_SCOPE_MODES = ['full_acceptance', 'bounded_fix_cycle'] as const;
export type ReviewScopeMode = (typeof REVIEW_SCOPE_MODES)[number];

export const REVIEW_ADVISORY_DISPOSITIONS = [
  'continue_to_qa',
  'fix_before_qa',
  'defer_to_follow_on',
] as const;
export type ReviewAdvisoryDisposition = (typeof REVIEW_ADVISORY_DISPOSITIONS)[number];

export const COMPLETION_ADVISOR_OUTCOMES = [
  'ready',
  'blocked',
  'refused',
  'requires_choice',
] as const;
export type CompletionAdvisorOutcome = (typeof COMPLETION_ADVISOR_OUTCOMES)[number];

export const COMPLETION_ADVISOR_ACTION_KINDS = [
  'canonical_stage',
  'support_skill',
  'external_installed_skill',
  'compat_alias',
  'utility',
  'disposition',
  'stop',
] as const;
export type CompletionAdvisorActionKind = (typeof COMPLETION_ADVISOR_ACTION_KINDS)[number];

export const COMPLETION_ADVISOR_INTERACTION_MODES = [
  'required_choice',
  'recommended_choice',
  'summary_only',
] as const;
export type CompletionAdvisorInteractionMode = (typeof COMPLETION_ADVISOR_INTERACTION_MODES)[number];

export const DESIGN_IMPACTS = ['none', 'touchup', 'material'] as const;
export type DesignImpact = (typeof DESIGN_IMPACTS)[number];

export const DEPLOY_PLATFORMS = [
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
] as const;
export type DeployPlatform = (typeof DEPLOY_PLATFORMS)[number];

export const DEPLOY_PROJECT_TYPES = [
  'web_app',
  'api',
  'cli',
  'library',
  'service',
  'unknown',
] as const;
export type DeployProjectType = (typeof DEPLOY_PROJECT_TYPES)[number];

export const DEPLOY_TRIGGER_KINDS = [
  'auto_on_push',
  'github_actions',
  'command',
  'manual',
  'none',
] as const;
export type DeployTriggerKind = (typeof DEPLOY_TRIGGER_KINDS)[number];

export const DEPLOY_STATUS_KINDS = ['http', 'command', 'github_actions', 'none'] as const;
export type DeployStatusKind = (typeof DEPLOY_STATUS_KINDS)[number];

export const DEPLOY_CONFIG_SOURCES = ['canonical_contract', 'legacy_claude', 'none'] as const;
export type DeployConfigSource = (typeof DEPLOY_CONFIG_SOURCES)[number];

export const CANARY_EVIDENCE_STATUSES = ['healthy', 'degraded', 'broken'] as const;
export type CanaryEvidenceStatus = (typeof CANARY_EVIDENCE_STATUSES)[number];

export const DEPLOY_RESULT_PHASES = ['pre_merge', 'merge_queue', 'post_merge'] as const;
export type DeployResultPhase = (typeof DEPLOY_RESULT_PHASES)[number];

export const DEPLOY_RESULT_FAILURE_KINDS = [
  'pre_merge_ci_failed',
  'pre_merge_conflict',
  'merge_queue_failed',
  'post_merge_deploy_failed',
] as const;
export type DeployResultFailureKind = (typeof DEPLOY_RESULT_FAILURE_KINDS)[number];

export const DEPLOY_RESULT_CI_STATUSES = ['passed', 'pending', 'failed', 'skipped', 'unknown'] as const;
export type DeployResultCiStatus = (typeof DEPLOY_RESULT_CI_STATUSES)[number];

export const DEPLOY_RESULT_NEXT_ACTIONS = [
  'rerun_land_and_deploy',
  'rerun_ship',
  'rerun_build_review_qa_ship',
  'investigate_deploy',
  'revert',
  'none',
] as const;
export type DeployResultNextAction = (typeof DEPLOY_RESULT_NEXT_ACTIONS)[number];

export const LEARNING_TYPES = [
  'pattern',
  'pitfall',
  'preference',
  'architecture',
  'tool',
] as const;
export type LearningType = (typeof LEARNING_TYPES)[number];

export const LEARNING_SOURCES = [
  'observed',
  'user-stated',
  'inferred',
  'cross-model',
] as const;
export type LearningSource = (typeof LEARNING_SOURCES)[number];

export const CONTINUATION_MODES = ['task', 'phase', 'project_reset'] as const;
export type ContinuationMode = (typeof CONTINUATION_MODES)[number];

export const CONTINUATION_ADVICE_OPTIONS = [
  'continue_here',
  'compact_then_continue',
  'fresh_session_continue',
] as const;
export type ContinuationAdviceOption = (typeof CONTINUATION_ADVICE_OPTIONS)[number];

export const REPO_RETRO_ARCHIVE_MODES = ['repo', 'compare'] as const;
export type RepoRetroArchiveMode = (typeof REPO_RETRO_ARCHIVE_MODES)[number];

export interface VerificationMatrixAttachedEvidenceRecord {
  supported: boolean;
  required: boolean;
}

export const VERIFICATION_CHECKLIST_CATEGORIES = [
  'testing',
  'security',
  'performance',
  'accessibility',
  'design',
] as const;
export type VerificationChecklistCategory = (typeof VERIFICATION_CHECKLIST_CATEGORIES)[number];

export interface VerificationMatrixChecklistRecord {
  category: VerificationChecklistCategory;
  source_path: string;
  applies: boolean;
  rationale: string;
  triggers: string[];
  support_surfaces: string[];
}

export interface VerificationMatrixChecklistRationaleRecord {
  category: VerificationChecklistCategory;
  source_path: string;
  rationale: string;
}

export interface VerificationMatrixSupportSkillSignalRecord {
  suggested: boolean;
  reason: string | null;
  checklist_rationale: VerificationMatrixChecklistRationaleRecord[];
}

export interface VerificationMatrixBuildObligationRecord {
  owner_stage: 'build';
  required: boolean;
  gate_affecting: boolean;
  expected_artifacts: string[];
}

export interface VerificationMatrixReviewObligationRecord {
  owner_stage: 'review';
  required: boolean;
  gate_affecting: boolean;
  mode: ReviewScopeMode;
  expected_artifacts: string[];
}

export interface VerificationMatrixQaObligationRecord {
  owner_stage: 'qa';
  required: boolean;
  gate_affecting: boolean;
  design_verification_required: boolean;
  expected_artifacts: string[];
}

export interface VerificationMatrixShipObligationRecord {
  owner_stage: 'ship';
  required: boolean;
  gate_affecting: boolean;
  deploy_readiness_required: boolean;
  expected_artifacts: string[];
}

export interface VerificationMatrixRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  design_impact: DesignImpact;
  verification_required: boolean;
  obligations: {
    build: VerificationMatrixBuildObligationRecord;
    review: VerificationMatrixReviewObligationRecord;
    qa: VerificationMatrixQaObligationRecord;
    ship: VerificationMatrixShipObligationRecord;
  };
  attached_evidence: {
    benchmark: VerificationMatrixAttachedEvidenceRecord;
    canary: VerificationMatrixAttachedEvidenceRecord;
    qa_only: VerificationMatrixAttachedEvidenceRecord;
  };
  checklists: Record<VerificationChecklistCategory, VerificationMatrixChecklistRecord>;
  support_skill_signals: {
    design_review: VerificationMatrixSupportSkillSignalRecord;
    browse: VerificationMatrixSupportSkillSignalRecord;
    benchmark: VerificationMatrixSupportSkillSignalRecord;
    cso: VerificationMatrixSupportSkillSignalRecord;
    connect_chrome: VerificationMatrixSupportSkillSignalRecord;
    setup_browser_cookies: VerificationMatrixSupportSkillSignalRecord;
  };
}

export interface CanaryStatusRecord {
  schema_version: 1;
  generated_at: string;
  source: 'canary' | 'land-and-deploy';
  url: string;
  duration_minutes: number | null;
  pages_monitored: string[];
  status: CanaryEvidenceStatus;
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  baseline_path: string | null;
  report_markdown_path: string | null;
  report_json_path: string | null;
  screenshots_dir: string | null;
  summary: string;
}

export const COMMAND_HISTORY_VIAS = [
  'office-hours',
  'plan-ceo-review',
  'plan-eng-review',
  'autoplan',
  'start-work',
  'execute-wave',
  'governed-execute',
  'verify-close',
  'fix-cycle',
  'retry',
  'refresh',
] as const;
export type CommandHistoryVia = (typeof COMMAND_HISTORY_VIAS)[number] | null;

export interface ArtifactPointer {
  kind: 'markdown' | 'json';
  path: string;
}

export interface RequestedRouteRecord {
  command: CanonicalCommandId;
  governed: boolean;
  execution_mode: ExecutionMode;
  primary_provider: PrimaryProvider;
  provider_topology: ProviderTopology;
  planner: string | null;
  generator: string | null;
  evaluator_a: string | null;
  evaluator_b: string | null;
  synthesizer: string | null;
  substrate: string | null;
  transport: 'ccb' | 'local';
  fallback_policy: 'disabled';
}

export interface ActualRouteRecord {
  provider: string | null;
  route: string | null;
  substrate: string | null;
  transport: ActualRouteTransport;
  receipt_path: string | null;
}

export interface RouteValidationRecord {
  transport: RouteValidationTransport;
  available: boolean;
  approved: boolean;
  reason: string;
  mounted_providers?: string[];
  provider_checks?: Array<{
    provider: string;
    available: boolean;
    mounted: boolean;
    reason: string;
  }>;
}

export interface RouteCheckRecord {
  checked_at: string;
  requested_route: RequestedRouteRecord;
  route_validation: RouteValidationRecord;
}

export interface CommandHistoryEntry {
  command: CanonicalCommandId;
  at: string;
  via: CommandHistoryVia;
}

export interface ImplementationProvenanceRecord {
  path: string;
  requested_route: RequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
}

export interface ReviewRequestedRouteRecord {
  provider: string | null;
  route: string | null;
  substrate: string | null;
  transport: 'ccb' | 'local';
}

export interface ReviewAuditProvenanceRecord {
  provider: string;
  path: string;
  requested_route: ReviewRequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
  request_id?: string | null;
  receipt?: string | null;
  receipt_markdown_path?: string | null;
  receipt_record_path?: string | null;
}

export interface ReviewAuditReceiptRecord {
  schema_version: 1;
  review_attempt_id: string;
  provider: 'codex' | 'gemini';
  request_id: string | null;
  generated_at: string;
  requested_route: ReviewRequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
  verdict: 'pass' | 'fail';
  markdown_path: string;
}

export interface ReviewScopeRecord {
  mode: ReviewScopeMode;
  source_stage: 'plan' | 'review' | 'qa';
  blocking_items: string[];
  advisory_policy: 'out_of_scope_advisory';
}

export interface LearningCandidate {
  type: LearningType;
  key: string;
  insight: string;
  confidence: number;
  source: LearningSource;
  files: string[];
}

export interface DeploySecondarySurfaceRecord {
  label: string;
  platform: DeployPlatform;
  project_type: DeployProjectType;
  production: {
    url: string | null;
    health_check: string | null;
  };
  deploy_trigger: {
    kind: DeployTriggerKind;
    details: string | null;
  };
  deploy_workflow: string | null;
  deploy_status: {
    kind: DeployStatusKind;
    command: string | null;
  };
  notes: string[];
  sources: string[];
}

export interface DeployContractRecord {
  schema_version: 1;
  configured_at: string;
  primary_surface_label: string | null;
  platform: DeployPlatform;
  project_type: DeployProjectType;
  production: {
    url: string | null;
    health_check: string | null;
  };
  staging: {
    url: string | null;
    workflow: string | null;
  };
  deploy_trigger: {
    kind: DeployTriggerKind;
    details: string | null;
  };
  deploy_workflow: string | null;
  deploy_status: {
    kind: DeployStatusKind;
    command: string | null;
  };
  custom_hooks: {
    pre_merge: string[];
    post_merge: string[];
  };
  secondary_surfaces: DeploySecondarySurfaceRecord[];
  notes: string[];
  sources: string[];
}

export interface DeployReadinessSecondarySurfaceRecord {
  label: string;
  platform: DeployPlatform;
  project_type: DeployProjectType;
  production_url: string | null;
  health_check: string | null;
  deploy_status_kind: DeployStatusKind;
  deploy_status_command: string | null;
  deploy_workflow: string | null;
  blocking: false;
  notes: string[];
}

export interface DeployReadinessRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  configured: boolean;
  source: DeployConfigSource;
  contract_path: string | null;
  primary_surface_label: string | null;
  platform: DeployPlatform | null;
  project_type: DeployProjectType | null;
  production_url: string | null;
  health_check: string | null;
  deploy_status_kind: DeployStatusKind;
  deploy_status_command: string | null;
  deploy_workflow: string | null;
  staging_detected: boolean;
  secondary_surfaces: DeployReadinessSecondarySurfaceRecord[];
  notes: string[];
}

export interface DeployResultRecord {
  schema_version: 1;
  generated_at: string;
  source: 'land-and-deploy';
  phase: DeployResultPhase;
  failure_kind: DeployResultFailureKind | null;
  ci_status: DeployResultCiStatus;
  ship_handoff_head_sha: string | null;
  pull_request_head_sha: string | null;
  ship_handoff_current: boolean;
  next_action: DeployResultNextAction;
  production_url: string | null;
  pull_request_path: string;
  deploy_readiness_path: string;
  canary_status_path: string | null;
  merge_status: 'pending' | 'merged' | 'reverted';
  deploy_status: 'pending' | 'verified' | 'degraded' | 'failed' | 'skipped';
  verification_status: 'healthy' | 'degraded' | 'broken' | 'skipped';
  report_markdown_path: string | null;
  summary: string;
}

export interface FollowOnEvidenceSummaryRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  source_artifacts: string[];
  evidence: {
    qa: {
      perf_verification_path: string | null;
    };
    ship: {
      canary_status_path: string | null;
      canary_status: CanaryEvidenceStatus | null;
      deploy_result_path: string | null;
      deploy_status: DeployResultRecord['deploy_status'] | null;
      verification_status: DeployResultRecord['verification_status'] | null;
      production_url: string | null;
    };
    closeout: {
      documentation_sync_path: string | null;
    };
  };
  summary: string;
}

export interface StageLearningCandidatesRecord {
  schema_version: 1;
  run_id: string;
  stage: 'review' | 'qa' | 'ship';
  generated_at: string;
  candidates: LearningCandidate[];
}

export interface RunLearningsRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  source_candidates: string[];
  learnings: Array<LearningCandidate & { origin_stage: 'review' | 'qa' | 'ship' }>;
}

export interface RepoRetroArchiveRecord {
  schema_version: 1;
  retro_id: string;
  mode: RepoRetroArchiveMode;
  date: string;
  window: string;
  generated_at: string;
  repository_root: string;
  linked_run_ids: string[];
  source_artifacts: string[];
  summary: string;
  key_findings: string[];
  recommended_attention_areas: string[];
}

export interface DiscoverRetroContinuityRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  source_retro_artifacts: string[];
  recent_findings: string[];
  recommended_attention_areas: string[];
  summary: string;
}

export interface DesignIntentRecord {
  impact: DesignImpact;
  affected_surfaces: string[];
  design_system_source: 'none' | 'design_md' | 'support_skill' | 'mixed';
  contract_required: boolean;
  verification_required: boolean;
}

export interface SessionRootRecord {
  path: string;
  kind: 'repo_root';
  source: 'ccb_root';
}

export interface WorkspaceRecord {
  path: string;
  kind: WorkspaceKind;
  branch: string | null;
  source: 'repo_root' | 'existing:nexus_worktree' | 'existing:legacy_worktree' | 'allocated:fresh_run';
  run_id?: string;
  retirement_state?: WorkspaceRetirementState;
}

export interface ReviewMetaRecord {
  run_id: string;
  review_attempt_id?: string;
  execution_mode?: ExecutionMode;
  primary_provider?: PrimaryProvider;
  provider_topology?: ProviderTopology;
  workspace?: WorkspaceRecord;
  implementation_provider: string;
  implementation_path: string;
  implementation_route: string | null;
  implementation_substrate: string | null;
  implementation: ImplementationProvenanceRecord;
  audits: {
    codex: ReviewAuditProvenanceRecord;
    gemini: ReviewAuditProvenanceRecord;
  };
  review_discipline: {
    adapter: 'superpowers';
    summary: string;
  };
  codex_audit: {
    provider: string;
    path: string;
    route: string | null;
    substrate: string | null;
    receipt_markdown_path?: string | null;
    receipt_record_path?: string | null;
  };
  gemini_audit: {
    provider: string;
    path: string;
    route: string | null;
    substrate: string | null;
    receipt_markdown_path?: string | null;
    receipt_record_path?: string | null;
  };
  pm_skill: string;
  execution_skill_chain: string[];
  lifecycle_stage: 'review';
  handoff_from: string;
  handoff_to: string;
  review_scope?: ReviewScopeRecord;
  local_persona_review?: LocalPersonaReviewStatusRecord | null;
}

export interface ReviewAdvisoriesRecord {
  schema_version: 1;
  run_id: string;
  generated_at: string;
  advisories: string[];
}

export interface ReviewAdvisoryDispositionRecord {
  schema_version: 1;
  run_id: string;
  advisory_count: number;
  selected: ReviewAdvisoryDisposition | null;
  selected_at: string | null;
  available_options: ReviewAdvisoryDisposition[];
}

export interface CompletionAdvisorActionRecord {
  id: string;
  kind: CompletionAdvisorActionKind;
  surface: string;
  invocation: string | null;
  label: string;
  description: string;
  recommended: boolean;
  visibility_reason: string | null;
  why_this_skill: string | null;
  evidence_signal: CompletionAdvisorEvidenceSignalRecord | null;
}

export interface CompletionAdvisorEvidenceSignalRecord {
  kind:
    | 'lifecycle'
    | 'verification_matrix'
    | 'stage_status'
    | 'review_advisory'
    | 'deploy_readiness'
    | 'installed_skill'
    | 'project_setup';
  summary: string;
  source_paths: string[];
  checklist_categories: VerificationChecklistCategory[];
}

export interface CompletionAdvisorRecord {
  schema_version: 1;
  run_id: string;
  stage: CanonicalCommandId;
  generated_at: string;
  stage_outcome: CompletionAdvisorOutcome;
  interaction_mode: CompletionAdvisorInteractionMode;
  summary: string;
  requires_user_choice: boolean;
  choice_reason: string | null;
  default_action_id: string | null;
  primary_next_actions: CompletionAdvisorActionRecord[];
  alternative_next_actions: CompletionAdvisorActionRecord[];
  recommended_side_skills: CompletionAdvisorActionRecord[];
  recommended_external_skills?: CompletionAdvisorActionRecord[];
  stop_action: CompletionAdvisorActionRecord | null;
  project_setup_gaps: string[];
  hidden_compat_aliases: string[];
  hidden_utility_skills: string[];
  suppressed_surfaces: string[];
}

export type InstalledSkillNamespace = 'nexus_canonical' | 'nexus_support' | 'external_installed';

export interface InstalledSkillRecord {
  name: string;
  surface: string;
  description: string | null;
  path: string;
  source_root: string;
  namespace: InstalledSkillNamespace;
  tags: string[];
}

export interface SessionContinuationAdviceRecord {
  schema_version: 1;
  run_id: string;
  boundary_kind: 'fresh_run_phase';
  continuation_mode: ContinuationMode;
  lifecycle_can_continue_here: true;
  recommended_option: ContinuationAdviceOption;
  available_options: ContinuationAdviceOption[];
  host_compact_supported: boolean;
  resume_artifacts: string[];
  supporting_context_artifacts: string[];
  recommended_next_command: '/frame';
  summary: string;
  generated_at: string;
}

export interface ConflictRecord {
  stage: CanonicalCommandId;
  adapter: string;
  kind:
    | 'route_mismatch'
    | 'partial_write_failure'
    | 'backend_conflict'
    | 'illegal_transition'
    | 'status_precedence';
  message: string;
  canonical_paths: string[];
  trace_paths: string[];
}

export interface PullRequestRecord {
  provider: 'github' | 'gitlab' | 'unknown';
  status: 'created' | 'reused' | 'unavailable' | 'not_requested';
  number: number | null;
  url: string | null;
  state: string | null;
  head_branch: string | null;
  head_sha: string | null;
  base_branch: string | null;
  reason?: string | null;
}

export const LOCAL_REVIEW_PERSONA_ROLES = ['code', 'test', 'security', 'design'] as const;
export type LocalReviewPersonaRole = (typeof LOCAL_REVIEW_PERSONA_ROLES)[number];

export const LOCAL_SHIP_PERSONA_ROLES = ['release', 'qa', 'security', 'docs_deploy'] as const;
export type LocalShipPersonaRole = (typeof LOCAL_SHIP_PERSONA_ROLES)[number];

export interface LocalPersonaReviewStatusRecord {
  enabled: boolean;
  roles: LocalReviewPersonaRole[];
  artifact_paths: string[];
  gate_affecting_roles: LocalReviewPersonaRole[];
  advisory_only_roles: LocalReviewPersonaRole[];
}

export interface LocalPersonaShipStatusRecord {
  enabled: boolean;
  roles: LocalShipPersonaRole[];
  artifact_paths: string[];
  gate_affecting_roles: LocalShipPersonaRole[];
  advisory_only_roles: LocalShipPersonaRole[];
}

export interface StageStatus {
  run_id: string;
  stage: CanonicalCommandId;
  execution_mode?: ExecutionMode;
  primary_provider?: PrimaryProvider;
  provider_topology?: ProviderTopology;
  workspace?: WorkspaceRecord;
  session_root?: SessionRootRecord;
  design_impact?: DesignImpact;
  design_contract_required?: boolean;
  design_contract_path?: string | null;
  design_verified?: boolean | null;
  requested_execution_path?: string;
  actual_execution_path?: string | null;
  review_attempt_id?: string | null;
  audit_request_ids?: {
    codex: string | null;
    gemini: string | null;
  } | null;
  state: StageState;
  decision: StageDecision;
  ready: boolean;
  inputs: ArtifactPointer[];
  outputs: ArtifactPointer[];
  started_at: string;
  completed_at: string | null;
  errors: string[];
  requested_route?: RequestedRouteRecord | null;
  actual_route?: ActualRouteRecord | null;
  route_validation?: RouteValidationRecord | null;
  review_scope?: ReviewScopeRecord | null;
  advisories_path?: string | null;
  review_complete?: boolean;
  audit_set_complete?: boolean;
  provenance_consistent?: boolean;
  deploy_configured?: boolean;
  deploy_config_source?: DeployConfigSource | null;
  deploy_contract_path?: string | null;
  learning_candidates_path?: string | null;
  learnings_recorded?: boolean | null;
  gate_decision?: 'pass' | 'fail' | 'blocked' | null;
  archive_required?: boolean;
  archive_state?: 'pending' | 'archived' | 'not_required' | 'failed';
  verification_count?: number;
  defect_count?: number;
  advisory_count?: number;
  advisory_disposition?: ReviewAdvisoryDisposition | null;
  advisory_disposition_path?: string | null;
  local_persona_review?: LocalPersonaReviewStatusRecord | null;
  local_persona_ship?: LocalPersonaShipStatusRecord | null;
  pull_request?: PullRequestRecord | null;
}

export interface RunLedger {
  run_id: string;
  continuation_mode: ContinuationMode;
  status: RunStatus;
  current_command: CanonicalCommandId;
  current_stage: CanonicalCommandId;
  previous_stage: CanonicalCommandId | null;
  allowed_next_stages: CanonicalCommandId[];
  command_history: CommandHistoryEntry[];
  artifact_index: Record<string, ArtifactPointer>;
  execution: {
    mode: ExecutionMode;
    primary_provider: PrimaryProvider;
    provider_topology: ProviderTopology;
    workspace?: WorkspaceRecord;
    session_root?: SessionRootRecord;
    requested_path: string;
    actual_path: string | null;
  };
  route_intent: {
    planner: string | null;
    generator: string | null;
    evaluator_a: string | null;
    evaluator_b: string | null;
    synthesizer: string | null;
    substrate: string | null;
    fallback_policy: 'disabled';
  };
  route_check?: RouteCheckRecord | null;
}

export const PLACEHOLDER_OUTCOME = {
  state: 'blocked',
  decision: 'not_implemented',
  ready: false,
} as const;
