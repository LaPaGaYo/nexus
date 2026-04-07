import { createBuildStagePack, createHandoffStagePack } from '../stage-packs';
import type { ActualRouteRecord } from '../types';
import type { AdapterResult, AdapterTraceability, CcbAdapter } from './types';

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
  traceability: AdapterTraceability,
): AdapterResult<TRaw> {
  return {
    adapter_id: 'ccb',
    outcome: 'success',
    raw_output,
    requested_route,
    actual_route,
    notices: [],
    conflict_candidates: [],
    traceability,
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
  const handoffPack = createHandoffStagePack();
  const buildPack = createBuildStagePack();

  return {
    resolve_route: async (ctx) => {
      const resolved = handoffPack.buildResolvedRoute(ctx);

      return successResult<CcbResolveRouteRaw>(
        resolved.raw_output,
        resolved.actual_route,
        ctx.requested_route,
        handoffPack.traceability(),
      );
    },
    execute_generator: async (ctx) => {
      const execution = buildPack.buildGeneratorExecution(ctx);

      return successResult<CcbExecuteGeneratorRaw>(
        execution.raw_output,
        execution.actual_route,
        ctx.requested_route,
        buildPack.executionTraceability(),
      );
    },
    execute_audit_a: async () => inactiveResult(),
    execute_audit_b: async () => inactiveResult(),
    execute_qa: async () => inactiveResult(),
  };
}
