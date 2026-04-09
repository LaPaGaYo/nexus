import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusPlanStagePack {
  id: 'nexus-plan-pack';
  stage: 'plan';
  absorbed_capability: 'gsd-plan';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildExecutionReadinessPacket(ctx: NexusAdapterContext): string;
  buildSprintContract(ctx: NexusAdapterContext): string;
  traceability(): AdapterTraceability;
}

export function createPlanStagePack(): NexusPlanStagePack {
  const source_binding = getStagePackSourceBinding('nexus-plan-pack');

  return {
    id: 'nexus-plan-pack',
    stage: 'plan',
    absorbed_capability: 'gsd-plan',
    source_binding,
    buildExecutionReadinessPacket: (_ctx) => '# Execution Readiness Packet\n\nStatus: ready\n\nScope: governed thin slice\n',
    buildSprintContract: (_ctx) => '# Sprint Contract\n\nScope: governed thin slice\n\nVerification: review then closeout\n',
    traceability: () => ({
      nexus_stage_pack: 'nexus-plan-pack',
      absorbed_capability: 'gsd-plan',
      source_map: getStagePackSourceMap('nexus-plan-pack'),
    }),
  };
}
