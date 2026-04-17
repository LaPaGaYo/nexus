import type { ArtifactPointer, CanonicalCommandId } from './types';

export const CURRENT_ROOT = '.planning/current';
export const AUDIT_ROOT = '.planning/audits/current';
export const ARCHIVE_ROOT = '.planning/audits/archive';
export const RUN_ARCHIVE_ROOT = '.planning/archive/runs';
export const NEXUS_STATE_ROOT = '.planning/nexus';

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

export function frameDesignIntentPath(): string {
  return `${CURRENT_ROOT}/frame/design-intent.json`;
}

export function planDesignContractPath(): string {
  return `${CURRENT_ROOT}/plan/design-contract.md`;
}

export function qaDesignVerificationPath(): string {
  return `${CURRENT_ROOT}/qa/design-verification.md`;
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

export function shipPullRequestPath(): string {
  return `${CURRENT_ROOT}/ship/pull-request.json`;
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

export function currentAuditArtifactPaths(): string[] {
  return [
    currentAuditPointer('codex').path,
    currentAuditPointer('gemini').path,
    currentAuditPointer('synthesis').path,
    currentAuditPointer('gate-decision').path,
    currentAuditPointer('meta').path,
  ];
}

export function archiveRootFor(runId: string): string {
  return `${ARCHIVE_ROOT}/${runId}`;
}

export function runArchiveRootFor(runId: string): string {
  return `${RUN_ARCHIVE_ROOT}/${runId}`;
}

export function archivedRunLedgerPath(runId: string): string {
  return `${runArchiveRootFor(runId)}/current-run.json`;
}

export function archivedCloseoutRootFor(runId: string): string {
  return `${runArchiveRootFor(runId)}/closeout`;
}

export function closeoutNextRunBootstrapJsonPath(): string {
  return `${CURRENT_ROOT}/closeout/next-run-bootstrap.json`;
}

export function closeoutNextRunMarkdownPath(): string {
  return `${CURRENT_ROOT}/closeout/NEXT-RUN.md`;
}

export function discoverBootstrapJsonPath(): string {
  return `${CURRENT_ROOT}/discover/next-run-bootstrap.json`;
}

export function discoverBootstrapMarkdownPath(): string {
  return `${CURRENT_ROOT}/discover/NEXT-RUN.md`;
}

export function ccbProviderStatePath(): string {
  return `${NEXUS_STATE_ROOT}/providers.json`;
}

export function ccbDispatchStatePath(requestId: string): string {
  return `${NEXUS_STATE_ROOT}/dispatch/${requestId}.json`;
}
