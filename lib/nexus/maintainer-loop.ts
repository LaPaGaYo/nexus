import type { UpstreamMaintenanceLock } from './upstream-maintenance';

export const MAINTAINER_LOOP_STATUSES = ['ready', 'action_required', 'blocked'] as const;
export type MaintainerLoopStatus = (typeof MAINTAINER_LOOP_STATUSES)[number];

export const MAINTAINER_NEXT_ACTIONS = [
  'none',
  'review_refresh_candidate',
  'refresh_upstream',
  'prepare_release',
  'publish_release',
  'repair_published_release',
] as const;
export type MaintainerNextAction = (typeof MAINTAINER_NEXT_ACTIONS)[number];

export const MAINTAINER_RELEASE_STATUSES = ['ready', 'blocked', 'unknown'] as const;
export type MaintainerReleaseStatus = (typeof MAINTAINER_RELEASE_STATUSES)[number];

export interface MaintainerLoopReport {
  schema_version: 1;
  generated_at: string;
  status: MaintainerLoopStatus;
  next_action: MaintainerNextAction;
  summary: string;
  issues: string[];
  recommendations: string[];
  upstreams: {
    pending_refresh_candidates: string[];
    behind_upstreams: string[];
  };
  release: {
    current_version: string;
    current_tag: string;
    preflight_status: Exclude<MaintainerReleaseStatus, 'unknown'>;
    remote_smoke_status: MaintainerReleaseStatus;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }
}

function assertMaintainerLoopStatus(value: unknown, label = 'status'): asserts value is MaintainerLoopStatus {
  if (!MAINTAINER_LOOP_STATUSES.includes(value as MaintainerLoopStatus)) {
    throw new Error(`${label} must be one of: ${MAINTAINER_LOOP_STATUSES.join(', ')}`);
  }
}

function assertMaintainerNextAction(value: unknown, label = 'next_action'): asserts value is MaintainerNextAction {
  if (!MAINTAINER_NEXT_ACTIONS.includes(value as MaintainerNextAction)) {
    throw new Error(`${label} must be one of: ${MAINTAINER_NEXT_ACTIONS.join(', ')}`);
  }
}

function assertMaintainerReleaseStatus(value: unknown, label = 'release status'): asserts value is MaintainerReleaseStatus {
  if (!MAINTAINER_RELEASE_STATUSES.includes(value as MaintainerReleaseStatus)) {
    throw new Error(`${label} must be one of: ${MAINTAINER_RELEASE_STATUSES.join(', ')}`);
  }
}

export function validateMaintainerLoopReport(report: unknown): MaintainerLoopReport {
  if (!isRecord(report)) {
    throw new Error('maintainer loop report must be an object');
  }

  if (report.schema_version !== 1) {
    throw new Error('maintainer loop report schema_version must be 1');
  }

  assertString(report.generated_at, 'generated_at');
  assertMaintainerLoopStatus(report.status);
  assertMaintainerNextAction(report.next_action);
  assertString(report.summary, 'summary');
  assertStringArray(report.issues, 'issues');
  assertStringArray(report.recommendations, 'recommendations');

  if (!isRecord(report.upstreams)) {
    throw new Error('upstreams must be an object');
  }
  assertStringArray(report.upstreams.pending_refresh_candidates, 'upstreams.pending_refresh_candidates');
  assertStringArray(report.upstreams.behind_upstreams, 'upstreams.behind_upstreams');

  if (!isRecord(report.release)) {
    throw new Error('release must be an object');
  }
  assertString(report.release.current_version, 'release.current_version');
  assertString(report.release.current_tag, 'release.current_tag');
  assertMaintainerReleaseStatus(report.release.preflight_status, 'release.preflight_status');
  assertMaintainerReleaseStatus(report.release.remote_smoke_status, 'release.remote_smoke_status');

  if (report.release.preflight_status === 'unknown') {
    throw new Error('release.preflight_status must be ready or blocked');
  }

  return report as MaintainerLoopReport;
}

