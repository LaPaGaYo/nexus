import { stageAdapterOutputPath } from '../artifacts';
import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildVerificationSummary } from '../absorption/superpowers/build';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

function expectedProvider(generator: string | null): string | null {
  if (generator?.startsWith('codex')) {
    return 'codex';
  }

  if (generator?.startsWith('gemini')) {
    return 'gemini';
  }

  return null;
}

export interface NexusBuildStagePack {
  id: 'nexus-build-pack';
  stage: 'build';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildVerificationSummary(ctx: NexusAdapterContext): string;
  buildGeneratorExecution(ctx: NexusAdapterContext): {
    raw_output: { receipt: string };
    actual_route: {
      provider: string | null;
      route: string;
      substrate: string;
      transport: 'ccb';
      receipt_path: string;
    };
  };
  disciplineTraceability(): AdapterTraceability;
  executionTraceability(): AdapterTraceability;
}

export function createBuildStagePack(): NexusBuildStagePack {
  const source_binding = getStagePackSourceBinding('nexus-build-pack');

  return {
    id: 'nexus-build-pack',
    stage: 'build',
    source_binding,
    buildVerificationSummary: (ctx) => buildVerificationSummary(ctx),
    buildGeneratorExecution: (ctx) => {
      const provider = expectedProvider(ctx.requested_route?.generator ?? null);

      return {
        raw_output: {
          receipt: 'ccb-default',
        },
        actual_route: {
          provider,
          route: ctx.requested_route?.generator ?? 'codex-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb' as const,
          receipt_path: stageAdapterOutputPath('build'),
        },
      };
    },
    disciplineTraceability: () => ({
      nexus_stage_pack: 'nexus-build-pack',
      absorbed_capability: 'superpowers-build-discipline',
      source_map: getStagePackSourceMap('nexus-build-pack'),
    }),
    executionTraceability: () => ({
      nexus_stage_pack: 'nexus-build-pack',
      absorbed_capability: 'ccb-execution',
      source_map: getStagePackSourceMap('nexus-build-pack'),
    }),
  };
}
