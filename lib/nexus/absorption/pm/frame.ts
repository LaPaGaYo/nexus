import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections, renderChecklist, renderExecutionContext } from '../render';

export function buildPmFrameTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-frame-pack',
    absorbed_capability: 'pm-frame',
    source_map: getStagePackSourceMap('nexus-frame-pack'),
  };
}

export function buildPmDecisionBrief(_ctx: NexusAdapterContext): string {
  const ctx = _ctx;
  const sections = getAbsorbedStageSections('frame');

  return [
    '# Decision Brief',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Framing Checklist', sections.checklist),
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

export function buildPmPrd(_ctx: NexusAdapterContext): string {
  const sections = getAbsorbedStageSections('frame');

  return [
    '# PRD',
    '',
    '## Scope and Success',
    '',
    sections.overview,
    '',
    renderChecklist('Success Criteria', sections.checklist),
    '## Routing',
    '',
    sections.routing,
    '',
  ].join('\n');
}
