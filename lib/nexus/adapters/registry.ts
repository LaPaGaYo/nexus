import { createDefaultPmAdapter } from './pm';
import type { AdapterRegistryShape, AdapterResult, CcbAdapter, GsdAdapter, NexusAdapters, SuperpowersAdapter } from './types';

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

function inactiveResult(adapter_id: string): AdapterResult<null> {
  return {
    adapter_id,
    outcome: 'blocked',
    raw_output: null,
    requested_route: null,
    actual_route: null,
    notices: ['Adapter invoked before seam implementation'],
    conflict_candidates: [],
  };
}

function createDefaultGsdAdapter(): GsdAdapter {
  return {
    plan: async () => inactiveResult('gsd'),
    closeout: async () => inactiveResult('gsd'),
  };
}

function createDefaultSuperpowersAdapter(): SuperpowersAdapter {
  return {
    build_discipline: async () => inactiveResult('superpowers'),
    review_discipline: async () => inactiveResult('superpowers'),
    ship_discipline: async () => inactiveResult('superpowers'),
  };
}

function createDefaultCcbAdapter(): CcbAdapter {
  return {
    resolve_route: async () => inactiveResult('ccb'),
    execute_generator: async () => inactiveResult('ccb'),
    execute_audit_a: async () => inactiveResult('ccb'),
    execute_audit_b: async () => inactiveResult('ccb'),
  };
}

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
