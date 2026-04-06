import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { PM_SOURCE_MAP } from './source-map';

function discoverSourceMap(): string[] {
  return PM_SOURCE_MAP
    .filter((entry) => entry.absorbed_capability === 'pm-discover')
    .map((entry) => entry.upstream_file);
}

export function buildPmDiscoverTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'pm-discover',
    source_map: discoverSourceMap(),
  };
}

export function buildPmDiscoverIdeaBrief(_ctx: NexusAdapterContext): string {
  return '# Idea Brief\n\nProblem: normalized by Nexus\n';
}
