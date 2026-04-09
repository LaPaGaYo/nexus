import { readFileSync } from 'fs';
import type { NexusStageContentPack } from '../types';

function readSection(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').trim();
}

export function createBuildStageContent(): NexusStageContentPack {
  return {
    id: 'nexus-build-content',
    stage: 'build',
    sections: {
      overview: readSection('overview.md'),
      checklist: readSection('checklist.md'),
      artifact_contract: readSection('artifact-contract.md'),
      routing: readSection('routing.md'),
    },
  };
}
