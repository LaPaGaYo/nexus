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

export const ROUTE_VALIDATION_TRANSPORTS = ['ccb', 'none'] as const;
export type RouteValidationTransport = (typeof ROUTE_VALIDATION_TRANSPORTS)[number];

export const ACTUAL_ROUTE_TRANSPORTS = ['ccb', null] as const;
export type ActualRouteTransport = (typeof ACTUAL_ROUTE_TRANSPORTS)[number];

export interface ArtifactPointer {
  kind: 'markdown' | 'json';
  path: string;
}

export interface RequestedRouteRecord {
  command: CanonicalCommandId;
  governed: boolean;
  planner: string | null;
  generator: string | null;
  evaluator_a: string | null;
  evaluator_b: string | null;
  synthesizer: string | null;
  substrate: string | null;
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
}

export interface ImplementationProvenanceRecord {
  path: string;
  requested_route: RequestedRouteRecord;
  actual_route: ActualRouteRecord | null;
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
  review_complete?: boolean;
  audit_set_complete?: boolean;
  provenance_consistent?: boolean;
  gate_decision?: 'pass' | 'fail' | 'blocked' | null;
  archive_required?: boolean;
  archive_state?: 'pending' | 'archived' | 'not_required' | 'failed';
}

export interface RunLedger {
  run_id: string;
  status: RunStatus;
  current_command: CanonicalCommandId;
  current_stage: CanonicalCommandId;
  previous_stage: CanonicalCommandId | null;
  allowed_next_stages: CanonicalCommandId[];
  command_history: Array<{ command: CanonicalCommandId; at: string; via: string | null }>;
  artifact_index: Record<string, ArtifactPointer>;
  route_intent: {
    planner: string | null;
    generator: string | null;
    evaluator_a: string | null;
    evaluator_b: string | null;
    synthesizer: string | null;
    substrate: string | null;
    fallback_policy: 'disabled';
  };
}

export const PLACEHOLDER_OUTCOME = {
  state: 'blocked',
  decision: 'not_implemented',
  ready: false,
} as const;
