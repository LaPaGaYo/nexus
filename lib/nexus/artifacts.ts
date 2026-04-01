import type { ArtifactPointer, CanonicalCommandId } from './types';

export const CURRENT_ROOT = '.planning/current';
export const AUDIT_ROOT = '.planning/audits/current';
export const ARCHIVE_ROOT = '.planning/audits/archive';

export function stageStatusPath(stage: CanonicalCommandId): string {
  return `${CURRENT_ROOT}/${stage}/status.json`;
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
