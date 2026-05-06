#!/usr/bin/env bun
import { getRuntimeNexusAdapters } from '../lib/nexus/adapters/registry';
import {
  buildCliErrorEnvelope,
  formatCompletionAdvisorForInteractiveCli,
  formatCliCompletionContextForCli,
  resolveCliCompletionContext,
} from '../lib/nexus/cli-advisor';
import { resolveInvocation } from '../lib/nexus/commands/index';
import { defaultExecutionSelection } from '../lib/nexus/execution-topology';
import { resolveRuntimeInvocation } from '../lib/nexus/runtime-invocation';
import type { RuntimeOutputMode } from '../lib/nexus/runtime-invocation';
import { resolveRuntimeCwd } from '../lib/nexus/runtime-cwd';
import type { CanonicalCommandId } from '../lib/nexus/types';

const cwd = resolveRuntimeCwd();
let command: CanonicalCommandId | null = null;
let outputMode: RuntimeOutputMode = 'json-with-advisor';

function emitSuccess(payload: unknown, advisorSummary: string | null): void {
  if (outputMode === 'human' || outputMode === 'interactive') {
    if (advisorSummary) {
      console.log(advisorSummary);
      return;
    }
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (outputMode === 'json-with-advisor' && advisorSummary) {
    console.error(advisorSummary);
  }
  console.log(JSON.stringify(payload, null, 2));
}

function emitFailure(message: string, payload: unknown, advisorSummary: string | null): void {
  if (outputMode === 'human' || outputMode === 'interactive') {
    console.log(message);
    if (advisorSummary) {
      console.log(`\n${advisorSummary}`);
    }
    return;
  }

  if (outputMode === 'json-with-advisor') {
    console.error(message);
    if (advisorSummary) {
      console.error(`\n${advisorSummary}`);
    }
  }

  console.log(JSON.stringify(payload, null, 2));
}

function parseFlag(argv: string[], name: string): string | undefined {
  // Supports both --foo=bar and --foo bar
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === name && i + 1 < argv.length) return argv[i + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function formatCompletionContextForOutput(
  context: ReturnType<typeof resolveCliCompletionContext>,
): string | null {
  if (outputMode === 'interactive' && context.advisor) {
    return formatCompletionAdvisorForInteractiveCli(context.advisor);
  }

  return formatCliCompletionContextForCli(context);
}

try {
  // Phase 5 (Track D-D3): `nexus do "<intent>"` is a meta-command that
  // routes via the SkillRegistry rather than the canonical lifecycle.
  // It must be handled BEFORE resolveRuntimeInvocation since it does not
  // map to a CanonicalCommandId.
  const argv = process.argv.slice(2);
  if (argv[0] === 'do') {
    const { runDoCommandAsync } = await import('../lib/nexus/commands/do');
    const intentString = argv.slice(1).join(' ').trim();
    if (!intentString) {
      console.error('Usage: nexus do "<intent>"');
      process.exit(1);
    }
    // Best-effort: auto-register a real LLM classifier if NEXUS_INTENT_LLM=1
    // and an API key is present in the environment. Without auto-register,
    // the no-op classifier preserves the keyword-only outcome.
    if (process.env.NEXUS_INTENT_LLM === '1') {
      const { autoRegisterLLMClassifier } = await import('../lib/nexus/intent-classifier');
      autoRegisterLLMClassifier();
    }
    // Use async variant so the LLM classifier hook fires when enabled
    // (NEXUS_INTENT_LLM=1 + non-local_provider mode). Sync path runs when
    // LLM disabled — same outcome as before.
    const result = await runDoCommandAsync({ intent: intentString, cwd });
    if (process.env.NEXUS_DO_OUTPUT === 'json' || !process.stdout.isTTY) {
      console.log(JSON.stringify({
        intent: result.intent,
        outcome: result.outcome,
      }, null, 2));
    } else {
      console.log(result.text);
    }
    process.exit(result.outcome.kind === 'no_match' ? 0 : 0);
  }

  // Phase H (adoption telemetry — Track D-D3 follow-up): `nexus telemetry`
  // is a read-only reporter over the per-project telemetry log. Like
  // `nexus do`, NOT a canonical lifecycle stage; bypasses resolveInvocation.
  if (argv[0] === 'telemetry') {
    const { runTelemetryCommand } = await import('../lib/nexus/commands/telemetry');
    const stage = parseFlag(argv, '--stage');
    const kind = parseFlag(argv, '--kind');
    const since = parseFlag(argv, '--since');
    const raw = argv.includes('--raw');
    const outputJson = argv.includes('--json') || !process.stdout.isTTY;
    const result = runTelemetryCommand({ cwd, stage, kind, since, raw });
    if (outputJson) {
      console.log(JSON.stringify({
        enabled: result.enabled,
        log_path: result.log_path,
        summary: result.summary,
        events: result.events,
        read_meta: { total_lines: result.read.total_lines, parsed: result.read.parsed, skipped: result.read.skipped },
      }, null, 2));
    } else {
      console.log(result.text);
    }
    process.exit(0);
  }

  const runtimeInvocation = resolveRuntimeInvocation(argv, process.env);
  const invocation = resolveInvocation(runtimeInvocation.command);
  command = invocation.command;
  outputMode = runtimeInvocation.outputMode;
  const result = await invocation.handler({
    cwd,
    clock: () => new Date().toISOString(),
    via: invocation.via,
    adapters: getRuntimeNexusAdapters(),
    execution: defaultExecutionSelection(),
    continuation_mode_override: runtimeInvocation.continuationModeOverride,
    review_advisory_disposition_override: runtimeInvocation.reviewAdvisoryDispositionOverride,
  });

  const advisorSummary = formatCompletionContextForOutput(
    resolveCliCompletionContext(cwd, invocation.command, {
      completionAdvisor: result.completion_advisor ?? null,
      status: result.status,
    }),
  );
  emitSuccess(result, advisorSummary);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const completionContext = command ? resolveCliCompletionContext(cwd, command) : null;
  const advisorSummary = completionContext ? formatCompletionContextForOutput(completionContext) : null;
  emitFailure(message, buildCliErrorEnvelope(message, completionContext, command), advisorSummary);
  process.exit(1);
}
