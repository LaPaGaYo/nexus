import { createCloseoutStagePack, createPlanStagePack } from '../stage-packs';
import type { AdapterKind, AdapterResult, AdapterTraceability, PlanningAdapter } from './types';

export interface PlanningPlanRaw {
  execution_readiness_packet: string;
  sprint_contract: string;
  design_contract: string | null;
  ready: boolean;
}

export interface PlanningCloseoutRaw {
  closeout_record: string;
  archive_required: boolean;
  merge_ready: boolean;
}

function successResult<TRaw>(raw_output: TRaw, traceability: AdapterTraceability): AdapterResult<TRaw> {
  return {
    adapter_id: 'planning',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

function createPlanningAdapter(kind: AdapterKind): PlanningAdapter {
  const planPack = createPlanStagePack();
  const closeoutPack = createCloseoutStagePack();

  return {
    kind,
    plan: async (ctx) =>
      successResult<PlanningPlanRaw>({
        execution_readiness_packet: planPack.buildExecutionReadinessPacket(ctx),
        sprint_contract: planPack.buildSprintContract(ctx),
        design_contract: null,
        ready: true,
      }, planPack.traceability()),
    closeout: async (ctx) =>
      successResult<PlanningCloseoutRaw>({
        closeout_record: closeoutPack.buildCloseoutRecord(ctx),
        archive_required: true,
        merge_ready: true,
      }, closeoutPack.traceability()),
  };
}

export function createDefaultPlanningAdapter(): PlanningAdapter {
  return createPlanningAdapter('stub');
}

export function createRuntimePlanningAdapter(): PlanningAdapter {
  return createPlanningAdapter('runtime');
}
