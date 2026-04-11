export const UPSTREAM_NAMES = ['pm-skills', 'gsd', 'superpowers', 'claude-code-bridge'] as const;
export type UpstreamName = (typeof UPSTREAM_NAMES)[number];

export const UPSTREAM_REFRESH_STATUSES = ['unchecked', 'up_to_date', 'behind', 'refresh_candidate'] as const;
export type UpstreamRefreshStatus = (typeof UPSTREAM_REFRESH_STATUSES)[number];

export const UPSTREAM_ABSORPTION_DECISIONS = ['ignore', 'defer', 'absorb_partial', 'absorb_full', 'reject'] as const;
export type UpstreamAbsorptionDecision = (typeof UPSTREAM_ABSORPTION_DECISIONS)[number];

export const UPSTREAM_BOOTSTRAP_STATES = ['bootstrap', 'checked'] as const;
export type UpstreamBootstrapState = (typeof UPSTREAM_BOOTSTRAP_STATES)[number];

export const UPSTREAM_TRIAGE_RECOMMENDATIONS = ['ignore', 'defer', 'review', 'refresh_now'] as const;
export type UpstreamTriageRecommendation = (typeof UPSTREAM_TRIAGE_RECOMMENDATIONS)[number];

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

export interface UpstreamCheckResult {
  name: UpstreamName;
  repo_url: string;
  pinned_commit: string;
  latest_checked_commit: string | null;
  behind_count: number | null;
  active_absorbed_capabilities: readonly string[];
  triage_recommendation: UpstreamTriageRecommendation;
  remote_error: string | null;
}

function hasPendingRefreshCandidate(record: UpstreamMaintenanceRecord): boolean {
  return record.refresh_status === 'refresh_candidate' && record.last_refresh_candidate_at !== null;
}

function resolveRefreshStatusForCheck(
  record: UpstreamMaintenanceRecord,
  latestCheckedCommit: string | null,
  behindCount: number | null,
): UpstreamRefreshStatus {
  if (hasPendingRefreshCandidate(record)) {
    return 'refresh_candidate';
  }

  if (latestCheckedCommit === null) {
    return 'unchecked';
  }

  if (behindCount === null) {
    return 'unchecked';
  }

  return behindCount === 0 ? 'up_to_date' : 'behind';
}

function buildCheckNotes(
  record: UpstreamMaintenanceRecord,
  result: UpstreamCheckResult,
  latestCheckedCommit: string | null,
  retainedLastKnownSnapshot: boolean,
): string {
  if (hasPendingRefreshCandidate(record)) {
    if (result.remote_error) {
      return 'Refresh candidate still pending maintainer review; latest upstream check failed, so Nexus retained the last known checked snapshot. Imported upstream source material remains non-authoritative until review.';
    }

    if (retainedLastKnownSnapshot) {
      return 'Refresh candidate still pending maintainer review; latest upstream check could not verify ancestry for the new remote snapshot, so Nexus retained the last known checked snapshot. Imported upstream source material remains non-authoritative until review.';
    }

    return 'Refresh candidate still pending maintainer review; latest upstream check updated freshness metadata while imported upstream source material remains non-authoritative until review.';
  }

  if (result.remote_error) {
    return latestCheckedCommit === null
      ? 'Checked snapshot unavailable; latest upstream check failed and imported upstream source material remains non-authoritative until a later successful check.'
      : 'Latest upstream check failed, so Nexus retained the last known checked snapshot. Imported upstream source material remains non-authoritative until refreshed.';
  }

  if (result.behind_count === null) {
    if (retainedLastKnownSnapshot) {
      return 'Latest upstream check could not verify ancestry for the new remote snapshot, so Nexus retained the last known checked snapshot. Imported upstream source material remains non-authoritative until refresh review.';
    }

    return 'Checked snapshot with unresolved ancestry; imported upstream source material remains non-authoritative until refresh review.';
  }

  return 'Checked snapshot; imported upstream source material remains non-authoritative until refreshed.';
}

export interface UpstreamMaintenanceCheckRecord {
  name: UpstreamName;
  repo_url: string;
  pinned_commit: string;
  active_absorbed_capabilities: readonly string[];
}

