import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { bootstrapResumeArtifacts } from '../runtime/run-bootstrap';
import {
  CONTINUATION_ADVICE_OPTIONS,
  type ContinuationAdviceOption,
  type ContinuationMode,
  type SessionContinuationAdviceRecord,
} from '../contracts/types';

function recommendedOption(
  mode: ContinuationMode,
  hostCompactSupported: boolean,
): ContinuationAdviceOption {
  if (mode === 'phase') {
    return hostCompactSupported ? 'compact_then_continue' : 'fresh_session_continue';
  }

  return 'continue_here';
}

function summaryFor(mode: ContinuationMode, hostCompactSupported: boolean): string {
  if (mode === 'phase') {
    return hostCompactSupported
      ? 'Nexus can continue in this session. Because this is a new phase boundary, compacting first or resuming in a fresh session is recommended.'
      : 'Nexus can continue in this session. Because this is a new phase boundary and host-managed compact is unavailable, a fresh session is recommended; manual compact remains an option.';
  }

  return 'Nexus can continue in this session.';
}

export function buildSessionContinuationAdvice(input: {
  runId: string;
  boundaryKind: SessionContinuationAdviceRecord['boundary_kind'];
  continuationMode: ContinuationMode;
  hostCompactSupported: boolean;
  contextTransferArtifactPath: string | null;
  supportingContextArtifacts?: string[];
  recommendedNextCommand: SessionContinuationAdviceRecord['recommended_next_command'];
  generatedAt: string;
}): SessionContinuationAdviceRecord {
  const resumeArtifacts = [...bootstrapResumeArtifacts()];

  if (input.contextTransferArtifactPath) {
    resumeArtifacts.push(input.contextTransferArtifactPath);
  }

  return {
    schema_version: 1,
    run_id: input.runId,
    boundary_kind: input.boundaryKind,
    continuation_mode: input.continuationMode,
    lifecycle_can_continue_here: true,
    recommended_option: recommendedOption(input.continuationMode, input.hostCompactSupported),
    available_options: [...CONTINUATION_ADVICE_OPTIONS],
    host_compact_supported: input.hostCompactSupported,
    resume_artifacts: resumeArtifacts,
    supporting_context_artifacts: input.supportingContextArtifacts ?? [],
    recommended_next_command: input.recommendedNextCommand,
    summary: summaryFor(input.continuationMode, input.hostCompactSupported),
    generated_at: input.generatedAt,
  };
}

function latestHistoryMarkdownPath(cwd: string, relativeDir: string): string | null {
  const absoluteDir = join(cwd, relativeDir);
  if (!existsSync(absoluteDir)) {
    return null;
  }

  const candidates = readdirSync(absoluteDir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => ({
      relativePath: `${relativeDir}/${entry}`,
      mtimeMs: statSync(join(absoluteDir, entry)).mtimeMs,
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0]?.relativePath ?? null;
}

export function findLatestContextTransferArtifact(cwd: string): string | null {
  return latestHistoryMarkdownPath(cwd, '.ccb/history')
    ?? latestHistoryMarkdownPath(cwd, '.ccb_config/history');
}

export function renderSessionContinuationMarkdown(record: SessionContinuationAdviceRecord): string {
  const resumeArtifacts = record.resume_artifacts.map((artifact) => `- ${artifact}`);
  const supportingArtifacts = record.supporting_context_artifacts.map((artifact) => `- ${artifact}`);

  return [
    '# Session Continuation Advisory',
    '',
    `- Lifecycle can continue here: ${record.lifecycle_can_continue_here ? 'yes' : 'no'}`,
    `- Recommended option: ${record.recommended_option}`,
    `- Recommended next command: ${record.recommended_next_command}`,
    `- Host compact supported: ${record.host_compact_supported ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    record.summary,
    '',
    '## Resume Artifacts',
    '',
    ...resumeArtifacts,
    '',
    ...(supportingArtifacts.length > 0
      ? [
          '## Supporting Context',
          '',
          ...supportingArtifacts,
          '',
        ]
      : []),
    '## Available Options',
    '',
    ...record.available_options.map((option) => `- ${option}`),
    '',
  ].join('\n');
}
