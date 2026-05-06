import { basename, resolve } from 'path';
import {
  NEXUS_TELEMETRY_SCHEMA_VERSION,
  type TelemetryEvent,
  type TelemetryEventKind,
} from './types';
import {
  appendTelemetryEvent,
  readTelemetryLog,
  resolveTelemetryLogPath,
  type TelemetryStorageOptions,
} from './storage';

export {
  NEXUS_TELEMETRY_SCHEMA_VERSION,
  type TelemetryEvent,
  type TelemetryEventKind,
  type TelemetryReadResult,
  type StageAdvisorRecordedEvent,
  type ReviewAdvisoryDispatchedEvent,
  type ShipReadinessGateVerdictEvent,
  type StageReEnteredEvent,
  type ReviewPassRoundChangedEvent,
  type ShipBranchOutcomeChosenEvent,
  type QaClusterRoutedEvent,
  type Build3StrikeTriggeredEvent,
  type CloseoutStaleEvidenceEvent,
  type FrameReadinessGateFailedEvent,
  type DiscoverAntiPatternDetectedEvent,
} from './types';

export {
  appendTelemetryEvent,
  readTelemetryLog,
  resolveTelemetryLogPath,
  type TelemetryStorageOptions,
} from './storage';

/**
 * Whether telemetry is enabled. Default: false.
 *
 * Enabled when `NEXUS_TELEMETRY=1`. Disabled when explicitly opted out via
 * `NEXUS_TELEMETRY=0` or unset.
 *
 * The privacy default is OFF — telemetry must be an explicit choice. Users
 * who don't opt in pay zero cost (no I/O, no events).
 */
export function isTelemetryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NEXUS_TELEMETRY === '1';
}

/**
 * Derive the project slug from a cwd. Used to scope per-project telemetry
 * (mirrors the slug derivation in nexus-slug bin script).
 */
export function projectSlugFromCwd(cwd: string): string {
  // Simple slug: basename of resolved cwd. Real nexus-slug uses git origin
  // when available; this fallback is sufficient for telemetry storage paths.
  return basename(resolve(cwd)) || 'unknown';
}

/**
 * Convenience: build a TelemetryEvent with schema_version + ts auto-filled.
 * Caller provides the event-specific fields.
 */
export function buildTelemetryEvent<E extends TelemetryEvent>(
  partial: Omit<E, 'schema_version' | 'ts'> & { ts?: string },
): E {
  return {
    schema_version: NEXUS_TELEMETRY_SCHEMA_VERSION,
    ts: partial.ts ?? new Date().toISOString(),
    ...partial,
  } as E;
}

/**
 * Emit a telemetry event if telemetry is enabled. No-op otherwise.
 *
 * This is the primary public surface; callers should prefer this over
 * directly calling `appendTelemetryEvent` so the env gate is respected.
 */
export function emitTelemetryEvent(
  event: TelemetryEvent,
  opts: TelemetryStorageOptions,
): void {
  if (!isTelemetryEnabled()) return;
  appendTelemetryEvent(event, opts);
}

/**
 * Convenience wrapper: take a cwd, derive slug, emit event.
 */
export function emitTelemetryEventForCwd(event: TelemetryEvent, cwd: string, home?: string): void {
  emitTelemetryEvent(event, { slug: projectSlugFromCwd(cwd), home });
}

// ─── Reporting helpers ────────────────────────────────────────────

export interface TelemetrySummary {
  total: number;
  by_stage: Record<string, number>;
  by_kind: Record<string, number>;
  by_outcome: Record<string, number>;
  /** First and last event timestamps in the log. */
  first_ts: string | null;
  last_ts: string | null;
  /** Distinct run_ids observed. */
  unique_runs: number;
}

export function summarizeTelemetry(events: readonly TelemetryEvent[]): TelemetrySummary {
  const by_stage: Record<string, number> = {};
  const by_kind: Record<string, number> = {};
  const by_outcome: Record<string, number> = {};
  const runs = new Set<string>();
  let first_ts: string | null = null;
  let last_ts: string | null = null;

  for (const event of events) {
    by_stage[event.stage] = (by_stage[event.stage] ?? 0) + 1;
    by_kind[event.kind] = (by_kind[event.kind] ?? 0) + 1;
    runs.add(event.run_id);
    if (event.kind === 'stage_advisor_recorded') {
      const outcome = event.stage_outcome;
      by_outcome[outcome] = (by_outcome[outcome] ?? 0) + 1;
    }
    if (first_ts === null || event.ts < first_ts) first_ts = event.ts;
    if (last_ts === null || event.ts > last_ts) last_ts = event.ts;
  }

  return {
    total: events.length,
    by_stage,
    by_kind,
    by_outcome,
    first_ts,
    last_ts,
    unique_runs: runs.size,
  };
}
