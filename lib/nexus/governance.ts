import type { StageStatus } from './types';

export function archiveRequired(reviewStatus: StageStatus): boolean {
  return reviewStatus.state === 'completed' && reviewStatus.decision === 'audit_recorded';
}

export function assertSameRunId(expected: string, actual: string, label: string): void {
  if (expected !== actual) {
    throw new Error(`Run ID mismatch for ${label}: expected ${expected}, got ${actual}`);
  }
}

export function gateRequiresArchive(gateDecisionMarkdown: string): boolean {
  return /Gate:\s*pass/i.test(gateDecisionMarkdown);
}
