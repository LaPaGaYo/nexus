import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';

export function buildPmDiscoverTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-discover-pack',
    absorbed_capability: 'pm-discover',
    source_map: getStagePackSourceMap('nexus-discover-pack'),
  };
}

export function buildPmDiscoverIdeaBrief(_ctx: NexusAdapterContext): string {
  return '# Idea Brief\n\nProblem: normalized by Nexus\n';
}
