import type { CanonicalCommandId, NexusStageContentId } from '../types';

export interface NexusStageContentSections {
  overview: string;
  checklist: string;
  artifact_contract: string;
  routing: string;
}

export interface NexusStageContentPack {
  id: NexusStageContentId;
  stage: CanonicalCommandId;
  sections: NexusStageContentSections;
}

export interface NexusStageContentSourceRef {
  imported_path: string;
  upstream_file: string;
}

export interface NexusStageContentSourceBinding {
  content_id: NexusStageContentId;
  canonical_stage: CanonicalCommandId;
  content_root: string;
  source_refs: NexusStageContentSourceRef[];
}
