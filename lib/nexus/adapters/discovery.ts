import { createDiscoverStagePack, createFrameStagePack } from '../stage-packs';
import type { AdapterKind, AdapterResult, AdapterTraceability, DiscoveryAdapter } from './types';
import type { DesignIntentRecord } from '../contracts/types';

export interface DiscoveryDiscoverRaw {
  idea_brief_markdown: string;
}

export interface DiscoveryFrameRaw {
  decision_brief_markdown: string;
  prd_markdown: string;
  design_intent: DesignIntentRecord;
}

function successResult<TRaw>(raw_output: TRaw, traceability: AdapterTraceability): AdapterResult<TRaw> {
  return {
    adapter_id: 'discovery',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

function createDiscoveryAdapter(kind: AdapterKind): DiscoveryAdapter {
  const discoverPack = createDiscoverStagePack();
  const framePack = createFrameStagePack();

  return {
    kind,
    discover: async (ctx) =>
      successResult<DiscoveryDiscoverRaw>({
        idea_brief_markdown: discoverPack.buildIdeaBrief(ctx),
      }, discoverPack.traceability()),
    frame: async (ctx) =>
      successResult<DiscoveryFrameRaw>({
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

export function createDefaultDiscoveryAdapter(): DiscoveryAdapter {
  return createDiscoveryAdapter('stub');
}

export function createRuntimeDiscoveryAdapter(): DiscoveryAdapter {
  return createDiscoveryAdapter('runtime');
}
