import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
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
    buildIdeaBrief: (_ctx) => '# Idea Brief\n\nProblem: normalized by Nexus\n',
    traceability: () => ({
      nexus_stage_pack: 'nexus-discover-pack',
      absorbed_capability: 'pm-discover',
      source_map: getStagePackSourceMap('nexus-discover-pack'),
    }),
  };
}
