import { createDiscoverStagePack, createFrameStagePack } from '../stage-packs';
import type { AdapterResult, AdapterTraceability, PmAdapter } from './types';

export interface PmDiscoverRaw {
  idea_brief_markdown: string;
}

export interface PmFrameRaw {
  decision_brief_markdown: string;
  prd_markdown: string;
}

function successResult<TRaw>(raw_output: TRaw, traceability: AdapterTraceability): AdapterResult<TRaw> {
  return {
    adapter_id: 'pm',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

export function createDefaultPmAdapter(): PmAdapter {
  const discoverPack = createDiscoverStagePack();
  const framePack = createFrameStagePack();

  return {
    discover: async (ctx) =>
      successResult<PmDiscoverRaw>({
        idea_brief_markdown: discoverPack.buildIdeaBrief(ctx),
      }, discoverPack.traceability()),
    frame: async (ctx) =>
      successResult<PmFrameRaw>({
        decision_brief_markdown: framePack.buildDecisionBrief(ctx),
        prd_markdown: framePack.buildPrd(ctx),
      }, framePack.traceability()),
  };
}
