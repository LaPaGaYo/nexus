import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections, renderChecklist, renderExecutionContext } from '../render';

export function buildGsdPlanTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-plan-pack',
    absorbed_capability: 'gsd-plan',
    source_map: getStagePackSourceMap('nexus-plan-pack'),
  };
}

export function buildExecutionReadinessPacket(_ctx: NexusAdapterContext): string {
  const ctx = _ctx;
  const sections = getAbsorbedStageSections('plan');

  return [
    '# Execution Readiness Packet',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Readiness Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
  ].join('\n');
}

export function buildSprintContract(_ctx: NexusAdapterContext): string {
  const sections = getAbsorbedStageSections('plan');

  return [
    '# Sprint Contract',
    '',
    '## Bounded Scope',
    '',
    sections.overview,
    '',
    renderChecklist('Execution Commitments', sections.checklist),
    '## Transition Rule',
    '',
    sections.routing,
    '',
  ].join('\n');
}
