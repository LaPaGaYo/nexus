import type { AbsorbedSourceRef } from '../absorption/types';
import type { CanonicalCommandId, NexusStagePackId } from '../types';

export interface StagePackTraceability {
  nexus_stage_pack: NexusStagePackId;
  source_map: string[];
}

export interface NexusStagePackSourceBinding {
  pack_id: NexusStagePackId;
  canonical_stage: CanonicalCommandId;
  absorbed_capabilities: string[];
  source_refs: AbsorbedSourceRef[];
}
