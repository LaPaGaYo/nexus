import { getDefaultNexusAdapters } from '../../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../../lib/nexus/adapters/types';

type PartialNexusAdapters = Partial<{
  [K in keyof NexusAdapters]: NexusAdapters[K] extends object ? Partial<NexusAdapters[K]> : NexusAdapters[K];
}>;

export function makeFakeAdapters(overrides: PartialNexusAdapters = {}): NexusAdapters {
  const defaults = getDefaultNexusAdapters();

  return {
    ...defaults,
    ...overrides,
    registry: {
      ...defaults.registry,
      ...(overrides.registry ?? {}),
    },
    pm: {
      ...defaults.pm,
      ...(overrides.pm ?? {}),
    },
    gsd: {
      ...defaults.gsd,
      ...(overrides.gsd ?? {}),
    },
    superpowers: {
      ...defaults.superpowers,
      ...(overrides.superpowers ?? {}),
    },
    ccb: {
      ...defaults.ccb,
      ...(overrides.ccb ?? {}),
    },
  };
}
