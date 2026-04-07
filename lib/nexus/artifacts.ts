import type { ArtifactPointer, CanonicalCommandId } from './types';

export const CURRENT_ROOT = '.planning/current';
export const AUDIT_ROOT = '.planning/audits/current';
export const ARCHIVE_ROOT = '.planning/audits/archive';

export function stageStatusPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/status.json`;
}

export function stageAdapterRequestPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/adapter-request.json`;
}

export function stageAdapterOutputPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/adapter-output.json`;
}

export function stageNormalizationPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/normalization.json`;
}

export function qaReportPath(): string {
  return `${CURRENT_ROOT}/qa/qa-report.md`;
}

export function shipReleaseGateRecordPath(): string {
  return `${CURRENT_ROOT}/ship/release-gate-record.md`;
}

export function shipChecklistPath(): string {
  return `${CURRENT_ROOT}/ship/checklist.json`;
}

export function stageConflictPath(stage: CanonicalCommandId, adapter: string): string {
  return `${CURRENT_ROOT}/conflicts/${stage}-${adapter}.json`;
}

export function stageConflictMarkdownPath(stage: CanonicalCommandId, adapter: string): string {
  return `${CURRENT_ROOT}/conflicts/${stage}-${adapter}.md`;
}

export function currentAuditPointer(
  name: 'codex' | 'gemini' | 'synthesis' | 'gate-decision' | 'meta',
): ArtifactPointer {
  const suffix = name === 'meta' ? 'meta.json' : `${name}.md`;

  return {
    kind: suffix.endsWith('.json') ? 'json' : 'markdown',
    path: `${AUDIT_ROOT}/${suffix}`,
  };
}

export function archiveRootFor(runId: string): string {
  return `${ARCHIVE_ROOT}/${runId}`;
}
