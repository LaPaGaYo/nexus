import type { TemplateContext } from './types';

const STAGE_FIELDS: Record<string, string[]> = {
  frame: [
    'summary',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'suppressed_surfaces',
    'default_action_id',
  ],
  plan: [
    'summary',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'suppressed_surfaces',
    'default_action_id',
  ],
  handoff: [
    'summary',
    'stage_outcome',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'default_action_id',
  ],
  build: [
    'summary',
    'stage_outcome',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'recommended_external_skills',
    'stop_action',
    'project_setup_gaps',
    'default_action_id',
  ],
  review: [
    'summary',
    'stage_outcome',
    'interaction_mode',
    'requires_user_choice',
    'choice_reason',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'suppressed_surfaces',
    'default_action_id',
  ],
  qa: [
    'summary',
    'stage_outcome',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'suppressed_surfaces',
    'default_action_id',
  ],
  ship: [
    'summary',
    'stage_outcome',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'suppressed_surfaces',
    'default_action_id',
  ],
  closeout: [
    'summary',
    'stage_outcome',
    'interaction_mode',
    'requires_user_choice',
    'primary_next_actions',
    'alternative_next_actions',
    'recommended_side_skills',
    'stop_action',
    'project_setup_gaps',
    'suppressed_surfaces',
    'default_action_id',
  ],
};

const STAGE_NOTES: Record<string, string> = {
  frame: `If the advisor surfaces \`/plan-design-review\` or \`/design-consultation\`, that means the run is
design-bearing or still lacks a stable design contract. Keep the canonical path anchored on
\`/plan\`.`,
  plan: `If the advisor surfaces \`/plan-design-review\`, that is design-driven follow-on work inferred from
\`design_impact\` and the verification matrix. Keep the canonical execution path anchored on
\`/handoff\`.`,
  handoff: `\`/handoff\` normally has a single canonical continuation into \`/build\`. Do not manufacture extra
choices when the advisor has no real branching.`,
  build: `For design-bearing runs, the advisor may surface \`/design-review\` and \`/browse\` based on
\`design_impact\` and the verification matrix. Keep \`/review\` first when the build is ready.

If the build is blocked, do not invent your own routing. Follow the advisor:

- stale handoff / route issues -> \`/handoff\`
- implementation ambiguity or deeper failure analysis -> \`/investigate\``,
  review: `Do not reconstruct advisory logic from \`status.json\`. Review advisory disposition is runtime-owned
through the advisor actions themselves. If \`/review\` passed with advisories, the advisor will emit
the exact governed choices, including:

- \`/build --review-advisory-disposition fix_before_qa\`
- \`/qa --review-advisory-disposition continue_to_qa\`
- \`/qa --review-advisory-disposition defer_to_follow_on\`

If the advisor recommends \`/simplify\`, \`/design-review\`, \`/benchmark\`, or \`/cso\`, those came from structured
verification-matrix support skill signals and should be offered as side skills after the canonical
governed action.`,
  qa: `For design-bearing runs, browser-facing runs, or when the verification matrix surfaces additional
support skill signals, the advisor may surface \`/design-review\`, \`/browse\`, \`/benchmark\`,
\`/connect-chrome\`, \`/setup-browser-cookies\`, and \`/cso\`. Keep \`/ship\` first when QA is ready.

If QA is not ready, do not improvise. Follow the advisor back into the bounded fix cycle through
\`/build\`.`,
  ship: `The advisor is where ship-level deploy awareness now lives. Use it to surface:

- \`/land\` as the recommended post-ship PR landing path
- \`/land-and-deploy\` as the compatibility shortcut for combined landing/deploy
- \`/setup-deploy\` when deploy configuration is still incomplete
- \`/deploy\` only after landing, when a deploy surface is configured
- \`/closeout\` when landing was handled manually or intentionally deferred
- \`/document-release\` as follow-on release hygiene`,
  closeout: `The closeout advisor should be the single place where you surface:

- fresh \`/discover\` for the next governed run
- \`/land\` when landing is still pending
- \`/land-and-deploy\` as the compatibility shortcut when landing is still pending
- \`/deploy\` after a landed merge-only result when deploy is still needed
- \`/canary\` after a verified deploy with a production URL but no post-deploy health evidence
- \`/retro\`, \`/learn\`, and \`/document-release\` as follow-on work`,
};

