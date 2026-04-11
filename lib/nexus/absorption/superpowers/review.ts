import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections } from '../render';

export function buildSuperpowersReviewTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-review-pack',
    absorbed_capability: 'superpowers-review-discipline',
    source_map: getStagePackSourceMap('nexus-review-pack').filter((path) => path.includes('superpowers')),
  };
}

export function buildReviewDisciplineSummary(_ctx: NexusAdapterContext): string {
  const sections = getAbsorbedStageSections('review');

  return [
    sections.overview,
    ...sections.checklist,
    sections.routing,
  ].join('; ');
}
