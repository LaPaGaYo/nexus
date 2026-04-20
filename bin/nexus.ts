#!/usr/bin/env bun
import { getRuntimeNexusAdapters } from '../lib/nexus/adapters/registry';
import { resolveInvocation } from '../lib/nexus/commands/index';
import { defaultExecutionSelection } from '../lib/nexus/execution-topology';
import { resolveRuntimeInvocation } from '../lib/nexus/runtime-invocation';
import { resolveRuntimeCwd } from '../lib/nexus/runtime-cwd';

try {
  const runtimeInvocation = resolveRuntimeInvocation(process.argv.slice(2), process.env);
  const invocation = resolveInvocation(runtimeInvocation.command);
  const result = await invocation.handler({
    cwd: resolveRuntimeCwd(),
    clock: () => new Date().toISOString(),
    via: invocation.via,
    adapters: getRuntimeNexusAdapters(),
    execution: defaultExecutionSelection(),
    continuation_mode_override: runtimeInvocation.continuationModeOverride,
    review_advisory_disposition_override: runtimeInvocation.reviewAdvisoryDispositionOverride,
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
