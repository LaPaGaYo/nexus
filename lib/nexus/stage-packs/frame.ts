import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildPmDecisionBrief, buildPmPrd } from './native-builders';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusFrameStagePack {
  id: 'nexus-frame-pack';
  stage: 'frame';
  absorbed_capability: 'pm-frame';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildDecisionBrief(ctx: NexusAdapterContext): string;
  buildPrd(ctx: NexusAdapterContext): string;
  traceability(): AdapterTraceability;
}

export function createFrameStagePack(): NexusFrameStagePack {
  const source_binding = getStagePackSourceBinding('nexus-frame-pack');

  return {
    id: 'nexus-frame-pack',
    stage: 'frame',
    absorbed_capability: 'pm-frame',
    source_binding,
    buildDecisionBrief: (ctx) => buildPmDecisionBrief(ctx),
    buildPrd: (ctx) => buildPmPrd(ctx),
    traceability: () => ({
      nexus_stage_pack: 'nexus-frame-pack',
      absorbed_capability: 'pm-frame',
      source_map: getStagePackSourceMap('nexus-frame-pack'),
    }),
  };
}
