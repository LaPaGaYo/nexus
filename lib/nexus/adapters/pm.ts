import {
  buildPmDecisionBrief,
  buildPmDiscoverIdeaBrief,
  buildPmDiscoverTraceability,
  buildPmFrameTraceability,
  buildPmPrd,
} from '../absorption';
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
  return {
    discover: async (ctx) =>
      successResult<PmDiscoverRaw>({
        idea_brief_markdown: buildPmDiscoverIdeaBrief(ctx),
      }, buildPmDiscoverTraceability()),
    frame: async (ctx) =>
      successResult<PmFrameRaw>({
        decision_brief_markdown: buildPmDecisionBrief(ctx),
        prd_markdown: buildPmPrd(ctx),
      }, buildPmFrameTraceability()),
  };
}
