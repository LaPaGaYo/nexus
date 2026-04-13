import { cpSync, existsSync, readFileSync } from 'fs';
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

export function assertExpectedHistoryOneOf(
  ledger: RunLedger,
  expectedHistories: RunLedger['command_history'][number]['command'][][],
): void {
  for (const expected of expectedHistories) {
    try {
      assertExpectedHistory(ledger, expected);
      return;
    } catch {
      // Try the next expected history.
    }
  }

  throw new Error('Illegal Nexus transition history');
}

function matchesFixCycleHistory(
  actual: RunLedger['command_history'][number]['command'][],
  options: { qaRecorded: boolean; shipRecorded: boolean },
): boolean {
  const expectedPrefix: RunLedger['command_history'][number]['command'][] = ['plan', 'handoff'];
  if (actual.length < expectedPrefix.length + 2) {
    return false;
  }

  for (const [index, command] of expectedPrefix.entries()) {
    if (actual[index] !== command) {
      return false;
    }
  }

  let cursor = expectedPrefix.length;
  while (actual[cursor] === 'handoff') {
    cursor += 1;
  }

  if (actual[cursor] !== 'build' || actual[cursor + 1] !== 'review') {
    return false;
  }
  cursor += 2;

  while (
    cursor < actual.length
  ) {
    while (actual[cursor] === 'handoff') {
      cursor += 1;
    }

    if (cursor + 1 < actual.length && actual[cursor] === 'build' && actual[cursor + 1] === 'review') {
      cursor += 2;
      continue;
    }

    break;
  }

  if (options.qaRecorded) {
    if (actual[cursor] !== 'qa') {
      return false;
    }
    cursor += 1;
  }

  if (options.shipRecorded) {
    if (actual[cursor] !== 'ship') {
      return false;
    }
    cursor += 1;
  }

  return cursor === actual.length;
}

export function assertCloseoutHistory(
  ledger: RunLedger,
  options: { qaRecorded: boolean; shipRecorded: boolean },
): void {
  const actual = ledger.command_history.map((entry) => entry.command);
  if (!matchesFixCycleHistory(actual, options)) {
    throw new Error('Illegal Nexus transition history');
  }
}

export function archiveAuditWorkspace(runId: string, cwd = process.cwd()): string {
  const source = join(cwd, '.planning', 'audits', 'current');
  const destination = join(cwd, archiveRootFor(runId));
  cpSync(source, destination, { recursive: true, force: true });
  return archiveRootFor(runId);
}

export function assertArchiveConsistency(runId: string, reviewStatus: StageStatus, cwd = process.cwd()): void {
  if (reviewStatus.archive_required !== true) {
    return;
  }

  const archiveRoot = join(cwd, archiveRootFor(runId));
  for (const file of ['codex.md', 'gemini.md', 'synthesis.md', 'gate-decision.md', 'meta.json']) {
    const filePath = join(archiveRoot, file);
    if (!existsSync(filePath)) {
      throw new Error(`Missing archived audit artifact: ${file}`);
    }

    const content = readFileSync(filePath, 'utf8').trim();
    if (!content) {
      throw new Error(`Missing archived audit artifact: ${file}`);
    }
  }
}

export function archiveExists(runId: string, cwd = process.cwd()): boolean {
  return existsSync(join(cwd, archiveRootFor(runId)));
}

export function assertReviewReadyForCloseout(reviewStatus: StageStatus, cwd = process.cwd()): void {
  if (
    reviewStatus.state !== 'completed'
    || reviewStatus.decision !== 'audit_recorded'
    || reviewStatus.ready !== true
    || reviewStatus.audit_set_complete !== true
    || reviewStatus.provenance_consistent !== true
    || reviewStatus.gate_decision !== 'pass'
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

export function assertQaReadyForCloseout(qaStatus: StageStatus | null): void {
  if (!qaStatus) {
    return;
  }

  if (
    qaStatus.stage !== 'qa'
    || qaStatus.state !== 'completed'
    || qaStatus.decision !== 'qa_recorded'
    || qaStatus.ready !== true
  ) {
    throw new Error('QA must be ready before closeout');
  }
}

export function assertShipReadyForCloseout(shipStatus: StageStatus | null): void {
  if (!shipStatus) {
    return;
  }

  if (
    shipStatus.stage !== 'ship'
    || shipStatus.state !== 'completed'
    || shipStatus.decision !== 'ship_recorded'
    || shipStatus.ready !== true
  ) {
    throw new Error('Ship must be ready before closeout');
  }
}
