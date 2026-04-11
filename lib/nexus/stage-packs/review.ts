import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildReviewDisciplineSummary } from '../absorption/superpowers/review';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusReviewStagePack {
  id: 'nexus-review-pack';
  stage: 'review';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildDisciplineSummary(ctx: NexusAdapterContext): string;
  disciplineTraceability(): AdapterTraceability;
  auditTraceability(provider: 'codex' | 'gemini'): AdapterTraceability;
}

export function createReviewStagePack(): NexusReviewStagePack {
  const source_binding = getStagePackSourceBinding('nexus-review-pack');

  return {
    id: 'nexus-review-pack',
    stage: 'review',
    source_binding,
    buildDisciplineSummary: (ctx) => buildReviewDisciplineSummary(ctx),
    disciplineTraceability: () => ({
      nexus_stage_pack: 'nexus-review-pack',
      absorbed_capability: 'superpowers-review-discipline',
      source_map: getStagePackSourceMap('nexus-review-pack').filter((path) => path.includes('superpowers')),
    }),
    auditTraceability: (provider) => ({
      nexus_stage_pack: 'nexus-review-pack',
      absorbed_capability: provider === 'codex' ? 'ccb-review-codex' : 'ccb-review-gemini',
      source_map: getStagePackSourceMap('nexus-review-pack').filter((path) =>
        provider === 'codex' ? path.includes('codex_comm.py') : path.includes('gemini_comm.py'),
      ),
    }),
  };
}
