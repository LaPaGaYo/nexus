import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync, symlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-update-check');

let nexusDir: string;
let stateDir: string;

function run(extraEnv: Record<string, string> = {}, args: string[] = []) {
  const result = Bun.spawnSync(['bash', SCRIPT, ...args], {
    env: {
      ...process.env,
      NEXUS_DIR: nexusDir,
      NEXUS_STATE_DIR: stateDir,
      NEXUS_REMOTE_URL: `file://${join(nexusDir, 'REMOTE_VERSION')}`,
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
  const binDir = join(nexusDir, 'bin');
  mkdirSync(binDir);
  symlinkSync(join(import.meta.dir, '..', '..', 'bin', 'nexus-config'), join(binDir, 'nexus-config'));
  symlinkSync(join(import.meta.dir, '..', '..', 'bin', 'nexus-telemetry-log'), join(binDir, 'nexus-telemetry-log'));
});

afterEach(() => {
  rmSync(nexusDir, { recursive: true, force: true });
  rmSync(stateDir, { recursive: true, force: true });
});

describe('nexus-update-check', () => {
  test('exits silently when VERSION file is missing', () => {
    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('outputs JUST_UPGRADED and clears the marker', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '0.4.0\n');
    writeFileSync(join(stateDir, 'just-upgraded-from'), '0.3.3\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('JUST_UPGRADED 0.3.3 0.4.0');
  });

  test('writes UP_TO_DATE cache when versions match', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(nexusDir, 'REMOTE_VERSION'), '0.3.3\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
    expect(readFileSync(join(stateDir, 'last-update-check'), 'utf-8')).toContain('UP_TO_DATE 0.3.3');
  });

  test('outputs UPGRADE_AVAILABLE when versions differ', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(nexusDir, 'REMOTE_VERSION'), '0.4.0\n');

    const { exitCode, stdout } = run();
    expect(exitCode).toBe(0);
    expect(stdout).toBe('UPGRADE_AVAILABLE 0.3.3 0.4.0');
    expect(readFileSync(join(stateDir, 'last-update-check'), 'utf-8')).toContain('UPGRADE_AVAILABLE 0.3.3 0.4.0');
  });

  test('force clears cache before re-checking', () => {
    writeFileSync(join(nexusDir, 'VERSION'), '0.3.3\n');
    writeFileSync(join(stateDir, 'last-update-check'), 'UP_TO_DATE 0.3.3');
    writeFileSync(join(nexusDir, 'REMOTE_VERSION'), '0.4.0\n');

    const { exitCode, stdout } = run({}, ['--force']);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('UPGRADE_AVAILABLE 0.3.3 0.4.0');
  });

  test('uses Nexus-only override names in the implementation', () => {
    const content = readFileSync(SCRIPT, 'utf-8');
    expect(content).toContain('NEXUS_DIR');
    expect(content).toContain('NEXUS_STATE_DIR');
    expect(content).toContain('NEXUS_REMOTE_URL');
    expect(content).not.toContain('GSTACK_REMOTE_URL');
    expect(content).not.toContain('GSTACK_STATE_DIR');
  });
});
