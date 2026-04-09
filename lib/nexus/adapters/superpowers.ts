import { createBuildStagePack, createReviewStagePack, createShipStagePack } from '../stage-packs';
import type { AdapterResult, AdapterTraceability, SuperpowersAdapter } from './types';

export interface SuperpowersBuildDisciplineRaw {
  verification_summary: string;
}

export interface SuperpowersReviewDisciplineRaw {
  discipline_summary: string;
}

export interface SuperpowersShipDisciplineRaw {
  release_gate_record: string;
  checklist: {
    review_complete: boolean;
    qa_ready: boolean;
    merge_ready: boolean;
  };
  merge_ready: boolean;
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

export function createDefaultSuperpowersAdapter(): SuperpowersAdapter {
  const buildPack = createBuildStagePack();
  const reviewPack = createReviewStagePack();
  const shipPack = createShipStagePack();

  return {
    build_discipline: async (ctx) =>
      successResult<SuperpowersBuildDisciplineRaw>({
        verification_summary: buildPack.buildVerificationSummary(ctx),
      }, buildPack.disciplineTraceability()),
    review_discipline: async () =>
      successResult<SuperpowersReviewDisciplineRaw>({
        discipline_summary: 'Verification-before-completion passed',
      }, reviewPack.disciplineTraceability()),
    ship_discipline: async (ctx) =>
      successResult<SuperpowersShipDisciplineRaw>({
        release_gate_record: '# Release Gate Record\n\nResult: merge ready\n',
        checklist: {
          review_complete: true,
          qa_ready: true,
          merge_ready: true,
        },
        merge_ready: true,
      }, shipPack.disciplineTraceability()),
  };
}
