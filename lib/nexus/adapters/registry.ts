import { createDefaultDiscoveryAdapter, createRuntimeDiscoveryAdapter } from './discovery';
import { createDefaultPlanningAdapter, createRuntimePlanningAdapter } from './planning';
import { createDefaultCcbAdapter, createRuntimeCcbAdapter } from './ccb';
import { createDefaultLocalAdapter, createRuntimeLocalAdapter } from './local';
import { createDefaultExecutionAdapter, createRuntimeExecutionAdapter } from './execution';
import type { AdapterRegistryShape, NexusAdapters } from './types';

const DEFAULT_REGISTRY: AdapterRegistryShape = {
  discover: { discovery: 'active' },
  frame: { discovery: 'active' },
  plan: { planning: 'active' },
  handoff: { ccb: 'active', local: 'active' },
  build: { execution: 'active', ccb: 'active', local: 'active' },
  review: { execution: 'active', ccb: 'active', local: 'active' },
  qa: { ccb: 'active', local: 'active' },
  ship: { execution: 'active', local: 'active' },
  closeout: { planning: 'active' },
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
    discovery: createDefaultDiscoveryAdapter(),
    planning: createDefaultPlanningAdapter(),
    execution: createDefaultExecutionAdapter(),
    ccb: createDefaultCcbAdapter(),
    local: createDefaultLocalAdapter(),
  };
}

export function getRuntimeNexusAdapters(): NexusAdapters {
  return {
    registry: getDefaultAdapterRegistry(),
    discovery: createRuntimeDiscoveryAdapter(),
    planning: createRuntimePlanningAdapter(),
    execution: createRuntimeExecutionAdapter(),
    ccb: createRuntimeCcbAdapter(),
    local: createRuntimeLocalAdapter(),
  };
}