export function buildMaintainerLoopReport(input: {
  generatedAt: string;
  upstreams: MaintainerLoopReport['upstreams'];
  release: MaintainerLoopReport['release'];
  local_release_drift?: boolean;
  published_release_missing?: boolean;
}): MaintainerLoopReport {
  if (input.release.remote_smoke_status === 'blocked') {
    return validateMaintainerLoopReport({
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'blocked',
      next_action: 'repair_published_release',
      summary: 'Published release verification is blocked.',
      issues: ['Published release smoke failed.'],
      recommendations: ['Run ./bin/nexus-release-smoke and repair the published release mismatch.'],
      upstreams: input.upstreams,
      release: input.release,
    });
  }

  if (input.upstreams.pending_refresh_candidates.length > 0) {
    return validateMaintainerLoopReport({
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'action_required',
      next_action: 'review_refresh_candidate',
      summary: `${input.upstreams.pending_refresh_candidates.length} upstream refresh candidate needs maintainer review.`,
      issues: input.upstreams.pending_refresh_candidates.map((name) => `${name} refresh candidate pending review`),
      recommendations: input.upstreams.pending_refresh_candidates.map(
        (name) => `Review upstream-notes/refresh-candidates/${name}.md`,
      ),
      upstreams: input.upstreams,
      release: input.release,
    });
  }

  if (input.upstreams.behind_upstreams.length > 0) {
    return validateMaintainerLoopReport({
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'action_required',
      next_action: 'refresh_upstream',
      summary: `${input.upstreams.behind_upstreams.length} upstream snapshot is behind the pinned Nexus import.`,
      issues: input.upstreams.behind_upstreams.map((name) => `${name} is behind the pinned imported snapshot`),
      recommendations: ['Run bun run upstream:refresh -- <name> for the reviewed upstream.'],
      upstreams: input.upstreams,
      release: input.release,
    });
  }

  if (input.local_release_drift === true && input.release.preflight_status === 'blocked') {
    return validateMaintainerLoopReport({
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'action_required',
      next_action: 'prepare_release',
      summary: 'Local Nexus release drift exists, but release preflight is still blocked.',
      issues: ['Local Nexus-owned changes exist without a release-ready publish state.'],
      recommendations: ['Run ./bin/nexus-release-preflight and align the local release markers before publishing.'],
      upstreams: input.upstreams,
      release: input.release,
    });
  }

  if (input.local_release_drift === true && input.release.preflight_status === 'ready' && input.published_release_missing) {
    return validateMaintainerLoopReport({
      schema_version: 1,
      generated_at: input.generatedAt,
      status: 'action_required',
      next_action: 'publish_release',
      summary: 'A release-ready Nexus version is not published yet.',
      issues: ['Local release markers are ready, but the matching published release is missing.'],
      recommendations: ['Publish the Git tag and GitHub Release after re-running ./bin/nexus-release-preflight.'],
      upstreams: input.upstreams,
      release: input.release,
    });
  }

  return validateMaintainerLoopReport({
    schema_version: 1,
    generated_at: input.generatedAt,
    status: 'ready',
    next_action: 'none',
    summary: 'No maintainer action is currently required.',
    issues: [],
    recommendations: [],
    upstreams: input.upstreams,
    release: input.release,
  });
}

export function summarizeUpstreamMaintenance(
  lock: Pick<UpstreamMaintenanceLock, 'upstreams'>,
): MaintainerLoopReport['upstreams'] {
  return {
    pending_refresh_candidates: lock.upstreams
      .filter((record) => record.refresh_status === 'refresh_candidate' && record.last_refresh_candidate_at !== null)
      .map((record) => record.name),
    behind_upstreams: lock.upstreams
      .filter((record) => record.refresh_status === 'behind' && (record.behind_count ?? 0) > 0)
      .map((record) => record.name),
  };
}

export function buildMaintainerReleaseState(input: {
  currentVersion: string;
  currentTag: string;
  preflightStatus: Exclude<MaintainerReleaseStatus, 'unknown'>;
  remoteSmokeStatus: MaintainerReleaseStatus;
}): MaintainerLoopReport['release'] {
  return {
    current_version: input.currentVersion,
    current_tag: input.currentTag,
    preflight_status: input.preflightStatus,
    remote_smoke_status: input.remoteSmokeStatus,
  };
}

export function renderMaintainerLoopMarkdown(report: MaintainerLoopReport): string {
  const lines = [
    '# Nexus Maintainer Status',
    '',
    `Generated: \`${report.generated_at}\``,
    '',
    `- Status: \`${report.status}\``,
    `- Next action: \`${report.next_action}\``,
    `- Summary: ${report.summary}`,
    `- Current version: \`${report.release.current_version}\``,
    `- Current tag: \`${report.release.current_tag}\``,
    `- Release preflight: \`${report.release.preflight_status}\``,
    `- Remote release smoke: \`${report.release.remote_smoke_status}\``,
    '',
    '## Upstreams',
    '',
    `- Pending refresh candidates: ${
      report.upstreams.pending_refresh_candidates.length > 0
        ? report.upstreams.pending_refresh_candidates.map((name) => `\`${name}\``).join(', ')
        : 'none'
    }`,
    `- Behind upstreams: ${
      report.upstreams.behind_upstreams.length > 0
        ? report.upstreams.behind_upstreams.map((name) => `\`${name}\``).join(', ')
        : 'none'
    }`,
  ];

  if (report.issues.length > 0) {
    lines.push('', '## Issues', '');
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  if (report.recommendations.length > 0) {
    lines.push('', '## Recommendations', '');
    for (const recommendation of report.recommendations) {
      lines.push(`- ${recommendation}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function serializeMaintainerLoopReport(report: MaintainerLoopReport): string {
  return `${JSON.stringify(validateMaintainerLoopReport(report), null, 2)}\n`;
}

export function reportsMatchExceptGeneratedAt(left: MaintainerLoopReport, right: MaintainerLoopReport): boolean {
  const normalizedLeft = {
    ...validateMaintainerLoopReport(left),
    generated_at: '__ignored__',
  };
  const normalizedRight = {
    ...validateMaintainerLoopReport(right),
    generated_at: '__ignored__',
  };

  return serializeMaintainerLoopReport(normalizedLeft) === serializeMaintainerLoopReport(normalizedRight);
}
