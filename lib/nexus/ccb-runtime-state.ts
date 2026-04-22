import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { ccbDispatchStatePath, ccbProviderStatePath } from './artifacts';

export type CcbRuntimeProvider = 'codex' | 'gemini';
export type CcbRuntimeStage = 'handoff' | 'build' | 'review' | 'qa';
export type CcbDispatchStage = Exclude<CcbRuntimeStage, 'handoff'>;
export type CcbDispatchStatus = 'dispatched' | 'completed' | 'blocked' | 'recovered_late' | 'superseded';
export type CcbPayloadSource = 'ask' | 'pend' | 'receipt' | null;
export type CcbDispatchLatencyPath = 'foreground' | 'foreground_retry' | 'watchdog_recovery' | 'late_recovery' | 'blocked';
export type CcbDispatchForegroundExit = 'success' | 'timeout' | 'nonzero';
export type CcbDispatchLikelyCause = 'normal' | 'provider_slow' | 'orchestration_false_start' | 'dispatch_failed';

export interface CcbDispatchLatencySummary {
  path: CcbDispatchLatencyPath;
  likely_cause: CcbDispatchLikelyCause;
  foreground_exit: CcbDispatchForegroundExit;
  foreground_retry_count: number;
  finalize_nudge_issued: boolean;
  pend_attempts: number;
  recovered_via: CcbPayloadSource;
}

export interface CcbDispatchRetryProvenance {
  reason: 'foreground_false_start';
  retry_count: number;
  initial_exit_code: number | null;
  initial_request_id: string | null;
  initial_stdout_excerpt: string | null;
  initial_stderr_excerpt: string | null;
}

export interface CcbProviderStateEntry {
  provider: CcbRuntimeProvider;
  session_root: string | null;
  session_file: string | null;
  mounted: boolean | null;
  last_mounted_at: string | null;
  last_mounted_output: string | null;
  ping_ok: boolean | null;
  last_ping_at: string | null;
  last_ping_output: string | null;
  autonew_ok: boolean | null;
  last_autonew_at: string | null;
  last_autonew_output: string | null;
  active_dispatch_id: string | null;
  active_dispatch_stage: CcbDispatchStage | null;
  active_dispatch_status: CcbDispatchStatus | null;
  last_dispatch_id: string | null;
  last_dispatch_stage: CcbDispatchStage | null;
  last_dispatch_status: CcbDispatchStatus | null;
  last_request_id: string | null;
  last_request_stage: CcbRuntimeStage | null;
  last_request_status: CcbDispatchStatus | null;
}

export interface CcbProviderStateFile {
  schema_version: 2;
  updated_at: string;
  providers: Record<CcbRuntimeProvider, CcbProviderStateEntry>;
}

export interface CcbDispatchStateRecord {
  schema_version: 3;
  dispatch_id: string;
  request_id: string | null;
  provider: CcbRuntimeProvider;
  stage: CcbDispatchStage;
  status: CcbDispatchStatus;
  payload_source: CcbPayloadSource;
  session_root: string;
  session_file: string | null;
  execution_workspace: string;
  dispatch_command: string;
  dispatched_at: string;
  updated_at: string;
  ask_exit_code: number | null;
  stdout: string;
  stderr: string;
  retry_provenance: CcbDispatchRetryProvenance | null;
  latency_summary: CcbDispatchLatencySummary | null;
}

function defaultProviderEntry(provider: CcbRuntimeProvider): CcbProviderStateEntry {
  return {
    provider,
    session_root: null,
    session_file: null,
    mounted: null,
    last_mounted_at: null,
    last_mounted_output: null,
    ping_ok: null,
    last_ping_at: null,
    last_ping_output: null,
    autonew_ok: null,
    last_autonew_at: null,
    last_autonew_output: null,
    active_dispatch_id: null,
    active_dispatch_stage: null,
    active_dispatch_status: null,
    last_dispatch_id: null,
    last_dispatch_stage: null,
    last_dispatch_status: null,
    last_request_id: null,
    last_request_stage: null,
    last_request_status: null,
  };
}

