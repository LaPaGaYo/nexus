import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, join } from 'path';
import {
  NEXUS_TELEMETRY_SCHEMA_VERSION,
  type TelemetryEvent,
  type TelemetryReadResult,
} from './types';

/**
 * Storage layer for Phase H telemetry. Append-only JSONL at
 * ~/.nexus/telemetry/<slug>/events.jsonl.
 *
 * Mirrors the existing learnings storage pattern (see /learn skill) so
 * operators have one mental model for "where Nexus persists per-project
 * tracked data."
 */

export interface TelemetryStorageOptions {
  /** Project slug (typically derived from cwd). */
  slug: string;
  /** Override home directory (test-only). */
  home?: string;
}

/**
 * Resolve the absolute path of the telemetry log for a given project slug.
 * Does NOT create the file; that happens lazily on first append.
 */
export function resolveTelemetryLogPath(opts: TelemetryStorageOptions): string {
  const root = opts.home ?? homedir();
  return join(root, '.nexus', 'telemetry', opts.slug, 'events.jsonl');
}

/**
 * Append a telemetry event. Lazily creates the parent directory.
 * Failures are non-fatal — telemetry must never break the stage write.
 *
 * Caller is responsible for env-gating (don't call when telemetry disabled).
 */
export function appendTelemetryEvent(
  event: TelemetryEvent,
  opts: TelemetryStorageOptions,
): void {
  const path = resolveTelemetryLogPath(opts);
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + '\n', 'utf-8');
  } catch (err) {
    // Telemetry must NOT propagate failures upstream — the stage write is
    // more important than the event log. Surface to debug stream only.
    if (process.env.NEXUS_DEBUG_TELEMETRY) {
      process.stderr.write(
        `nexus telemetry: failed to append to ${path}: ${(err as Error).message}\n`,
      );
    }
  }
}

/**
 * Read the telemetry log, returning parsed events plus parse statistics.
 * Tolerates malformed lines (skips with reason) so a single corrupt entry
 * doesn't break observability.
 */
export function readTelemetryLog(opts: TelemetryStorageOptions): TelemetryReadResult {
  const path = resolveTelemetryLogPath(opts);
  if (!existsSync(path)) {
    return { events: [], total_lines: 0, parsed: 0, skipped: 0, errors: [] };
  }

  let content = '';
  try {
    content = readFileSync(path, 'utf-8');
  } catch (err) {
    return {
      events: [],
      total_lines: 0,
      parsed: 0,
      skipped: 0,
      errors: [{ line_number: 0, reason: `read failed: ${(err as Error).message}` }],
    };
  }

  const lines = content.split('\n').filter((line) => line.trim().length > 0);
  const events: TelemetryEvent[] = [];
  const errors: TelemetryReadResult['errors'] = [];
  let skipped = 0;

  lines.forEach((line, idx) => {
    try {
      const parsed = JSON.parse(line);
      if (parsed.schema_version !== NEXUS_TELEMETRY_SCHEMA_VERSION) {
        skipped++;
        errors.push({
          line_number: idx + 1,
          reason: `unsupported schema_version: ${parsed.schema_version}`,
        });
        return;
      }
      if (!isValidEventShape(parsed)) {
        skipped++;
        errors.push({ line_number: idx + 1, reason: 'invalid event shape' });
        return;
      }
      events.push(parsed as TelemetryEvent);
    } catch (err) {
      skipped++;
      errors.push({ line_number: idx + 1, reason: `parse error: ${(err as Error).message}` });
    }
  });

  return {
    events,
    total_lines: lines.length,
    parsed: events.length,
    skipped,
    errors,
  };
}

function isValidEventShape(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    typeof obj.schema_version === 'number' &&
    typeof obj.ts === 'string' &&
    typeof obj.run_id === 'string' &&
    typeof obj.kind === 'string' &&
    typeof obj.stage === 'string'
  );
}
