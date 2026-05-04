import { createDiscoverStagePack, createFrameStagePack } from '../stage-packs';
import type { AdapterKind, AdapterResult, AdapterTraceability, PmAdapter } from './types';
import type { DesignIntentRecord } from '../types';

export interface PmDiscoverRaw {
  idea_brief_markdown: string;
}

export interface PmFrameRaw {
  decision_brief_markdown: string;
  prd_markdown: string;
  design_intent: DesignIntentRecord;
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

function createPmAdapter(kind: AdapterKind): PmAdapter {
  const discoverPack = createDiscoverStagePack();
  const framePack = createFrameStagePack();

  return {
    kind,
    discover: async (ctx) =>
      successResult<PmDiscoverRaw>({
        idea_brief_markdown: discoverPack.buildIdeaBrief(ctx),
      }, discoverPack.traceability()),
    frame: async (ctx) =>
      successResult<PmFrameRaw>({
        decision_brief_markdown: framePack.buildDecisionBrief(ctx),
        prd_markdown: framePack.buildPrd(ctx),
        design_intent: {
          impact: 'none',
          affected_surfaces: [],
          design_system_source: 'none',
          contract_required: false,
          verification_required: false,
        },
      }, framePack.traceability()),
  };
}

export function createDefaultPmAdapter(): PmAdapter {
  return createPmAdapter('stub');
}

export function createRuntimePmAdapter(): PmAdapter {
  return createPmAdapter('runtime');
}
