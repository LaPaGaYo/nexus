import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { stageConflictMarkdownPath, stageConflictPath } from './artifacts';
import type { CanonicalCommandId, ConflictRecord } from './types';

function writeRepoFile(cwd: string, relativePath: string, content: string): void {
  const absolutePath = join(cwd, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

export function writeConflictArtifacts(
  cwd: string,
  stage: CanonicalCommandId,
  conflicts: ConflictRecord[],
): void {
  for (const conflict of conflicts) {
    writeRepoFile(
      cwd,
      stageConflictPath(stage, conflict.adapter),
      JSON.stringify(conflict, null, 2) + '\n',
    );
    writeRepoFile(
      cwd,
      stageConflictMarkdownPath(stage, conflict.adapter),
      `# Nexus Conflict\n\nKind: ${conflict.kind}\n\nMessage: ${conflict.message}\n`,
    );
  }
}
