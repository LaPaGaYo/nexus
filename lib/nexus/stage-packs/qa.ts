import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildQaReport } from '../absorption/qa';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusQaStagePack {
  id: 'nexus-qa-pack';
  stage: 'qa';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildQaReport(ctx: NexusAdapterContext, ready: boolean, findings: string[], advisories?: string[]): string;
  validationTraceability(): AdapterTraceability;
}

export function createQaStagePack(): NexusQaStagePack {
  const source_binding = getStagePackSourceBinding('nexus-qa-pack');

  return {
    id: 'nexus-qa-pack',
    stage: 'qa',
    source_binding,
    buildQaReport: (ctx, ready, findings, advisories) => buildQaReport(ctx, ready, findings, advisories),
    validationTraceability: () => ({
      nexus_stage_pack: 'nexus-qa-pack',
      absorbed_capability: 'ccb-qa',
      source_map: getStagePackSourceMap('nexus-qa-pack'),
    }),
  };
}
