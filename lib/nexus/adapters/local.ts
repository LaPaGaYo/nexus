import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import type { ActualRouteRecord, ConflictRecord, PrimaryProvider, ProviderTopology } from '../types';
import type { AdapterResult, AdapterTraceability, LocalAdapter, NexusAdapterContext } from './types';

export interface LocalResolveRouteRaw {
  available: boolean;
  provider: PrimaryProvider | null;
  topology: ProviderTopology;
  verification_command?: string;
  verification_output?: string;
}

export interface LocalExecuteGeneratorRaw {
  receipt: string;
  summary_markdown?: string;
  dispatch_command?: string;
}

export interface LocalExecuteAuditRaw {
  markdown: string;
  receipt: string;
  dispatch_command?: string;
}

export interface LocalExecuteQaRaw {
  report_markdown: string;
  ready: boolean;
  findings: string[];
  receipt: string;
  dispatch_command?: string;
}

interface LocalCommandSpec {
  argv: string[];
  cwd: string;
  stdin_text?: string;
  timeout_ms?: number;
}

interface LocalCommandResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface CreateRuntimeLocalAdapterOptions {
  runCommand?: (spec: LocalCommandSpec) => Promise<LocalCommandResult>;
  now?: () => string;
}

const DEFAULT_TIMEOUTS_MS = {
  handoff: 30_000,
  build: 1_810_000,
  review: 910_000,
  qa: 910_000,
} as const;

function backendConflict(stage: NexusAdapterContext['stage'], message: string): ConflictRecord {
  return {
    stage,
    adapter: 'local',
    kind: 'backend_conflict',
    message,
    canonical_paths: [],
    trace_paths: [],
  };
}

function successResult<TRaw>(
  raw_output: TRaw,
  actual_route: ActualRouteRecord | null,
  requested_route: AdapterResult<TRaw>['requested_route'],
  traceability: AdapterTraceability,
): AdapterResult<TRaw> {
  return {
    adapter_id: 'local',
    outcome: 'success',
    raw_output,
    requested_route,
    actual_route,
    notices: [],
    conflict_candidates: [],
    traceability,
  };
}

function blockedResult<TRaw>(
  stage: NexusAdapterContext['stage'],
  message: string,
  raw_output: TRaw,
  requested_route: AdapterResult<TRaw>['requested_route'],
  traceability: AdapterTraceability,
): AdapterResult<TRaw> {
  return {
    adapter_id: 'local',
    outcome: 'blocked',
    raw_output,
    requested_route,
    actual_route: null,
    notices: [message],
    conflict_candidates: [backendConflict(stage, message)],
    traceability,
  };
}

function defaultRunCommand(spec: LocalCommandSpec): Promise<LocalCommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(spec.argv[0], spec.argv.slice(1), {
      cwd: spec.cwd,
      env: process.env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finalize = (result: LocalCommandResult) => {
      if (settled) {
        return;
      }
      settled = true;
      resolvePromise(result);
    };

    const timeoutHandle = spec.timeout_ms
      ? setTimeout(() => {
          child.kill('SIGKILL');
          finalize({
            exit_code: 124,
            stdout,
            stderr: `${stderr}${stderr ? '\n' : ''}[TIMEOUT] command exceeded ${spec.timeout_ms}ms`,
          });
        }, spec.timeout_ms)
      : null;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      reject(error);
    });
    child.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      finalize({
        exit_code: code ?? 1,
        stdout,
        stderr,
      });
    });

    if (spec.stdin_text) {
      child.stdin.write(spec.stdin_text);
    }
    child.stdin.end();
  });
}

function localTraceability(absorbedCapability: string): AdapterTraceability {
  return {
    nexus_stage_pack: absorbedCapability.includes('review')
      ? 'nexus-review-pack'
      : absorbedCapability.includes('qa')
        ? 'nexus-qa-pack'
        : absorbedCapability.includes('handoff')
          ? 'nexus-handoff-pack'
          : 'nexus-build-pack',
    absorbed_capability: absorbedCapability,
    source_map: [],
  };
}

function buildActualRoute(
  provider: PrimaryProvider,
  route: string | null,
  substrate: string | null,
  stage: 'handoff' | 'build' | 'review' | 'qa',
): ActualRouteRecord {
  return {
    provider,
    route,
    substrate,
    transport: 'local',
    receipt_path: `.planning/current/${stage}/adapter-output.json`,
  };
}

