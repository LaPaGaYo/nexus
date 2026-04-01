import { cpSync, existsSync } from 'fs';
import { join } from 'path';
import { archiveRootFor } from './artifacts';
import type { RunLedger, StageStatus } from './types';

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

export function assertExpectedHistory(
  ledger: RunLedger,
  expected: RunLedger['command_history'][number]['command'][],
): void {
  const actual = ledger.command_history.map((entry) => entry.command);
  if (actual.length !== expected.length) {
    throw new Error('Illegal Nexus transition history');
  }

  for (const [index, command] of expected.entries()) {
    if (actual[index] !== command) {
      throw new Error('Illegal Nexus transition history');
    }
  }
}

export function archiveAuditWorkspace(runId: string, cwd = process.cwd()): string {
  const source = join(cwd, '.planning', 'audits', 'current');
  const destination = join(cwd, archiveRootFor(runId));
  cpSync(source, destination, { recursive: true, force: true });
  return archiveRootFor(runId);
}

export function assertReviewReadyForCloseout(reviewStatus: StageStatus, cwd = process.cwd()): void {
  if (
    reviewStatus.state !== 'completed'
    || reviewStatus.decision !== 'audit_recorded'
    || reviewStatus.audit_set_complete !== true
    || reviewStatus.provenance_consistent !== true
  ) {
    throw new Error('Review must be completed before closeout');
  }

  const requiredPaths = [
    '.planning/audits/current/codex.md',
    '.planning/audits/current/gemini.md',
    '.planning/audits/current/synthesis.md',
    '.planning/audits/current/gate-decision.md',
    '.planning/audits/current/meta.json',
  ];

  for (const path of requiredPaths) {
    if (!existsSync(join(cwd, path))) {
      throw new Error(`Missing required audit artifact: ${path}`);
    }
  }
}
