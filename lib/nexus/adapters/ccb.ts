import { stageAdapterOutputPath } from '../artifacts';
import type { ActualRouteRecord } from '../types';
import type { AdapterResult, CcbAdapter } from './types';

export interface CcbResolveRouteRaw {
  available: boolean;
  provider: string | null;
}

export interface CcbExecuteGeneratorRaw {
  receipt: string;
}

function successResult<TRaw>(
  raw_output: TRaw,
  actual_route: ActualRouteRecord | null,
  requested_route: AdapterResult<TRaw>['requested_route'],
): AdapterResult<TRaw> {
  return {
    adapter_id: 'ccb',
    outcome: 'success',
    raw_output,
    requested_route,
    actual_route,
    notices: [],
    conflict_candidates: [],
  };
}

function inactiveResult(): AdapterResult<null> {
  return {
    adapter_id: 'ccb',
    outcome: 'blocked',
    raw_output: null,
    requested_route: null,
    actual_route: null,
    notices: ['CCB audit seam is reserved for a later milestone'],
    conflict_candidates: [],
  };
}

export function createDefaultCcbAdapter(): CcbAdapter {
  return {
    resolve_route: async (ctx) =>
      successResult<CcbResolveRouteRaw>(
        {
          available: true,
          provider: 'codex',
        },
        {
          provider: 'codex',
          route: ctx.requested_route?.generator ?? 'codex-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb',
          receipt_path: stageAdapterOutputPath('handoff'),
        },
        ctx.requested_route,
      ),
    execute_generator: async (ctx) =>
      successResult<CcbExecuteGeneratorRaw>(
        {
          receipt: 'ccb-default',
        },
        {
          provider: 'codex',
          route: ctx.requested_route?.generator ?? 'codex-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb',
          receipt_path: stageAdapterOutputPath('build'),
        },
        ctx.requested_route,
      ),
    execute_audit_a: async () => inactiveResult(),
    execute_audit_b: async () => inactiveResult(),
  };
}
