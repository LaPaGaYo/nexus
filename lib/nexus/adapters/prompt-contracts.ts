import type { NexusAdapterContext } from './types';

const DESIGN_CONTRACT_PATH = '.planning/current/plan/design-contract.md';

function approvedDesignContractPath(ctx: NexusAdapterContext): string | null {
  return ctx.predecessor_artifacts.find((artifact) => artifact.path === DESIGN_CONTRACT_PATH)?.path ?? null;
}

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
  const designContractPath = approvedDesignContractPath(ctx);
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
    ...(designContractPath
      ? [
          'This is a design-bearing run.',
          `Approved design contract: ${designContractPath}`,
          'Treat the approved design contract as part of the bounded implementation contract, not optional reference material.',
        ]
      : []),
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
  const designContractPath = approvedDesignContractPath(ctx);
  const advisorySectionRequired = boundedScope || Boolean(designContractPath);

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
    ...(designContractPath
      ? [
          `This is a design-bearing review. The approved design contract is ${designContractPath}.`,
          'Use the approved design contract as explicit review evidence, not optional reference material.',
          'Do not turn this review into open-ended design critique.',
          'Only explicit violations of the approved design contract may justify fail on visual grounds.',
          'Additional visual concerns are advisories unless they show a clear contract violation.',
        ]
      : []),
    'If the transport supports it, you may include optional learning_candidates in the raw response contract for durable reusable learnings.',
    'Do not change the required markdown verdict shape to do this.',
    'Reply with markdown only in this exact shape:',
    header,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
    ...(advisorySectionRequired
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

export function buildReviewFinalizePrompt(
  ctx: NexusAdapterContext,
  stageLabel: string,
  provider: 'codex' | 'gemini',
  header: string,
): string {
  const boundedScope = ctx.review_scope?.mode === 'bounded_fix_cycle';
  const designContractPath = approvedDesignContractPath(ctx);
  const advisorySectionRequired = boundedScope || Boolean(designContractPath);

  return [
    buildPromptContextPreamble(ctx, stageLabel),
    `A governed Nexus /review audit for the ${provider} path is already running in this session and exceeded the bounded review soft deadline.`,
    'Do not restart the investigation or broaden scope.',
    'Use the repo-visible evidence already gathered in this session and finalize immediately.',
    ...(boundedScope
      ? [
          'Stay strictly within the blocking items listed in Review scope.',
          'Out-of-scope concerns may be listed as advisories only.',
        ]
      : [
          'Stay within the current execution contract in the predecessor artifacts.',
        ]),
    ...(designContractPath
      ? [
          `The approved design contract is ${designContractPath}.`,
          'Do not broaden into open-ended design critique during this finalize pass.',
          'Only explicit design contract violations may justify fail on visual grounds; other visual concerns are advisories.',
        ]
      : []),
    'If the transport supports it, you may include optional learning_candidates in the raw response contract for durable reusable learnings.',
    'Do not change the required markdown verdict shape to do this.',
    'Reply with markdown only in this exact shape:',
    header,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
    ...(advisorySectionRequired
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
      advisories: ['example advisory'],
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
    'You may include an optional learning_candidates array for durable reusable learnings; omit it when there are none.',
    'Keep the required ready, findings, and report_markdown fields unchanged.',
    'Use findings only for blocking defects that make QA not ready.',
    'Use an optional advisories array for non-blocking concerns that should not flip ready=false.',
    'If only advisories remain, set ready=true and keep findings empty.',
    ...extraLines,
    buildQaPromptSchemaExample(),
  ].join('\n');
}
