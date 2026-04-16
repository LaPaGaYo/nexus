import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { ccbDispatchStatePath, ccbProviderStatePath } from './artifacts';

type CcbRuntimeProvider = 'codex' | 'gemini';
type CcbRuntimeStage = 'handoff' | 'build' | 'review' | 'qa';
type CcbDispatchStatus = 'dispatched' | 'completed' | 'blocked' | 'recovered_late';
type CcbPayloadSource = 'ask' | 'pend' | null;

interface CcbProviderStateEntry {
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
  last_request_id: string | null;
  last_request_stage: CcbRuntimeStage | null;
}

interface CcbProviderStateFile {
  schema_version: 1;
  updated_at: string;
  providers: Record<CcbRuntimeProvider, CcbProviderStateEntry>;
}

interface CcbDispatchStateRecord {
  schema_version: 1;
  request_id: string;
  provider: CcbRuntimeProvider;
  stage: Exclude<CcbRuntimeStage, 'handoff'>;
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
    last_request_id: null,
    last_request_stage: null,
  };
}

function defaultProviderStateFile(now: string): CcbProviderStateFile {
  return {
    schema_version: 1,
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
      schema_version: 1,
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
  requestId: string;
  provider: CcbRuntimeProvider;
  stage: Exclude<CcbRuntimeStage, 'handoff'>;
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
}): void {
  const record: CcbDispatchStateRecord = {
    schema_version: 1,
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
  };
  writeJson(dispatchStateAbsolutePath(input.repoRoot, input.requestId), record);

  const providerState = readProviderState(input.repoRoot, input.updatedAt);
  providerState.updated_at = input.updatedAt;
  providerState.providers[input.provider] = {
    ...providerState.providers[input.provider],
    session_root: input.sessionRoot,
    session_file: input.sessionFile,
    last_request_id: input.requestId,
    last_request_stage: input.stage,
  };
  writeProviderState(input.repoRoot, providerState);
}
