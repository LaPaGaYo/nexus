import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { GSD_SOURCE_MAP } from './source-map';

function planSourceMap(): string[] {
  return GSD_SOURCE_MAP
    .filter((entry) => entry.absorbed_capability === 'gsd-plan')
    .map((entry) => entry.upstream_file);
}

export function buildGsdPlanTraceability(): AdapterTraceability {
  return {
    absorbed_capability: 'gsd-plan',
    source_map: planSourceMap(),
  };
}

export function buildExecutionReadinessPacket(_ctx: NexusAdapterContext): string {
  return '# Execution Readiness Packet\n\nStatus: ready\n\nScope: governed thin slice\n';
}

export function buildSprintContract(_ctx: NexusAdapterContext): string {
  return '# Sprint Contract\n\nScope: governed thin slice\n\nVerification: review then closeout\n';
}
