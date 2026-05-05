import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildPmDiscoverIdeaBrief } from './native-builders';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusDiscoverStagePack {
  id: 'nexus-discover-pack';
  stage: 'discover';
  absorbed_capability: 'pm-discover';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildIdeaBrief(ctx: NexusAdapterContext): string;
  traceability(): AdapterTraceability;
}

export function createDiscoverStagePack(): NexusDiscoverStagePack {
  const source_binding = getStagePackSourceBinding('nexus-discover-pack');

  return {
    id: 'nexus-discover-pack',
    stage: 'discover',
    absorbed_capability: 'pm-discover',
    source_binding,
    buildIdeaBrief: (ctx) => buildPmDiscoverIdeaBrief(ctx),
    traceability: () => ({
      nexus_stage_pack: 'nexus-discover-pack',
      absorbed_capability: 'pm-discover',
      source_map: getStagePackSourceMap('nexus-discover-pack'),
    }),
  };
}
