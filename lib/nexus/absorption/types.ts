import type { AbsorbedSourceSystem, CanonicalCommandId } from '../types';

export interface AbsorbedSourceRef {
  system: AbsorbedSourceSystem;
  imported_path: string;
  upstream_repo_url: string;
  pinned_commit: string;
  upstream_file: string;
  canonical_stage: CanonicalCommandId;
  absorbed_capability: string;
}
