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

export function buildCcbExecutionTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-build-pack',
    absorbed_capability: 'ccb-execution',
    source_map: getStagePackSourceMap('nexus-build-pack'),
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
