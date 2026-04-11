#!/usr/bin/env bun
import { getRuntimeNexusAdapters } from '../lib/nexus/adapters/registry';
import { resolveInvocation } from '../lib/nexus/commands/index';
import { defaultExecutionSelection } from '../lib/nexus/execution-topology';

const [, , rawCommand] = process.argv;

if (!rawCommand) {
  console.error('Usage: bun run bin/nexus.ts <command>');
  process.exit(1);
}

try {
  const invocation = resolveInvocation(rawCommand);
  const result = await invocation.handler({
    cwd: process.cwd(),
    clock: () => new Date().toISOString(),
    via: invocation.via,
    adapters: getRuntimeNexusAdapters(),
    execution: defaultExecutionSelection(),
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
