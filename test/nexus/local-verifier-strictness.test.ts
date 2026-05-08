/**
 * Tests for #103: capability-verifier strictness for codex / gemini.
 *
 * PR #100 shipped substring-based detection (`output.includes('exec -')`,
 * `output.includes('-p')`, `output.includes('--yolo')`). pr-test-analyzer
 * flagged this as fragile — `--print`, `--proxy`, etc. all contain `-p`,
 * and any descriptive text mentioning `exec -` would slip through. Tests
 * here pin the tightened word-boundary regex behavior so the fragility
 * can't regress.
 *
 * The verifier functions are not exported; we exercise them through the
 * public adapter API by handing the local adapter a `runCommand` mock and
 * driving handoff. The handoff status.json's
 * route_validation.local_subagent_support payload is the observable.
 */

import { describe, expect, test } from 'bun:test';
import { createRuntimeLocalAdapter } from '../../lib/nexus/adapters/local';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import { runInTempRepo } from './helpers/temp-repo';

const CODEX_LOCAL_SUBAGENT_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'codex' as const,
  provider_topology: 'subagents' as const,
  requested_execution_path: 'codex-local-subagents',
};

const GEMINI_LOCAL_SUBAGENT_EXECUTION = {
  mode: 'local_provider' as const,
  primary_provider: 'gemini' as const,
  provider_topology: 'subagents' as const,
  requested_execution_path: 'gemini-local-subagents',
};

interface HelpResponse {
  exit_code?: number;
  stdout?: string;
  stderr?: string;
}

function buildAdapter(provider: 'codex' | 'gemini', helpResponse: HelpResponse) {
  const adapters = getDefaultNexusAdapters();
  adapters.local = createRuntimeLocalAdapter({
    runCommand: async (spec) => {
      if (spec.argv[0] === 'which') {
        return { exit_code: 0, stdout: `/usr/local/bin/${provider}\n`, stderr: '' };
      }
      if (spec.argv[0] === provider && spec.argv.includes('--help')) {
        return {
          exit_code: helpResponse.exit_code ?? 0,
          stdout: helpResponse.stdout ?? '',
          stderr: helpResponse.stderr ?? '',
        };
      }
      throw new Error(`unexpected command: ${spec.argv.join(' ')}`);
    },
  });
  return adapters;
}

async function runHandoff(
  provider: 'codex' | 'gemini',
  helpResponse: HelpResponse,
): Promise<{ approved: boolean; reason?: string }> {
  const execution =
    provider === 'codex' ? CODEX_LOCAL_SUBAGENT_EXECUTION : GEMINI_LOCAL_SUBAGENT_EXECUTION;
  let captured: { approved: boolean; reason?: string } | null = null;
  await runInTempRepo(async ({ run }) => {
    const adapters = buildAdapter(provider, helpResponse);
    await run('plan', adapters, execution);

    let throwReason: string | undefined;
    try {
      await run('handoff', adapters, execution);
    } catch (err) {
      throwReason = (err as Error).message;
    }
    const status = await run.readJson('.planning/current/handoff/status.json');
    const validation = status?.route_validation;
    captured = {
      approved: validation?.approved === true,
      reason: validation?.reason ?? throwReason,
    };
  });
  if (captured === null) {
    throw new Error('runInTempRepo did not capture a handoff result');
  }
  return captured;
}

describe('#103 — codex verifyCodexSubagentSupport strictness', () => {
  test('accepts a literal `exec -` line in a Commands: block', async () => {
    const result = await runHandoff('codex', {
      stdout: 'Usage: codex [OPTIONS]\nCommands:\n  exec -\n  review\n',
    });
    expect(result.approved).toBe(true);
  });

  test('rejects descriptive text like "codex exec -i"', async () => {
    // Pre-fix: `output.includes('exec -')` would match "codex exec -i"
    // because the substring `exec -` is present (followed by `i`, not
    // whitespace). Tightened regex requires a whitespace boundary after
    // the dash.
    const result = await runHandoff('codex', {
      stdout: 'Usage: codex [OPTIONS]\nDESCRIPTION\n  Run `codex exec -i` to pipe stdin.\n',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('codex CLI does not support exec -');
  });

  test('accepts when the help text is emitted via stderr only', async () => {
    // Some CLI versions print --help to stderr. The verifier concatenates
    // stdout + stderr before matching, so this still has to work.
    const result = await runHandoff('codex', {
      stdout: '',
      stderr: 'Usage: codex [OPTIONS]\nCommands:\n  exec -\n  review\n',
    });
    expect(result.approved).toBe(true);
  });

  test('rejects when --help exits non-zero, even if flags appear in stdout', async () => {
    // Implementation rejects on non-zero exit before checking flag
    // presence. Pin that ordering — a broken `codex --help` is not
    // the same as a CLI that lacks the feature, and the verifier should
    // not give it the benefit of the doubt just because the broken run
    // happened to print the right substrings.
    const result = await runHandoff('codex', {
      exit_code: 1,
      stdout: 'Usage: codex [OPTIONS]\nCommands:\n  exec -\n  review\n',
      stderr: 'codex: configuration error',
    });
    expect(result.approved).toBe(false);
    // The implementation surfaces the captured stdout+stderr verbatim
    // when it is non-empty, so we pin the diagnostic content rather than
    // a synthetic "failed" message.
    expect(result.reason).toContain('configuration error');
  });

  test('rejects with synthetic message when --help exits non-zero with empty output', async () => {
    const result = await runHandoff('codex', {
      exit_code: 127,
      stdout: '',
      stderr: '',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('codex --help failed');
  });
});

describe('#103 — gemini verifyGeminiSubagentSupport strictness', () => {
  test('accepts when both -p and --yolo appear as standalone flags', async () => {
    const result = await runHandoff('gemini', {
      stdout: 'Usage: gemini [OPTIONS]\n  -p <prompt>\n  --output-format <format>\n  --yolo\n',
    });
    expect(result.approved).toBe(true);
  });

  test('rejects --print / --proxy / --profile masquerading as -p', async () => {
    // Pre-fix: `output.includes('-p')` is true for any of --print, --proxy,
    // --profile. A build of gemini that has --print but not the bare -p
    // short form would have been accepted incorrectly.
    const result = await runHandoff('gemini', {
      stdout: 'Usage: gemini [OPTIONS]\n  --print <file>\n  --proxy <url>\n  --yolo\n',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('gemini CLI does not support -p and --yolo');
  });

  test('rejects --yolo-mode masquerading as --yolo', async () => {
    const result = await runHandoff('gemini', {
      stdout: 'Usage: gemini [OPTIONS]\n  -p <prompt>\n  --yolo-mode <level>\n',
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toContain('gemini CLI does not support -p and --yolo');
  });

  test('accepts when the help text is emitted via stderr only', async () => {
    const result = await runHandoff('gemini', {
      stdout: '',
      stderr: 'Usage: gemini [OPTIONS]\n  -p <prompt>\n  --yolo\n',
    });
    expect(result.approved).toBe(true);
  });

  test('rejects when --help exits non-zero, even if flags appear in stdout', async () => {
    const result = await runHandoff('gemini', {
      exit_code: 1,
      stdout: 'Usage: gemini [OPTIONS]\n  -p <prompt>\n  --yolo\n',
      stderr: 'gemini: not configured',
    });
    expect(result.approved).toBe(false);
    // Same diagnostic-passthrough pattern as the codex case.
    expect(result.reason).toContain('not configured');
  });
});
