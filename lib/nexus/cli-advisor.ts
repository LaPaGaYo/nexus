import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { stageCompletionAdvisorPath, stageStatusPath } from './artifacts';
import { readLedger } from './ledger';
import { readStageStatus } from './status';
import type {
  CanonicalCommandId,
  CompletionAdvisorActionRecord,
  CompletionAdvisorRecord,
  StageStatus,
} from './types';

export interface CliCompletionContext {
  stage: CanonicalCommandId | null;
  advisor: CompletionAdvisorRecord | null;
  status: StageStatus | null;
}

export interface CliErrorEnvelope {
  ok: false;
  command: CanonicalCommandId | null;
  error: string;
  completion_context: {
    stage: CanonicalCommandId | null;
    completion_advisor: CompletionAdvisorRecord | null;
    status: StageStatus | null;
  } | null;
}

function readCompletionAdvisor(cwd: string, stage: CanonicalCommandId): CompletionAdvisorRecord | null {
  const path = join(cwd, stageCompletionAdvisorPath(stage));
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(readFileSync(path, 'utf8')) as CompletionAdvisorRecord;
}

function preferredStage(cwd: string, fallbackStage: CanonicalCommandId): CanonicalCommandId {
  const ledger = readLedger(cwd);
  return ledger?.current_stage ?? fallbackStage;
}

function formatAction(action: CompletionAdvisorActionRecord): string[] {
  const lines = [`- ${action.label}${action.recommended ? ' (recommended)' : ''}`];
  if (action.invocation) {
    lines.push(`  Command: ${action.invocation}`);
  }
  lines.push(`  ${action.description}`);
  if (action.visibility_reason) {
    lines.push(`  Reason: ${action.visibility_reason}`);
  }
  return lines;
}

function appendActionSection(
  lines: string[],
  title: string,
  actions: CompletionAdvisorActionRecord[],
): void {
  if (actions.length === 0) {
    return;
  }

  lines.push(title);
  for (const action of actions) {
    lines.push(...formatAction(action));
  }
}

function choiceActions(advisor: CompletionAdvisorRecord): CompletionAdvisorActionRecord[] {
  return [
    ...advisor.primary_next_actions,
    ...advisor.alternative_next_actions,
    ...advisor.recommended_side_skills,
    ...(advisor.recommended_external_skills ?? []),
    ...(advisor.stop_action ? [advisor.stop_action] : []),
  ];
}

export function resolveCliCompletionContext(
  cwd: string,
  fallbackStage: CanonicalCommandId,
  options: {
    completionAdvisor?: CompletionAdvisorRecord | null;
    status?: StageStatus | null;
  } = {},
): CliCompletionContext {
  const stage = options.status?.stage ?? options.completionAdvisor?.stage ?? preferredStage(cwd, fallbackStage);
  const advisor = options.completionAdvisor ?? readCompletionAdvisor(cwd, stage);
  const status = options.status ?? readStageStatus(stageStatusPath(stage), cwd);

  return {
    stage,
    advisor,
    status,
  };
}

export function formatCompletionAdvisorForCli(advisor: CompletionAdvisorRecord): string {
  const lines = [
    `Completion advisor: /${advisor.stage}`,
    `Outcome: ${advisor.stage_outcome}`,
    `Interaction mode: ${advisor.interaction_mode}`,
    `Summary: ${advisor.summary}`,
  ];

  if (advisor.requires_user_choice) {
    lines.push('User choice required: yes');
  }
  if (advisor.choice_reason) {
    lines.push(`Choice reason: ${advisor.choice_reason}`);
  }

  appendActionSection(lines, 'Primary next actions:', advisor.primary_next_actions);
  appendActionSection(lines, 'Alternative next actions:', advisor.alternative_next_actions);
  if (advisor.stop_action) {
    appendActionSection(lines, 'Stop action:', [advisor.stop_action]);
  }
  appendActionSection(lines, 'Recommended side skills:', advisor.recommended_side_skills);
  appendActionSection(lines, 'Recommended installed skills:', advisor.recommended_external_skills ?? []);

  if (advisor.project_setup_gaps.length > 0) {
    lines.push('Project/setup gaps:');
    for (const gap of advisor.project_setup_gaps) {
      lines.push(`- ${gap}`);
    }
  }

  return lines.join('\n');
}

export function formatCompletionAdvisorForInteractiveCli(advisor: CompletionAdvisorRecord): string {
  const actions = choiceActions(advisor);
  const defaultIndex = actions.findIndex((action) => action.id === advisor.default_action_id);
  const lines = [
    `Nexus interactive chooser: /${advisor.stage}`,
    `Outcome: ${advisor.stage_outcome}`,
    `Interaction mode: ${advisor.interaction_mode}`,
    `Summary: ${advisor.summary}`,
  ];

  if (advisor.requires_user_choice) {
    lines.push('User choice required: yes');
  }
  if (advisor.choice_reason) {
    lines.push(`Choice reason: ${advisor.choice_reason}`);
  }
  if (defaultIndex >= 0) {
    lines.push(`Default: ${defaultIndex + 1}`);
  }

  if (actions.length === 0) {
    lines.push('No interactive choice is available from the current advisor.');
  } else {
    lines.push('Choices:');
    actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action.label}${action.recommended ? ' (recommended)' : ''}`);
      if (action.invocation) {
        lines.push(`   Command: ${action.invocation}`);
      }
      lines.push(`   ${action.description}`);
      if (action.visibility_reason) {
        lines.push(`   Reason: ${action.visibility_reason}`);
      }
    });
  }

  if (advisor.project_setup_gaps.length > 0) {
    lines.push('Project/setup gaps:');
    for (const gap of advisor.project_setup_gaps) {
      lines.push(`- ${gap}`);
    }
  }

  lines.push('Run the selected command manually; Nexus will not auto-execute a choice from this renderer.');
  return lines.join('\n');
}

function formatStageStatusForCli(status: StageStatus): string {
  const lines = [
    `Stage status: /${status.stage}`,
    `State: ${status.state}`,
    `Decision: ${status.decision}`,
    `Ready: ${status.ready ? 'true' : 'false'}`,
  ];

  if (status.errors.length > 0) {
    lines.push('Errors:');
    for (const error of status.errors) {
      lines.push(`- ${error}`);
    }
  }

  return lines.join('\n');
}

export function formatCliCompletionContextForCli(context: CliCompletionContext): string | null {
  if (context.advisor) {
    return formatCompletionAdvisorForCli(context.advisor);
  }
  if (context.status) {
    return formatStageStatusForCli(context.status);
  }
  return null;
}

export function buildCliErrorEnvelope(
  message: string,
  context: CliCompletionContext | null,
  command: CanonicalCommandId | null,
): CliErrorEnvelope {
  return {
    ok: false,
    command,
    error: message,
    completion_context: context
      ? {
          stage: context.stage,
          completion_advisor: context.advisor,
          status: context.status,
        }
      : null,
  };
}
