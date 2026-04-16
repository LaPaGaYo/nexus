import type { NexusAdapterContext } from './types';

export function buildPromptContextPreamble(
  ctx: NexusAdapterContext,
  stageLabel: string,
): string {
  const executionWorkspace = ctx.workspace?.path ?? ctx.cwd;
  const preamble = [
    `${stageLabel}: ${ctx.stage}`,
    `Run ID: ${ctx.run_id}`,
    `Command: ${ctx.command}`,
    `Repository cwd: ${ctx.cwd}`,
    `Execution workspace cwd: ${executionWorkspace}`,
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

  if (!ctx.review_scope) {
    return preamble;
  }

  return [
    preamble,
    'Review scope:',
    JSON.stringify(ctx.review_scope, null, 2),
    '',
  ].join('\n');
}

export function buildBuildExecutionPrompt(ctx: NexusAdapterContext, stageLabel: string): string {
  const scopeLines = ctx.review_scope?.mode === 'bounded_fix_cycle'
    ? [
        'This is a bounded fix-cycle build.',
        'Implement only the blocking items listed in Review scope.',
        'Do not reopen unrelated phase-scope concerns during this build.',
      ]
    : [
        'This is a full-acceptance build for the current execution packet.',
        'Read the current execution contract from the predecessor artifacts before deciding whether code changes are required.',
        'If the repository only satisfies an earlier phase, implement the missing work required by the current execution packet instead of re-validating the earlier phase.',
      ];

  return [
    buildPromptContextPreamble(ctx, stageLabel),
    'Execute the bounded Nexus /build contract for this repository.',
    'Apply repository changes only if the repo-visible governed artifacts require them.',
    ...scopeLines,
    'Do not treat existing `.planning/current/build/*` files or `.planning/nexus/current-run.json` as proof that `/build` is already complete.',
    'Those are outputs of this stage and may be stale from an earlier run; use predecessor artifacts and current repository implementation state instead.',
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
  const boundedScope = ctx.review_scope?.mode === 'bounded_fix_cycle';

  return [
    buildPromptContextPreamble(ctx, stageLabel),
    introLine,
    boundedScope
      ? 'This is a bounded fix-cycle review.'
      : 'Review the current repo state and relevant changed files against the current execution contract in the predecessor artifacts.',
    ...(boundedScope
      ? [
          'Operate as a fast bounded auditor, not an open-ended investigator.',
          'Decide pass/fail only against the blocking items listed in Review scope.',
          'Additional out-of-scope concerns may be noted as advisories only, and must not by themselves cause Result: fail.',
          'Inspect only the files and symbols directly relevant to the blocking items and predecessor artifacts unless one targeted follow-up read is required to reach a verdict.',
          'Do not activate extra review workflows or broad repo-search procedures for this bounded review.',
          'As soon as the blocking items are confirmed pass/fail from repo-visible evidence, finalize immediately.',
        ]
      : []),
    'Reply with markdown only in this exact shape:',
    header,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
    ...(boundedScope
      ? [
          '',
          'Advisories:',
          '- ...',
          '',
          'If there are no advisories, say "- none".',
        ]
      : []),
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
