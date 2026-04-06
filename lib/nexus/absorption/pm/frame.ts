import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { PM_SOURCE_MAP } from './source-map';

function frameSourceMap(): string[] {
  return PM_SOURCE_MAP
    .filter((entry) => entry.absorbed_capability === 'pm-frame')
    .map((entry) => entry.upstream_file);
}

export function buildPmFrameTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'pm-frame',
    source_map: frameSourceMap(),
  };
}

export function buildPmDecisionBrief(_ctx: NexusAdapterContext): string {
  return '# Decision Brief\n\nScope: Nexus PM seam\n';
}

export function buildPmPrd(_ctx: NexusAdapterContext): string {
  return '# PRD\n\nSuccess: repo-visible PM outputs\n';
}