export interface UpstreamMaintenanceAlignedEntry {
  definition: UpstreamMaintenanceDefinition;
  record: UpstreamMaintenanceRecord;
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
    pinned_commit: '295a5726dc6139f383acfc0dbef6b88d4ec94dfa',
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

export function getUpstreamCheckRecord(name: UpstreamName): UpstreamMaintenanceCheckRecord {
  const definition = getUpstreamMaintenanceDefinition(name);

  return {
    name: definition.name,
    repo_url: definition.repo_url,
    pinned_commit: definition.pinned_commit,
    active_absorbed_capabilities: [...definition.active_absorbed_capabilities],
  };
}

function compareStringArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function alignUpstreamLockWithContract(lock: UpstreamMaintenanceLock): UpstreamMaintenanceAlignedEntry[] {
  const byName = new Map(lock.upstreams.map((record) => [record.name, record]));
  const lockNames = new Set(lock.upstreams.map((record) => record.name));

  if (lock.upstreams.length !== UPSTREAM_MAINTENANCE_UPSTREAMS.length) {
    throw new Error(
      `Upstream lock contains ${lock.upstreams.length} rows but the maintenance contract defines ${UPSTREAM_MAINTENANCE_UPSTREAMS.length}`,
    );
  }

  for (const definition of UPSTREAM_MAINTENANCE_UPSTREAMS) {
    const record = byName.get(definition.name);
    if (!record) {
      throw new Error(`Upstream lock is missing required row for ${definition.name}`);
    }

    if (!lockNames.has(definition.name)) {
      throw new Error(`Upstream lock is missing required row for ${definition.name}`);
    }

    if (record.repo_url !== definition.repo_url) {
      throw new Error(`Upstream lock repo_url mismatch for ${definition.name}`);
    }

    if (record.imported_path !== definition.imported_path) {
      throw new Error(`Upstream lock imported_path mismatch for ${definition.name}`);
    }

    if (!compareStringArrays(record.active_absorbed_capabilities, definition.active_absorbed_capabilities)) {
      throw new Error(`Upstream lock active_absorbed_capabilities mismatch for ${definition.name}`);
    }
  }

  for (const record of lock.upstreams) {
    if (!UPSTREAM_NAMES.includes(record.name)) {
      throw new Error(`Upstream lock contains unsupported upstream ${record.name}`);
    }
  }

  return UPSTREAM_MAINTENANCE_UPSTREAMS.map((definition) => {
    const record = byName.get(definition.name);
    if (!record) {
      throw new Error(`Upstream lock is missing required row for ${definition.name}`);
    }

    return { definition, record };
  });
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

export function parseUpstreamMaintenanceLock(content: string): UpstreamMaintenanceLock {
  return JSON.parse(content) as UpstreamMaintenanceLock;
}

export function serializeUpstreamMaintenanceLock(lock: UpstreamMaintenanceLock): string {
  return `${JSON.stringify(lock, null, 2)}\n`;
}

export function resolveUpstreamTriageRecommendation(
  result: Pick<UpstreamCheckResult, 'latest_checked_commit' | 'behind_count'>,
): UpstreamTriageRecommendation {
  if (result.latest_checked_commit === null) {
    return 'defer';
  }

  if (result.behind_count === null) {
    return 'defer';
  }

  if (result.behind_count === 0) {
    return 'ignore';
  }

  return result.behind_count > 1 ? 'refresh_now' : 'review';
}

export function buildUpstreamCheckResult(
  upstream: UpstreamMaintenanceDefinition,
  latest_checked_commit: string | null,
  behind_count: number | null,
  remote_error: string | null = null,
): UpstreamCheckResult {
  return {
    name: upstream.name,
    repo_url: upstream.repo_url,
    pinned_commit: upstream.pinned_commit,
    latest_checked_commit,
    behind_count,
    active_absorbed_capabilities: [...upstream.active_absorbed_capabilities],
    triage_recommendation: resolveUpstreamTriageRecommendation({
      latest_checked_commit,
      behind_count,
    }),
    remote_error,
  };
}

export function buildUpstreamCheckResultFromRecord(
  record: UpstreamMaintenanceCheckRecord,
  latest_checked_commit: string | null,
  behind_count: number | null,
  remote_error: string | null = null,
): UpstreamCheckResult {
  return {
    name: record.name,
    repo_url: record.repo_url,
    pinned_commit: record.pinned_commit,
    latest_checked_commit,
    behind_count,
    active_absorbed_capabilities: [...record.active_absorbed_capabilities],
    triage_recommendation: resolveUpstreamTriageRecommendation({
      latest_checked_commit,
      behind_count,
    }),
    remote_error,
  };
}

export function applyUpstreamCheckResults(
  lock: UpstreamMaintenanceLock,
  results: UpstreamCheckResult[],
  checkedAt: string,
): UpstreamMaintenanceLock {
  const resultsByName = new Map(results.map((result) => [result.name, result]));

  return {
    ...lock,
    updated_at: checkedAt,
    upstreams: lock.upstreams.map((record) => {
      const result = resultsByName.get(record.name);

      if (!result) {
        return record;
      }

      const unresolvedAncestry = result.latest_checked_commit !== null && result.behind_count === null;
      const retainedLastKnownSnapshot =
        record.last_checked_commit !== null && (result.remote_error !== null || unresolvedAncestry);

      const latestCheckedCommit = retainedLastKnownSnapshot
        ? record.last_checked_commit
        : result.latest_checked_commit ?? record.last_checked_commit;
      const behindCount = retainedLastKnownSnapshot
        ? record.behind_count
        : result.behind_count ?? record.behind_count;

      return {
        ...record,
        bootstrap_state: 'checked',
        last_checked_commit: latestCheckedCommit,
        last_checked_at: checkedAt,
        behind_count: behindCount,
        refresh_status: resolveRefreshStatusForCheck(record, latestCheckedCommit, behindCount),
        notes: buildCheckNotes(record, result, latestCheckedCommit, retainedLastKnownSnapshot),
      };
    }),
  };
}

function formatMaybeCommit(commit: string | null): string {
  return commit ? `\`${commit}\`` : 'unknown';
}

function formatMaybeCount(count: number | null): string {
  return count === null ? 'unknown' : String(count);
}

function formatCapabilities(capabilities: readonly string[]): string {
  return capabilities.length === 0 ? 'none' : capabilities.map((capability) => `\`${capability}\``).join(', ');
}

export function renderUpstreamCheckStatus(lock: UpstreamMaintenanceLock, results: UpstreamCheckResult[], checkedAt: string): string {
  const resultsByName = new Map(results.map((result) => [result.name, result]));
  const lines: string[] = [];

  lines.push('# Upstream Update Status');
  lines.push('');
  lines.push(`Last checked: \`${checkedAt}\``);
  lines.push('');
  lines.push('- Maintenance truth: `upstream-notes/upstream-lock.json`');
  lines.push('- Human-readable freshness summary: `upstream-notes/update-status.md`');
  lines.push('- Imported upstreams remain source material only');
  lines.push('');
  lines.push('| upstream | pinned_commit | latest_checked_commit | behind_count | active_absorbed_capabilities | triage_recommendation |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  for (const record of lock.upstreams) {
    const result = resultsByName.get(record.name);
    const latest = result ? result.latest_checked_commit : record.last_checked_commit;
    const behindCount = result ? result.behind_count : record.behind_count;
    const capabilities = result ? result.active_absorbed_capabilities : record.active_absorbed_capabilities;
    const triage = result ? result.triage_recommendation : resolveUpstreamTriageRecommendation({
      latest_checked_commit: latest,
      behind_count: behindCount,
    });

    lines.push(
      `| ${record.name} | ${formatMaybeCommit(record.pinned_commit)} | ${formatMaybeCommit(latest)} | ${formatMaybeCount(behindCount)} | ${formatCapabilities(capabilities)} | \`${triage}\` |`,
    );
  }

  const pendingCandidates = lock.upstreams.filter((record) => hasPendingRefreshCandidate(record));
  if (pendingCandidates.length > 0) {
    lines.push('');
    lines.push('## Pending Refresh Candidates');
    lines.push('');
    for (const record of pendingCandidates) {
      lines.push(
        `- \`${record.name}\` pending maintainer review since \`${record.last_refresh_candidate_at}\` via \`upstream-notes/refresh-candidates/${record.name}.md\``,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}
