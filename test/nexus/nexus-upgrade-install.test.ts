import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { buildManagedReleaseInstallMetadata, readInstallMetadata } from '../../lib/nexus/install-metadata';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync, existsSync, readdirSync, symlinkSync, statSync } from 'fs';
import { basename, dirname, join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-upgrade-install');

let installDir: string;
let stateDir: string;
let fixtureDir: string;

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeExecutable(path: string, contents: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, { mode: 0o755 });
  chmodSync(path, 0o755);
}

function setupCurrentInstall(version: string) {
  writeFileSync(join(installDir, 'VERSION'), `${version}\n`);
  writeExecutable(
    join(installDir, 'setup'),
    '#!/usr/bin/env bash\nexit 0\n',
  );
  writeFileSync(join(installDir, 'sentinel.txt'), 'current install\n');
  const metadata = buildManagedReleaseInstallMetadata({
    install_scope: 'global',
    release_channel: 'stable',
    installed_version: version,
    installed_tag: `v${version}`,
    install_source: {
      kind: 'github_release',
      repo: 'LaPaGaYo/nexus',
      bundle_url: `https://example.com/nexus/v${version}.tar.gz`,
    },
    last_upgrade_at: '2026-04-08T00:00:00Z',
    migrated_from: null,
  });
  writeJson(join(installDir, '.nexus-install.json'), metadata);
}

