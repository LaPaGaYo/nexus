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
  'closeout_recorded',
  'refused',
] as const;
export type StageDecision = (typeof STAGE_DECISIONS)[number];

export interface ArtifactPointer {
  kind: 'markdown' | 'json';
  path: string;
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
  audit_set_complete?: boolean;
  provenance_consistent?: boolean;
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