function describeCommand(argv: string[]): string {
  return argv.join(' ');
}

function providerCommand(provider: PrimaryProvider): string {
  switch (provider) {
    case 'claude':
      return 'claude';
    case 'codex':
      return 'codex';
    case 'gemini':
      return 'gemini';
  }
}

function sanitizeTimestamp(value: string): string {
  return value.replace(/[:.]/g, '-');
}

function buildContextPreamble(ctx: NexusAdapterContext): string {
  return [
    `Nexus stage: ${ctx.stage}`,
    `Run ID: ${ctx.run_id}`,
    `Command: ${ctx.command}`,
    `Repository cwd: ${ctx.cwd}`,
    '',
    'Use only repo-visible artifacts as the source of truth.',
    'Do not rely on hidden session memory or unstated prior context.',
    '',
    'Predecessor artifacts:',
    ...ctx.predecessor_artifacts.map((artifact) => `- ${artifact.path}`),
    '',
    'Requested route:',
    JSON.stringify(ctx.requested_route, null, 2),
    '',
  ].join('\n');
}

function buildGeneratorPrompt(ctx: NexusAdapterContext): string {
  return [
    buildContextPreamble(ctx),
    'Execute the bounded Nexus /build contract for this repository.',
    'Apply repository changes only if the repo-visible governed artifacts require them.',
    'After execution, reply with markdown only in this form:',
    '# Build Execution Summary',
    '',
    '- Status: completed | blocked',
    '- Actions: ...',
    '- Files touched: ...',
    '- Verification: ...',
    '',
    'If the contract is missing or inconsistent, say so explicitly in the summary.',
  ].join('\n');
}

function buildAuditPrompt(ctx: NexusAdapterContext, slot: 'a' | 'b'): string {
  return [
    buildContextPreamble(ctx),
    `Perform local Nexus /review audit pass ${slot.toUpperCase()}.`,
    'Review the current repo state and relevant changed files independently.',
    'Reply with markdown only in this exact shape:',
    `# Local Audit ${slot.toUpperCase()}`,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
  ].join('\n');
}

function buildQaPrompt(ctx: NexusAdapterContext): string {
  return [
    buildContextPreamble(ctx),
    'Perform Nexus /qa validation for this repository.',
    'Return JSON only, with no code fences and no extra prose.',
    JSON.stringify(
      {
        ready: true,
        findings: ['example finding'],
        report_markdown: '# QA Report\n\nResult: pass\n',
      },
      null,
      2,
    ),
  ].join('\n');
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
  return lines.slice(1, -1).join('\n').trim();
}

function parseQaPayload(stdout: string): Omit<LocalExecuteQaRaw, 'receipt' | 'dispatch_command'> {
  const normalized = stripMarkdownFences(stdout);
  const firstBrace = normalized.indexOf('{');
  const lastBrace = normalized.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Malformed QA response: no JSON object found');
  }

  const parsed = JSON.parse(normalized.slice(firstBrace, lastBrace + 1)) as {
    ready?: unknown;
    findings?: unknown;
    report_markdown?: unknown;
  };

  if (
    typeof parsed.ready !== 'boolean'
    || typeof parsed.report_markdown !== 'string'
    || !Array.isArray(parsed.findings)
    || parsed.findings.some((finding) => typeof finding !== 'string')
  ) {
    throw new Error('Malformed QA response: expected ready, findings, and report_markdown');
  }

  return {
    ready: parsed.ready,
    findings: parsed.findings,
    report_markdown: parsed.report_markdown.trim(),
  };
}

