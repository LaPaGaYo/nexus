import { mkdirSync, renameSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { writeConflictArtifacts } from '../conflicts';
import { writeLedger } from '../ledger';
import { writeStageStatus } from '../status';
import { syncRunWorkspaceArtifacts } from '../workspace-substrate';
import type { CanonicalCommandId, ConflictRecord, RunLedger, StageStatus, WorkspaceRecord } from '../types';

function writeRepoFile(cwd: string, relativePath: string, content: string): void {
  const absolutePath = join(cwd, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

function writeAtomicRepoFile(cwd: string, relativePath: string, content: string): void {
  const absolutePath = join(cwd, relativePath);
  const tempPath = `${absolutePath}.tmp`;

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(tempPath, content);
  renameSync(tempPath, absolutePath);
}

function removeRepoFile(cwd: string, relativePath: string): void {
  rmSync(join(cwd, relativePath), { recursive: true, force: true });
}

interface ArtifactWrite {
  path: string;
  content: string;
}

interface ApplyNormalizationPlanInput {
  cwd: string;
  stage: CanonicalCommandId;
  statusPath: string;
  canonicalWrites: ArtifactWrite[];
  removeWrites?: string[];
  traceWrites: ArtifactWrite[];
  status: StageStatus;
  ledger?: RunLedger;
  conflicts?: ConflictRecord[];
  mirrorWorkspace?: WorkspaceRecord | null;
  writeAtomicFile?: (cwd: string, relativePath: string, content: string) => void;
}

export async function applyNormalizationPlan(input: ApplyNormalizationPlanInput): Promise<void> {
  try {
    for (const trace of input.traceWrites) {
      writeRepoFile(input.cwd, trace.path, trace.content);
    }

    for (const relativePath of input.removeWrites ?? []) {
      removeRepoFile(input.cwd, relativePath);
    }

    for (const write of input.canonicalWrites) {
      (input.writeAtomicFile ?? writeAtomicRepoFile)(input.cwd, write.path, write.content);
    }

    writeStageStatus(input.statusPath, input.status, input.cwd);
    if (input.ledger) {
      writeLedger(input.ledger, input.cwd);
    }
    if (input.conflicts && input.conflicts.length > 0) {
      writeConflictArtifacts(input.cwd, input.stage, input.conflicts);
    }
    syncRunWorkspaceArtifacts(input.cwd, input.mirrorWorkspace);
  } catch (error) {
    const blockedStatus: StageStatus = {
      ...input.status,
      state: 'blocked',
      ready: false,
      completed_at: null,
      errors: [...input.status.errors, 'Canonical writeback failed'],
    };
    const conflicts = input.conflicts ?? [
      {
        stage: input.stage,
        adapter: 'normalizer',
        kind: 'partial_write_failure',
        message: error instanceof Error ? error.message : String(error),
        canonical_paths: [...(input.removeWrites ?? []), ...input.canonicalWrites.map((write) => write.path)],
        trace_paths: input.traceWrites.map((write) => write.path),
      },
    ];

    writeConflictArtifacts(input.cwd, input.stage, conflicts);
    writeStageStatus(input.statusPath, blockedStatus, input.cwd);
    syncRunWorkspaceArtifacts(input.cwd, input.mirrorWorkspace);
    throw new Error('Canonical writeback failed');
  }
}
