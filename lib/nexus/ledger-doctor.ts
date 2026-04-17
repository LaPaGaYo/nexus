import { existsSync } from 'fs';
import { join } from 'path';
import { currentAuditArtifactPaths, stageStatusPath } from './artifacts';
import { diagnoseCloseoutHistory } from './governance';
import { readLedger } from './ledger';
import { readStageStatus } from './status';
import type { StageStatus } from './types';

export const LEDGER_DOCTOR_ISSUE_CODES = [
  'history_mismatch',
  'stale_current_audits',
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

function currentAuditArtifactsPresent(rootDir: string): string[] {
  return currentAuditArtifactPaths().filter((path) => existsSync(join(rootDir, path)));
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

export function buildLedgerDoctorReport(rootDir: string): LedgerDoctorReport {
  const issues: LedgerDoctorIssue[] = [];
  const ledger = readLedger(rootDir);
  const reviewStatus = readStageStatus(stageStatusPath('review'), rootDir);
  const qaStatus = readStageStatus(stageStatusPath('qa'), rootDir);
  const shipStatus = readStageStatus(stageStatusPath('ship'), rootDir);

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

  return {
    status: issues.length === 0 ? 'clean' : 'action_required',
    issues,
  };
}