async function runProviderCommand(
  provider: PrimaryProvider,
  prompt: string,
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{ stdout: string; stderr: string; argv: string[] }> {
  if (provider === 'claude') {
    const argv = [
      'claude',
      '-p',
      '--output-format',
      'text',
      '--dangerously-skip-permissions',
    ];
    const result = await runCommand({ argv, cwd, stdin_text: prompt, timeout_ms: timeoutMs });
    return { stdout: result.stdout, stderr: result.stderr, argv };
  }

  if (provider === 'codex') {
    const tempDir = mkdtempSync(join(tmpdir(), 'nexus-local-codex-'));
    const outputPath = join(tempDir, 'last-message.txt');
    const argv = [
      'codex',
      'exec',
      '-',
      '--output-last-message',
      outputPath,
      '--dangerously-bypass-approvals-and-sandbox',
      '-s',
      'workspace-write',
    ];
    try {
      const result = await runCommand({ argv, cwd, stdin_text: prompt, timeout_ms: timeoutMs });
      return {
        stdout: readFileSync(outputPath, 'utf8'),
        stderr: result.stderr,
        argv,
      };
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  const argv = [
    'gemini',
    '-p',
    prompt,
    '--output-format',
    'text',
    '--yolo',
  ];
  const result = await runCommand({ argv, cwd, timeout_ms: timeoutMs });
  return { stdout: result.stdout, stderr: result.stderr, argv };
}

export function createDefaultLocalAdapter(): LocalAdapter {
  return {
    resolve_route: async (ctx) => successResult<LocalResolveRouteRaw>(
      {
        available: true,
        provider: ctx.ledger.execution.primary_provider,
        topology: ctx.ledger.execution.provider_topology,
      },
      buildActualRoute(
        ctx.ledger.execution.primary_provider,
        ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path,
        ctx.requested_route?.substrate ?? 'superpowers-core',
        'handoff',
      ),
      ctx.requested_route,
      localTraceability('local-provider-routing'),
    ),
    execute_generator: async (ctx) => successResult<LocalExecuteGeneratorRaw>(
      {
        receipt: `local-build-${ctx.ledger.execution.primary_provider}`,
        summary_markdown: '# Build Execution Summary\n\n- Status: completed\n- Actions: local provider build\n- Files touched: none\n- Verification: placeholder\n',
      },
      buildActualRoute(
        ctx.ledger.execution.primary_provider,
        ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path,
        ctx.requested_route?.substrate ?? 'superpowers-core',
        'build',
      ),
      ctx.requested_route,
      localTraceability('local-provider-execution'),
    ),
    execute_audit_a: async (ctx) => successResult<LocalExecuteAuditRaw>(
      {
        markdown: '# Local Audit A\n\nResult: pass\n\nFindings:\n- none\n',
        receipt: `local-review-a-${ctx.ledger.execution.primary_provider}`,
      },
      buildActualRoute(
        ctx.ledger.execution.primary_provider,
        ctx.requested_route?.evaluator_a ?? ctx.ledger.execution.requested_path,
        ctx.requested_route?.substrate ?? 'superpowers-core',
        'review',
      ),
      ctx.requested_route,
      localTraceability('local-provider-review-a'),
    ),
    execute_audit_b: async (ctx) => successResult<LocalExecuteAuditRaw>(
      {
        markdown: '# Local Audit B\n\nResult: pass\n\nFindings:\n- none\n',
        receipt: `local-review-b-${ctx.ledger.execution.primary_provider}`,
      },
      buildActualRoute(
        ctx.ledger.execution.primary_provider,
        ctx.requested_route?.evaluator_b ?? ctx.ledger.execution.requested_path,
        ctx.requested_route?.substrate ?? 'superpowers-core',
        'review',
      ),
      ctx.requested_route,
      localTraceability('local-provider-review-b'),
    ),
    execute_qa: async (ctx) => successResult<LocalExecuteQaRaw>(
      {
        report_markdown: '# QA Report\n\nResult: pass\n',
        ready: true,
        findings: [],
        receipt: `local-qa-${ctx.ledger.execution.primary_provider}`,
      },
      buildActualRoute(
        ctx.ledger.execution.primary_provider,
        ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path,
        ctx.requested_route?.substrate ?? 'superpowers-core',
        'qa',
      ),
      ctx.requested_route,
      localTraceability('local-provider-qa'),
    ),
  };
}

export function createRuntimeLocalAdapter(
  providedOptions: CreateRuntimeLocalAdapterOptions = {},
): LocalAdapter {
  const runCommand = providedOptions.runCommand ?? defaultRunCommand;
  const now = providedOptions.now ?? (() => new Date().toISOString());

  return {
    resolve_route: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      try {
        const result = await runCommand({
          argv: ['which', providerCommand(provider)],
          cwd: ctx.cwd,
          timeout_ms: DEFAULT_TIMEOUTS_MS.handoff,
        });
        if (result.exit_code !== 0) {
          return blockedResult(
            ctx.stage,
            result.stderr.trim() || `${provider} CLI is not available for local_provider mode`,
            {
              available: false,
              provider,
              topology: ctx.ledger.execution.provider_topology,
              verification_command: `which ${providerCommand(provider)}`,
              verification_output: result.stdout.trim(),
            },
            ctx.requested_route,
            localTraceability('local-provider-routing'),
          );
        }

        return successResult<LocalResolveRouteRaw>(
          {
            available: true,
            provider,
            topology: ctx.ledger.execution.provider_topology,
            verification_command: `which ${providerCommand(provider)}`,
            verification_output: result.stdout.trim(),
          },
          buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'handoff'),
          ctx.requested_route,
          localTraceability('local-provider-routing'),
        );
      } catch (error) {
        return blockedResult(
          ctx.stage,
          error instanceof Error ? error.message : String(error),
          {
            available: false,
            provider,
            topology: ctx.ledger.execution.provider_topology,
          },
          ctx.requested_route,
          localTraceability('local-provider-routing'),
        );
      }
    },
    execute_generator: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      try {
        const execution = await runProviderCommand(
          provider,
          buildGeneratorPrompt(ctx),
          ctx.cwd,
          DEFAULT_TIMEOUTS_MS.build,
          runCommand,
        );

        return successResult<LocalExecuteGeneratorRaw>(
          {
            receipt: `local-build-${provider}-${sanitizeTimestamp(now())}`,
            summary_markdown: execution.stdout.trim(),
            dispatch_command: describeCommand(execution.argv),
          },
          buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'build'),
          ctx.requested_route,
          localTraceability('local-provider-execution'),
        );
      } catch (error) {
        return blockedResult(
          ctx.stage,
          error instanceof Error ? error.message : String(error),
          {
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-execution'),
        );
      }
    },
    execute_audit_a: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      try {
        const execution = await runProviderCommand(
          provider,
          buildAuditPrompt(ctx, 'a'),
          ctx.cwd,
          DEFAULT_TIMEOUTS_MS.review,
          runCommand,
        );

        return successResult<LocalExecuteAuditRaw>(
          {
            markdown: execution.stdout.trim(),
            receipt: `local-review-a-${provider}-${sanitizeTimestamp(now())}`,
            dispatch_command: describeCommand(execution.argv),
          },
          buildActualRoute(provider, ctx.requested_route?.evaluator_a ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'review'),
          ctx.requested_route,
          localTraceability('local-provider-review-a'),
        );
      } catch (error) {
        return blockedResult(
          ctx.stage,
          error instanceof Error ? error.message : String(error),
          {
            markdown: '',
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-review-a'),
        );
      }
    },
    execute_audit_b: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      try {
        const execution = await runProviderCommand(
          provider,
          buildAuditPrompt(ctx, 'b'),
          ctx.cwd,
          DEFAULT_TIMEOUTS_MS.review,
          runCommand,
        );

        return successResult<LocalExecuteAuditRaw>(
          {
            markdown: execution.stdout.trim(),
            receipt: `local-review-b-${provider}-${sanitizeTimestamp(now())}`,
            dispatch_command: describeCommand(execution.argv),
          },
          buildActualRoute(provider, ctx.requested_route?.evaluator_b ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'review'),
          ctx.requested_route,
          localTraceability('local-provider-review-b'),
        );
      } catch (error) {
        return blockedResult(
          ctx.stage,
          error instanceof Error ? error.message : String(error),
          {
            markdown: '',
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-review-b'),
        );
      }
    },
    execute_qa: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      try {
        const execution = await runProviderCommand(
          provider,
          buildQaPrompt(ctx),
          ctx.cwd,
          DEFAULT_TIMEOUTS_MS.qa,
          runCommand,
        );
        const parsed = parseQaPayload(execution.stdout);

        return successResult<LocalExecuteQaRaw>(
          {
            ...parsed,
            receipt: `local-qa-${provider}-${sanitizeTimestamp(now())}`,
            dispatch_command: describeCommand(execution.argv),
          },
          buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'qa'),
          ctx.requested_route,
          localTraceability('local-provider-qa'),
        );
      } catch (error) {
        return blockedResult(
          ctx.stage,
          error instanceof Error ? error.message : String(error),
          {
            report_markdown: '',
            ready: false,
            findings: [],
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-qa'),
        );
      }
    },
  };
}
