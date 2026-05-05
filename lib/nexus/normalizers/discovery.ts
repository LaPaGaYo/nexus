import {
  stageAdapterOutputPath,
  stageAdapterRequestPath,
  frameDesignIntentPath,
  stageNormalizationPath,
} from '../artifacts';
import type { AdapterResult } from '../adapters/types';
import { DESIGN_IMPACTS, type CanonicalCommandId, type DesignIntentRecord } from '../types';
import type { DiscoveryDiscoverRaw, DiscoveryFrameRaw } from '../adapters/discovery';

interface ArtifactWrite {
  path: string;
  content: string;
}

const DESIGN_SYSTEM_SOURCES = ['none', 'design_md', 'support_skill', 'mixed'] as const;

function isValidDesignIntent(value: unknown): value is DesignIntentRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const intent = value as Record<string, unknown>;
  return DESIGN_IMPACTS.includes(intent.impact as DesignIntentRecord['impact'])
    && Array.isArray(intent.affected_surfaces)
    && intent.affected_surfaces.every((surface) => typeof surface === 'string')
    && DESIGN_SYSTEM_SOURCES.includes(intent.design_system_source as DesignIntentRecord['design_system_source'])
    && typeof intent.contract_required === 'boolean'
    && typeof intent.verification_required === 'boolean';
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

export function normalizeDiscoveryDiscover(
  result: AdapterResult<DiscoveryDiscoverRaw>,
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

export function normalizeDiscoveryFrame(
  result: AdapterResult<DiscoveryFrameRaw>,
): { canonicalWrites: ArtifactWrite[] } {
  if (
    !result.raw_output.decision_brief_markdown.trim()
    || !result.raw_output.prd_markdown.trim()
    || !isValidDesignIntent(result.raw_output.design_intent)
  ) {
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
      {
        path: frameDesignIntentPath(),
        content: JSON.stringify(result.raw_output.design_intent, null, 2) + '\n',
      },
    ],
  };
}

export function buildDiscoveryTraceabilityPayloads(
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
    frameDesignIntentPath(),
    '.planning/current/frame/status.json',
  ];
}

export function canonicalNextStages(stage: CanonicalCommandId): CanonicalCommandId[] {
  return stage === 'discover' ? ['frame'] : ['plan'];
}
