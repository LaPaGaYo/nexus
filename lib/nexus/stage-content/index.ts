import { NEXUS_STAGE_CONTENT, type CanonicalCommandId, type NexusStageContentId } from '../types';
import { createDiscoverStageContent } from './discover';
import { createFrameStageContent } from './frame';
import { createHandoffStageContent } from './handoff';
import { createBuildStageContent } from './build';
import { createPlanStageContent } from './plan';
import { createReviewStageContent } from './review';
import { createQaStageContent } from './qa';
import { createShipStageContent } from './ship';
import { createCloseoutStageContent } from './closeout';
import { getStageContentSourceBinding } from './source-map';
import type { NexusStageContentPack } from './types';

const STAGE_CONTENT: Record<NexusStageContentId, NexusStageContentPack> = {
  'nexus-discover-content': createDiscoverStageContent(),
  'nexus-frame-content': createFrameStageContent(),
  'nexus-plan-content': createPlanStageContent(),
  'nexus-handoff-content': createHandoffStageContent(),
  'nexus-build-content': createBuildStageContent(),
  'nexus-review-content': createReviewStageContent(),
  'nexus-qa-content': createQaStageContent(),
  'nexus-ship-content': createShipStageContent(),
  'nexus-closeout-content': createCloseoutStageContent(),
};

export { NEXUS_STAGE_CONTENT } from '../types';
export * from './types';
export * from './source-map';

export function getStageContent(content_id: NexusStageContentId): NexusStageContentPack {
  return STAGE_CONTENT[content_id];
}

export function getStageContentForStage(stage: CanonicalCommandId): NexusStageContentPack {
  const content = Object.values(STAGE_CONTENT).find((pack) => pack.stage === stage);
  if (!content) {
    throw new Error(`No Nexus stage content registered for stage: ${stage}`);
  }

  return content;
}

export function getAllStageContent(): NexusStageContentPack[] {
  return NEXUS_STAGE_CONTENT.map((content_id) => getStageContent(content_id));
}
