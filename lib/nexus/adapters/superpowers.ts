import { createBuildStagePack, createReviewStagePack, createShipStagePack } from '../stage-packs';
import type { LearningCandidate } from '../types';
import type { AdapterKind, AdapterResult, AdapterTraceability, SuperpowersAdapter } from './types';

export interface SuperpowersBuildDisciplineRaw {
  verification_summary: string;
}

export interface SuperpowersReviewDisciplineRaw {
  discipline_summary: string;
  learning_candidates?: LearningCandidate[];
}

export interface SuperpowersShipDisciplineRaw {
  release_gate_record: string;
  checklist: {
    review_complete: boolean;
    qa_ready: boolean;
    merge_ready: boolean;
  };
  merge_ready: boolean;
  learning_candidates?: LearningCandidate[];
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

function createSuperpowersAdapter(kind: AdapterKind): SuperpowersAdapter {
  const buildPack = createBuildStagePack();
  const reviewPack = createReviewStagePack();
  const shipPack = createShipStagePack();

  return {
    kind,
    build_discipline: async (ctx) =>
      successResult<SuperpowersBuildDisciplineRaw>({
        verification_summary: buildPack.buildVerificationSummary(ctx),
      }, buildPack.disciplineTraceability()),
    review_discipline: async (ctx) =>
      successResult<SuperpowersReviewDisciplineRaw>({
        discipline_summary: reviewPack.buildDisciplineSummary(ctx),
      }, reviewPack.disciplineTraceability()),
    ship_discipline: async (ctx) =>
      successResult<SuperpowersShipDisciplineRaw>({
        release_gate_record: shipPack.buildReleaseGateRecord(ctx, true),
        checklist: {
          review_complete: true,
          qa_ready: true,
          merge_ready: true,
        },
        merge_ready: true,
      }, shipPack.disciplineTraceability()),
  };
}

export function createDefaultSuperpowersAdapter(): SuperpowersAdapter {
  return createSuperpowersAdapter('stub');
}

export function createRuntimeSuperpowersAdapter(): SuperpowersAdapter {
  return createSuperpowersAdapter('runtime');
}
