import type { CanonicalCommandId, NexusStagePackId } from '../contracts/types';

export interface StagePackTraceability {
  nexus_stage_pack: NexusStagePackId;
  source_map: string[];
}

export interface StagePackSourceRef {
  imported_path: string;
  upstream_file: string;
}

export interface NexusStagePackSourceBinding {
  pack_id: NexusStagePackId;
  canonical_stage: CanonicalCommandId;
  absorbed_capabilities: string[];
  source_refs: StagePackSourceRef[];
}
