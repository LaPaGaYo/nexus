import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { buildManagedReleaseInstallMetadata, readInstallMetadata } from '../../../lib/nexus/io/install-metadata';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync, existsSync, readdirSync, symlinkSync, statSync } from 'fs';
import { basename, dirname, join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', '..', 'bin', 'nexus-upgrade-install');

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

function resetInstallDir(path: string) {
  rmSync(installDir, { recursive: true, force: true });
  installDir = path;
  mkdirSync(installDir, { recursive: true });
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

function git(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = result.stderr.toString().trim();
  const stdout = result.stdout.toString().trim();
  expect(result.exitCode).toBe(0);
  return { stdout, stderr };
}

function setupLegacyGitInstall(version: string, options: {
  installPath?: string;
  dirtyTracked?: boolean;
  dirtyUntracked?: boolean;
} = {}) {
  const installPath = options.installPath ?? installDir;
  mkdirSync(installPath, { recursive: true });
  git(installPath, 'init');
  git(installPath, 'config', 'user.email', 'test@test.com');
  git(installPath, 'config', 'user.name', 'Test');
  writeFileSync(join(installPath, 'VERSION'), `${version}\n`);
  writeExecutable(join(installPath, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
  writeFileSync(join(installPath, 'sentinel.txt'), 'legacy install\n');
  git(installPath, 'add', '.');
  git(installPath, 'commit', '-m', 'initial');

  if (options.dirtyTracked) {
    writeFileSync(join(installPath, 'sentinel.txt'), 'legacy install changed\n');
  }

  if (options.dirtyUntracked) {
    writeFileSync(join(installPath, 'untracked.txt'), 'local change\n');
  }
}

function run(extraEnv: Record<string, string> = {}, cwd?: string) {
  const result = Bun.spawnSync([SCRIPT], {
    cwd,
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

function findVendoredBackupRoots(vendoredDir: string) {
  const backupPrefix = `.${basename(vendoredDir)}.vendored-bak-`;
  return readdirSync(dirname(vendoredDir))
    .filter(entry => entry.startsWith(backupPrefix))
    .map(entry => join(dirname(vendoredDir), entry));
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

  test('upgrades directly across multiple patch releases within the same patch line', () => {
    setupCurrentInstall('1.0.19');
    makeReleaseFixture({
      version: '1.0.23',
      tag: 'v1.0.23',
      setupScript: '#!/usr/bin/env bash\nexit 0\n',
      manifestOverrides: {
        compatibility: {
          upgrade_from_min_version: '1.0.0',
          requires_setup: true,
        },
      },
    });

    const result = run({
      NEXUS_UPGRADE_TO_VERSION: '1.0.23',
      NEXUS_UPGRADE_TO_TAG: 'v1.0.23',
      NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.23.release.json')}`,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.23');
    expect(readInstallMetadata(installDir)).toMatchObject({
      installed_version: '1.0.23',
      installed_tag: 'v1.0.23',
    });
    expect(JSON.parse(readFileSync(join(stateDir, 'update-state', 'just-upgraded.json'), 'utf8'))).toMatchObject({
      from_version: '1.0.19',
      from_tag: 'v1.0.19',
      to_version: '1.0.23',
      to_tag: 'v1.0.23',
    });
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
    expect(result.stderr).toContain('legacy git installs can only be migrated from known user install roots');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
    expect(existsSync(join(stateDir, 'update-state', 'just-upgraded.json'))).toBe(false);
  });

  test('migrates a clean legacy git install from a known user root to a managed release install', () => {
    resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
    setupLegacyGitInstall('1.0.0');
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
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
    expect(existsSync(join(installDir, '.git'))).toBe(false);
    expect(readInstallMetadata(installDir)).toMatchObject({
      install_kind: 'managed_release',
      install_scope: 'global',
      installed_version: '1.0.1',
      installed_tag: 'v1.0.1',
      migrated_from: {
        install_kind: 'legacy_git',
        installed_version: '1.0.0',
      },
    });
  });

  test('migrates a clean legacy git install from ~/.nexus/repos/nexus to a managed release install', () => {
    resetInstallDir(join(fixtureDir, '.nexus', 'repos', 'nexus'));
    setupLegacyGitInstall('1.0.0');
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
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
    expect(existsSync(join(installDir, '.git'))).toBe(false);
    expect(readInstallMetadata(installDir)).toMatchObject({
      install_kind: 'managed_release',
      install_scope: 'global',
      installed_version: '1.0.1',
      installed_tag: 'v1.0.1',
      migrated_from: {
        install_kind: 'legacy_git',
        installed_version: '1.0.0',
      },
    });
  });

  test('refuses migrating a legacy git install with tracked local modifications', () => {
    resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
    setupLegacyGitInstall('1.0.0', { dirtyTracked: true });
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
    expect(result.stderr).toContain('legacy git install has local modifications');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('legacy install changed\n');
    expect(existsSync(join(installDir, '.nexus-install.json'))).toBe(false);
  });

  test('refuses migrating a legacy git install with untracked local modifications', () => {
    resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
    setupLegacyGitInstall('1.0.0', { dirtyUntracked: true });
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
    expect(result.stderr).toContain('legacy git install has local modifications');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(readFileSync(join(installDir, 'untracked.txt'), 'utf8')).toBe('local change\n');
    expect(existsSync(join(installDir, '.nexus-install.json'))).toBe(false);
  });

  test('refuses source checkouts and explains that development clones are maintained manually', () => {
    setupLegacyGitInstall('1.0.0');
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
    expect(result.stderr).toContain('source checkouts are development clones');
    expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
    expect(existsSync(join(installDir, '.nexus-install.json'))).toBe(false);
  });

  test('syncs a repo-local vendored copy to the same release and writes managed vendored metadata', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
      setupCurrentInstall('1.0.0');

      const vendoredDir = join(projectDir, '.claude', 'skills', 'nexus');
      mkdirSync(vendoredDir, { recursive: true });
      writeFileSync(join(vendoredDir, 'VERSION'), '1.0.0\n');
      writeExecutable(join(vendoredDir, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
      writeFileSync(join(vendoredDir, 'vendored-sentinel.txt'), 'vendored current install\n');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: '#!/usr/bin/env bash\nexit 0\n',
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      }, projectDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Synced vendored Nexus copy');
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
      expect(readFileSync(join(vendoredDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
      expect(existsSync(join(vendoredDir, 'vendored-sentinel.txt'))).toBe(false);
      expect(readInstallMetadata(vendoredDir)).toMatchObject({
        install_kind: 'managed_vendored',
        install_scope: 'project',
        installed_version: '1.0.1',
        installed_tag: 'v1.0.1',
        migrated_from: {
          install_kind: 'legacy_vendored',
          installed_version: '1.0.0',
        },
      });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('migrates a direct repo-local vendored install to a managed vendored install', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(projectDir, '.claude', 'skills', 'nexus'));
      mkdirSync(installDir, { recursive: true });
      writeFileSync(join(installDir, 'VERSION'), '1.0.0\n');
      writeExecutable(join(installDir, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
      writeFileSync(join(installDir, 'vendored-sentinel.txt'), 'vendored current install\n');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: '#!/usr/bin/env bash\nexit 0\n',
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      }, projectDir);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('Synced vendored Nexus copy');
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
      expect(existsSync(join(installDir, 'vendored-sentinel.txt'))).toBe(false);
      expect(readInstallMetadata(installDir)).toMatchObject({
        install_kind: 'managed_vendored',
        install_scope: 'project',
        installed_version: '1.0.1',
        installed_tag: 'v1.0.1',
        migrated_from: {
          install_kind: 'legacy_vendored',
          installed_version: '1.0.0',
        },
      });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('refuses a git-backed repo-local vendored install as a source checkout', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(projectDir, '.claude', 'skills', 'nexus'));
      setupLegacyGitInstall('1.0.0');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: '#!/usr/bin/env bash\nexit 0\n',
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      }, projectDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('source checkouts are development clones');
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(existsSync(join(installDir, '.git'))).toBe(true);
      expect(existsSync(join(installDir, '.nexus-install.json'))).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('refuses a git-backed repo-local vendored install even when metadata is already present', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(projectDir, '.claude', 'skills', 'nexus'));
      setupCurrentInstall('1.0.0');
      git(installDir, 'init');
      const primarySetupSideEffect = join(projectDir, 'primary-setup-side-effect.txt');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: `#!/usr/bin/env bash
printf 'primary setup ran\\n' > ${JSON.stringify(primarySetupSideEffect)}
exit 0
`,
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      }, projectDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('source checkouts are development clones');
      expect(result.stderr).not.toContain('previous install was restored');
      expect(existsSync(primarySetupSideEffect)).toBe(false);
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(existsSync(join(installDir, '.git'))).toBe(true);
      expect(readInstallMetadata(installDir)).toMatchObject({
        install_kind: 'managed_release',
        install_scope: 'global',
      });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('restores both installs when vendored sync fails after the primary install is replaced', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
      setupCurrentInstall('1.0.0');

      const vendoredDir = join(projectDir, '.claude', 'skills', 'nexus');
      mkdirSync(vendoredDir, { recursive: true });
      writeFileSync(join(vendoredDir, 'VERSION'), '1.0.0\n');
      writeExecutable(join(vendoredDir, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
      writeFileSync(join(vendoredDir, 'vendored-sentinel.txt'), 'vendored current install\n');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: '#!/usr/bin/env bash\nexit 0\n',
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
        NEXUS_UPGRADE_TEST_FAIL_VENDORED_SYNC: '1',
      }, projectDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('vendored Nexus copy was restored');
      expect(result.stderr).toContain('previous install was restored');
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(readFileSync(join(vendoredDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(readFileSync(join(vendoredDir, 'vendored-sentinel.txt'), 'utf8')).toBe('vendored current install\n');
      expect(existsSync(join(vendoredDir, '.nexus-install.json'))).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('refuses syncing over a git-backed vendored checkout before replacing either install', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
      setupCurrentInstall('1.0.0');

      const vendoredDir = join(projectDir, '.claude', 'skills', 'nexus');
      setupLegacyGitInstall('1.0.0', { installPath: vendoredDir, dirtyTracked: true });
      const primarySetupSideEffect = join(projectDir, 'primary-setup-side-effect.txt');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: `#!/usr/bin/env bash
printf 'primary setup ran\\n' > ${JSON.stringify(primarySetupSideEffect)}
exit 0
`,
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      }, projectDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('source checkout');
      expect(result.stderr).not.toContain('previous install was restored');
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(readFileSync(join(installDir, 'sentinel.txt'), 'utf8')).toBe('current install\n');
      expect(existsSync(primarySetupSideEffect)).toBe(false);
      expect(readFileSync(join(vendoredDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(readFileSync(join(vendoredDir, 'sentinel.txt'), 'utf8')).toBe('legacy install changed\n');
      expect(existsSync(join(vendoredDir, '.git'))).toBe(true);
      expect(existsSync(join(vendoredDir, '.nexus-install.json'))).toBe(false);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('vendored setup does not observe the primary managed_release metadata', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
      setupCurrentInstall('1.0.0');

      const vendoredDir = join(projectDir, '.claude', 'skills', 'nexus');
      mkdirSync(vendoredDir, { recursive: true });
      writeFileSync(join(vendoredDir, 'VERSION'), '1.0.0\n');
      writeExecutable(join(vendoredDir, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
      writeFileSync(join(vendoredDir, 'vendored-sentinel.txt'), 'vendored current install\n');
      const primaryMetadataMarker = join(vendoredDir, 'vendored-saw-primary-metadata.txt');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: `#!/usr/bin/env bash
if [ -f .nexus-install.json ] && grep -q '"install_kind": "managed_release"' .nexus-install.json; then
  printf 'saw primary metadata\\n' > ${JSON.stringify(primaryMetadataMarker)}
fi
exit 0
`,
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
      }, projectDir);

      expect(result.exitCode).toBe(0);
      expect(existsSync(primaryMetadataMarker)).toBe(false);
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
      expect(readFileSync(join(vendoredDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');
      expect(readInstallMetadata(vendoredDir)).toMatchObject({
        install_kind: 'managed_vendored',
        install_scope: 'project',
        installed_version: '1.0.1',
        installed_tag: 'v1.0.1',
      });
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test('preserves the vendored backup if vendored restore fails', () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'nexus-project-'));
    try {
      resetInstallDir(join(fixtureDir, '.claude', 'skills', 'nexus'));
      setupCurrentInstall('1.0.0');

      const vendoredDir = join(projectDir, '.claude', 'skills', 'nexus');
      mkdirSync(vendoredDir, { recursive: true });
      writeFileSync(join(vendoredDir, 'VERSION'), '1.0.0\n');
      writeExecutable(join(vendoredDir, 'setup'), '#!/usr/bin/env bash\nexit 0\n');
      writeFileSync(join(vendoredDir, 'vendored-sentinel.txt'), 'vendored current install\n');

      makeReleaseFixture({
        version: '1.0.1',
        tag: 'v1.0.1',
        setupScript: '#!/usr/bin/env bash\nexit 0\n',
      });

      const result = run({
        NEXUS_UPGRADE_TO_VERSION: '1.0.1',
        NEXUS_UPGRADE_TO_TAG: 'v1.0.1',
        NEXUS_RELEASE_MANIFEST_URL: `file://${join(fixtureDir, 'v1.0.1.release.json')}`,
        NEXUS_UPGRADE_TEST_FAIL_VENDORED_SYNC: '1',
        NEXUS_UPGRADE_TEST_FAIL_VENDORED_RESTORE: '1',
      }, projectDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('failed to restore vendored Nexus copy');
      expect(result.stderr).toContain('vendored backup copy was preserved');
      expect(result.stderr).not.toContain('vendored Nexus copy was restored');
      expect(result.stderr).toContain('previous install was restored');
      expect(readFileSync(join(installDir, 'VERSION'), 'utf8').trim()).toBe('1.0.0');
      expect(readFileSync(join(vendoredDir, 'VERSION'), 'utf8').trim()).toBe('1.0.1');

      const backups = findVendoredBackupRoots(vendoredDir);
      expect(backups.length).toBe(1);
      try {
        expect(readFileSync(join(backups[0], 'VERSION'), 'utf8').trim()).toBe('1.0.0');
        expect(readFileSync(join(backups[0], 'vendored-sentinel.txt'), 'utf8')).toBe('vendored current install\n');
      } finally {
        rmSync(backups[0], { recursive: true, force: true });
      }
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
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
