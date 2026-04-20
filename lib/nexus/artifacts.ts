import type { ArtifactPointer, CanonicalCommandId } from './types';

export const CURRENT_ROOT = '.planning/current';
export const AUDIT_ROOT = '.planning/audits/current';
export const ARCHIVE_ROOT = '.planning/audits/archive';
export const RUN_ARCHIVE_ROOT = '.planning/archive/runs';
export const RETRO_ARCHIVE_ROOT = '.planning/archive/retros';
export const NEXUS_STATE_ROOT = '.planning/nexus';
export const DEPLOY_ROOT = '.planning/deploy';

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

export function planVerificationMatrixPath(): string {
  return `${CURRENT_ROOT}/plan/verification-matrix.json`;
}

export function qaDesignVerificationPath(): string {
  return `${CURRENT_ROOT}/qa/design-verification.md`;
}

export function qaPerfVerificationPath(): string {
  return `${CURRENT_ROOT}/qa/perf-verification.md`;
}

export function qaReportPath(): string {
  return `${CURRENT_ROOT}/qa/qa-report.md`;
}

export function reviewLearningCandidatesPath(): string {
  return `${CURRENT_ROOT}/review/learning-candidates.json`;
}

export function reviewAdvisoriesPath(): string {
  return `${CURRENT_ROOT}/review/advisories.json`;
}

export function reviewAdvisoryDispositionPath(): string {
  return `${CURRENT_ROOT}/review/advisory-disposition.json`;
}

export function qaLearningCandidatesPath(): string {
  return `${CURRENT_ROOT}/qa/learning-candidates.json`;
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

export function shipDeployReadinessPath(): string {
  return `${CURRENT_ROOT}/ship/deploy-readiness.json`;
}

export function shipCanaryStatusPath(): string {
  return `${CURRENT_ROOT}/ship/canary-status.json`;
}

export function shipDeployResultPath(): string {
  return `${CURRENT_ROOT}/ship/deploy-result.json`;
}

export function shipLearningCandidatesPath(): string {
  return `${CURRENT_ROOT}/ship/learning-candidates.json`;
}

export function deployContractJsonPath(): string {
  return `${DEPLOY_ROOT}/deploy-contract.json`;
}

export function deployContractMarkdownPath(): string {
  return `${DEPLOY_ROOT}/DEPLOY-CONTRACT.md`;
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

export function currentAttachedEvidencePaths(): string[] {
  return [
    qaPerfVerificationPath(),
    shipCanaryStatusPath(),
    shipDeployResultPath(),
    closeoutDocumentationSyncPath(),
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

export function archivedCurrentArtifactPath(runId: string, currentArtifactPath: string): string {
  const prefix = `${CURRENT_ROOT}/`;
  if (!currentArtifactPath.startsWith(prefix)) {
    throw new Error(`Expected current-stage artifact path, got: ${currentArtifactPath}`);
  }
  return `${runArchiveRootFor(runId)}/${currentArtifactPath.slice(prefix.length)}`;
}

export function retroArchiveRootPath(): string {
  return RETRO_ARCHIVE_ROOT;
}

export function retroArchiveJsonPath(retroId: string): string {
  return `${retroArchiveRootPath()}/${retroId}/retro.json`;
}

export function retroArchiveMarkdownPath(retroId: string): string {
  return `${retroArchiveRootPath()}/${retroId}/RETRO.md`;
}

export function closeoutNextRunBootstrapJsonPath(): string {
  return `${CURRENT_ROOT}/closeout/next-run-bootstrap.json`;
}

export function closeoutNextRunMarkdownPath(): string {
  return `${CURRENT_ROOT}/closeout/NEXT-RUN.md`;
}

export function closeoutLearningsMarkdownPath(): string {
  return `${CURRENT_ROOT}/closeout/LEARNINGS.md`;
}

export function closeoutLearningsJsonPath(): string {
  return `${CURRENT_ROOT}/closeout/learnings.json`;
}

export function closeoutFollowOnSummaryMarkdownPath(): string {
  return `${CURRENT_ROOT}/closeout/FOLLOW-ON-SUMMARY.md`;
}

export function closeoutFollowOnSummaryJsonPath(): string {
  return `${CURRENT_ROOT}/closeout/follow-on-summary.json`;
}

export function closeoutDocumentationSyncPath(): string {
  return `${CURRENT_ROOT}/closeout/documentation-sync.md`;
}

export function discoverNextRunBootstrapJsonPath(): string {
  return `${CURRENT_ROOT}/discover/next-run-bootstrap.json`;
}

export function discoverNextRunMarkdownPath(): string {
  return `${CURRENT_ROOT}/discover/NEXT-RUN.md`;
}

export function discoverBootstrapJsonPath(): string {
  return discoverNextRunBootstrapJsonPath();
}

export function discoverBootstrapMarkdownPath(): string {
  return discoverNextRunMarkdownPath();
}

export function discoverSessionContinuationAdvicePath(): string {
  return `${CURRENT_ROOT}/discover/session-continuation-advice.json`;
}

export function discoverSessionContinuationMarkdownPath(): string {
  return `${CURRENT_ROOT}/discover/SESSION-CONTINUATION.md`;
}

export function discoverRetroContinuityJsonPath(): string {
  return `${CURRENT_ROOT}/discover/retro-continuity.json`;
}

export function discoverRetroContinuityMarkdownPath(): string {
  return `${CURRENT_ROOT}/discover/RETRO-CONTINUITY.md`;
}

export function ccbProviderStatePath(): string {
  return `${NEXUS_STATE_ROOT}/providers.json`;
}

export function ccbDispatchStatePath(requestId: string): string {
  return `${NEXUS_STATE_ROOT}/dispatch/${requestId}.json`;
}