function defaultProviderStateFile(now: string): CcbProviderStateFile {
  return {
    schema_version: 2,
    updated_at: now,
    providers: {
      codex: defaultProviderEntry('codex'),
      gemini: defaultProviderEntry('gemini'),
    },
  };
}

function providerStateAbsolutePath(repoRoot: string): string {
  return join(repoRoot, ccbProviderStatePath());
}

function dispatchStateAbsolutePath(repoRoot: string, requestId: string): string {
  return join(repoRoot, ccbDispatchStatePath(requestId));
}

export function createCcbDispatchId(input: {
  provider: CcbRuntimeProvider;
  stage: CcbDispatchStage;
  at: string;
}): string {
  return `${input.stage}-${input.provider}-${input.at.replace(/[^0-9A-Za-z]+/g, '-')}`;
}

function writeJson(absolutePath: string, value: unknown): void {
  try {
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, JSON.stringify(value, null, 2) + '\n');
  } catch {
    // CCB runtime state is best-effort observability; it must not block stage execution.
  }
}

function readProviderState(repoRoot: string, now: string): CcbProviderStateFile {
  const absolutePath = providerStateAbsolutePath(repoRoot);
  if (!existsSync(absolutePath)) {
    return defaultProviderStateFile(now);
  }

  try {
    const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as Partial<CcbProviderStateFile>;
    return {
      schema_version: 2,
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : now,
      providers: {
        codex: {
          ...defaultProviderEntry('codex'),
          ...(parsed.providers?.codex ?? {}),
          provider: 'codex',
        },
        gemini: {
          ...defaultProviderEntry('gemini'),
          ...(parsed.providers?.gemini ?? {}),
          provider: 'gemini',
        },
      },
    };
  } catch {
    return defaultProviderStateFile(now);
  }
}

function writeProviderState(repoRoot: string, state: CcbProviderStateFile): void {
  writeJson(providerStateAbsolutePath(repoRoot), state);
}

export function readCcbProviderState(repoRoot: string, now: string): CcbProviderStateFile {
  return readProviderState(repoRoot, now);
}

export function readCcbDispatchState(repoRoot: string, dispatchId: string): CcbDispatchStateRecord | null {
  const absolutePath = dispatchStateAbsolutePath(repoRoot, dispatchId);
  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as Partial<CcbDispatchStateRecord>;
    if (
      (parsed.schema_version !== 2 && parsed.schema_version !== 3) ||
      typeof parsed.dispatch_id !== 'string' ||
      typeof parsed.provider !== 'string' ||
      typeof parsed.stage !== 'string' ||
      typeof parsed.status !== 'string'
    ) {
      return null;
    }

    return {
      schema_version: 3,
      dispatch_id: parsed.dispatch_id,
      request_id: typeof parsed.request_id === 'string' ? parsed.request_id : null,
      provider: parsed.provider as CcbRuntimeProvider,
      stage: parsed.stage as CcbDispatchStage,
      status: parsed.status as CcbDispatchStatus,
      payload_source: parsed.payload_source === 'ask'
        || parsed.payload_source === 'pend'
        || parsed.payload_source === 'receipt'
        ? parsed.payload_source
        : null,
      session_root: typeof parsed.session_root === 'string' ? parsed.session_root : '',
      session_file: typeof parsed.session_file === 'string' ? parsed.session_file : null,
      execution_workspace: typeof parsed.execution_workspace === 'string' ? parsed.execution_workspace : '',
      dispatch_command: typeof parsed.dispatch_command === 'string' ? parsed.dispatch_command : '',
      dispatched_at: typeof parsed.dispatched_at === 'string' ? parsed.dispatched_at : '',
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : '',
      ask_exit_code: typeof parsed.ask_exit_code === 'number' ? parsed.ask_exit_code : null,
      stdout: typeof parsed.stdout === 'string' ? parsed.stdout : '',
      stderr: typeof parsed.stderr === 'string' ? parsed.stderr : '',
      retry_provenance: parsed.retry_provenance && typeof parsed.retry_provenance === 'object'
        ? {
            reason: parsed.retry_provenance.reason === 'foreground_false_start'
              ? 'foreground_false_start'
              : 'foreground_false_start',
            retry_count: typeof parsed.retry_provenance.retry_count === 'number'
              ? parsed.retry_provenance.retry_count
              : 0,
            initial_exit_code: typeof parsed.retry_provenance.initial_exit_code === 'number'
              ? parsed.retry_provenance.initial_exit_code
              : null,
            initial_request_id: typeof parsed.retry_provenance.initial_request_id === 'string'
              ? parsed.retry_provenance.initial_request_id
              : null,
            initial_stdout_excerpt: typeof parsed.retry_provenance.initial_stdout_excerpt === 'string'
              ? parsed.retry_provenance.initial_stdout_excerpt
              : null,
            initial_stderr_excerpt: typeof parsed.retry_provenance.initial_stderr_excerpt === 'string'
              ? parsed.retry_provenance.initial_stderr_excerpt
              : null,
          }
        : null,
      latency_summary: parsed.latency_summary && typeof parsed.latency_summary === 'object'
        ? {
            path: parsed.latency_summary.path as CcbDispatchLatencyPath,
            likely_cause: parsed.latency_summary.likely_cause as CcbDispatchLikelyCause,
            foreground_exit: parsed.latency_summary.foreground_exit as CcbDispatchForegroundExit,
            foreground_retry_count: typeof parsed.latency_summary.foreground_retry_count === 'number'
              ? parsed.latency_summary.foreground_retry_count
              : 0,
            finalize_nudge_issued: parsed.latency_summary.finalize_nudge_issued === true,
            pend_attempts: typeof parsed.latency_summary.pend_attempts === 'number'
              ? parsed.latency_summary.pend_attempts
              : 0,
            recovered_via: parsed.latency_summary.recovered_via === 'ask'
              || parsed.latency_summary.recovered_via === 'pend'
              || parsed.latency_summary.recovered_via === 'receipt'
              ? parsed.latency_summary.recovered_via
              : null,
          }
        : null,
    };
  } catch {
    return null;
  }
}

