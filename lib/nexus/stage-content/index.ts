import { NEXUS_STAGE_CONTENT, type NexusStageContentId } from '../types';
import { createDiscoverStageContent } from './discover';
import { createFrameStageContent } from './frame';
import { createHandoffStageContent } from './handoff';
import { createBuildStageContent } from './build';
import { createPlanStageContent } from './plan';
import { createCloseoutStageContent } from './closeout';
import { getStageContentSourceBinding } from './source-map';
import type { NexusStageContentPack } from './types';

const STAGE_CONTENT: Record<NexusStageContentId, NexusStageContentPack> = {
  'nexus-discover-content': createDiscoverStageContent(),
  'nexus-frame-content': createFrameStageContent(),
  'nexus-plan-content': createPlanStageContent(),
  'nexus-handoff-content': createHandoffStageContent(),
  'nexus-build-content': createBuildStageContent(),
  'nexus-review-content': {
    id: 'nexus-review-content',
    stage: 'review',
    sections: {
      overview: 'Nexus-owned review guidance for audit completion, synthesis, and explicit gate state.',
      checklist: '- write the audit set\n- verify provenance consistency\n- record gate decision',
      artifact_contract: 'Writes .planning/audits/current/* and .planning/current/review/status.json.',
      routing: 'Advance to /qa, /ship, or /closeout only through Nexus-authored review completion state.',
    },
  },
  'nexus-qa-content': {
    id: 'nexus-qa-content',
    stage: 'qa',
    sections: {
      overview: 'Nexus-owned QA guidance for explicit validation scope beyond code review.',
      checklist: '- define validation scope\n- record findings\n- keep runtime status explicit',
      artifact_contract: 'Currently writes .planning/current/qa/status.json while broader QA runtime depth remains staged.',
      routing: 'QA content must not bypass review or create governed advancement outside Nexus.',
    },
  },
  'nexus-ship-content': {
    id: 'nexus-ship-content',
    stage: 'ship',
    sections: {
      overview: 'Nexus-owned ship guidance for conservative release gating and merge readiness.',
      checklist: '- require review artifacts\n- require governed gate state\n- keep release semantics explicit',
      artifact_contract: 'Currently writes .planning/current/ship/status.json while full release-gate runtime remains staged.',
      routing: 'Ship content must not imply implemented release authority before Nexus runtime says so.',
    },
  },
  'nexus-closeout-content': createCloseoutStageContent(),
};

export { NEXUS_STAGE_CONTENT } from '../types';
export * from './types';
export * from './source-map';

export function getStageContent(content_id: NexusStageContentId): NexusStageContentPack {
  return STAGE_CONTENT[content_id];
}

export function getAllStageContent(): NexusStageContentPack[] {
  return NEXUS_STAGE_CONTENT.map((content_id) => getStageContent(content_id));
}
