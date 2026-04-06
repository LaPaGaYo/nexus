import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { GSD_SOURCE_MAP } from './source-map';

function closeoutSourceMap(): string[] {
  return GSD_SOURCE_MAP
    .filter((entry) => entry.absorbed_capability === 'gsd-closeout')
    .map((entry) => entry.upstream_file);
}

export function buildGsdCloseoutTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'gsd-closeout',
    source_map: closeoutSourceMap(),
  };
}

export function buildCloseoutRecord(_ctx: NexusAdapterContext): string {
  return '# Closeout Record\n\nResult: merge ready\n';
}
