import type { AdapterTraceability, NexusAdapterContext } from '../adapters/types';
import { buildExecutionSummary, buildGeneratorExecution, buildVerificationSummary } from './native-builders';
import { getStagePackSourceBinding, getStagePackSourceMap } from './source-map';

export interface NexusBuildStagePack {
  id: 'nexus-build-pack';
  stage: 'build';
  source_binding: ReturnType<typeof getStagePackSourceBinding>;
  buildVerificationSummary(ctx: NexusAdapterContext): string;
  buildExecutionSummary(
    ctx: NexusAdapterContext,
    options: { actions: string; verification: string; files_touched?: string },
  ): string;
  buildGeneratorExecution(ctx: NexusAdapterContext): {
    raw_output: { receipt: string; summary_markdown?: string };
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
    buildExecutionSummary: (ctx, options) => buildExecutionSummary(ctx, options),
    buildGeneratorExecution: (ctx) => buildGeneratorExecution(
      ctx,
      buildExecutionSummary(ctx, {
        actions: 'default CCB transport recorded the bounded build execution path',
        verification: 'default Nexus CCB execution trace recorded',
      }),
    ),
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
