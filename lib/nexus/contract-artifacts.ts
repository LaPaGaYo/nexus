import type { ArtifactPointer } from './types';

export const PLAN_STATUS_PATH = '.planning/current/plan/status.json';
export const EXECUTION_READINESS_PACKET_PATH = '.planning/current/plan/execution-readiness-packet.md';
export const SPRINT_CONTRACT_PATH = '.planning/current/plan/sprint-contract.md';
export const HANDOFF_STATUS_PATH = '.planning/current/handoff/status.json';
export const GOVERNED_HANDOFF_PATH = '.planning/current/handoff/governed-handoff.md';
export const BUILD_STATUS_PATH = '.planning/current/build/status.json';
export const REVIEW_STATUS_PATH = '.planning/current/review/status.json';

export function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

export function executionContractArtifacts(): ArtifactPointer[] {
  return [
    artifactPointerFor(GOVERNED_HANDOFF_PATH),
    artifactPointerFor(EXECUTION_READINESS_PACKET_PATH),
    artifactPointerFor(SPRINT_CONTRACT_PATH),
  ];
}

export function dedupeArtifactPointers(artifacts: ArtifactPointer[]): ArtifactPointer[] {
  const seen = new Set<string>();
  const deduped: ArtifactPointer[] = [];

  for (const artifact of artifacts) {
    if (seen.has(artifact.path)) {
      continue;
    }

    seen.add(artifact.path);
    deduped.push(artifact);
  }

  return deduped;
}
