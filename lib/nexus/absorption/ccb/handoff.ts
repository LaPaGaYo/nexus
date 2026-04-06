import { stageAdapterOutputPath } from '../../artifacts';
import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { CCB_SOURCE_MAP } from './source-map';

function routingSourceMap(): string[] {
  return CCB_SOURCE_MAP
    .filter((entry) => entry.absorbed_capability === 'ccb-routing')
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

export function buildCcbRoutingTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'ccb-routing',
    source_map: routingSourceMap(),
  };
}

export function buildResolvedRoute(ctx: NexusAdapterContext) {
  const provider = expectedProvider(ctx.requested_route?.generator ?? null);

  return {
    raw_output: {
      available: true,
      provider,
    },
    actual_route: {
      provider,
      route: ctx.requested_route?.generator ?? 'codex-via-ccb',
      substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
      transport: 'ccb' as const,
      receipt_path: stageAdapterOutputPath('handoff'),
    },
  };
}
