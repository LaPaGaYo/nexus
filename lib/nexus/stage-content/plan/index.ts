import { readFileSync } from 'fs';
import type { NexusStageContentPack } from '../types';

function readSection(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').trim();
}

export function createPlanStageContent(): NexusStageContentPack {
  return {
    id: 'nexus-plan-content',
    stage: 'plan',
    sections: {
      overview: readSection('overview.md'),
      checklist: readSection('checklist.md'),
      artifact_contract: readSection('artifact-contract.md'),
      routing: readSection('routing.md'),
    },
  };
}
