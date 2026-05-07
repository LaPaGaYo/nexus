import type { NexusStageContentId } from '../contracts/types';
import type { NexusStageContentSourceBinding } from './types';

const STAGE_CONTENT_SOURCE_MAP: Record<NexusStageContentId, NexusStageContentSourceBinding> = {
  'nexus-discover-content': {
    content_id: 'nexus-discover-content',
    canonical_stage: 'discover',
    content_root: 'lib/nexus/stage-content/discover',
    source_refs: [],
  },
  'nexus-frame-content': {
    content_id: 'nexus-frame-content',
    canonical_stage: 'frame',
    content_root: 'lib/nexus/stage-content/frame',
    source_refs: [],
  },
  'nexus-plan-content': {
    content_id: 'nexus-plan-content',
    canonical_stage: 'plan',
    content_root: 'lib/nexus/stage-content/plan',
    source_refs: [],
  },
  'nexus-handoff-content': {
    content_id: 'nexus-handoff-content',
    canonical_stage: 'handoff',
    content_root: 'lib/nexus/stage-content/handoff',
    source_refs: [],
  },
  'nexus-build-content': {
    content_id: 'nexus-build-content',
    canonical_stage: 'build',
    content_root: 'lib/nexus/stage-content/build',
    source_refs: [],
  },
  'nexus-review-content': {
    content_id: 'nexus-review-content',
    canonical_stage: 'review',
    content_root: 'lib/nexus/stage-content/review',
    source_refs: [],
  },
  'nexus-qa-content': {
    content_id: 'nexus-qa-content',
    canonical_stage: 'qa',
    content_root: 'lib/nexus/stage-content/qa',
    source_refs: [],
  },
  'nexus-ship-content': {
    content_id: 'nexus-ship-content',
    canonical_stage: 'ship',
    content_root: 'lib/nexus/stage-content/ship',
    source_refs: [],
  },
  'nexus-closeout-content': {
    content_id: 'nexus-closeout-content',
    canonical_stage: 'closeout',
    content_root: 'lib/nexus/stage-content/closeout',
    source_refs: [],
  },
};

export function getStageContentSourceBinding(content_id: NexusStageContentId): NexusStageContentSourceBinding {
  return STAGE_CONTENT_SOURCE_MAP[content_id];
}
