export const UPSTREAM_NAMES = ['pm-skills', 'gsd', 'superpowers', 'claude-code-bridge'] as const;
export type UpstreamName = (typeof UPSTREAM_NAMES)[number];

export const UPSTREAM_REFRESH_STATUSES = ['unchecked', 'up_to_date', 'behind', 'refresh_candidate'] as const;
export type UpstreamRefreshStatus = (typeof UPSTREAM_REFRESH_STATUSES)[number];

export const UPSTREAM_ABSORPTION_DECISIONS = ['ignore', 'defer', 'absorb_partial', 'absorb_full', 'reject'] as const;
export type UpstreamAbsorptionDecision = (typeof UPSTREAM_ABSORPTION_DECISIONS)[number];

export const UPSTREAM_BOOTSTRAP_STATES = ['bootstrap', 'checked'] as const;
export type UpstreamBootstrapState = (typeof UPSTREAM_BOOTSTRAP_STATES)[number];

export interface UpstreamMaintenanceDefinition {
  name: UpstreamName;
  repo_url: string;
  imported_path: string;
  inventory_path: string;
  pinned_commit: string;
  active_absorbed_capabilities: readonly string[];
}

export interface UpstreamMaintenanceRecord {
  name: UpstreamName;
  bootstrap_state: UpstreamBootstrapState;
  repo_url: string;
  imported_path: string;
  pinned_commit: string;
  last_checked_commit: string | null;
  last_checked_at: string | null;
  behind_count: number | null;
  refresh_status: UpstreamRefreshStatus;
  last_refresh_candidate_at: string | null;
  last_absorption_decision: UpstreamAbsorptionDecision | null;
  active_absorbed_capabilities: readonly string[];
  notes: string;
}

export interface UpstreamMaintenanceLock {
  schema_version: 1;
  updated_at: string;
  upstreams: UpstreamMaintenanceRecord[];
}

const UPSTREAM_MAINTENANCE_METADATA: Record<
  UpstreamName,
  {
    repo_url: string;
    imported_path: string;
    inventory_path: string;
    pinned_commit: string;
    active_absorbed_capabilities: readonly string[];
  }
> = {
  'pm-skills': {
    repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
    imported_path: 'upstream/pm-skills',
    inventory_path: 'upstream-notes/pm-skills-inventory.md',
    pinned_commit: '4aa4196c14873b84f5af7316e7f66328cb6dee4c',
    active_absorbed_capabilities: ['pm-discover', 'pm-frame'],
  },
  gsd: {
    repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    imported_path: 'upstream/gsd',
    inventory_path: 'upstream-notes/gsd-inventory.md',
    pinned_commit: 'caf337508fe9c84f4d1a0edb423b76b83f256e91',
    active_absorbed_capabilities: ['gsd-plan', 'gsd-closeout'],
  },
  superpowers: {
    repo_url: 'https://github.com/obra/superpowers.git',
    imported_path: 'upstream/superpowers',
    inventory_path: 'upstream-notes/superpowers-inventory.md',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    active_absorbed_capabilities: [
      'superpowers-build-discipline',
      'superpowers-build-verification',
      'superpowers-review-discipline',
      'superpowers-ship-discipline',
    ],
  },
  'claude-code-bridge': {
    repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    imported_path: 'upstream/claude-code-bridge',
    inventory_path: 'upstream-notes/ccb-inventory.md',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    active_absorbed_capabilities: [
      'ccb-routing',
      'ccb-execution',
      'ccb-review-codex',
      'ccb-review-gemini',
      'ccb-qa',
    ],
  },
};

function createDefinition(name: UpstreamName, inventory_path: string): UpstreamMaintenanceDefinition {
  const metadata = UPSTREAM_MAINTENANCE_METADATA[name];

  return {
    name,
    repo_url: metadata.repo_url,
    imported_path: metadata.imported_path,
    inventory_path,
    pinned_commit: metadata.pinned_commit,
    active_absorbed_capabilities: [...metadata.active_absorbed_capabilities],
  };
}

export const UPSTREAM_MAINTENANCE_UPSTREAMS = [
  createDefinition('pm-skills', 'upstream-notes/pm-skills-inventory.md'),
  createDefinition('gsd', 'upstream-notes/gsd-inventory.md'),
  createDefinition('superpowers', 'upstream-notes/superpowers-inventory.md'),
  createDefinition('claude-code-bridge', 'upstream-notes/ccb-inventory.md'),
] as const;

const UPSTREAM_BY_NAME: Record<UpstreamName, UpstreamMaintenanceDefinition> = Object.fromEntries(
  UPSTREAM_MAINTENANCE_UPSTREAMS.map((upstream) => [upstream.name, upstream]),
) as Record<UpstreamName, UpstreamMaintenanceDefinition>;

export function getUpstreamMaintenanceDefinition(name: UpstreamName): UpstreamMaintenanceDefinition {
  return UPSTREAM_BY_NAME[name];
}

export function getUpstreamInventoryPath(name: UpstreamName): string {
  return getUpstreamMaintenanceDefinition(name).inventory_path;
}

export function getUpstreamImportedPath(name: UpstreamName): string {
  return getUpstreamMaintenanceDefinition(name).imported_path;
}

export function getUpstreamRepoUrl(name: UpstreamName): string {
  return getUpstreamMaintenanceDefinition(name).repo_url;
}

export function getUpstreamPinnedCommit(name: UpstreamName): string {
  return getUpstreamMaintenanceDefinition(name).pinned_commit;
}

export function createInitialUpstreamLock(frozenAt = '2026-04-09T00:00:00.000Z'): UpstreamMaintenanceLock {
  return {
    schema_version: 1,
    updated_at: frozenAt,
    upstreams: UPSTREAM_MAINTENANCE_UPSTREAMS.map((upstream) => ({
      name: upstream.name,
      bootstrap_state: 'bootstrap',
      repo_url: upstream.repo_url,
      imported_path: upstream.imported_path,
      pinned_commit: upstream.pinned_commit,
      last_checked_commit: null,
      last_checked_at: null,
      behind_count: null,
      refresh_status: 'unchecked',
      last_refresh_candidate_at: null,
      last_absorption_decision: null,
      active_absorbed_capabilities: [...upstream.active_absorbed_capabilities],
      notes: 'Bootstrap snapshot only; imported upstream source material remains non-authoritative until checked.',
    })),
  };
}
