import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections, renderChecklist, renderExecutionContext } from '../render';

export function buildGsdCloseoutTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-closeout-pack',
    absorbed_capability: 'gsd-closeout',
    source_map: getStagePackSourceMap('nexus-closeout-pack'),
  };
}

export function buildCloseoutRecord(_ctx: NexusAdapterContext): string {
  const ctx = _ctx;
  const sections = getAbsorbedStageSections('closeout');

  return [
    '# Closeout Record',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Closeout Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Final Gate',
    '',
    sections.routing,
    '',
  ].join('\n');
}
