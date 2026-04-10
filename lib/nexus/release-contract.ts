import { join } from 'path';

export const RELEASE_MANIFEST_FILE = 'release.json' as const;
export const RELEASE_NOTES_DIR = 'docs/releases' as const;

export const RELEASE_CHANNELS = ['stable'] as const;
export const RESERVED_RELEASE_CHANNELS = ['candidate', 'nightly'] as const;
export const KNOWN_RELEASE_CHANNELS = [...RELEASE_CHANNELS, ...RESERVED_RELEASE_CHANNELS] as const;

export type SupportedReleaseChannel = (typeof RELEASE_CHANNELS)[number];
export type ReleaseChannel = (typeof KNOWN_RELEASE_CHANNELS)[number];

export interface ReleaseBundle {
  type: 'tar.gz';
  url: string;
}

export interface ReleaseCompatibility {
  upgrade_from_min_version: string;
  requires_setup: boolean;
}

export interface ReleaseManifest {
  schema_version: 1;
  product: 'nexus';
  version: string;
  tag: string;
  channel: SupportedReleaseChannel;
  published_at: string;
  release_notes_path: string;
  bundle: ReleaseBundle;
  compatibility: ReleaseCompatibility;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`);
  }
}

export function assertSupportedReleaseChannel(value: unknown, label = 'channel'): asserts value is SupportedReleaseChannel {
  if (!RELEASE_CHANNELS.includes(value as SupportedReleaseChannel)) {
    throw new Error(`${label} must be one of: ${RELEASE_CHANNELS.join(', ')}`);
  }
}

export function assertReleaseManifest(manifest: unknown): asserts manifest is ReleaseManifest {
  if (!isRecord(manifest)) {
    throw new Error('release manifest must be an object');
  }

  if (manifest.schema_version !== 1) {
    throw new Error('release manifest schema_version must be 1');
  }

  if (manifest.product !== 'nexus') {
    throw new Error('release manifest product must be nexus');
  }

  assertString(manifest.version, 'version');
  assertString(manifest.tag, 'tag');
  assertString(manifest.published_at, 'published_at');
  assertString(manifest.release_notes_path, 'release_notes_path');
  assertSupportedReleaseChannel(manifest.channel, 'channel');

  if (!isRecord(manifest.bundle)) {
    throw new Error('bundle must be an object');
  }
  assertString(manifest.bundle.type, 'bundle.type');
  assertString(manifest.bundle.url, 'bundle.url');
  if (manifest.bundle.type !== 'tar.gz') {
    throw new Error('bundle.type must be tar.gz');
  }

  if (!isRecord(manifest.compatibility)) {
    throw new Error('compatibility must be an object');
  }
  assertString(manifest.compatibility.upgrade_from_min_version, 'compatibility.upgrade_from_min_version');
  assertBoolean(manifest.compatibility.requires_setup, 'compatibility.requires_setup');
}

export function assertReleaseManifestConsistency(
  manifest: Pick<ReleaseManifest, 'version' | 'tag' | 'release_notes_path'>,
  expected: { version: string; tag?: string; release_notes_path: string },
): void {
  const expectedTag = expected.tag ?? `v${expected.version}`;

  if (manifest.version !== expected.version) {
    throw new Error(`release manifest version ${manifest.version} does not match expected ${expected.version}`);
  }

  if (manifest.tag !== expectedTag) {
    throw new Error(`release manifest tag ${manifest.tag} does not match expected ${expectedTag}`);
  }

  if (manifest.release_notes_path !== expected.release_notes_path) {
    throw new Error(
      `release manifest release_notes_path ${manifest.release_notes_path} does not match expected ${expected.release_notes_path}`,
    );
  }
}

export function getReleaseManifestPath(rootDir = process.cwd()): string {
  return join(rootDir, RELEASE_MANIFEST_FILE);
}

export function getReleaseNotesPath(dateSegment: string, version: string): string {
  return `${RELEASE_NOTES_DIR}/${dateSegment}-nexus-v${version}.md`;
}
