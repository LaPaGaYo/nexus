import { stageAdapterOutputPath } from '../../artifacts';
import type { AdapterTraceability, NexusAdapterContext } from '../../adapters/types';
import { getStagePackSourceMap } from '../../stage-packs';
import { getAbsorbedStageSections, renderChecklist } from '../render';

function expectedProvider(generator: string | null): string | null {
  if (generator?.startsWith('codex')) {
    return 'codex';
  }

  if (generator?.startsWith('gemini')) {
    return 'gemini';
  }

  return null;
}

export function buildCcbExecutionTraceability(): AdapterTraceability {
  return {
    nexus_stage_pack: 'nexus-build-pack',
    absorbed_capability: 'ccb-execution',
    source_map: getStagePackSourceMap('nexus-build-pack'),
  };
}

export function buildExecutionSummary(
  _ctx: NexusAdapterContext,
  options: {
    actions: string;
    verification: string;
    files_touched?: string;
  },
): string {
  const sections = getAbsorbedStageSections('build');

  return [
    '# Build Execution Summary',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderChecklist('Execution Checklist', sections.checklist).trimEnd(),
    '## Actions',
    '',
    `- ${options.actions}`,
    `- Files touched: ${options.files_touched ?? 'none'}`,
    `- Verification: ${options.verification}`,
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildGeneratorExecution(ctx: NexusAdapterContext, summary_markdown?: string) {
  const provider = expectedProvider(ctx.requested_route?.generator ?? null);

  return {
    raw_output: {
      receipt: 'ccb-default',
      summary_markdown,
    },
    actual_route: {
      provider,
      route: ctx.requested_route?.generator ?? 'codex-via-ccb',
      substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
      transport: 'ccb' as const,
      receipt_path: stageAdapterOutputPath('build'),
    },
  };
}
