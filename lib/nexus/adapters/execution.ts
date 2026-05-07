import { createBuildStagePack, createReviewStagePack, createShipStagePack } from '../stage-packs';
import type { LearningCandidate } from '../contracts/types';
import type { AdapterKind, AdapterResult, AdapterTraceability, ExecutionAdapter } from './types';

export interface ExecutionBuildDisciplineRaw {
  verification_summary: string;
}

export interface ExecutionReviewDisciplineRaw {
  discipline_summary: string;
  learning_candidates?: LearningCandidate[];
}

export interface ExecutionShipDisciplineRaw {
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
    adapter_id: 'execution',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

function createExecutionAdapter(kind: AdapterKind): ExecutionAdapter {
  const buildPack = createBuildStagePack();
  const reviewPack = createReviewStagePack();
  const shipPack = createShipStagePack();

  return {
    kind,
    build_discipline: async (ctx) =>
      successResult<ExecutionBuildDisciplineRaw>({
        verification_summary: buildPack.buildVerificationSummary(ctx),
      }, buildPack.disciplineTraceability()),
    review_discipline: async (ctx) =>
      successResult<ExecutionReviewDisciplineRaw>({
        discipline_summary: reviewPack.buildDisciplineSummary(ctx),
      }, reviewPack.disciplineTraceability()),
    ship_discipline: async (ctx) =>
      successResult<ExecutionShipDisciplineRaw>({
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

export function createDefaultExecutionAdapter(): ExecutionAdapter {
  return createExecutionAdapter('stub');
}

export function createRuntimeExecutionAdapter(): ExecutionAdapter {
  return createExecutionAdapter('runtime');
}
