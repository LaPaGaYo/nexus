import { stageAdapterOutputPath } from '../../artifacts';
import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { CCB_SOURCE_MAP } from './source-map';

function executionSourceMap(): string[] {
  return CCB_SOURCE_MAP
    .filter((entry) => entry.absorbed_capability === 'ccb-execution')
    .map((entry) => entry.upstream_file);
}

function expectedProvider(generator: string | null): string | null {
  if (generator?.startsWith('codex')) {
    return 'codex';
  }

  if (generator?.startsWith('gemini')) {
    return 'gemini';
  }

  return null;
}

export function buildCcbExecutionTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'ccb-execution',
    source_map: executionSourceMap(),
  };
}

export function buildGeneratorExecution(ctx: NexusAdapterContext) {
  const provider = expectedProvider(ctx.requested_route?.generator ?? null);

  return {
    raw_output: {
      receipt: 'ccb-default',
    },
    actual_route: {
      provider,
      route: ctx.requested_route?.generator ?? 'codex-via-ccb',
      substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
      transport: 'ccb' as const,
      receipt_path: stageAdapterOutputPath('build'),
    },
  };
}
