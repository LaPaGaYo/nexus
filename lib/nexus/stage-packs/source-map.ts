import { CCB_SOURCE_MAP } from '../absorption/ccb/source-map';
import { GSD_SOURCE_MAP } from '../absorption/gsd/source-map';
import { PM_SOURCE_MAP } from '../absorption/pm/source-map';
import { SUPERPOWERS_SOURCE_MAP } from '../absorption/superpowers/source-map';
import type { NexusStagePackId } from '../types';
import type { NexusStagePackSourceBinding } from './types';

const STAGE_PACK_SOURCE_MAP: Record<NexusStagePackId, NexusStagePackSourceBinding> = {
  'nexus-discover-pack': {
    pack_id: 'nexus-discover-pack',
    canonical_stage: 'discover',
    absorbed_capabilities: ['pm-discover'],
    source_refs: PM_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'discover'),
  },
  'nexus-frame-pack': {
    pack_id: 'nexus-frame-pack',
    canonical_stage: 'frame',
    absorbed_capabilities: ['pm-frame'],
    source_refs: PM_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'frame'),
  },
  'nexus-plan-pack': {
    pack_id: 'nexus-plan-pack',
    canonical_stage: 'plan',
    absorbed_capabilities: ['gsd-plan'],
    source_refs: GSD_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'plan'),
  },
  'nexus-handoff-pack': {
    pack_id: 'nexus-handoff-pack',
    canonical_stage: 'handoff',
    absorbed_capabilities: ['ccb-routing'],
    source_refs: CCB_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'handoff'),
  },
  'nexus-build-pack': {
    pack_id: 'nexus-build-pack',
    canonical_stage: 'build',
    absorbed_capabilities: ['superpowers-build-discipline', 'superpowers-build-verification', 'ccb-execution'],
    source_refs: [
      ...SUPERPOWERS_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'build'),
      ...CCB_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'build'),
    ],
  },
  'nexus-review-pack': {
    pack_id: 'nexus-review-pack',
    canonical_stage: 'review',
    absorbed_capabilities: ['superpowers-review-discipline', 'ccb-review-codex', 'ccb-review-gemini'],
    source_refs: [
      ...SUPERPOWERS_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'review'),
      ...CCB_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'review'),
    ],
  },
  'nexus-qa-pack': {
    pack_id: 'nexus-qa-pack',
    canonical_stage: 'qa',
    absorbed_capabilities: ['ccb-qa'],
    source_refs: CCB_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'qa'),
  },
  'nexus-ship-pack': {
    pack_id: 'nexus-ship-pack',
    canonical_stage: 'ship',
    absorbed_capabilities: ['superpowers-ship-discipline'],
    source_refs: SUPERPOWERS_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'ship'),
  },
  'nexus-closeout-pack': {
    pack_id: 'nexus-closeout-pack',
    canonical_stage: 'closeout',
    absorbed_capabilities: ['gsd-closeout'],
    source_refs: GSD_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'closeout'),
  },
};

export function getStagePackSourceBinding(pack_id: NexusStagePackId): NexusStagePackSourceBinding {
  return STAGE_PACK_SOURCE_MAP[pack_id];
}

export function getStagePackSourceMap(pack_id: NexusStagePackId): string[] {
  return getStagePackSourceBinding(pack_id).source_refs.map((entry) => entry.upstream_file);
}
