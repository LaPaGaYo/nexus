import { createDefaultPmAdapter } from './pm';
import { createDefaultGsdAdapter } from './gsd';
import { createDefaultCcbAdapter } from './ccb';
import { createDefaultSuperpowersAdapter } from './superpowers';
import type { AdapterRegistryShape, NexusAdapters } from './types';

const DEFAULT_REGISTRY: AdapterRegistryShape = {
  discover: { pm: 'active' },
  frame: { pm: 'active' },
  plan: { gsd: 'active' },
  handoff: { ccb: 'active' },
  build: { superpowers: 'active', ccb: 'active' },
  review: { superpowers: 'reserved_future', ccb: 'reserved_future' },
  ship: { superpowers: 'reserved_future' },
  closeout: { gsd: 'active' },
};

export function getDefaultAdapterRegistry(): AdapterRegistryShape {
  return {
    discover: { ...DEFAULT_REGISTRY.discover },
    frame: { ...DEFAULT_REGISTRY.frame },
    plan: { ...DEFAULT_REGISTRY.plan },
    handoff: { ...DEFAULT_REGISTRY.handoff },
    build: { ...DEFAULT_REGISTRY.build },
    review: { ...DEFAULT_REGISTRY.review },
    ship: { ...DEFAULT_REGISTRY.ship },
    closeout: { ...DEFAULT_REGISTRY.closeout },
  };
}

export function getDefaultNexusAdapters(): NexusAdapters {
  return {
    registry: getDefaultAdapterRegistry(),
    pm: createDefaultPmAdapter(),
    gsd: createDefaultGsdAdapter(),
    superpowers: createDefaultSuperpowersAdapter(),
    ccb: createDefaultCcbAdapter(),
  };
}
