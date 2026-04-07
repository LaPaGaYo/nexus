import { stageAdapterOutputPath } from '../../artifacts';
import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';

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
    nexus_stage_pack: 'nexus-handoff-pack',
    absorbed_capability: 'ccb-routing',
    source_map: getStagePackSourceMap('nexus-handoff-pack'),
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
