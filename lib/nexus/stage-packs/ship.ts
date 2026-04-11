import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildReleaseGateRecord } from '../absorption/superpowers/ship';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusShipStagePack {
  id: 'nexus-ship-pack';
  stage: 'ship';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildReleaseGateRecord(ctx: NexusAdapterContext, mergeReady: boolean): string;
  disciplineTraceability(): AdapterTraceability;
}

export function createShipStagePack(): NexusShipStagePack {
  const source_binding = getStagePackSourceBinding('nexus-ship-pack');

  return {
    id: 'nexus-ship-pack',
    stage: 'ship',
    source_binding,
    buildReleaseGateRecord: (ctx, mergeReady) => buildReleaseGateRecord(ctx, mergeReady),
    disciplineTraceability: () => ({
      nexus_stage_pack: 'nexus-ship-pack',
      absorbed_capability: 'superpowers-ship-discipline',
      source_map: getStagePackSourceMap('nexus-ship-pack'),
    }),
  };
}