export function readActiveCcbDispatchState(
  repoRoot: string,
  provider: CcbRuntimeProvider,
  now: string,
): CcbDispatchStateRecord | null {
  const state = readProviderState(repoRoot, now);
  const dispatchId = state.providers[provider].active_dispatch_id;
  if (!dispatchId) {
    return null;
  }

  return readCcbDispatchState(repoRoot, dispatchId);
}

export function startCcbDispatchState(input: {
  repoRoot: string;
  dispatchId: string;
  provider: CcbRuntimeProvider;
  stage: CcbDispatchStage;
  sessionRoot: string;
  sessionFile: string | null;
  executionWorkspace: string;
  dispatchCommand: string;
  dispatchedAt: string;
}): void {
  const record: CcbDispatchStateRecord = {
    schema_version: 3,
    dispatch_id: input.dispatchId,
    request_id: null,
    provider: input.provider,
    stage: input.stage,
    status: 'dispatched',
    payload_source: null,
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    execution_workspace: input.executionWorkspace,
    dispatch_command: input.dispatchCommand,
    dispatched_at: input.dispatchedAt,
    updated_at: input.dispatchedAt,
    ask_exit_code: null,
    stdout: '',
    stderr: '',
    retry_provenance: null,
    latency_summary: null,
  };
  writeJson(dispatchStateAbsolutePath(input.repoRoot, input.dispatchId), record);

  const providerState = readProviderState(input.repoRoot, input.dispatchedAt);
  providerState.updated_at = input.dispatchedAt;
  providerState.providers[input.provider] = {
    ...providerState.providers[input.provider],
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    active_dispatch_id: input.dispatchId,
    active_dispatch_stage: input.stage,
    active_dispatch_status: 'dispatched',
    last_dispatch_id: input.dispatchId,
    last_dispatch_stage: input.stage,
    last_dispatch_status: 'dispatched',
  };
  writeProviderState(input.repoRoot, providerState);
}

