import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
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
    buildDecisionBrief: (_ctx) => '# Decision Brief\n\nScope: Nexus PM seam\n',
    buildPrd: (_ctx) => '# PRD\n\nSuccess: repo-visible PM outputs\n',
    traceability: () => ({
      nexus_stage_pack: 'nexus-frame-pack',
      absorbed_capability: 'pm-frame',
      source_map: getStagePackSourceMap('nexus-frame-pack'),
    }),
  };
}
