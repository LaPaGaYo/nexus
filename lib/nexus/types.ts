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

export const CONTINUATION_MODES = ['task', 'phase', 'project_reset'] as const;
export type ContinuationMode = (typeof CONTINUATION_MODES)[number];

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
}

export interface ReviewScopeRecord {
  mode: ReviewScopeMode;
  source_stage: 'plan' | 'review';
  blocking_items: string[];
  advisory_policy: 'out_of_scope_advisory';
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
  };
  gemini_audit: {
    provider: string;
    path: string;
    route: string | null;
    substrate: string | null;
  };
  pm_skill: string;
  execution_skill_chain: string[];
  lifecycle_stage: 'review';
  handoff_from: string;
  handoff_to: string;
  review_scope?: ReviewScopeRecord;
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

export interface StageStatus {
  run_id: string;
  stage: CanonicalCommandId;
  execution_mode?: ExecutionMode;
  primary_provider?: PrimaryProvider;
  provider_topology?: ProviderTopology;
  workspace?: WorkspaceRecord;
  session_root?: SessionRootRecord;
  requested_execution_path?: string;
  actual_execution_path?: string | null;
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
  review_complete?: boolean;
  audit_set_complete?: boolean;
  provenance_consistent?: boolean;
  gate_decision?: 'pass' | 'fail' | 'blocked' | null;
  archive_required?: boolean;
  archive_state?: 'pending' | 'archived' | 'not_required' | 'failed';
  verification_count?: number;
  defect_count?: number;
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
