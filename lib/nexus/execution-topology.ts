import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type {
  ExecutionMode,
  PrimaryProvider,
  ProviderTopology,
  RunLedger,
  StageStatus,
} from './types';

export interface ExecutionSelection {
  mode: ExecutionMode;
  primary_provider: PrimaryProvider;
  provider_topology: ProviderTopology;
  requested_execution_path: string;
}

const LOCAL_PROVIDER_BINS: Record<PrimaryProvider, string> = {
  claude: 'claude',
  codex: 'codex',
  gemini: 'gemini',
};

function readConfigValue(key: string): string | null {
  const stateDir = process.env.NEXUS_STATE_DIR ?? join(homedir(), '.nexus');
  const configPath = join(stateDir, 'config.yaml');
  if (!existsSync(configPath)) {
    return null;
  }

  const match = readFileSync(configPath, 'utf8').match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim() ?? null;
}

function commandExists(command: string): boolean {
  const result = Bun.spawnSync(['which', command], {
    stdout: 'ignore',
    stderr: 'ignore',
  });
  return result.exitCode === 0;
}

export function localExecutionPath(
  provider: PrimaryProvider,
  topology: ProviderTopology,
  scope: 'build' | 'audit_a' | 'audit_b' | 'qa' = 'build',
): string {
  const suffix = scope === 'build' ? '' : `-${scope.replace('_', '-')}`;
  return `${provider}-local-${topology}${suffix}`;
}

export function defaultExecutionSelection(): ExecutionSelection {
  const configuredMode = (process.env.NEXUS_EXECUTION_MODE ?? readConfigValue('execution_mode')) as ExecutionMode | undefined;
  const configuredProvider = (process.env.NEXUS_PRIMARY_PROVIDER ?? readConfigValue('primary_provider')) as PrimaryProvider | undefined;
  const configuredTopology = (process.env.NEXUS_PROVIDER_TOPOLOGY ?? readConfigValue('provider_topology')) as ProviderTopology | undefined;
  const ccbAvailable = commandExists('ask');

  const mode: ExecutionMode = configuredMode
    ?? (ccbAvailable ? 'governed_ccb' : 'local_provider');

  if (mode === 'governed_ccb') {
    return {
      mode,
      primary_provider: 'codex',
      provider_topology: 'multi_session',
      requested_execution_path: 'codex-via-ccb',
    };
  }

  const primaryProvider = configuredProvider
    ?? (['claude', 'codex', 'gemini'] as const).find((provider) => commandExists(LOCAL_PROVIDER_BINS[provider]))
    ?? 'claude';
  const topology = configuredTopology ?? 'single_agent';

  return {
    mode,
    primary_provider: primaryProvider,
    provider_topology: topology,
    requested_execution_path: localExecutionPath(primaryProvider, topology),
  };
}

export function executionFieldsFromLedger(
  ledger: RunLedger,
  actualPath: string | null = ledger.execution.actual_path,
): Pick<
  StageStatus,
  'execution_mode' | 'primary_provider' | 'provider_topology' | 'requested_execution_path' | 'actual_execution_path'
> {
  return {
    execution_mode: ledger.execution.mode,
    primary_provider: ledger.execution.primary_provider,
    provider_topology: ledger.execution.provider_topology,
    requested_execution_path: ledger.execution.requested_path,
    actual_execution_path: actualPath,
  };
}

export function withActualExecutionPath(ledger: RunLedger, actualPath: string | null): RunLedger {
  return {
    ...ledger,
    execution: {
      ...ledger.execution,
      actual_path: actualPath,
    },
  };
}
