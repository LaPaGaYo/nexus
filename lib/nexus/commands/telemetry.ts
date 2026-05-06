import {
  isTelemetryEnabled,
  projectSlugFromCwd,
  readTelemetryLog,
  resolveTelemetryLogPath,
  summarizeTelemetry,
  type TelemetryEvent,
  type TelemetrySummary,
  type TelemetryReadResult,
} from '../telemetry';

/**
 * Phase H (Track D-D3 follow-up): `nexus telemetry` meta-command.
 *
 * Reads the per-project telemetry log and produces a summary. Like
 * `nexus do`, this is NOT a canonical lifecycle stage — no artifact
 * write, no governance, no run state. Pure read-only reporter.
 */

export interface TelemetryCommandOptions {
  cwd: string;
  home?: string;
  /** Filter events by stage (e.g., 'build', 'review'). */
  stage?: string;
  /** Filter events by kind (e.g., 'stage_advisor_recorded'). */
  kind?: string;
  /** Output as raw events list rather than summary. */
  raw?: boolean;
  /** Filter events to those after this ISO timestamp. */
  since?: string;
}

export interface TelemetryCommandResult {
  enabled: boolean;
  log_path: string;
  read: TelemetryReadResult;
  events: TelemetryEvent[];
  summary: TelemetrySummary;
  text: string;
}

export function runTelemetryCommand(options: TelemetryCommandOptions): TelemetryCommandResult {
  const { cwd, home, stage, kind, raw, since } = options;
  const slug = projectSlugFromCwd(cwd);
  const log_path = resolveTelemetryLogPath({ slug, home });
  const read = readTelemetryLog({ slug, home });
  const enabled = isTelemetryEnabled();

  let events = read.events as TelemetryEvent[];
  if (stage) events = events.filter((e) => e.stage === stage);
  if (kind) events = events.filter((e) => e.kind === kind);
  if (since) events = events.filter((e) => e.ts >= since);

  const summary = summarizeTelemetry(events);
  const text = formatTelemetryReport({ enabled, log_path, read, events, summary, raw: !!raw });

  return { enabled, log_path, read, events, summary, text };
}

function formatTelemetryReport(args: {
  enabled: boolean;
  log_path: string;
  read: TelemetryReadResult;
  events: TelemetryEvent[];
  summary: TelemetrySummary;
  raw: boolean;
}): string {
  const lines: string[] = [];
  lines.push(`Telemetry log: ${args.log_path}`);
  lines.push(`Status: ${args.enabled ? 'ENABLED (NEXUS_TELEMETRY=1)' : 'disabled (set NEXUS_TELEMETRY=1 to enable)'}`);
  lines.push('');

  if (args.read.total_lines === 0) {
    lines.push('No telemetry events recorded yet.');
    if (!args.enabled) {
      lines.push('');
      lines.push('To start collecting events, set NEXUS_TELEMETRY=1 in your shell environment.');
    }
    return lines.join('\n');
  }

  if (args.read.skipped > 0) {
    lines.push(`Note: ${args.read.skipped}/${args.read.total_lines} log lines skipped (corruption or schema drift).`);
    lines.push('');
  }

  lines.push(`Events: ${args.summary.total} (across ${args.summary.unique_runs} run${args.summary.unique_runs === 1 ? '' : 's'})`);
  if (args.summary.first_ts && args.summary.last_ts) {
    lines.push(`Range:  ${args.summary.first_ts}  →  ${args.summary.last_ts}`);
  }
  lines.push('');

  if (Object.keys(args.summary.by_stage).length > 0) {
    lines.push('By stage:');
    for (const [stage, count] of Object.entries(args.summary.by_stage).sort((a, b) => b[1] - a[1])) {
      lines.push(`  /${stage.padEnd(10)} ${count}`);
    }
    lines.push('');
  }

  if (Object.keys(args.summary.by_kind).length > 0) {
    lines.push('By event kind:');
    for (const [kind, count] of Object.entries(args.summary.by_kind).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${kind.padEnd(38)} ${count}`);
    }
    lines.push('');
  }

  if (Object.keys(args.summary.by_outcome).length > 0) {
    lines.push('By stage outcome (advisor records):');
    for (const [outcome, count] of Object.entries(args.summary.by_outcome).sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${outcome.padEnd(20)} ${count}`);
    }
    lines.push('');
  }

  if (args.raw) {
    lines.push('Events:');
    for (const e of args.events.slice(-50)) {
      lines.push(`  ${e.ts}  ${e.run_id.slice(0, 8)}  /${e.stage.padEnd(10)} ${e.kind}`);
    }
  }

  return lines.join('\n');
}
