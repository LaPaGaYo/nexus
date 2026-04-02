import type { AdapterResult, GsdAdapter } from './types';

export interface GsdPlanRaw {
  execution_readiness_packet: string;
  sprint_contract: string;
  ready: boolean;
}

export interface GsdCloseoutRaw {
  closeout_record: string;
  archive_required: boolean;
  merge_ready: boolean;
}

function successResult<TRaw>(raw_output: TRaw): AdapterResult<TRaw> {
  return {
    adapter_id: 'gsd',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
  };
}

export function createDefaultGsdAdapter(): GsdAdapter {
  return {
    plan: async () =>
      successResult<GsdPlanRaw>({
        execution_readiness_packet: '# Execution Readiness Packet\n\nStatus: ready\n\nScope: governed thin slice\n',
        sprint_contract: '# Sprint Contract\n\nScope: governed thin slice\n\nVerification: review then closeout\n',
        ready: true,
      }),
    closeout: async () =>
      successResult<GsdCloseoutRaw>({
        closeout_record: '# Closeout Record\n\nResult: merge ready\n',
        archive_required: true,
        merge_ready: true,
      }),
  };
}
