import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import {
  closeoutDocumentationSyncPath,
  currentAttachedEvidencePaths,
  currentAuditArtifactPaths,
  qaPerfVerificationPath,
  shipCanaryStatusPath,
  shipDeployResultPath,
  stageStatusPath,
} from './artifacts';
import { diagnoseCloseoutHistory } from './governance';
import { readLedger, writeLedger } from './ledger';
import { readStageStatus } from './status';
import type { StageStatus } from './types';

export const LEDGER_DOCTOR_ISSUE_CODES = [
  'history_mismatch',
  'stale_current_audits',
  'stale_attached_evidence',
] as const;

export type LedgerDoctorIssueCode = (typeof LEDGER_DOCTOR_ISSUE_CODES)[number];

export interface LedgerDoctorIssue {
  code: LedgerDoctorIssueCode;
  message: string;
  evidence: string[];
}

export interface LedgerDoctorReport {
  status: 'clean' | 'action_required';
  issues: LedgerDoctorIssue[];
}

export interface LedgerDoctorSafeFixResult {
  report: LedgerDoctorReport;
  fixed_paths: string[];
  fixed_issue_codes: LedgerDoctorIssueCode[];
}

function currentAuditArtifactsPresent(rootDir: string): string[] {
  return currentAuditArtifactPaths().filter((path) => existsSync(join(rootDir, path)));
}

type AttachedEvidenceBinding = {
  path: string;
  ownerStage: 'qa' | 'ship' | 'closeout';
};

const ATTACHED_EVIDENCE_BINDINGS: AttachedEvidenceBinding[] = [
  { path: qaPerfVerificationPath(), ownerStage: 'qa' },
  { path: shipCanaryStatusPath(), ownerStage: 'ship' },
  { path: shipDeployResultPath(), ownerStage: 'ship' },
  { path: closeoutDocumentationSyncPath(), ownerStage: 'closeout' },
];

function currentAttachedEvidencePresent(rootDir: string): string[] {
  return currentAttachedEvidencePaths().filter((path) => existsSync(join(rootDir, path)));
}

function isCanonicalRecordedReview(reviewStatus: StageStatus | null, runId: string | null): boolean {
  return Boolean(
    reviewStatus
      && reviewStatus.stage === 'review'
      && reviewStatus.run_id === runId
      && reviewStatus.state === 'completed'
      && reviewStatus.decision === 'audit_recorded'
      && reviewStatus.review_complete === true
      && reviewStatus.audit_set_complete === true
      && reviewStatus.provenance_consistent === true,
  );
}

function shouldDiagnoseCloseoutHistory(currentStage: string | null | undefined): boolean {
  return currentStage === 'review'
    || currentStage === 'qa'
    || currentStage === 'ship'
    || currentStage === 'closeout';
}

function attachedEvidenceIsCanonical(
  evidencePath: string,
  ledgerRunId: string | null,
  qaStatus: StageStatus | null,
  shipStatus: StageStatus | null,
  closeoutStatus: StageStatus | null,
): boolean {
  const binding = ATTACHED_EVIDENCE_BINDINGS.find((entry) => entry.path === evidencePath);
  if (!binding || !ledgerRunId) {
    return false;
  }

  const ownerStatus = binding.ownerStage === 'qa'
    ? qaStatus
    : binding.ownerStage === 'ship'
      ? shipStatus
      : closeoutStatus;

  return Boolean(ownerStatus && ownerStatus.run_id === ledgerRunId && ownerStatus.stage === binding.ownerStage);
}

function staleAttachedEvidencePaths(input: {
  rootDir: string;
  ledgerRunId: string | null;
  qaStatus: StageStatus | null;
  shipStatus: StageStatus | null;
  closeoutStatus: StageStatus | null;
}): string[] {
  return currentAttachedEvidencePresent(input.rootDir).filter((path) => !attachedEvidenceIsCanonical(
    path,
    input.ledgerRunId,
    input.qaStatus,
    input.shipStatus,
    input.closeoutStatus,
  ));
}

