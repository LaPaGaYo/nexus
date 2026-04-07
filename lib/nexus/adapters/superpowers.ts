import { createBuildStagePack } from '../stage-packs';
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
  const buildPack = createBuildStagePack();

  return {
    build_discipline: async (ctx) =>
      successResult<SuperpowersBuildDisciplineRaw>({
        verification_summary: buildPack.buildVerificationSummary(ctx),
      }, buildPack.disciplineTraceability()),
    review_discipline: async () => reservedFutureResult(),
    ship_discipline: async () => reservedFutureResult(),
  };
}
