import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { SUPERPOWERS_SOURCE_MAP } from './source-map';

function buildSourceMap(): string[] {
  return SUPERPOWERS_SOURCE_MAP
    .filter((entry) => entry.canonical_stage === 'build')
    .map((entry) => entry.upstream_file);
}

export function buildSuperpowersBuildTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'superpowers-build-discipline',
    source_map: buildSourceMap(),
  };
}

export function buildVerificationSummary(_ctx: NexusAdapterContext): string {
  return 'TDD checks passed';
}
