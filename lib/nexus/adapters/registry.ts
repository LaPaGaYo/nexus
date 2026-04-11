import { createDefaultPmAdapter } from './pm';
import { createDefaultGsdAdapter } from './gsd';
import { createDefaultCcbAdapter, createRuntimeCcbAdapter } from './ccb';
import { createDefaultLocalAdapter, createRuntimeLocalAdapter } from './local';
import { createDefaultSuperpowersAdapter } from './superpowers';
import type { AdapterRegistryShape, NexusAdapters } from './types';

const DEFAULT_REGISTRY: AdapterRegistryShape = {
  discover: { pm: 'active' },
  frame: { pm: 'active' },
  plan: { gsd: 'active' },
  handoff: { ccb: 'active', local: 'active' },
  build: { superpowers: 'active', ccb: 'active', local: 'active' },
  review: { superpowers: 'active', ccb: 'active', local: 'active' },
  qa: { ccb: 'active', local: 'active' },
  ship: { superpowers: 'active' },
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
    qa: { ...DEFAULT_REGISTRY.qa },
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
    local: createDefaultLocalAdapter(),
  };
}

export function getRuntimeNexusAdapters(): NexusAdapters {
  return {
    registry: getDefaultAdapterRegistry(),
    pm: createDefaultPmAdapter(),
    gsd: createDefaultGsdAdapter(),
    superpowers: createDefaultSuperpowersAdapter(),
    ccb: createRuntimeCcbAdapter(),
    local: createRuntimeLocalAdapter(),
  };
}
