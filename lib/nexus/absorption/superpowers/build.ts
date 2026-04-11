import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections } from '../render';

export function buildSuperpowersBuildTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-build-pack',
    absorbed_capability: 'superpowers-build-discipline',
    source_map: getStagePackSourceMap('nexus-build-pack'),
  };
}

export function buildVerificationSummary(_ctx: NexusAdapterContext): string {
  const sections = getAbsorbedStageSections('build');

  return [
    sections.overview,
    ...sections.checklist,
    sections.routing,
  ].join('; ');
}
