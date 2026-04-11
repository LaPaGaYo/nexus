import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { defaultExecutionSelection, type ExecutionSelection } from './execution-topology';
import { getAllowedNextStages } from './transitions';
import type { CanonicalCommandId, RunLedger } from './types';

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

export function makeRunId(clock: () => string): string {
  return `run-${clock().replace(/[:.]/g, '-')}`;
}

export function startLedger(
  run_id: string,
  stage: CanonicalCommandId,
  execution: ExecutionSelection = defaultExecutionSelection(),
): RunLedger {
  return {
    run_id,
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
