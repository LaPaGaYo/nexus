import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { stageAdapterOutputPath, stageAdapterRequestPath, stageNormalizationPath } from '../artifacts';
import {
  buildBuildExecutionPrompt,
  buildPromptContextPreamble,
  buildQaValidationPrompt,
  buildReviewAuditPrompt,
} from './prompt-contracts';
import { createBuildStagePack, createHandoffStagePack, createQaStagePack, createReviewStagePack } from '../stage-packs';
import type { ActualRouteRecord, ConflictRecord } from '../types';
import type { AdapterResult, AdapterTraceability, CcbAdapter, NexusAdapterContext } from './types';

export interface CcbResolveRouteRaw {
  available: boolean;
  provider: string | null;
  mounted: string[];
  verification_command?: string;
  verification_output?: string;
}

export interface CcbExecuteGeneratorRaw {
  receipt: string;
  summary_markdown?: string;
  dispatch_command?: string;
}

export interface CcbExecuteAuditRaw {
  markdown: string;
  receipt: string;
  dispatch_command?: string;
}

export interface CcbExecuteQaRaw {
  report_markdown: string;
  ready: boolean;
  findings: string[];
  receipt: string;
  dispatch_command?: string;
}

export interface CcbToolPaths {
  ask_path: string;
  mounted_path: string;
}

export interface CcbCommandSpec {
  argv: string[];
  cwd: string;
  env: Record<string, string>;
  stdin_text?: string;
  timeout_ms?: number;
}

export interface CcbCommandResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface CreateRuntimeCcbAdapterOptions {
  resolveToolPaths?: () => CcbToolPaths;
  resolveSessionRoot?: (cwd: string) => string;
  runCommand?: (spec: CcbCommandSpec) => Promise<CcbCommandResult>;
  now?: () => string;
}

const DEFAULT_TIMEOUTS_SECONDS = {
  build: '1800',
  review: '900',
  qa: '900',
} as const;

function successResult<TRaw>(
  raw_output: TRaw,
  actual_route: ActualRouteRecord | null,
  requested_route: AdapterResult<TRaw>['requested_route'],
  traceability: AdapterTraceability,
): AdapterResult<TRaw> {
  return {
    adapter_id: 'ccb',
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
    adapter_id: 'ccb',
    outcome: 'blocked',
    raw_output,
    requested_route,
    actual_route: null,
    notices: [message],
    conflict_candidates: [backendConflict(stage, message)],
    traceability,
  };
}

function backendConflict(stage: NexusAdapterContext['stage'], message: string): ConflictRecord {
  return {
    stage,
    adapter: 'ccb',
    kind: 'backend_conflict',
    message,
    canonical_paths: [],
    trace_paths: [
      stageAdapterRequestPath(stage),
      stageAdapterOutputPath(stage),
      stageNormalizationPath(stage),
    ],
  };
}

function inactiveResult(): AdapterResult<null> {
  return {
    adapter_id: 'ccb',
    outcome: 'blocked',
    raw_output: null,
    requested_route: null,
    actual_route: null,
    notices: ['CCB audit seam is reserved for a later milestone'],
    conflict_candidates: [],
  };
}

function expectedProvider(generator: string | null): 'codex' | 'gemini' | null {
  if (generator?.startsWith('codex')) {
    return 'codex';
  }

  if (generator?.startsWith('gemini')) {
    return 'gemini';
  }

  return null;
}

function sanitizeReceiptTimestamp(value: string): string {
  return value.replace(/:/g, '-');
}

function defaultResolveToolPaths(): CcbToolPaths {
  const installBin = join(homedir(), '.local', 'share', 'codex-dual', 'bin');
  const askPath = join(installBin, 'ask');
  const mountedPath = join(installBin, 'ccb-mounted');

  return {
    ask_path: existsSync(askPath) ? askPath : 'ask',
    mounted_path: existsSync(mountedPath) ? mountedPath : 'ccb-mounted',
  };
}

