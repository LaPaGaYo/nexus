import { NEXUS_STAGE_CONTENT, type NexusStageContentId } from '../types';
import { createDiscoverStageContent } from './discover';
import { createFrameStageContent } from './frame';
import { createPlanStageContent } from './plan';
import { getStageContentSourceBinding } from './source-map';
import type { NexusStageContentPack } from './types';

const STAGE_CONTENT: Record<NexusStageContentId, NexusStageContentPack> = {
  'nexus-discover-content': createDiscoverStageContent(),
  'nexus-frame-content': createFrameStageContent(),
  'nexus-plan-content': createPlanStageContent(),
  'nexus-handoff-content': {
    id: 'nexus-handoff-content',
    stage: 'handoff',
    sections: {
      overview: 'Nexus-owned governed handoff guidance for explicit routing and route approval.',
      checklist: '- record requested route\n- validate transport availability\n- require separate Nexus approval',
      artifact_contract: 'Writes .planning/current/handoff/governed-execution-routing.md, .planning/current/handoff/governed-handoff.md, and .planning/current/handoff/status.json.',
      routing: 'Advance to /build only after Nexus records an approved governed handoff.',
    },
  },
  'nexus-build-content': {
    id: 'nexus-build-content',
    stage: 'build',
    sections: {
      overview: 'Nexus-owned build guidance for disciplined implementation under governed routing.',
      checklist: '- run build discipline\n- preserve requested route\n- record actual route separately',
      artifact_contract: 'Writes .planning/current/build/build-request.json, .planning/current/build/build-result.md, and .planning/current/build/status.json.',
      routing: 'Advance to /review only after Nexus records a bounded build result.',
    },
  },
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
  'nexus-closeout-content': {
    id: 'nexus-closeout-content',
    stage: 'closeout',
    sections: {
      overview: 'Nexus-owned closeout guidance for archive verification, provenance consistency, and final readiness.',
      checklist: '- verify audit completeness\n- verify archive state\n- verify legal transition history',
      artifact_contract: 'Writes .planning/current/closeout/CLOSEOUT-RECORD.md and .planning/current/closeout/status.json.',
      routing: 'Closeout is the final governed conclusion of the work unit.',
    },
  },
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
