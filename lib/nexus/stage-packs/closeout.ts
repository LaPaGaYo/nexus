import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildCloseoutRecord } from '../absorption/gsd/closeout';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusCloseoutStagePack {
  id: 'nexus-closeout-pack';
  stage: 'closeout';
  absorbed_capability: 'gsd-closeout';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildCloseoutRecord(ctx: NexusAdapterContext): string;
  traceability(): AdapterTraceability;
}

export function createCloseoutStagePack(): NexusCloseoutStagePack {
  const source_binding = getStagePackSourceBinding('nexus-closeout-pack');

  return {
    id: 'nexus-closeout-pack',
    stage: 'closeout',
    absorbed_capability: 'gsd-closeout',
    source_binding,
    buildCloseoutRecord: (ctx) => buildCloseoutRecord(ctx),
    traceability: () => ({
      nexus_stage_pack: 'nexus-closeout-pack',
      absorbed_capability: 'gsd-closeout',
      source_map: getStagePackSourceMap('nexus-closeout-pack'),
    }),
  };
}
