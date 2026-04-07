import { stageAdapterOutputPath } from '../artifacts';
import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

function expectedProvider(generator: string | null): string | null {
  if (generator?.startsWith('codex')) {
    return 'codex';
  }

  if (generator?.startsWith('gemini')) {
    return 'gemini';
  }

  return null;
}

export interface NexusHandoffStagePack {
  id: 'nexus-handoff-pack';
  stage: 'handoff';
  absorbed_capability: 'ccb-routing';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildResolvedRoute(ctx: NexusAdapterContext): {
    raw_output: { available: boolean; provider: string | null };
    actual_route: {
      provider: string | null;
      route: string;
      substrate: string;
      transport: 'ccb';
      receipt_path: string;
    };
  };
  traceability(): AdapterTraceability;
}

export function createHandoffStagePack(): NexusHandoffStagePack {
  const source_binding = getStagePackSourceBinding('nexus-handoff-pack');

  return {
    id: 'nexus-handoff-pack',
    stage: 'handoff',
    absorbed_capability: 'ccb-routing',
    source_binding,
    buildResolvedRoute: (ctx) => {
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
    },
    traceability: () => ({
      nexus_stage_pack: 'nexus-handoff-pack',
      absorbed_capability: 'ccb-routing',
      source_map: getStagePackSourceMap('nexus-handoff-pack'),
    }),
  };
}