function makeReleaseFixture(options: {
  version: string;
  tag: string;
  setupScript: string;
  bundleVersion?: string;
  manifestOverrides?: Record<string, unknown>;
  bundleManifestOverrides?: Record<string, unknown>;
  bundleSymlink?: { path: string; target: string };
}) {
  const bundleVersion = options.bundleVersion ?? options.version;
  const releaseDir = mkdtempSync(join(fixtureDir, 'release-'));
  const bundlePath = join(fixtureDir, `${options.tag}.tar.gz`);
  const manifestPath = join(fixtureDir, `${options.tag}.release.json`);

  const candidateManifest = {
    schema_version: 1,
    product: 'nexus',
    version: options.version,
    tag: options.tag,
    channel: 'stable',
    published_at: '2026-04-09T00:00:00Z',
    release_notes_path: `docs/releases/2026-04-09-nexus-${options.tag}.md`,
    bundle: {
      type: 'tar.gz',
      url: `file://${bundlePath}`,
    },
    compatibility: {
      upgrade_from_min_version: '1.0.0',
      requires_setup: true,
    },
    ...options.manifestOverrides,
  };
  const bundleManifest = {
    ...candidateManifest,
    ...options.bundleManifestOverrides,
  };

  writeJson(join(releaseDir, 'release.json'), bundleManifest);
  writeFileSync(join(releaseDir, 'VERSION'), `${bundleVersion}\n`);
  writeExecutable(join(releaseDir, 'setup'), options.setupScript);
  writeFileSync(join(releaseDir, 'release-marker.txt'), `${bundleVersion}\n`);
  if (options.bundleSymlink) {
    symlinkSync(options.bundleSymlink.target, join(releaseDir, options.bundleSymlink.path));
  }

  const archive = Bun.spawnSync(['tar', '-czf', bundlePath, '-C', releaseDir, '.'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  expect(archive.exitCode).toBe(0);

  writeJson(manifestPath, candidateManifest);

  return { releaseDir, bundlePath, manifestPath };
}

function writeLegacyInstallMetadata(kind: 'legacy_git' | 'legacy_vendored' | 'source_checkout') {
  writeJson(join(installDir, '.nexus-install.json'), {
    schema_version: 1,
    product: 'nexus',
    install_kind: kind,
    install_scope: 'global',
    release_channel: 'stable',
    installed_version: '1.0.0',
    installed_tag: 'v1.0.0',
    install_source: {
      kind: 'github_release',
      repo: 'LaPaGaYo/nexus',
      bundle_url: 'https://example.com/nexus/v1.0.0.tar.gz',
    },
    last_upgrade_at: '2026-04-08T00:00:00Z',
    migrated_from: null,
  });
}

function run(extraEnv: Record<string, string> = {}) {
  const result = Bun.spawnSync([SCRIPT], {
    env: {
      ...process.env,
      HOME: fixtureDir,
      NEXUS_DIR: installDir,
      NEXUS_STATE_DIR: stateDir,
      NEXUS_RELEASE_REPO: 'LaPaGaYo/nexus',
      NEXUS_RELEASE_CHANNEL: 'stable',
      NEXUS_INSTALL_SCOPE: 'global',
      ...extraEnv,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

function findBackupRoot() {
  const backupPrefix = `.${basename(installDir)}.bak-`;
  return readdirSync(dirname(installDir))
    .filter(entry => entry.startsWith(backupPrefix))
    .map(entry => join(dirname(installDir), entry));
}

beforeEach(() => {
  installDir = mkdtempSync(join(tmpdir(), 'nexus-install-'));
  stateDir = mkdtempSync(join(tmpdir(), 'nexus-state-'));
  fixtureDir = mkdtempSync(join(tmpdir(), 'nexus-upgrade-fixture-'));
});

afterEach(() => {
  rmSync(installDir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe('nexus-upgrade-install', () => {
  test('installs a managed release, writes metadata, and clears stale update-state', () => {
    setupCurrentInstall('1.0.0');
    writeJson(join(stateDir, 'update-state', 'last-check.json'), { stale: true });
    writeJson(join(stateDir, 'update-state', 'snooze.json'), { stale: true });
    writeFileSync(join(stateDir, 'last-update-check'), 'legacy\n');
    writeFileSync(join(stateDir, 'update-snoozed'), 'legacy\n');
    writeFileSync(join(stateDir, 'just-upgraded-from'), 'legacy\n');

    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
    expect(readFileSync(join(installDir, 'release-marker.txt'), 'utf8').trim()).toBe('1.0.1');
    expect(existsSync(join(installDir, 'sentinel.txt'))).toBe(false);
    expect(readInstallMetadata(installDir)).toMatchObject({
      schema_version: 1,
      product: 'nexus',
      install_kind: 'managed_release',
      install_scope: 'global',
      release_channel: 'stable',
      installed_version: '1.0.1',
      installed_tag: 'v1.0.1',
      install_source: {
        kind: 'github_release',
        repo: 'LaPaGaYo/nexus',
        bundle_url: `file://${join(fixtureDir, 'v1.0.1.tar.gz')}`,
      },
      migrated_from: null,
    });
    expect(JSON.parse(readFileSync(join(stateDir, 'update-state', 'just-upgraded.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      from_version: '1.0.0',
      from_tag: 'v1.0.0',
      to_version: '1.0.1',
      to_tag: 'v1.0.1',
      release_channel: 'stable',
    });
    expect(existsSync(join(stateDir, 'update-state', 'last-check.json'))).toBe(false);
    expect(existsSync(join(stateDir, 'update-state', 'snooze.json'))).toBe(false);
    expect(existsSync(join(stateDir, 'last-update-check'))).toBe(false);
    expect(existsSync(join(stateDir, 'update-snoozed'))).toBe(false);
    expect(existsSync(join(stateDir, 'just-upgraded-from'))).toBe(false);
  });

  test('restores the previous install when setup fails', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 1\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(readFileSync(join(installDir, 'setup'), 'utf8')).toContain('exit 0');
    expect(readInstallMetadata(installDir)).toMatchObject({
      installed_version: '1.0.0',
      installed_tag: 'v1.0.0',
    });
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('restores the previous install when metadata write fails', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nchmod 500 "$PWD"\nexit 0\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(readFileSync(join(installDir, 'setup'), 'utf8')).toContain('exit 0');
    expect(readInstallMetadata(installDir)).toMatchObject({
      installed_version: '1.0.0',
      installed_tag: 'v1.0.0',
    });
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('rejects bundles whose extracted VERSION disagrees with the candidate manifest', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      bundleVersion: '1.0.2',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('extracted VERSION does not match');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(installDir, 'release-marker.txt'))).toBe(false);
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('refuses installs without managed metadata', () => {
    writeFileSync(join(installDir, 'VERSION'), '1.0.0\n');
    writeExecutable(join(installDir, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
    writeFileSync(join(installDir, 'sentinel.txt'), 'current install\n');

    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('managed install with .nexus-install.json');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(installDir, '.nexus-install.json'))).toBe(false);
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('refuses non-managed install kinds', () => {
    setupCurrentInstall('1.0.0');
    writeLegacyInstallMetadata('legacy_git');

    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('install_kind must be managed_release or managed_vendored');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('never writes just-upgraded.json when the upgrade fails', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 1\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
    expect(existsSync(join(installDir, 'VERSION'))).toBe(true);
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
  });

  test('restores the previous install when setup leaves unreadable nested directories', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nmkdir -p locked/subdir\nchmod 000 locked\nexit 1\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('previous install was restored');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('refuses upgrades below manifest.compatibility.upgrade_from_min_version', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
      manifestOverrides: {
        compatibility: {
          upgrade_from_min_version: '1.0.1',
          requires_setup: true,
        },
      },
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('minimum supported upgrade source version');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(installDir, 'release-marker.txt'))).toBe(false);
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('rejects bundles whose embedded release.json disagrees on compatibility fields', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
      bundleManifestOverrides: {
        compatibility: {
          upgrade_from_min_version: '9.9.9',
          requires_setup: true,
        },
      },
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('compatibility.upgrade_from_min_version');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(installDir, 'release-marker.txt'))).toBe(false);
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('does not chmod through symlinks while preparing rollback', () => {
    setupCurrentInstall('1.0.0');
    const externalTarget = join(fixtureDir, 'external-target.txt');
    writeFileSync(externalTarget, 'protected\n', { mode: 0o400 });
    chmodSync(externalTarget, 0o400);
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 1\n',
      bundleSymlink: {
        path: 'linked-outside.txt',
        target: externalTarget,
      },
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('previous install was restored');
    expect(readFileSync(externalTarget, 'utf8')).toBe('protected\n');
    expect(statSync(externalTarget).mode & 0o777).toBe(0o400);
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('preserves the backup copy if rollback restore fails', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 1\n',
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      NEXUS_UPGRADE_TEST_FAIL_RESTORE: '1',
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('failed to restore previous install');
    expect(result.stderr).not.toContain('previous install was restored');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);

    const backups = findBackupRoot();
    expect(backups.length).toBe(1);
    try {
      expect(readFileSync(join(backups[0], 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(readFileSync(join(backups[0], 'sentinel.txt'), 'utf8')).toBe('current install\n');
    } finally {
      rmSync(backups[0], { recursive: true, force: true });
    }
  });

  test('honors NEXUS_RELEASE_REPO override when writing install metadata', () => {
    setupCurrentInstall('1.0.0');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
    });

    const result = run({
      NEXUS_RELEASE_REPO: 'VoltAgent/nexus',
      NEXUS_UPGRADE_TO_VERSION: '1.0.1',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
    });

    expect(result.exitCode).toBe(0);
    expect(readInstallMetadata(installDir)).toMatchObject({
      install_source: {
        kind: 'github_release',
        repo: 'VoltAgent/nexus',
        bundle_url: `file://${join(fixtureDir, 'v1.0.1.tar.gz')}`,
      },
    });
  });
});
