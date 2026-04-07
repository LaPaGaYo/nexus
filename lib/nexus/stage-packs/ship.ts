import type { AdapterTraceability } from '../adapters/types';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusShipStagePack {
  id: 'nexus-ship-pack';
  stage: 'ship';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  disciplineTraceability(): AdapterTraceability;
}

export function createShipStagePack(): NexusShipStagePack {
  const source_binding = getStagePackSourceBinding('nexus-ship-pack');

  return {
    id: 'nexus-ship-pack',
    stage: 'ship',
    source_binding,
    disciplineTraceability: () => ({
      nexus_stage_pack: 'nexus-ship-pack',
      absorbed_capability: 'superpowers-ship-discipline',
      source_map: getStagePackSourceMap('nexus-ship-pack'),
    }),
  };
}