export function buildLedgerDoctorReport(rootDir: string): LedgerDoctorReport {
  const issues: LedgerDoctorIssue[] = [];
  const ledger = readLedger(rootDir);
  const reviewStatus = readStageStatus(stageStatusPath('review'), rootDir);
  const qaStatus = readStageStatus(stageStatusPath('qa'), rootDir);
  const shipStatus = readStageStatus(stageStatusPath('ship'), rootDir);
  const closeoutStatus = readStageStatus(stageStatusPath('closeout'), rootDir);

  if (ledger && shouldDiagnoseCloseoutHistory(ledger.current_stage)) {
    const historyError = diagnoseCloseoutHistory(ledger, {
      qaRecorded: qaStatus?.run_id === ledger.run_id,
      shipRecorded: shipStatus?.run_id === ledger.run_id,
    });

    if (historyError) {
      issues.push({
        code: 'history_mismatch',
        message: historyError,
        evidence: [`.planning/nexus/current-run.json`],
      });
    }
  }

  const currentAuditArtifacts = currentAuditArtifactsPresent(rootDir);
  if (
    currentAuditArtifacts.length > 0
    && !isCanonicalRecordedReview(reviewStatus, ledger?.run_id ?? null)
  ) {
    const reviewEvidence = reviewStatus ? [stageStatusPath('review')] : [];
    const explanation = reviewStatus
      ? 'Current audit artifacts exist but the review status is not a completed canonical audit record.'
      : 'Current audit artifacts exist but there is no review status for the active run.';
    issues.push({
      code: 'stale_current_audits',
      message: explanation,
      evidence: [...reviewEvidence, ...currentAuditArtifacts],
    });
  }

  const staleAttachedEvidence = staleAttachedEvidencePaths({
    rootDir,
    ledgerRunId: ledger?.run_id ?? null,
    qaStatus,
    shipStatus,
    closeoutStatus,
  });
  if (staleAttachedEvidence.length > 0) {
    issues.push({
      code: 'stale_attached_evidence',
      message: 'Attached follow-on evidence exists but the owning stage status is missing or does not belong to the active run.',
      evidence: staleAttachedEvidence,
    });
  }

  return {
    status: issues.length === 0 ? 'clean' : 'action_required',
    issues,
  };
}

function removeRepoFiles(rootDir: string, relativePaths: string[]): string[] {
  const removed: string[] = [];
  for (const relativePath of relativePaths) {
    const absolutePath = join(rootDir, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    rmSync(absolutePath, { force: true });
    removed.push(relativePath);
  }
  return removed;
}

function removeArtifactIndexEntries(rootDir: string, relativePaths: string[]): void {
  const ledger = readLedger(rootDir);
  if (!ledger) {
    return;
  }

  let changed = false;
  const nextArtifactIndex = { ...ledger.artifact_index };
  for (const relativePath of relativePaths) {
    if (relativePath in nextArtifactIndex) {
      delete nextArtifactIndex[relativePath];
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  writeLedger({
    ...ledger,
    artifact_index: nextArtifactIndex,
  }, rootDir);
}

export function applySafeLedgerDoctorFix(rootDir: string): LedgerDoctorSafeFixResult {
  const reportBefore = buildLedgerDoctorReport(rootDir);
  const fixedPaths: string[] = [];
  const fixedIssueCodes: LedgerDoctorIssueCode[] = [];

  if (reportBefore.issues.some((issue) => issue.code === 'stale_current_audits')) {
    const removed = removeRepoFiles(rootDir, currentAuditArtifactsPresent(rootDir));
    if (removed.length > 0) {
      removeArtifactIndexEntries(rootDir, removed);
      fixedPaths.push(...removed);
      fixedIssueCodes.push('stale_current_audits');
    }
  }

  if (reportBefore.issues.some((issue) => issue.code === 'stale_attached_evidence')) {
    const ledger = readLedger(rootDir);
    const qaStatus = readStageStatus(stageStatusPath('qa'), rootDir);
    const shipStatus = readStageStatus(stageStatusPath('ship'), rootDir);
    const closeoutStatus = readStageStatus(stageStatusPath('closeout'), rootDir);
    const removed = removeRepoFiles(rootDir, staleAttachedEvidencePaths({
      rootDir,
      ledgerRunId: ledger?.run_id ?? null,
      qaStatus,
      shipStatus,
      closeoutStatus,
    }));
    if (removed.length > 0) {
      removeArtifactIndexEntries(rootDir, removed);
      fixedPaths.push(...removed);
      fixedIssueCodes.push('stale_attached_evidence');
    }
  }

  return {
    report: buildLedgerDoctorReport(rootDir),
    fixed_paths: [...new Set(fixedPaths)],
    fixed_issue_codes: [...new Set(fixedIssueCodes)],
  };
}
