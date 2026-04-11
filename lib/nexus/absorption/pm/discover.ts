import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections, renderChecklist, renderExecutionContext } from '../render';

export function buildPmDiscoverTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-discover-pack',
    absorbed_capability: 'pm-discover',
    source_map: getStagePackSourceMap('nexus-discover-pack'),
  };
}

export function buildPmDiscoverIdeaBrief(_ctx: NexusAdapterContext): string {
  const ctx = _ctx;
  const sections = getAbsorbedStageSections('discover');

  return [
    '# Idea Brief',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Discovery Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Transition Rule',
    '',
    sections.routing,
    '',
  ].join('\n');
}
