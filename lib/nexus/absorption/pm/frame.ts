import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';

export function buildPmFrameTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-frame-pack',
    absorbed_capability: 'pm-frame',
    source_map: getStagePackSourceMap('nexus-frame-pack'),
  };
}

export function buildPmDecisionBrief(_ctx: NexusAdapterContext): string {
  return '# Decision Brief\n\nScope: Nexus PM seam\n';
}

export function buildPmPrd(_ctx: NexusAdapterContext): string {
  return '# PRD\n\nSuccess: repo-visible PM outputs\n';
}
