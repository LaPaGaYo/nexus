import type { CanonicalCommandId, CompletionAdvisorOutcome } from '../types';

/**
 * Phase H (adoption telemetry — Track D-D3 follow-up):
 * structured events recording when Iron Law gates and AskUserQuestion
 * checkpoints fire in real Nexus runs.
 *
 * Privacy contract:
 *   - NO content (no PRD text, no intent strings, no user prompts)
 *   - Only event metadata: stage, outcome, run_id, schema-version
 *   - Default OFF; opt-in via NEXUS_TELEMETRY=1
 *   - Append-only JSONL at ~/.nexus/telemetry/<slug>/events.jsonl
 *   - Same per-project slug pattern as ~/.nexus/projects/<slug>/learnings.jsonl
 */

export const NEXUS_TELEMETRY_SCHEMA_VERSION = 1 as const;
export type NexusTelemetrySchemaVersion = typeof NEXUS_TELEMETRY_SCHEMA_VERSION;

/**
 * Event kinds we emit. Adding a new kind is non-breaking; readers must
 * handle unknown kinds gracefully (skip + log to debug stream).
 */
export type TelemetryEventKind =
  | 'stage_advisor_recorded'      // every advisor write (chokepoint)
  | 'review_pass_round_changed'   // /review Law 2 two-round protocol fired
  | 'review_advisory_dispatched'  // /review Law 3 advisory disposition chosen
  | 'ship_branch_outcome_chosen'  // /ship Law 3 branch decision tree
  | 'qa_cluster_routed'           // /qa Law 3 3-strike → /investigate
  | 'build_3strike_triggered'     // /build Law 2 3-strike stop fired
  | 'closeout_stale_evidence'     // /closeout Law 2 stale audit detected
  | 'frame_readiness_gate_failed' // /frame Law 3 readiness gate verdict not_ready
  | 'discover_anti_pattern_detected'; // /discover Law 1 anti-pattern stop

export interface TelemetryEventBase {
  schema_version: NexusTelemetrySchemaVersion;
  /** ISO 8601 timestamp at event emit time. */
  ts: string;
  /** Run identifier (groups events from one Nexus run). */
  run_id: string;
  /** Event kind discriminator. */
  kind: TelemetryEventKind;
  /** Lifecycle stage that emitted the event. */
  stage: CanonicalCommandId;
}

export interface StageAdvisorRecordedEvent extends TelemetryEventBase {
  kind: 'stage_advisor_recorded';
  stage_outcome: CompletionAdvisorOutcome;
  interaction_mode: string;
  requires_user_choice: boolean;
  /** How many skills the manifest-driven advisor surfaced. */
  recommended_skills_count: number;
  /** How many primary actions the advisor surfaced. */
  primary_action_count: number;
}

export interface ReviewPassRoundChangedEvent extends TelemetryEventBase {
  kind: 'review_pass_round_changed';
  stage: 'review';
  pass_round: number;
}

export interface ReviewAdvisoryDispatchedEvent extends TelemetryEventBase {
  kind: 'review_advisory_dispatched';
  stage: 'review';
  advisory_disposition: 'fix_before_qa' | 'continue_to_qa' | 'defer_to_follow_on';
}

export interface ShipBranchOutcomeChosenEvent extends TelemetryEventBase {
  kind: 'ship_branch_outcome_chosen';
  stage: 'ship';
  outcome: 'merge' | 'keep_alive' | 'discard' | 'split';
}

export interface QaClusterRoutedEvent extends TelemetryEventBase {
  kind: 'qa_cluster_routed';
  stage: 'qa';
  cluster_size: number;
}

export interface Build3StrikeTriggeredEvent extends TelemetryEventBase {
  kind: 'build_3strike_triggered';
  stage: 'build';
  strike_count: number;
}

export interface CloseoutStaleEvidenceEvent extends TelemetryEventBase {
  kind: 'closeout_stale_evidence';
  stage: 'closeout';
  /** Which staleness leg fired: head_sha | run_id_mismatch | clock_aged. */
  staleness_signal: 'head_sha' | 'run_id_mismatch' | 'clock_aged';
}

export interface FrameReadinessGateFailedEvent extends TelemetryEventBase {
  kind: 'frame_readiness_gate_failed';
  stage: 'frame';
  /** Which of the 5 Law 3 conditions failed. */
  failed_condition:
    | 'success_criteria_unfalsifiable'
    | 'non_goals_under_three'
    | 'no_user_story_acceptance'
    | 'out_of_scope_empty'
    | 'hypothesis_missing';
}

export interface DiscoverAntiPatternDetectedEvent extends TelemetryEventBase {
  kind: 'discover_anti_pattern_detected';
  stage: 'discover';
  /** Which Law 1 anti-pattern fired. */
  anti_pattern:
    | 'feature_spec'
    | 'user_testing'
    | 'substitute_for_shipping'
    | 'single_stakeholder'
    | 'solutioning_in_disguise';
}

export type TelemetryEvent =
  | StageAdvisorRecordedEvent
  | ReviewPassRoundChangedEvent
  | ReviewAdvisoryDispatchedEvent
  | ShipBranchOutcomeChosenEvent
  | QaClusterRoutedEvent
  | Build3StrikeTriggeredEvent
  | CloseoutStaleEvidenceEvent
  | FrameReadinessGateFailedEvent
  | DiscoverAntiPatternDetectedEvent;

/**
 * Result of reading the telemetry log. Includes parse statistics so callers
 * can detect schema drift or corruption.
 */
export interface TelemetryReadResult {
  events: TelemetryEvent[];
  total_lines: number;
  parsed: number;
  skipped: number;
  /** Lines that failed JSON.parse or schema validation, with reasons. */
  errors: Array<{ line_number: number; reason: string }>;
}
