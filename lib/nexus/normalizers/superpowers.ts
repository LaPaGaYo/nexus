import {
  stageAdapterOutputPath,
  stageAdapterRequestPath,
  stageNormalizationPath,
} from '../artifacts';
import type { AdapterResult } from '../adapters/types';
import type { SuperpowersBuildDisciplineRaw } from '../adapters/superpowers';
import type { RequestedRouteRecord } from '../types';

interface ArtifactWrite {
  path: string;
  content: string;
}

export function normalizeBuildDiscipline(
  result: AdapterResult<SuperpowersBuildDisciplineRaw>,
): { verification_summary: string } {
  if (result.outcome === 'blocked') {
    throw new Error('Superpowers discipline blocked build');
  }

  if (result.outcome === 'refused') {
    throw new Error('Superpowers discipline refused build');
  }

  if (!result.raw_output.verification_summary.trim()) {
    throw new Error('Canonical writeback failed');
  }

  return {
    verification_summary: result.raw_output.verification_summary,
  };
}

export function buildBuildStageTraceabilityPayloads(
  runId: string,
  inputs: string[],
  requestedRoute: RequestedRouteRecord,
  disciplineResult: AdapterResult<unknown>,
  transportResult: AdapterResult<unknown> | null,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return [
    {
      path: stageAdapterRequestPath('build'),
      content: JSON.stringify(
        {
          run_id: runId,
          inputs,
          adapter_chain: ['superpowers', 'ccb'],
          requested_route: requestedRoute,
          discipline_required: true,
        },
        null,
        2,
      ) + '\n',
    },
    {
      path: stageAdapterOutputPath('build'),
      content: JSON.stringify(
        {
          discipline: disciplineResult,
          transport: transportResult,
        },
        null,
        2,
      ) + '\n',
    },
    {
      path: stageNormalizationPath('build'),
      content: JSON.stringify(normalizationPayload, null, 2) + '\n',
    },
  ];
}