function defaultResolveSessionRoot(cwd: string): string {
  let current = resolve(cwd);

  while (true) {
    if (existsSync(join(current, '.ccb')) || existsSync(join(current, '.ccb_config'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(cwd);
    }

    current = parent;
  }
}

function sessionFileForProvider(root: string, provider: 'codex' | 'gemini' | 'claude'): string | null {
  const primary = join(root, '.ccb', `.${provider}-session`);
  if (existsSync(primary)) {
    return primary;
  }

  const legacy = join(root, '.ccb_config', `.${provider}-session`);
  if (existsSync(legacy)) {
    return legacy;
  }

  return primary;
}

function defaultRunCommand(spec: CcbCommandSpec): Promise<CcbCommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(spec.argv[0], spec.argv.slice(1), {
      cwd: spec.cwd,
      env: {
        ...process.env,
        ...spec.env,
      },
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finalize = (result: CcbCommandResult) => {
      if (settled) {
        return;
      }

      settled = true;
      resolvePromise(result);
    };

    let timeoutHandle: Timer | null = null;
    if (spec.timeout_ms && spec.timeout_ms > 0) {
      timeoutHandle = setTimeout(() => {
        child.kill('SIGKILL');
        finalize({
          exit_code: 124,
          stdout,
          stderr: `${stderr}${stderr ? '\n' : ''}[TIMEOUT] command exceeded ${spec.timeout_ms}ms`,
        });
      }, spec.timeout_ms);
    }

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
      if (!settled) {
        reject(error);
      }
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

function describeCommand(argv: string[]): string {
  return argv.join(' ');
}

function buildActualRoute(
  provider: 'codex' | 'gemini' | null,
  route: string | null,
  substrate: string | null,
  stage: 'handoff' | 'build' | 'review' | 'qa',
): ActualRouteRecord {
  return {
    provider,
    route,
    substrate,
    transport: 'ccb',
    receipt_path: stageAdapterOutputPath(stage),
  };
}

function buildGeneratorPrompt(ctx: NexusAdapterContext): string {
  return buildBuildExecutionPrompt(ctx, 'Nexus governed stage');
}

function buildAuditPrompt(
  ctx: NexusAdapterContext,
  provider: 'codex' | 'gemini',
): string {
  const header = provider === 'codex' ? '# Codex Audit' : '# Gemini Audit';

  return buildReviewAuditPrompt(
    ctx,
    'Nexus governed stage',
    `Perform the governed Nexus /review audit for the ${provider} path.`,
    header,
  );
}

function buildQaPrompt(ctx: NexusAdapterContext): string {
  return buildQaValidationPrompt(
    ctx,
    'Nexus governed stage',
    'Perform the governed Nexus /qa validation for this repository.',
    [
      'Required JSON schema:',
      'Set ready=false and include findings when defects remain.',
      'report_markdown must begin with "# QA Report" and include a "Result:" line.',
    ],
  );
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
  if (lines.length < 3) {
    return trimmed;
  }

  return lines.slice(1, -1).join('\n').trim();
}

function extractJsonObject(text: string): string {
  const normalized = stripMarkdownFences(text);
  const firstBrace = normalized.indexOf('{');
  const lastBrace = normalized.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error('Malformed QA response: no JSON object found');
  }

  return normalized.slice(firstBrace, lastBrace + 1);
}

function parseQaPayload(stdout: string): Omit<CcbExecuteQaRaw, 'receipt' | 'dispatch_command'> {
  const normalized = extractJsonObject(stdout);
  let parsed: {
    ready?: unknown;
    findings?: unknown;
    report_markdown?: unknown;
  };

  try {
    parsed = JSON.parse(normalized) as {
      ready?: unknown;
      findings?: unknown;
      report_markdown?: unknown;
    };
  } catch (error) {
    throw new Error(`Malformed QA response: ${error instanceof Error ? error.message : String(error)}`);
  }
  const findings = Array.isArray(parsed.findings)
    ? parsed.findings.filter((value): value is string => typeof value === 'string')
    : null;

  if (typeof parsed.ready !== 'boolean' || typeof parsed.report_markdown !== 'string' || findings === null) {
    throw new Error('Malformed QA response: expected JSON with ready, findings, and report_markdown');
  }

  return {
    ready: parsed.ready,
    findings,
    report_markdown: parsed.report_markdown.trim(),
  };
}

function buildRouteCheckPrompt(ctx: NexusAdapterContext, provider: 'codex' | 'gemini'): string {
  return [
    buildPromptContextPreamble(ctx, 'Nexus governed stage'),
    `Run a Nexus governed route availability check for provider ${provider}.`,
    'Reply exactly with: Nexus route check ok',
  ].join('\n');
}

async function runRouteVerification(
  ctx: NexusAdapterContext,
  traceability: AdapterTraceability,
  options: Required<CreateRuntimeCcbAdapterOptions>,
): Promise<AdapterResult<CcbResolveRouteRaw>> {
  const provider = expectedProvider(ctx.requested_route?.generator ?? null);
  if (!ctx.requested_route || !provider) {
    return blockedResult(
      ctx.stage,
      'Nexus requested route is missing a supported CCB provider',
      {
        available: false,
        provider,
        mounted: [],
      },
      ctx.requested_route,
      traceability,
    );
  }

  const dispatch = await runAskDispatch(
    ctx,
    provider,
    'handoff',
    buildRouteCheckPrompt(ctx, provider),
    traceability,
    options,
  );

  if ('adapter_id' in dispatch) {
    return dispatch;
  }

  return successResult<CcbResolveRouteRaw>(
    {
      available: true,
      provider,
      mounted: [provider],
      verification_command: describeCommand([
        options.resolveToolPaths().ask_path,
        provider,
        '--foreground',
        '--no-wrap',
        '--timeout',
        '30',
      ]),
      verification_output: dispatch.stdout.trim(),
    },
    buildActualRoute(provider, ctx.requested_route.generator, ctx.requested_route.substrate, 'handoff'),
    ctx.requested_route,
    traceability,
  );
}

async function runAskDispatch(
  ctx: NexusAdapterContext,
  provider: 'codex' | 'gemini',
  stage: 'handoff' | 'build' | 'review' | 'qa',
  prompt: string,
  traceability: AdapterTraceability,
  options: Required<CreateRuntimeCcbAdapterOptions>,
): Promise<CcbCommandResult | AdapterResult<any>> {
  const toolPaths = options.resolveToolPaths();
  const sessionRoot = options.resolveSessionRoot(ctx.cwd);
  const sessionFile = sessionFileForProvider(sessionRoot, provider);

  const argv = [
    toolPaths.ask_path,
    provider,
    '--foreground',
    '--no-wrap',
    '--timeout',
    stage === 'handoff' ? '30' : DEFAULT_TIMEOUTS_SECONDS[stage],
  ];

  let execution: CcbCommandResult;
  try {
    execution = await options.runCommand({
      argv,
      cwd: ctx.cwd,
      env: {
        CCB_CALLER: 'claude',
        CCB_ASKD_AUTOSTART: '1',
        CCB_ALLOW_FOREGROUND: '1',
        CCB_SESSION_FILE: sessionFile,
      },
      stdin_text: prompt,
      timeout_ms: Number(stage === 'handoff' ? '30' : DEFAULT_TIMEOUTS_SECONDS[stage]) * 1000 + 10_000,
    });
  } catch (error) {
    return blockedResult(
      ctx.stage,
      error instanceof Error ? error.message : String(error),
      {
        receipt: '',
        dispatch_command: describeCommand(argv),
      },
      ctx.requested_route,
      traceability,
    );
  }

  if (execution.exit_code !== 0) {
    return blockedResult(
      ctx.stage,
      execution.stderr.trim() || `CCB ${provider} dispatch failed`,
      {
        receipt: '',
        dispatch_command: describeCommand(argv),
      },
      ctx.requested_route,
      traceability,
    );
  }

  return execution;
}

export function createDefaultCcbAdapter(): CcbAdapter {
  const handoffPack = createHandoffStagePack();
  const buildPack = createBuildStagePack();
  const reviewPack = createReviewStagePack();
  const qaPack = createQaStagePack();

  return {
    resolve_route: async (ctx) => {
      const resolved = handoffPack.buildResolvedRoute(ctx);

      return successResult<CcbResolveRouteRaw>(
        resolved.raw_output,
        resolved.actual_route,
        ctx.requested_route,
        handoffPack.traceability(),
      );
    },
    execute_generator: async (ctx) => {
      const execution = buildPack.buildGeneratorExecution(ctx);

      return successResult<CcbExecuteGeneratorRaw>(
        execution.raw_output,
        execution.actual_route,
        ctx.requested_route,
        buildPack.executionTraceability(),
      );
    },
    execute_audit_a: async (ctx) =>
      successResult<CcbExecuteAuditRaw>(
        {
          markdown: reviewPack.buildAuditMarkdown('codex'),
          receipt: 'ccb-review-codex',
        },
        {
          provider: 'codex',
          route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb',
          receipt_path: '.planning/current/review/adapter-output.json',
        },
        ctx.requested_route,
        reviewPack.auditTraceability('codex'),
      ),
    execute_audit_b: async (ctx) =>
      successResult<CcbExecuteAuditRaw>(
        {
          markdown: reviewPack.buildAuditMarkdown('gemini'),
          receipt: 'ccb-review-gemini',
        },
        {
          provider: 'gemini',
          route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb',
          receipt_path: '.planning/current/review/adapter-output.json',
        },
        ctx.requested_route,
        reviewPack.auditTraceability('gemini'),
      ),
    execute_qa: async (ctx) =>
      successResult<CcbExecuteQaRaw>(
        {
          report_markdown: qaPack.buildQaReport(ctx, true, []),
          ready: true,
          findings: [],
          receipt: 'ccb-qa',
        },
        {
          provider: 'gemini',
          route: ctx.requested_route?.generator ?? 'gemini-via-ccb',
          substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
          transport: 'ccb',
          receipt_path: '.planning/current/qa/adapter-output.json',
        },
        ctx.requested_route,
        qaPack.validationTraceability(),
      ),
  };
}

export function createRuntimeCcbAdapter(
  providedOptions: CreateRuntimeCcbAdapterOptions = {},
): CcbAdapter {
  const handoffPack = createHandoffStagePack();
  const buildPack = createBuildStagePack();
  const reviewPack = createReviewStagePack();
  const qaPack = createQaStagePack();
  const options: Required<CreateRuntimeCcbAdapterOptions> = {
    resolveToolPaths: providedOptions.resolveToolPaths ?? defaultResolveToolPaths,
    resolveSessionRoot: providedOptions.resolveSessionRoot ?? defaultResolveSessionRoot,
    runCommand: providedOptions.runCommand ?? defaultRunCommand,
    now: providedOptions.now ?? (() => new Date().toISOString()),
  };

  return {
    resolve_route: async (ctx) => runRouteVerification(ctx, handoffPack.traceability(), options),
    execute_generator: async (ctx) => {
      const traceability = buildPack.executionTraceability();
      const execution = await runAskDispatch(
        ctx,
        expectedProvider(ctx.requested_route?.generator ?? null) ?? 'codex',
        'build',
        buildGeneratorPrompt(ctx),
        traceability,
        options,
      );

      if ('adapter_id' in execution) {
        return execution;
      }

      const provider = expectedProvider(ctx.requested_route?.generator ?? null);
      const receipt = `ccb-build-${provider ?? 'unknown'}-${sanitizeReceiptTimestamp(options.now())}`;

      return successResult<CcbExecuteGeneratorRaw>(
        {
          receipt,
          summary_markdown: execution.stdout.trim(),
          dispatch_command: describeCommand([
            options.resolveToolPaths().ask_path,
            provider ?? 'codex',
            '--foreground',
            '--no-wrap',
            '--timeout',
            DEFAULT_TIMEOUTS_SECONDS.build,
          ]),
        },
        buildActualRoute(provider, ctx.requested_route?.generator ?? null, ctx.requested_route?.substrate ?? null, 'build'),
        ctx.requested_route,
        traceability,
      );
    },
    execute_audit_a: async (ctx) => {
      const traceability = reviewPack.auditTraceability('codex');
      const execution = await runAskDispatch(
        ctx,
        'codex',
        'review',
        buildAuditPrompt(ctx, 'codex'),
        traceability,
        options,
      );

      if ('adapter_id' in execution) {
        return execution;
      }

      return successResult<CcbExecuteAuditRaw>(
        {
          markdown: execution.stdout.trim(),
          receipt: `ccb-review-codex-${sanitizeReceiptTimestamp(options.now())}`,
          dispatch_command: describeCommand([
            options.resolveToolPaths().ask_path,
            'codex',
            '--foreground',
            '--no-wrap',
            '--timeout',
            DEFAULT_TIMEOUTS_SECONDS.review,
          ]),
        },
        buildActualRoute('codex', ctx.requested_route?.evaluator_a ?? 'codex-via-ccb', ctx.requested_route?.substrate ?? null, 'review'),
        ctx.requested_route,
        traceability,
      );
    },
    execute_audit_b: async (ctx) => {
      const traceability = reviewPack.auditTraceability('gemini');
      const execution = await runAskDispatch(
        ctx,
        'gemini',
        'review',
        buildAuditPrompt(ctx, 'gemini'),
        traceability,
        options,
      );

      if ('adapter_id' in execution) {
        return execution;
      }

      return successResult<CcbExecuteAuditRaw>(
        {
          markdown: execution.stdout.trim(),
          receipt: `ccb-review-gemini-${sanitizeReceiptTimestamp(options.now())}`,
          dispatch_command: describeCommand([
            options.resolveToolPaths().ask_path,
            'gemini',
            '--foreground',
            '--no-wrap',
            '--timeout',
            DEFAULT_TIMEOUTS_SECONDS.review,
          ]),
        },
        buildActualRoute('gemini', ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb', ctx.requested_route?.substrate ?? null, 'review'),
        ctx.requested_route,
        traceability,
      );
    },
    execute_qa: async (ctx) => {
      const traceability = qaPack.validationTraceability();
      const execution = await runAskDispatch(
        ctx,
        'gemini',
        'qa',
        buildQaPrompt(ctx),
        traceability,
        options,
      );

      if ('adapter_id' in execution) {
        return execution;
      }

      try {
        const parsed = parseQaPayload(execution.stdout);

        return successResult<CcbExecuteQaRaw>(
          {
            ...parsed,
            receipt: `ccb-qa-gemini-${sanitizeReceiptTimestamp(options.now())}`,
            dispatch_command: describeCommand([
              options.resolveToolPaths().ask_path,
              'gemini',
              '--foreground',
              '--no-wrap',
              '--timeout',
              DEFAULT_TIMEOUTS_SECONDS.qa,
            ]),
          },
          buildActualRoute('gemini', ctx.requested_route?.generator ?? 'gemini-via-ccb', ctx.requested_route?.substrate ?? null, 'qa'),
          ctx.requested_route,
          traceability,
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
            dispatch_command: describeCommand([
              options.resolveToolPaths().ask_path,
              'gemini',
              '--foreground',
              '--no-wrap',
              '--timeout',
              DEFAULT_TIMEOUTS_SECONDS.qa,
            ]),
          },
          ctx.requested_route,
          traceability,
        );
      }
    },
  };
}
