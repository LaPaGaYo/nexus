import {
  stageAdapterOutputPath,
  stageAdapterRequestPath,
  stageNormalizationPath,
} from '../artifacts';
import type { AdapterResult } from '../adapters/types';
import type { CanonicalCommandId } from '../types';
import type { PmDiscoverRaw, PmFrameRaw } from '../adapters/pm';

interface ArtifactWrite {
  path: string;
  content: string;
}

function buildTraceWrites(
  stage: 'discover' | 'frame',
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

export function normalizePmDiscover(
  result: AdapterResult<PmDiscoverRaw>,
): { canonicalWrites: ArtifactWrite[] } {
  if (!result.raw_output.idea_brief_markdown.trim()) {
    throw new Error('Canonical writeback failed');
  }

  return {
    canonicalWrites: [
      {
        path: 'docs/product/idea-brief.md',
        content: result.raw_output.idea_brief_markdown,
      },
    ],
  };
}

export function normalizePmFrame(
  result: AdapterResult<PmFrameRaw>,
): { canonicalWrites: ArtifactWrite[] } {
  if (!result.raw_output.decision_brief_markdown.trim() || !result.raw_output.prd_markdown.trim()) {
    throw new Error('Canonical writeback failed');
  }

  return {
    canonicalWrites: [
      {
        path: 'docs/product/decision-brief.md',
        content: result.raw_output.decision_brief_markdown,
      },
      {
        path: 'docs/product/prd.md',
        content: result.raw_output.prd_markdown,
      },
    ],
  };
}

export function buildPmTraceabilityPayloads(
  stage: 'discover' | 'frame',
  runId: string,
  inputs: string[],
  requestPayload: Record<string, unknown>,
  result: AdapterResult<unknown>,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return buildTraceWrites(stage, { run_id: runId, inputs, ...requestPayload }, result, normalizationPayload);
}

export function canonicalStageOutputs(stage: 'discover' | 'frame'): string[] {
  if (stage === 'discover') {
    return ['docs/product/idea-brief.md', '.planning/current/discover/status.json'];
  }

  return [
    'docs/product/decision-brief.md',
    'docs/product/prd.md',
    '.planning/current/frame/status.json',
  ];
}

export function canonicalNextStages(stage: CanonicalCommandId): CanonicalCommandId[] {
  return stage === 'discover' ? ['frame'] : ['plan'];
}
