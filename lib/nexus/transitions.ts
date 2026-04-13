import { CANONICAL_MANIFEST } from './command-manifest';
import type { CanonicalCommandId } from './types';

const TRANSITION_RULES: Record<CanonicalCommandId, CanonicalCommandId[]> = {
  discover: ['frame'],
  frame: ['plan'],
  plan: ['handoff'],
  handoff: ['handoff', 'build'],
  build: ['review'],
  review: ['handoff', 'build', 'review', 'qa', 'ship', 'closeout'],
  qa: ['ship', 'closeout'],
  ship: ['closeout'],
  closeout: [],
};

for (const [stage, nextStages] of Object.entries(TRANSITION_RULES) as Array<
  [CanonicalCommandId, CanonicalCommandId[]]
>) {
  for (const nextStage of nextStages) {
    if (!CANONICAL_MANIFEST[nextStage].legal_predecessors.includes(stage)) {
      throw new Error(`Transition rule mismatch: ${stage} -> ${nextStage}`);
    }
  }
}

export function getAllowedNextStages(stage: CanonicalCommandId): CanonicalCommandId[] {
  return [...TRANSITION_RULES[stage]];
}

export function assertLegalTransition(from: CanonicalCommandId, to: CanonicalCommandId): void {
  if (!getAllowedNextStages(from).includes(to)) {
    throw new Error(`Illegal Nexus transition: ${from} -> ${to}`);
  }
}
