#!/usr/bin/env bun
import { getRuntimeNexusAdapters } from '../lib/nexus/adapters/registry';
import {
  buildCliErrorEnvelope,
  formatCliCompletionContextForCli,
  resolveCliCompletionContext,
} from '../lib/nexus/cli-advisor';
import { resolveInvocation } from '../lib/nexus/commands/index';
import { defaultExecutionSelection } from '../lib/nexus/execution-topology';
import { resolveRuntimeInvocation } from '../lib/nexus/runtime-invocation';
import { resolveRuntimeCwd } from '../lib/nexus/runtime-cwd';
import type { CanonicalCommandId } from '../lib/nexus/types';

const cwd = resolveRuntimeCwd();
let command: CanonicalCommandId | null = null;
let outputMode: 'json-with-advisor' | 'json' | 'human' = 'json-with-advisor';

function emitSuccess(payload: unknown, advisorSummary: string | null): void {
  if (outputMode === 'human') {
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
  if (outputMode === 'human') {
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

try {
  const runtimeInvocation = resolveRuntimeInvocation(process.argv.slice(2), process.env);
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

  const advisorSummary = formatCliCompletionContextForCli(
    resolveCliCompletionContext(cwd, invocation.command, {
      completionAdvisor: result.completion_advisor ?? null,
      status: result.status,
    }),
  );
  emitSuccess(result, advisorSummary);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const completionContext = command ? resolveCliCompletionContext(cwd, command) : null;
  const advisorSummary = completionContext ? formatCliCompletionContextForCli(completionContext) : null;
  emitFailure(message, buildCliErrorEnvelope(message, completionContext, command), advisorSummary);
  process.exit(1);
}
