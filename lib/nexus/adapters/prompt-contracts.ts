import type { NexusAdapterContext } from './types';

export function buildPromptContextPreamble(
  ctx: NexusAdapterContext,
  stageLabel: string,
): string {
  return [
    `${stageLabel}: ${ctx.stage}`,
    `Run ID: ${ctx.run_id}`,
    `Command: ${ctx.command}`,
    `Repository cwd: ${ctx.cwd}`,
    '',
    'Use only repo-visible artifacts as the source of truth.',
    'Do not rely on hidden session memory or unstated prior context.',
    '',
    'Predecessor artifacts:',
    ...ctx.predecessor_artifacts.map((artifact) => `- ${artifact.path}`),
    '',
    'Requested route:',
    JSON.stringify(ctx.requested_route, null, 2),
    '',
  ].join('\n');
}

export function buildBuildExecutionPrompt(ctx: NexusAdapterContext, stageLabel: string): string {
  return [
    buildPromptContextPreamble(ctx, stageLabel),
    'Execute the bounded Nexus /build contract for this repository.',
    'Apply repository changes only if the repo-visible governed artifacts require them.',
    'After execution, reply with markdown only in this form:',
    '# Build Execution Summary',
    '',
    '- Status: completed | blocked',
    '- Actions: ...',
    '- Files touched: ...',
    '- Verification: ...',
    '',
    'If the contract is missing or inconsistent, say so explicitly in the summary.',
  ].join('\n');
}

export function buildReviewAuditPrompt(
  ctx: NexusAdapterContext,
  stageLabel: string,
  introLine: string,
  header: string,
): string {
  return [
    buildPromptContextPreamble(ctx, stageLabel),
    introLine,
    'Review the current repo state and relevant changed files independently.',
    'Reply with markdown only in this exact shape:',
    header,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
  ].join('\n');
}

export function buildQaPromptSchemaExample(): string {
  return JSON.stringify(
    {
      ready: true,
      findings: ['example finding'],
      report_markdown: '# QA Report\n\nResult: pass\n',
    },
    null,
    2,
  );
}

export function buildQaValidationPrompt(
  ctx: NexusAdapterContext,
  stageLabel: string,
  introLine: string,
  extraLines: string[] = [],
): string {
  return [
    buildPromptContextPreamble(ctx, stageLabel),
    introLine,
    'Return JSON only, with no code fences and no extra prose.',
    ...extraLines,
    buildQaPromptSchemaExample(),
  ].join('\n');
}
