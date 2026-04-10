import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync, symlinkSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-update-check');

let nexusDir: string;
let stateDir: string;
let fixtureDir: string;

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function statePath(name: string) {
  return join(stateDir, 'update-state', name);
}

function makeReleaseFixture(options: {
  version: string;
  tag: string;
  manifestOverrides?: Record<string, unknown>;
  discoveryOverrides?: Record<string, unknown>;
}) {
  const manifestPath = join(fixtureDir, `${options.tag}-release.json`);
  const discoveryPath = join(fixtureDir, `${options.tag}-discovery.json`);
  const manifest = {
    schema_version: 1,
    product: 'nexus',
    version: options.version,
    tag: options.tag,
    channel: 'stable',
    published_at: '2026-04-09T00:00:00Z',
    release_notes_path: `docs/releases/2026-04-09-nexus-${options.tag}.md`,
    bundle: {
      type: 'tar.gz',
      url: `https://example.com/nexus/${options.tag}.tar.gz`,
    },
    compatibility: {
      upgrade_from_min_version: '1.0.0',
      requires_setup: true,
    },
    ...options.manifestOverrides,
  };
  const discovery = {
    tag_name: options.tag,
    version: options.version,
    channel: 'stable',
    draft: false,
    prerelease: false,
    manifest_url: `file://${manifestPath}`,
    bundle_url: manifest.bundle.url,
    ...options.discoveryOverrides,
  };

  writeJson(manifestPath, manifest);
  writeJson(discoveryPath, discovery);

  return {
    manifestPath,
    discoveryPath,
    manifest,
    discovery,
  };
}

