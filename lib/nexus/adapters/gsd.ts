import { createCloseoutStagePack, createPlanStagePack } from '../stage-packs';
import type { AdapterResult, AdapterTraceability, GsdAdapter } from './types';

export interface GsdPlanRaw {
  execution_readiness_packet: string;
  sprint_contract: string;
  design_contract: string | null;
  ready: boolean;
}

export interface GsdCloseoutRaw {
  closeout_record: string;
  archive_required: boolean;
  merge_ready: boolean;
}

function successResult<TRaw>(raw_output: TRaw, traceability: AdapterTraceability): AdapterResult<TRaw> {
  return {
    adapter_id: 'gsd',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

export function createDefaultGsdAdapter(): GsdAdapter {
  const planPack = createPlanStagePack();
  const closeoutPack = createCloseoutStagePack();

  return {
    plan: async (ctx) =>
      successResult<GsdPlanRaw>({
        execution_readiness_packet: planPack.buildExecutionReadinessPacket(ctx),
        sprint_contract: planPack.buildSprintContract(ctx),
        design_contract: null,
        ready: true,
      }, planPack.traceability()),
    closeout: async (ctx) =>
      successResult<GsdCloseoutRaw>({
        closeout_record: closeoutPack.buildCloseoutRecord(ctx),
        archive_required: true,
        merge_ready: true,
      }, closeoutPack.traceability()),
  };
}
