import type { AdapterTraceability } from '../adapters/types';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusQaStagePack {
  id: 'nexus-qa-pack';
  stage: 'qa';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  validationTraceability(): AdapterTraceability;
}

export function createQaStagePack(): NexusQaStagePack {
  const source_binding = getStagePackSourceBinding('nexus-qa-pack');

  return {
    id: 'nexus-qa-pack',
    stage: 'qa',
    source_binding,
    validationTraceability: () => ({
      nexus_stage_pack: 'nexus-qa-pack',
      absorbed_capability: 'ccb-qa',
      source_map: getStagePackSourceMap('nexus-qa-pack'),
    }),
  };
}