function run(extraEnv: Record<string, string> = {}, args: string[] = []) {
  const result = Bun.spawnSync([SCRIPT, ...args], {
    env: {
      ...process.env,
      NEXUS_DIR: nexusDir,
      NEXUS_STATE_DIR: stateDir,
      NEXUS_RELEASE_REPO: 'LaPaGaYo/nexus',
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

beforeEach(() => {
  nexusDir = mkdtempSync(join(tmpdir(), 'nexus-upd-test-'));
  stateDir = mkdtempSync(join(tmpdir(), 'nexus-state-test-'));
  fixtureDir = mkdtempSync(join(tmpdir(), 'nexus-release-fixture-'));
  const binDir = join(nexusDir, 'bin');
  const libDir = join(nexusDir, 'lib', 'nexus');
  mkdirSync(binDir);
  mkdirSync(libDir, { recursive: true });
  symlinkSync(join(import.meta.dir, '..', '..', 'bin', 'nexus-config'), join(binDir, 'nexus-config'));
  symlinkSync(join(import.meta.dir, '..', '..', 'bin', 'nexus-telemetry-log'), join(binDir, 'nexus-telemetry-log'));
  symlinkSync(
    join(import.meta.dir, '..', '..', 'lib', 'nexus', 'release-contract.ts'),
    join(libDir, 'release-contract.ts'),
  );
  symlinkSync(
    join(import.meta.dir, '..', '..', 'lib', 'nexus', 'install-metadata.ts'),
    join(libDir, 'install-metadata.ts'),
  );
  symlinkSync(join(import.meta.dir, '..', '..', 'lib', 'nexus', 'update-state.ts'), join(libDir, 'update-state.ts'));
});

afterEach(() => {
  rmSync(nexusDir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe('nexus-update-check', () => {
  test('--help prints usage and exits 0', () => {
    const { exitCode, stdout } = run({}, ['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('nexus-update-check');
    expect(stdout).toContain('JUST_UPGRADED');
    expect(stdout).toContain('UPGRADE_AVAILABLE');
  });

  test('exits silently when VERSION file is missing', () => {
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('normalizes legacy just-upgraded-from into just-upgraded.json', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeFileSync(join(stateDir, 'just-upgraded-from'), '0.9.9\n');
    makeReleaseFixture({ version: '1.0.0', tag: 'v1.0.0' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('JUST_UPGRADED 0.9.9 1.0.0');
    expect(JSON.parse(readFileSync(statePath('just-upgraded.json'), 'utf8'))).toEqual({
      schema_version: 1,
      from_version: '0.9.9',
      from_tag: 'v0.9.9',
      to_version: '1.0.0',
      to_tag: 'v1.0.0',
      release_channel: 'stable',
      completed_at: expect.any(String),
    });
  });

  test('clears stale snooze state when normalizing a legacy just-upgraded marker', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeFileSync(join(stateDir, 'just-upgraded-from'), '0.9.9\n');
    writeJson(statePath('snooze.json'), {
      schema_version: 1,
      release_channel: 'stable',
      candidate_version: '1.0.0',
      candidate_tag: 'v1.0.0',
      snooze_level: 2,
      snoozed_at: '2026-04-09T00:00:00Z',
      expires_at: '2026-04-11T00:00:00Z',
    });
    writeFileSync(join(stateDir, 'update-snoozed'), '1.0.0 2 1712620800\n');
    makeReleaseFixture({ version: '1.0.0', tag: 'v1.0.0' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('JUST_UPGRADED 0.9.9 1.0.0');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'up_to_date',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.0',
      candidate_tag: 'v1.0.0',
    });
    expect(() => readFileSync(statePath('snooze.json'), 'utf8')).toThrow();
  });

  test('projects JUST_UPGRADED from structured state only once', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    makeReleaseFixture({ version: '1.0.0', tag: 'v1.0.0' });
    writeJson(statePath('just-upgraded.json'), {
      schema_version: 1,
      from_version: '0.9.9',
      from_tag: 'v0.9.9',
      to_version: '1.0.0',
      to_tag: 'v1.0.0',
      release_channel: 'stable',
      completed_at: '2026-04-09T00:00:00Z',
    });

    const first = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(first.exitCode).toBe(0);
    expect(first.stdout).toBe('JUST_UPGRADED 0.9.9 1.0.0');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'up_to_date',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.0',
      candidate_tag: 'v1.0.0',
    });

    const second = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toBe('');
  });

  test('prefers structured just-upgraded state over stale structured snooze state for the current release', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeJson(statePath('just-upgraded.json'), {
      schema_version: 1,
      from_version: '0.9.9',
      from_tag: 'v0.9.9',
      to_version: '1.0.0',
      to_tag: 'v1.0.0',
      release_channel: 'stable',
      completed_at: '2026-04-09T00:00:00Z',
    });
    writeJson(statePath('snooze.json'), {
      schema_version: 1,
      release_channel: 'stable',
      candidate_version: '1.0.0',
      candidate_tag: 'v1.0.0',
      snooze_level: 2,
      snoozed_at: '2026-04-09T00:00:00Z',
      expires_at: '2026-04-11T00:00:00Z',
    });
    makeReleaseFixture({ version: '1.0.0', tag: 'v1.0.0' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('JUST_UPGRADED 0.9.9 1.0.0');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'up_to_date',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.0',
      candidate_tag: 'v1.0.0',
    });
    expect(() => readFileSync(statePath('snooze.json'), 'utf8')).toThrow();
  });

  test('suppresses JUST_UPGRADED when the candidate manifest is invalid', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeJson(statePath('just-upgraded.json'), {
      schema_version: 1,
      from_version: '0.9.9',
      from_tag: 'v0.9.9',
      to_version: '1.0.0',
      to_tag: 'v1.0.0',
      release_channel: 'stable',
      completed_at: '2026-04-09T00:00:00Z',
    });
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      manifestOverrides: {
        product: 'not-nexus',
      },
    });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.1-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'invalid_remote',
      release_channel: 'stable',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.1',
      candidate_tag: 'v1.0.1',
    });
  });

  test('writes up_to_date last-check state when versions match', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    makeReleaseFixture({ version: '1.0.0', tag: 'v1.0.0' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'up_to_date',
      release_channel: 'stable',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.0',
      candidate_tag: 'v1.0.0',
      source: {
        kind: 'github_release',
        repo: 'LaPaGaYo/nexus',
      },
    });
  });

  test('outputs UPGRADE_AVAILABLE and writes upgrade_available last-check state', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    makeReleaseFixture({ version: '1.0.1', tag: 'v1.0.1' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.1-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('UPGRADE_AVAILABLE 1.0.0 1.0.1');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'upgrade_available',
      release_channel: 'stable',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.1',
      candidate_tag: 'v1.0.1',
      source: {
        kind: 'github_release',
        repo: 'LaPaGaYo/nexus',
      },
    });
  });

  test('falls back to install metadata repo when no repo override or git remote is available', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeJson(join(nexusDir, '.nexus-install.json'), {
      schema_version: 1,
      product: 'nexus',
      install_kind: 'managed_release',
      install_scope: 'global',
      release_channel: 'stable',
      installed_version: '1.0.0',
      installed_tag: 'v1.0.0',
      install_source: {
        kind: 'github_release',
        repo: 'LaPaGaYo/nexus',
        bundle_url: 'https://example.com/nexus/v1.0.0.tar.gz',
      },
      last_upgrade_at: '2026-04-09T00:00:00Z',
      migrated_from: null,
    });
    makeReleaseFixture({ version: '1.0.1', tag: 'v1.0.1' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_REPO: '',
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.1-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('UPGRADE_AVAILABLE 1.0.0 1.0.1');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'upgrade_available',
      release_channel: 'stable',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.1',
      candidate_tag: 'v1.0.1',
      source: {
        kind: 'github_release',
        repo: 'LaPaGaYo/nexus',
      },
    });
  });

  test('bridges legacy snooze markers into structured snooze.json', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeFileSync(join(stateDir, 'update-snoozed'), `1.0.1 2 ${Math.floor(Date.now() / 1000)}\n`);
    makeReleaseFixture({ version: '1.0.1', tag: 'v1.0.1' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.1-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      status: 'snoozed',
      candidate_version: '1.0.1',
      candidate_tag: 'v1.0.1',
    });
    expect(JSON.parse(readFileSync(statePath('snooze.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      release_channel: 'stable',
      candidate_version: '1.0.1',
      candidate_tag: 'v1.0.1',
      snooze_level: 2,
    });
  });

  test('refuses unsupported release_channel values', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeFileSync(join(stateDir, 'config.yaml'), 'release_channel: candidate\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'error',
      release_channel: 'candidate',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: null,
      candidate_tag: null,
    });
  });

  test('honors NEXUS_RELEASE_CHANNEL overrides before consulting config or remote discovery', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    makeReleaseFixture({ version: '1.0.0', tag: 'v1.0.0' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_CHANNEL: 'candidate',
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.0-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'error',
      release_channel: 'candidate',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: null,
      candidate_tag: null,
    });
  });

  test('refuses invalid remote release manifests', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    makeReleaseFixture({
      version: '1.0.1',
      tag: 'v1.0.1',
      manifestOverrides: {
        product: 'not-nexus',
      },
    });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.1-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'invalid_remote',
      release_channel: 'stable',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: '1.0.1',
      candidate_tag: 'v1.0.1',
    });
  });

  test('refuses VERSION and .nexus-install.json mismatches', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '1.0.0\n');
    writeJson(join(nexusDir, '.nexus-install.json'), {
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
        bundle_url: 'https://example.com/nexus/v1.0.1.tar.gz',
      },
      last_upgrade_at: '2026-04-09T00:00:00Z',
      migrated_from: null,
    });
    makeReleaseFixture({ version: '1.0.1', tag: 'v1.0.1' });

    const { exitCode, stdout } = run({
      NEXUS_RELEASE_DISCOVERY_URL: `file://${join(fixtureDir, 'v1.0.1-discovery.json')}`,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(JSON.parse(readFileSync(statePath('last-check.json'), 'utf8'))).toMatchObject({
      schema_version: 1,
      status: 'error',
      release_channel: 'stable',
      local_version: '1.0.0',
      local_tag: 'v1.0.0',
      candidate_version: null,
      candidate_tag: null,
    });
  });
});
