import {
  stageAdapterOutputPath,
  stageAdapterRequestPath,
  planDesignContractPath,
  stageNormalizationPath,
} from '../artifacts';
import type { AdapterResult } from '../adapters/types';
import type { GsdCloseoutRaw, GsdPlanRaw } from '../adapters/gsd';

interface ArtifactWrite {
  path: string;
  content: string;
}

function buildTraceWrites(
  stage: 'plan' | 'closeout',
  requestPayload: Record<string, unknown>,
  result: AdapterResult<unknown>,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return [
    {
      path: stageAdapterRequestPath(stage),
      content: JSON.stringify(requestPayload, null, 2) + '\n',
    },
    {
      path: stageAdapterOutputPath(stage),
      content: JSON.stringify(result, null, 2) + '\n',
    },
    {
      path: stageNormalizationPath(stage),
      content: JSON.stringify(normalizationPayload, null, 2) + '\n',
    },
  ];
}

export function normalizeGsdPlan(
  result: AdapterResult<GsdPlanRaw>,
): { canonicalWrites: ArtifactWrite[] } {
  if (!result.raw_output.execution_readiness_packet.trim() || !result.raw_output.sprint_contract.trim()) {
    throw new Error('Canonical writeback failed');
  }

  const canonicalWrites: ArtifactWrite[] = [
    {
      path: '.planning/current/plan/execution-readiness-packet.md',
      content: result.raw_output.execution_readiness_packet,
    },
    {
      path: '.planning/current/plan/sprint-contract.md',
      content: result.raw_output.sprint_contract,
    },
  ];

  if (typeof result.raw_output.design_contract === 'string' && result.raw_output.design_contract.trim()) {
    canonicalWrites.push({
      path: planDesignContractPath(),
      content: result.raw_output.design_contract,
    });
  }

  return {
    canonicalWrites,
  };
}

export function normalizeGsdCloseout(
  result: AdapterResult<GsdCloseoutRaw>,
): { canonicalWrites: ArtifactWrite[] } {
  if (!result.raw_output.closeout_record.trim()) {
    throw new Error('Canonical writeback failed');
  }

  return {
    canonicalWrites: [
      {
        path: '.planning/current/closeout/CLOSEOUT-RECORD.md',
        content: result.raw_output.closeout_record,
      },
    ],
  };
}

export function buildGsdTraceabilityPayloads(
  stage: 'plan' | 'closeout',
  runId: string,
  inputs: string[],
  requestPayload: Record<string, unknown>,
  result: AdapterResult<unknown>,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return buildTraceWrites(stage, { run_id: runId, inputs, ...requestPayload }, result, normalizationPayload);
}
