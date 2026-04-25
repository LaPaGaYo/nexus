import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, chmodSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus-config');

let stateDir: string;

function run(args: string[] = [], extraEnv: Record<string, string> = {}) {
  const result = Bun.spawnSync(['bash', SCRIPT, ...args], {
    env: {
      ...process.env,
      NEXUS_STATE_DIR: stateDir,
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
  stateDir = mkdtempSync(join(tmpdir(), 'nexus-config-test-'));
});

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

describe('nexus-config', () => {
  test('--help prints usage and exits 0', () => {
    const { exitCode, stdout } = run(['--help']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('nexus-config');
    expect(stdout).toContain('get <key>');
    expect(stdout).toContain('set <key> <value>');
    expect(stdout).not.toContain('set -euo pipefail');
  });

  test('get on missing file returns empty and exits 0', () => {
    const { exitCode, stdout } = run(['get', 'auto_upgrade']);
    expect(exitCode).toBe(0);
    expect(stdout).toBe('');
  });

  test('set creates file and writes a key', () => {
    const { exitCode } = run(['set', 'auto_upgrade', 'true']);
    expect(exitCode).toBe(0);
    const content = readFileSync(join(stateDir, 'config.yaml'), 'utf-8');
    expect(content).toContain('auto_upgrade: true');
  });

  test('set replaces an existing key in place', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'auto_upgrade: false\n');
    run(['set', 'auto_upgrade', 'true']);
    const content = readFileSync(join(stateDir, 'config.yaml'), 'utf-8');
    expect(content).toContain('auto_upgrade: true');
    expect(content).not.toContain('auto_upgrade: false');
  });

  test('list returns the full config', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'auto_upgrade: true\nupdate_check: false\n');
    const { exitCode, stdout } = run(['list']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('auto_upgrade: true');
    expect(stdout).toContain('update_check: false');
  });

  test('set creates nested Nexus state directories', () => {
    const nestedDir = join(stateDir, 'nested', 'dir');
    const { exitCode } = run(['set', 'foo', 'bar'], { NEXUS_STATE_DIR: nestedDir });
    expect(exitCode).toBe(0);
    expect(existsSync(join(nestedDir, 'config.yaml'))).toBe(true);
  });

  test('writes a Nexus-branded header only once', () => {
    run(['set', 'telemetry', 'off']);
    run(['set', 'foo', 'bar']);
    const content = readFileSync(join(stateDir, 'config.yaml'), 'utf-8');
    expect(content).toContain('# Nexus configuration');
    expect((content.match(/# Nexus configuration/g) || []).length).toBe(1);
    expect(content).toContain('nexus_contributor:');
    expect(content).not.toContain('# gstack configuration');
    expect(content).not.toContain('# ─── Telemetry');
    expect(content).not.toContain('usage data + stable device ID');
  });

  test('set rejects invalid keys', () => {
    const { exitCode, stderr } = run(['set', '.*', 'value']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('alphanumeric');
  });

  test('effective-execution explains governed_ccb with local-only config keys unset', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'execution_mode: governed_ccb\n');
    const binDir = join(stateDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'ask'), '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(join(binDir, 'ask'), 0o755);

    const { exitCode, stdout } = run(['effective-execution'], {
      PATH: `${binDir}:/bin:/usr/bin`,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('execution_mode: governed_ccb');
    expect(stdout).toContain('execution_mode_configured: yes');
    expect(stdout).toContain('execution_mode_source: persisted_preference');
    expect(stdout).toContain('ccb_available: yes');
    expect(stdout).toContain('effective_primary_provider: codex');
    expect(stdout).toContain('effective_provider_topology: multi_session');
    expect(stdout).toContain('effective_requested_execution_path: codex-via-ccb');
    expect(stdout).toContain('current_session_ready: no');
    expect(stdout).toContain('required_governed_providers: codex,gemini');
    expect(stdout).toContain('mounted_providers: none');
    expect(stdout).toContain('missing_providers: codex,gemini');
    expect(stdout).toContain('governed_ready: no');
    expect(stdout).toContain('local_provider_candidate: claude');
    expect(stdout).toContain('local_provider_topology: single_agent');
    expect(stdout).toContain('local_provider-only config keys');
  });

  test('effective-execution reports governed readiness when required providers are mounted', () => {
    writeFileSync(join(stateDir, 'config.yaml'), 'execution_mode: governed_ccb\n');
    const binDir = join(stateDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'ask'), '#!/usr/bin/env bash\nexit 0\n');
    writeFileSync(
      join(binDir, 'ccb-mounted'),
      '#!/usr/bin/env bash\nprintf \'{"cwd":"/tmp/test","mounted":["codex","gemini"]}\\n\'\n',
    );
    chmodSync(join(binDir, 'ask'), 0o755);
    chmodSync(join(binDir, 'ccb-mounted'), 0o755);

    const { exitCode, stdout } = run(['effective-execution'], {
      PATH: `${binDir}:/bin:/usr/bin`,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('current_session_ready: yes');
    expect(stdout).toContain('mounted_providers: codex,gemini');
    expect(stdout).toContain('missing_providers: none');
    expect(stdout).toContain('governed_ready: yes');
  });

  test('effective-execution defaults to local_provider when CCB is installed but governed providers are incomplete', () => {
    const binDir = join(stateDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'ask'), '#!/usr/bin/env bash\nexit 0\n');
    writeFileSync(join(binDir, 'claude'), '#!/usr/bin/env bash\nexit 0\n');
    writeFileSync(
      join(binDir, 'ccb-mounted'),
      '#!/usr/bin/env bash\nprintf \'{"cwd":"/tmp/test","mounted":["codex","claude"]}\\n\'\n',
    );
    chmodSync(join(binDir, 'ask'), 0o755);
    chmodSync(join(binDir, 'claude'), 0o755);
    chmodSync(join(binDir, 'ccb-mounted'), 0o755);

    const { exitCode, stdout } = run(['effective-execution'], {
      PATH: `${binDir}:/bin:/usr/bin`,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('execution_mode: local_provider');
    expect(stdout).toContain('execution_mode_configured: no');
    expect(stdout).toContain('execution_mode_source: machine_default_local_governed_not_ready');
    expect(stdout).toContain('ccb_available: yes');
    expect(stdout).toContain('effective_primary_provider: claude');
    expect(stdout).toContain('effective_provider_topology: single_agent');
    expect(stdout).toContain('effective_requested_execution_path: claude-local-single_agent');
    expect(stdout).toContain('provider_cli_available: yes');
    expect(stdout).toContain('current_session_ready: yes');
    expect(stdout).toContain('required_governed_providers: codex,gemini');
    expect(stdout).toContain('mounted_providers: codex,claude');
    expect(stdout).toContain('missing_providers: gemini');
    expect(stdout).toContain('governed_ready: no');
    expect(stdout).toContain('local_provider_candidate: claude');
    expect(stdout).toContain('local_provider_ready: yes');
  });

  test('effective-execution resolves default local_provider route when CCB is missing', () => {
    const binDir = join(stateDir, 'bin');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'claude'), '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(join(binDir, 'claude'), 0o755);

    const { exitCode, stdout } = run(['effective-execution'], {
      PATH: `${binDir}:/bin:/usr/bin`,
    });

    expect(exitCode).toBe(0);
    expect(stdout).toContain('execution_mode: local_provider');
    expect(stdout).toContain('execution_mode_configured: no');
    expect(stdout).toContain('execution_mode_source: machine_default_local_ccb_missing');
    expect(stdout).toContain('ccb_available: no');
    expect(stdout).toContain('effective_primary_provider: claude');
    expect(stdout).toContain('effective_provider_topology: single_agent');
    expect(stdout).toContain('effective_requested_execution_path: claude-local-single_agent');
    expect(stdout).toContain('provider_cli_available: yes');
    expect(stdout).toContain('current_session_ready: yes');
    expect(stdout).toContain('mounted_providers: none');
    expect(stdout).toContain('missing_providers: codex,gemini');
    expect(stdout).toContain('governed_ready: no');
    expect(stdout).toContain('local_provider_candidate: claude');
    expect(stdout).toContain('local_provider_topology: single_agent');
  });

  test('no args shows usage and exits 1', () => {
    const { exitCode, stdout } = run([]);
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Usage');
  });
});
