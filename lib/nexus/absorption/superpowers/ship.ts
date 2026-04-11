import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections } from '../render';

export function buildSuperpowersShipTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-ship-pack',
    absorbed_capability: 'superpowers-ship-discipline',
    source_map: getStagePackSourceMap('nexus-ship-pack'),
  };
}

export function buildReleaseGateRecord(_ctx: NexusAdapterContext, mergeReady: boolean): string {
  const sections = getAbsorbedStageSections('ship');

  return [
    '# Release Gate Record',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    '## Gate Checklist',
    '',
    ...sections.checklist.map((item) => `- ${item}`),
    '',
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
    `Result: ${mergeReady ? 'merge ready' : 'blocked'}`,
    '',
  ].join('\n');
}
