import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { assertSupportedReleaseChannel, type SupportedReleaseChannel } from './release-contract';

export const UPDATE_STATE_DIRNAME = 'update-state' as const;
export const LAST_CHECK_FILE = 'last-check.json' as const;
export const SNOOZE_FILE = 'snooze.json' as const;
export const JUST_UPGRADED_FILE = 'just-upgraded.json' as const;

export const UPDATE_STATE_STATUSES = [
  'up_to_date',
  'upgrade_available',
  'snoozed',
  'disabled',
  'error',
  'invalid_remote',
] as const;
export type UpdateStateStatus = (typeof UPDATE_STATE_STATUSES)[number];

export interface UpdateStateSource {
  kind: 'github_release';
  repo: string;
}

export interface LastCheckUpdateState {
  schema_version: 1;
  status: UpdateStateStatus;
  checked_at: string;
  release_channel: SupportedReleaseChannel;
  local_version: string;
  local_tag: string;
  candidate_version: string | null;
  candidate_tag: string | null;
  source: UpdateStateSource;
}

export interface SnoozeUpdateState {
  schema_version: 1;
  release_channel: SupportedReleaseChannel;
  candidate_version: string;
  candidate_tag: string;
  snooze_level: number;
  snoozed_at: string;
  expires_at: string;
}

export interface JustUpgradedUpdateState {
  schema_version: 1;
  from_version: string;
  from_tag: string;
  to_version: string;
  to_tag: string;
  release_channel: SupportedReleaseChannel;
  completed_at: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

export function assertUpdateStateStatus(value: unknown): asserts value is UpdateStateStatus {
  if (!UPDATE_STATE_STATUSES.includes(value as UpdateStateStatus)) {
    throw new Error(`update-state status must be one of: ${UPDATE_STATE_STATUSES.join(', ')}`);
  }
}

function readJsonFile<T>(path: string, validate: (value: unknown) => T): T | null {
  if (!existsSync(path)) {
    return null;
  }

  return validate(JSON.parse(readFileSync(path, 'utf8')));
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function assertLastCheckUpdateState(state: unknown): asserts state is LastCheckUpdateState {
  if (!isRecord(state)) {
    throw new Error('last-check update state must be an object');
  }

  if (state.schema_version !== 1) {
    throw new Error('last-check update state schema_version must be 1');
  }

  assertUpdateStateStatus(state.status);
  assertString(state.checked_at, 'checked_at');
  assertSupportedReleaseChannel(state.release_channel, 'release_channel');
  assertString(state.local_version, 'local_version');
  assertString(state.local_tag, 'local_tag');
  const candidateVersionIsNull = state.candidate_version === null;
  const candidateTagIsNull = state.candidate_tag === null;
  if (candidateVersionIsNull !== candidateTagIsNull) {
    throw new Error('candidate_version and candidate_tag must either both be null or both be strings');
  }
  if (!candidateVersionIsNull) {
    assertString(state.candidate_version, 'candidate_version');
    assertString(state.candidate_tag, 'candidate_tag');
  }
  if (!isRecord(state.source)) {
    throw new Error('source must be an object');
  }
  if (state.source.kind !== 'github_release') {
    throw new Error('source.kind must be github_release');
  }
  assertString(state.source.repo, 'source.repo');
}

export function validateLastCheckUpdateState(state: unknown): LastCheckUpdateState {
  assertLastCheckUpdateState(state);
  return state;
}

export function readLastCheckUpdateState(homeDir: string): LastCheckUpdateState | null {
  return readJsonFile(getLastCheckPath(homeDir), validateLastCheckUpdateState);
}

export function writeLastCheckUpdateState(state: LastCheckUpdateState, homeDir: string): void {
  writeJsonFile(getLastCheckPath(homeDir), state);
}

export function assertSnoozeUpdateState(state: unknown): asserts state is SnoozeUpdateState {
  if (!isRecord(state)) {
    throw new Error('snooze update state must be an object');
  }

  if (state.schema_version !== 1) {
    throw new Error('snooze update state schema_version must be 1');
  }

  assertSupportedReleaseChannel(state.release_channel, 'release_channel');
  assertString(state.candidate_version, 'candidate_version');
  assertString(state.candidate_tag, 'candidate_tag');
  if (typeof state.snooze_level !== 'number' || !Number.isInteger(state.snooze_level) || state.snooze_level < 0) {
    throw new Error('snooze_level must be a non-negative integer');
  }
  assertString(state.snoozed_at, 'snoozed_at');
  assertString(state.expires_at, 'expires_at');
}

export function validateSnoozeUpdateState(state: unknown): SnoozeUpdateState {
  assertSnoozeUpdateState(state);
  return state;
}

export function readSnoozeUpdateState(homeDir: string): SnoozeUpdateState | null {
  return readJsonFile(getSnoozePath(homeDir), validateSnoozeUpdateState);
}

export function writeSnoozeUpdateState(state: SnoozeUpdateState, homeDir: string): void {
  writeJsonFile(getSnoozePath(homeDir), state);
}

export function assertJustUpgradedUpdateState(state: unknown): asserts state is JustUpgradedUpdateState {
  if (!isRecord(state)) {
    throw new Error('just-upgraded update state must be an object');
  }

  if (state.schema_version !== 1) {
    throw new Error('just-upgraded update state schema_version must be 1');
  }

  assertString(state.from_version, 'from_version');
  assertString(state.from_tag, 'from_tag');
  assertString(state.to_version, 'to_version');
  assertString(state.to_tag, 'to_tag');
  assertSupportedReleaseChannel(state.release_channel, 'release_channel');
  assertString(state.completed_at, 'completed_at');
}

export function validateJustUpgradedUpdateState(state: unknown): JustUpgradedUpdateState {
  assertJustUpgradedUpdateState(state);
  return state;
}

export function readJustUpgradedUpdateState(homeDir: string): JustUpgradedUpdateState | null {
  return readJsonFile(getJustUpgradedPath(homeDir), validateJustUpgradedUpdateState);
}

export function writeJustUpgradedUpdateState(state: JustUpgradedUpdateState, homeDir: string): void {
  writeJsonFile(getJustUpgradedPath(homeDir), state);
}

export function getUpdateStateRoot(homeDir: string): string {
  return join(homeDir, '.nexus', UPDATE_STATE_DIRNAME);
}

export function getLastCheckPath(homeDir: string): string {
  return join(getUpdateStateRoot(homeDir), LAST_CHECK_FILE);
}

export function getSnoozePath(homeDir: string): string {
  return join(getUpdateStateRoot(homeDir), SNOOZE_FILE);
}

export function getJustUpgradedPath(homeDir: string): string {
  return join(getUpdateStateRoot(homeDir), JUST_UPGRADED_FILE);
}
