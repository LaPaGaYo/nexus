import { buildSuperpowersBuildTraceability, buildVerificationSummary } from '../absorption';
import type { AdapterResult, AdapterTraceability, SuperpowersAdapter } from './types';

export interface SuperpowersBuildDisciplineRaw {
  verification_summary: string;
}

function successResult<TRaw>(raw_output: TRaw, traceability: AdapterTraceability): AdapterResult<TRaw> {
  return {
    adapter_id: 'superpowers',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

function reservedFutureResult(): AdapterResult<null> {
  return {
    adapter_id: 'superpowers',
    outcome: 'blocked',
    raw_output: null,
    requested_route: null,
    actual_route: null,
    notices: ['Superpowers seam is reserved for a later milestone'],
    conflict_candidates: [],
  };
}

export function createDefaultSuperpowersAdapter(): SuperpowersAdapter {
  return {
    build_discipline: async (ctx) =>
      successResult<SuperpowersBuildDisciplineRaw>({
        verification_summary: buildVerificationSummary(ctx),
      }, buildSuperpowersBuildTraceability()),
    review_discipline: async () => reservedFutureResult(),
    ship_discipline: async () => reservedFutureResult(),
  };
}
