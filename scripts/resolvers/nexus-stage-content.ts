import { getStageContentForStage } from '../../lib/nexus/stage-content';
import { CANONICAL_COMMANDS, type CanonicalCommandId } from '../../lib/nexus/types';
import type { TemplateContext } from './types';

function resolveCanonicalStage(ctx: TemplateContext): CanonicalCommandId {
  if (!CANONICAL_COMMANDS.includes(ctx.skillName as CanonicalCommandId)) {
    throw new Error(
      `Nexus stage-content placeholders require a canonical lifecycle skill, got "${ctx.skillName}" in ${ctx.tmplPath}.`,
    );
  }

  return ctx.skillName as CanonicalCommandId;
}

function getStageSection(
  ctx: TemplateContext,
  section: 'overview' | 'checklist' | 'artifact_contract' | 'routing',
): string {
  const pack = getStageContentForStage(resolveCanonicalStage(ctx));
  return pack.sections[section];
}

export function generateNexusStageOverview(ctx: TemplateContext): string {
  return getStageSection(ctx, 'overview');
}

export function generateNexusStageChecklist(ctx: TemplateContext): string {
  return getStageSection(ctx, 'checklist');
}

export function generateNexusStageArtifactContract(ctx: TemplateContext): string {
  return getStageSection(ctx, 'artifact_contract');
}

export function generateNexusStageRouting(ctx: TemplateContext): string {
  return getStageSection(ctx, 'routing');
}
