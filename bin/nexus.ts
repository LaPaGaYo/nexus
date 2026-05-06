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
    const { runDoCommand } = await import('../lib/nexus/commands/do');
    const intentString = argv.slice(1).join(' ').trim();
    if (!intentString) {
      console.error('Usage: nexus do "<intent>"');
      process.exit(1);
    }
    const result = runDoCommand({ intent: intentString, cwd });
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
