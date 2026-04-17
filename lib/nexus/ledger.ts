import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { archivedCloseoutRootFor, archivedRunLedgerPath, stageStatusPath } from './artifacts';
import { defaultExecutionSelection, type ExecutionSelection } from './execution-topology';
import { readStageStatus } from './status';
import { getAllowedNextStages } from './transitions';
import type {
  CanonicalCommandId,
  ContinuationMode,
  RunLedger,
  SessionRootRecord,
  StageStatus,
  WorkspaceRecord,
} from './types';

const LEDGER_PATH = '.planning/nexus/current-run.json';

export function ledgerPath(cwd = process.cwd()): string {
  return join(cwd, LEDGER_PATH);
}

export function readLedger(cwd = process.cwd()): RunLedger | null {
  const path = ledgerPath(cwd);
  if (!existsSync(path)) {
    return null;
  }

  return JSON.parse(readFileSync(path, 'utf8')) as RunLedger;
}

export function writeLedger(ledger: RunLedger, cwd = process.cwd()): void {
  mkdirSync(join(cwd, '.planning', 'nexus'), { recursive: true });
  writeFileSync(ledgerPath(cwd), JSON.stringify(ledger, null, 2) + '\n');
}

function closeoutReadyForRollover(status: StageStatus | null, runId: string): boolean {
  return Boolean(
    status
      && status.run_id === runId
      && status.stage === 'closeout'
      && status.state === 'completed'
      && status.ready === true,
  );
}

export function isCompletedCloseoutLedger(ledger: RunLedger, cwd = process.cwd()): boolean {
  if (ledger.current_stage !== 'closeout' || ledger.status !== 'completed') {
    return false;
  }

  const closeoutStatus = readStageStatus(stageStatusPath('closeout'), cwd);
  return closeoutReadyForRollover(closeoutStatus, ledger.run_id);
}

export function archiveCompletedRunLedger(ledger: RunLedger, cwd = process.cwd()): void {
  const archivedLedger = join(cwd, archivedRunLedgerPath(ledger.run_id));
  mkdirSync(dirname(archivedLedger), { recursive: true });
  writeFileSync(archivedLedger, JSON.stringify(ledger, null, 2) + '\n');

  const closeoutRoot = join(cwd, '.planning', 'current', 'closeout');
  if (existsSync(closeoutRoot)) {
    const archivedCloseoutRoot = join(cwd, archivedCloseoutRootFor(ledger.run_id));
    rmSync(archivedCloseoutRoot, { recursive: true, force: true });
    cpSync(closeoutRoot, archivedCloseoutRoot, {
      recursive: true,
      force: true,
    });
    const archivedCloseoutStatus = join(archivedCloseoutRoot, 'status.json');
    if (existsSync(archivedCloseoutStatus)) {
      const status = JSON.parse(readFileSync(archivedCloseoutStatus, 'utf8')) as StageStatus;
      writeFileSync(
        archivedCloseoutStatus,
        JSON.stringify(
          {
            ...status,
            workspace: ledger.execution.workspace,
            session_root: ledger.execution.session_root,
          },
          null,
          2,
        ) + '\n',
      );
    }
  }
}

export function makeRunId(clock: () => string): string {
  return `run-${clock().replace(/[:.]/g, '-')}`;
}

export function startLedger(
  run_id: string,
  stage: CanonicalCommandId,
  execution: ExecutionSelection = defaultExecutionSelection(),
  options: {
    continuationMode?: ContinuationMode;
    workspace?: WorkspaceRecord;
    sessionRoot?: SessionRootRecord;
  } = {},
): RunLedger {
  return {
    run_id,
    continuation_mode: options.continuationMode ?? 'project_reset',
    status: 'active',
    current_command: stage,
    current_stage: stage,
    previous_stage: null,
    allowed_next_stages: getAllowedNextStages(stage),
    command_history: [],
    artifact_index: {},
    execution: {
      mode: execution.mode,
      primary_provider: execution.primary_provider,
      provider_topology: execution.provider_topology,
      workspace: options.workspace,
      session_root: options.sessionRoot,
      requested_path: execution.requested_execution_path,
      actual_path: null,
    },
    route_intent: {
      planner: null,
      generator: null,
      evaluator_a: null,
      evaluator_b: null,
      synthesizer: null,
      substrate: null,
      fallback_policy: 'disabled',
    },
  };
}
