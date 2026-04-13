import { cpSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { archiveRootFor } from './artifacts';
import { CANONICAL_COMMANDS, COMMAND_HISTORY_VIAS } from './types';
import type { RunLedger, StageStatus } from './types';

export function archiveRequired(reviewStatus: StageStatus): boolean {
  return reviewStatus.state === 'completed' && reviewStatus.decision === 'audit_recorded';
}

export function assertSameRunId(expected: string, actual: string, label: string): void {
  if (expected !== actual) {
    throw new Error(`Run ID mismatch for ${label}: expected ${expected}, got ${actual}`);
  }
}

function assertCanonicalCommandHistoryEntry(entry: unknown): void {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new Error('Run ledger is not canonical');
  }

  const keys = Object.keys(entry).sort();
  if (keys.length !== 3 || keys[0] !== 'at' || keys[1] !== 'command' || keys[2] !== 'via') {
    throw new Error('Run ledger is not canonical');
  }

  const record = entry as Record<string, unknown>;
  if (!CANONICAL_COMMANDS.includes(record.command as typeof CANONICAL_COMMANDS[number])) {
    throw new Error('Run ledger is not canonical');
  }

  if (typeof record.at !== 'string' || record.at.trim().length === 0) {
    throw new Error('Run ledger is not canonical');
  }

  if (record.via !== null && !COMMAND_HISTORY_VIAS.includes(record.via as typeof COMMAND_HISTORY_VIAS[number])) {
    throw new Error('Run ledger is not canonical');
  }
}

function assertCanonicalRunLevelRouteCheck(ledger: RunLedger): void {
  if (ledger.execution.mode !== 'governed_ccb') {
    return;
  }

  if (!ledger.route_check || typeof ledger.route_check !== 'object') {
    throw new Error('Run ledger is not canonical');
  }

  if (typeof ledger.route_check.checked_at !== 'string' || ledger.route_check.checked_at.trim().length === 0) {
    throw new Error('Run ledger is not canonical');
  }

  if (!ledger.route_check.requested_route || typeof ledger.route_check.requested_route !== 'object') {
    throw new Error('Run ledger is not canonical');
  }

  const routeValidation = ledger.route_check.route_validation;
  if (!routeValidation || typeof routeValidation !== 'object') {
    throw new Error('Run ledger is not canonical');
  }

  if (
    typeof routeValidation.transport !== 'string'
    || typeof routeValidation.available !== 'boolean'
    || typeof routeValidation.approved !== 'boolean'
    || typeof routeValidation.reason !== 'string'
  ) {
    throw new Error('Run ledger is not canonical');
  }

  if (routeValidation.transport === 'ccb') {
    if (!Array.isArray(routeValidation.provider_checks) || routeValidation.provider_checks.length === 0) {
      throw new Error('Run ledger is not canonical');
    }

    for (const check of routeValidation.provider_checks) {
      if (
        !check
        || typeof check !== 'object'
        || typeof check.provider !== 'string'
        || typeof check.available !== 'boolean'
        || typeof check.mounted !== 'boolean'
        || typeof check.reason !== 'string'
      ) {
        throw new Error('Run ledger is not canonical');
      }
    }
  }
}

export function assertCanonicalTailLedger(ledger: RunLedger, label: 'QA' | 'ship'): void {
  if (!Array.isArray(ledger.command_history)) {
    throw new Error(`Run ledger is not canonical before ${label}`);
  }

  for (const entry of ledger.command_history) {
    try {
      assertCanonicalCommandHistoryEntry(entry);
    } catch {
      throw new Error(`Run ledger is not canonical before ${label}`);
    }
  }

  try {
    assertCanonicalRunLevelRouteCheck(ledger);
  } catch {
    throw new Error(`Run ledger is not canonical before ${label}`);
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
  while (actual[cursor] === 'review') {
    cursor += 1;
  }

  while (
    cursor < actual.length
  ) {
    while (actual[cursor] === 'handoff') {
      cursor += 1;
    }

    if (cursor + 1 < actual.length && actual[cursor] === 'build' && actual[cursor + 1] === 'review') {
      cursor += 2;
      while (actual[cursor] === 'review') {
        cursor += 1;
      }
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