export function recordCcbMountedProviderState(input: {
  repoRoot: string;
  provider: CcbRuntimeProvider;
  sessionRoot: string;
  sessionFile: string | null;
  mounted: boolean;
  mountedOutput: string;
  now: string;
}): void {
  const state = readProviderState(input.repoRoot, input.now);
  state.updated_at = input.now;
  state.providers[input.provider] = {
    ...state.providers[input.provider],
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    mounted: input.mounted,
    last_mounted_at: input.now,
    last_mounted_output: input.mountedOutput,
  };
  writeProviderState(input.repoRoot, state);
}

export function recordCcbPingProviderState(input: {
  repoRoot: string;
  provider: CcbRuntimeProvider;
  sessionRoot: string;
  sessionFile: string | null;
  pingOk: boolean;
  pingOutput: string;
  now: string;
}): void {
  const state = readProviderState(input.repoRoot, input.now);
  state.updated_at = input.now;
  state.providers[input.provider] = {
    ...state.providers[input.provider],
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    ping_ok: input.pingOk,
    last_ping_at: input.now,
    last_ping_output: input.pingOutput,
  };
  writeProviderState(input.repoRoot, state);
}

export function recordCcbAutonewProviderState(input: {
  repoRoot: string;
  provider: CcbRuntimeProvider;
  sessionRoot: string;
  sessionFile: string | null;
  autonewOk: boolean;
  autonewOutput: string;
  now: string;
}): void {
  const state = readProviderState(input.repoRoot, input.now);
  state.updated_at = input.now;
  state.providers[input.provider] = {
    ...state.providers[input.provider],
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    autonew_ok: input.autonewOk,
    last_autonew_at: input.now,
    last_autonew_output: input.autonewOutput,
  };
  writeProviderState(input.repoRoot, state);
}

export function recordCcbDispatchState(input: {
  repoRoot: string;
  dispatchId: string;
  requestId: string | null;
  provider: CcbRuntimeProvider;
  stage: CcbDispatchStage;
  status: CcbDispatchStatus;
  payloadSource: CcbPayloadSource;
  sessionRoot: string;
  sessionFile: string | null;
  executionWorkspace: string;
  dispatchCommand: string;
  dispatchedAt: string;
  updatedAt: string;
  askExitCode: number | null;
  stdout: string;
  stderr: string;
  retryProvenance?: CcbDispatchRetryProvenance | null;
  latencySummary?: CcbDispatchLatencySummary | null;
}): void {
  const record: CcbDispatchStateRecord = {
    schema_version: 3,
    dispatch_id: input.dispatchId,
    request_id: input.requestId,
    provider: input.provider,
    stage: input.stage,
    status: input.status,
    payload_source: input.payloadSource,
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    execution_workspace: input.executionWorkspace,
    dispatch_command: input.dispatchCommand,
    dispatched_at: input.dispatchedAt,
    updated_at: input.updatedAt,
    ask_exit_code: input.askExitCode,
    stdout: input.stdout,
    stderr: input.stderr,
    retry_provenance: input.retryProvenance ?? null,
    latency_summary: input.latencySummary ?? null,
  };
  writeJson(dispatchStateAbsolutePath(input.repoRoot, input.dispatchId), record);

  const providerState = readProviderState(input.repoRoot, input.updatedAt);
  const currentProviderState = providerState.providers[input.provider];
  const clearActiveDispatch = currentProviderState.active_dispatch_id === input.dispatchId && input.status !== 'dispatched';
  providerState.updated_at = input.updatedAt;
  providerState.providers[input.provider] = {
    ...currentProviderState,
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    active_dispatch_id: clearActiveDispatch ? null : currentProviderState.active_dispatch_id,
    active_dispatch_stage: clearActiveDispatch ? null : currentProviderState.active_dispatch_stage,
    active_dispatch_status: clearActiveDispatch ? null : currentProviderState.active_dispatch_status,
    last_dispatch_id: input.dispatchId,
    last_dispatch_stage: input.stage,
    last_dispatch_status: input.status,
    last_request_id: input.requestId ?? currentProviderState.last_request_id,
    last_request_stage: input.requestId ? input.stage : currentProviderState.last_request_stage,
    last_request_status: input.requestId ? input.status : currentProviderState.last_request_status,
  };
  writeProviderState(input.repoRoot, providerState);
}