function fieldsForStage(stage: string): string {
  const fields = STAGE_FIELDS[stage];
  if (!fields) {
    throw new Error(`Unknown Nexus completion advisor stage: ${stage}`);
  }
  return fields.map((field) => `- \`${field}\``).join('\n');
}

function claudeInteraction(stage: string): string {
  return `If \`interaction_mode\` is \`summary_only\`, do not call AskUserQuestion. Print the advisor
\`summary\`, any \`project_setup_gaps\`, and the invocation for the \`default_action_id\` if one exists.

If the session is interactive and \`interaction_mode\` is not \`summary_only\`, always use
AskUserQuestion for \`/${stage}\` completion.

If the host cannot display AskUserQuestion, rerun \`/${stage}\` with \`--output interactive\`
to print the same runtime-owned chooser in the terminal. Do not reconstruct choices
from \`status.json\`.

If \`interaction_mode\` is \`recommended_choice\`, present:

1. recommended primary action
2. other primary actions
3. alternatives
4. recommended side skills
5. \`stop_action\`

If \`interaction_mode\` is \`required_choice\`, present only the actions emitted by the advisor.

Use each action's \`label\` and \`description\`. If an action has \`visibility_reason\`,
\`why_this_skill\`, or \`evidence_signal\`, include it in the explanation so the user sees
why it is showing up now.

After the user chooses an action, run the selected \`invocation\` unless the selected action
is \`stop_action\` or has no invocation.`;
}

function textHostInteraction(stage: string, hostLabel: string): string {
  return `If \`interaction_mode\` is \`summary_only\`, print the advisor \`summary\`, any
\`project_setup_gaps\`, and the invocation for the \`default_action_id\` if one exists. Do not
ask for a choice.

If the session is interactive and \`interaction_mode\` is not \`summary_only\`, render a plain
numbered chooser directly in the ${hostLabel} conversation and wait for the user's reply. Do
not mention AskUserQuestion and do not tell the user to rerun the command just to get a chooser.

Use this exact text interaction shape:

\`\`\`text
Nexus next step: /${stage}

<advisor summary>

1. <action label> (Recommended, if action.recommended=true)
   <action description>
   Command: <action invocation, if present>
   Why: <visibility_reason or why_this_skill, if present>
   Evidence: <evidence_signal.summary, if present>

2. <next action label>
   <same fields>

Reply with the number to choose, or reply "stop" to stop here.
\`\`\`

If \`interaction_mode\` is \`required_choice\`, include only the actions emitted by the advisor.
If \`interaction_mode\` is \`recommended_choice\`, order choices as:

1. recommended primary action
2. other primary actions
3. alternatives
4. recommended side skills
5. recommended installed skills
6. \`stop_action\`

After the user replies with a number, run the selected \`invocation\` unless the selected action
is \`stop_action\` or has no invocation. If the user replies \`stop\`, stop without changing state.
If the reply is ambiguous, ask one short clarification question.`;
}

function interactionForHost(ctx: TemplateContext, stage: string): string {
  if (ctx.host === 'claude') {
    return claudeInteraction(stage);
  }
  return textHostInteraction(stage, ctx.host === 'codex' ? 'Codex CLI' : 'text host');
}

export function generateNexusCompletionAdvisor(ctx: TemplateContext, args?: string[]): string {
  const stage = args?.[0] || ctx.skillName;
  const note = STAGE_NOTES[stage] ?? '';

  return `## Completion Advisor

After \`/${stage}\` returns, prefer the runtime JSON field \`completion_advisor\`. If the host only has
filesystem access, or the field is absent, fall back to \`.planning/current/${stage}/completion-advisor.json\`.
If the runtime exited nonzero, inspect \`completion_context.completion_advisor\` from the error JSON
envelope before falling back to disk. Treat that advisor as the canonical next-step contract.

Read and summarize:

${fieldsForStage(stage)}

${interactionForHost(ctx, stage)}

${note}

If the session is non-interactive, print the advisor \`summary\` and the invocation for the
\`default_action_id\` when one exists.`;
}
