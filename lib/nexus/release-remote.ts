import { assertReleaseManifest } from './release-contract';

export const REMOTE_RELEASE_SMOKE_STATUSES = ['ready', 'blocked'] as const;
export type RemoteReleaseSmokeStatus = (typeof REMOTE_RELEASE_SMOKE_STATUSES)[number];

export interface RemoteReleaseSmokeReport {
  schema_version: 1;
  status: RemoteReleaseSmokeStatus;
  tag: string;
  version: string;
  issues: string[];
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
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }
}

function assertRemoteReleaseSmokeStatus(value: unknown): asserts value is RemoteReleaseSmokeStatus {
  if (!REMOTE_RELEASE_SMOKE_STATUSES.includes(value as RemoteReleaseSmokeStatus)) {
    throw new Error(`remote release smoke status must be one of: ${REMOTE_RELEASE_SMOKE_STATUSES.join(', ')}`);
  }
}

function parseGitHubRelease(jsonText: string): { tagName: string; body: string } {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('GitHub Release payload must be an object');
  }

  assertString(parsed.tagName, 'tagName');
  if (typeof parsed.body !== 'string') {
    throw new Error('body must be a string');
  }

  return {
    tagName: parsed.tagName,
    body: parsed.body,
  };
}

export function validateRemoteReleaseSmokeReport(report: unknown): RemoteReleaseSmokeReport {
  if (!isRecord(report)) {
    throw new Error('remote release smoke report must be an object');
  }

  if (report.schema_version !== 1) {
    throw new Error('remote release smoke report schema_version must be 1');
  }

  assertRemoteReleaseSmokeStatus(report.status);
  assertString(report.tag, 'tag');
  assertString(report.version, 'version');
  assertStringArray(report.issues, 'issues');

  return report;
}

export async function buildRemoteReleaseSmokeReport(input: {
  expectedTag: string;
  expectedVersion: string;
  expectedNotesBody: string;
  ghReleaseJson: string;
  releaseManifestText: string;
}): Promise<RemoteReleaseSmokeReport> {
  const issues: string[] = [];

  try {
    const release = parseGitHubRelease(input.ghReleaseJson);
    if (release.tagName !== input.expectedTag) {
      issues.push(`GitHub Release tag ${release.tagName} does not match ${input.expectedTag}`);
    }
    if (release.body.trim() !== input.expectedNotesBody.trim()) {
      issues.push('GitHub Release body does not match local release notes');
    }
  } catch (error) {
    issues.push(`GitHub Release metadata invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const manifest = JSON.parse(input.releaseManifestText) as unknown;
    assertReleaseManifest(manifest);

    if (manifest.tag !== input.expectedTag) {
      issues.push(`release manifest tag ${manifest.tag} does not match ${input.expectedTag}`);
    }
    if (manifest.version !== input.expectedVersion) {
      issues.push(`release manifest version ${manifest.version} does not match ${input.expectedVersion}`);
    }
  } catch (error) {
    issues.push(`release manifest invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  return validateRemoteReleaseSmokeReport({
    schema_version: 1,
    status: issues.length === 0 ? 'ready' : 'blocked',
    tag: input.expectedTag,
    version: input.expectedVersion,
    issues,
  });
}
