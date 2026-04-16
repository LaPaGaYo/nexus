import { getStageContentForStage } from '../stage-content';
import type { NexusAdapterContext } from '../adapters/types';
import type { CanonicalCommandId } from '../types';

export interface AbsorbedStageSections {
  overview: string;
  checklist: string[];
  artifact_contract: string;
  routing: string;
}

export function getAbsorbedStageSections(stage: CanonicalCommandId): AbsorbedStageSections {
  const content = getStageContentForStage(stage);

  return {
    overview: content.sections.overview.trim(),
    checklist: content.sections.checklist
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^- /, '')),
    artifact_contract: content.sections.artifact_contract.trim(),
    routing: content.sections.routing.trim(),
  };
}

export function renderChecklist(title: string, items: string[]): string {
  return [
    `## ${title}`,
    '',
    ...items.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

export function renderExecutionContext(ctx: NexusAdapterContext): string {
  const predecessorSection = ctx.predecessor_artifacts.length > 0
    ? [
      '### Predecessor Artifacts',
      '',
      ...ctx.predecessor_artifacts.map((artifact) => `- ${artifact.path}`),
      '',
    ]
    : [];

  return [
    '## Nexus Execution Context',
    '',
    `- Run ID: ${ctx.run_id}`,
    `- Command: ${ctx.command}`,
    `- Stage: ${ctx.stage}`,
    `- Continuation mode: ${ctx.ledger.continuation_mode}`,
    `- Execution mode: ${ctx.ledger.execution.mode}`,
    `- Primary provider: ${ctx.ledger.execution.primary_provider}`,
    `- Provider topology: ${ctx.ledger.execution.provider_topology}`,
    '',
    ...predecessorSection,
  ].join('\n');
}
