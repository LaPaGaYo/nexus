import { readFileSync } from 'fs';
import type { NexusStageContentPack } from '../types';

function readSection(name: string): string {
  return readFileSync(new URL(`./${name}`, import.meta.url), 'utf8').trim();
}

export function createShipStageContent(): NexusStageContentPack {
  return {
    id: 'nexus-ship-content',
    stage: 'ship',
    sections: {
      overview: readSection('overview.md'),
      checklist: readSection('checklist.md'),
      artifact_contract: readSection('artifact-contract.md'),
      routing: readSection('routing.md'),
    },
  };
}
