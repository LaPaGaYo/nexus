import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import {
  buildBuildExecutionPrompt,
  buildPromptContextPreamble,
  buildQaValidationPrompt,
  buildReviewAuditPrompt,
} from './prompt-contracts';
import { createBuildStagePack, createQaStagePack, createReviewStagePack, getStagePackSourceMap } from '../stage-packs';
import type {
  ActualRouteRecord,
  ConflictRecord,
  LearningCandidate,
  LocalReviewPersonaRole,
  LocalShipPersonaRole,
  NexusStagePackId,
  PrimaryProvider,
  ProviderTopology,
} from '../types';
import { reviewPersonaAuditPath, shipPersonaGatePath } from '../artifacts';
import type { AdapterResult, AdapterTraceability, LocalAdapter, NexusAdapterContext } from './types';

export interface LocalResolveRouteRaw {
  available: boolean;
  provider: PrimaryProvider | null;
  topology: ProviderTopology;
  verification_command?: string;
  verification_output?: string;
  verification_commands?: string[];
}

export interface LocalExecuteGeneratorRaw {
  receipt: string;
  summary_markdown?: string;
  dispatch_command?: string;
  dispatch_commands?: string[];
  agent_roles?: string[];
}

export interface LocalExecuteAuditRaw {
  markdown: string;
  receipt: string;
  learning_candidates?: LearningCandidate[];
  dispatch_command?: string;
  dispatch_commands?: string[];
  agent_roles?: string[];
  persona_group?: 'code_test' | 'security_design';
  persona_audits?: LocalReviewPersonaAuditRaw[];
}

export interface LocalExecuteShipPersonasRaw {
  release_gate_record: string;
  merge_ready: boolean;
  persona_gates: LocalShipPersonaGateRaw[];
  receipt: string;
  dispatch_command?: string;
  dispatch_commands?: string[];
  agent_roles?: string[];
}

export interface LocalExecuteQaRaw {
  report_markdown: string;
  ready: boolean;
  findings: string[];
  advisories?: string[];
  learning_candidates?: LearningCandidate[];
  receipt: string;
  dispatch_command?: string;
  dispatch_commands?: string[];
  agent_roles?: string[];
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
  ship: 910_000,
} as const;

interface ActiveLocalTopology {
  mode: 'single_agent' | 'claude_subagents' | 'claude_agent_team' | 'codex_subagents' | 'codex_multi_session' | 'gemini_subagents';
}

type LocalSupportVerification =
  | { ok: true; verificationCommands: string[]; verificationOutput: string }
  | { ok: false; message: string; verificationCommands: string[]; verificationOutput: string };

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

function activeLocalTopology(provider: PrimaryProvider, topology: ProviderTopology): ActiveLocalTopology | string {
  if (topology === 'single_agent') {
    return { mode: 'single_agent' };
  }

  if (topology === 'subagents') {
    if (provider === 'claude') {
      return { mode: 'claude_subagents' };
    }

    if (provider === 'codex') {
      return { mode: 'codex_subagents' };
    }

    if (provider === 'gemini') {
      return { mode: 'gemini_subagents' };
    }

    return 'local_provider topology subagents is only active for claude, codex, or gemini';
  }

  if (topology === 'agent_team') {
    if (provider === 'claude') {
      return { mode: 'claude_agent_team' };
    }

    return 'local_provider topology agent_team is only active for claude';
  }

  if (topology === 'multi_session') {
    if (provider === 'codex') {
      return { mode: 'codex_multi_session' };
    }

    return 'local_provider topology multi_session is only active for codex';
  }

  return `local_provider topology ${topology} is reserved and not yet active`;
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
      env: {
        ...process.env,
        PWD: spec.cwd,
      },
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

const LOCAL_ABSORBED_CAPABILITY_TO_PACK: Record<string, NexusStagePackId> = {
  'local-provider-routing': 'nexus-handoff-pack',
  'local-provider-execution': 'nexus-build-pack',
  'local-provider-review-a': 'nexus-review-pack',
  'local-provider-review-b': 'nexus-review-pack',
  'local-provider-qa': 'nexus-qa-pack',
  'local-provider-ship-personas': 'nexus-ship-pack',
};

export function localTraceability(absorbedCapability: string): AdapterTraceability {
  const packId = LOCAL_ABSORBED_CAPABILITY_TO_PACK[absorbedCapability];

  if (!packId) {
    throw new Error(`localTraceability: unknown absorbedCapability '${absorbedCapability}' - add it to LOCAL_ABSORBED_CAPABILITY_TO_PACK`);
  }

  return {
    nexus_stage_pack: packId,
    absorbed_capability: absorbedCapability,
    source_map: getStagePackSourceMap(packId),
  };
}

function buildActualRoute(
  provider: PrimaryProvider,
  route: string | null,
  substrate: string | null,
  stage: 'handoff' | 'build' | 'review' | 'qa' | 'ship',
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

interface LocalRoleAgent {
  name: string;
  description: string;
  systemPrompt: string;
}

interface LocalReviewPersonaAgent extends LocalRoleAgent {
  role: LocalReviewPersonaRole;
  gateAffecting: boolean;
}

interface LocalShipPersonaAgent extends LocalRoleAgent {
  role: LocalShipPersonaRole;
  gateAffecting: boolean;
}

export interface LocalReviewPersonaAuditRaw {
  role: LocalReviewPersonaRole;
  markdown: string;
  verdict: 'pass' | 'fail';
  gate_affecting: boolean;
  artifact_path: string;
}

export interface LocalShipPersonaGateRaw {
  role: LocalShipPersonaRole;
  markdown: string;
  verdict: 'pass' | 'fail';
  gate_affecting: boolean;
  artifact_path: string;
}

function localCommandFailureMessage(label: string, result: LocalCommandResult): string {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${result.exit_code}`;
  return `${label} failed: ${detail}`;
}

function buildGeneratorPrompt(ctx: NexusAdapterContext): string {
  return buildBuildExecutionPrompt(ctx, 'Nexus stage');
}

function buildBuildVerifierPrompt(ctx: NexusAdapterContext, builderSummary: string): string {
  return [
    buildPromptContextPreamble(ctx, 'Nexus stage'),
    'Verify the current repository state after the local build subagent ran.',
    'Reply with exactly one markdown bullet in this form:',
    '- Verification: ...',
    '',
    'Builder summary:',
    builderSummary.trim(),
  ].join('\n');
}

function buildAuditPrompt(ctx: NexusAdapterContext, slot: 'a' | 'b'): string {
  return buildReviewAuditPrompt(
    ctx,
    'Nexus stage',
    `Perform local Nexus /review audit pass ${slot.toUpperCase()}.`,
    `# Local Audit ${slot.toUpperCase()}`,
  );
}

function titleCaseRole(role: LocalReviewPersonaRole): string {
  return role[0].toUpperCase() + role.slice(1);
}

function reviewPersonaFocus(role: LocalReviewPersonaRole): string {
  switch (role) {
    case 'code':
      return 'Correctness, implementation completeness, architecture fit, error handling, data integrity, and acceptance criteria.';
    case 'test':
      return 'Test coverage, regression evidence, verification commands, missing contract tests, and unverified behavior.';
    case 'security':
      return 'Auth, authorization, secrets, injection, data exposure, unsafe filesystem or network behavior, and destructive operations.';
    case 'design':
      return 'UI/UX contract adherence, visual hierarchy, interaction states, accessibility, responsive behavior, and design-system consistency.';
  }
}

function designPersonaGateAffecting(ctx: NexusAdapterContext): boolean {
  return ctx.predecessor_artifacts.some((artifact) => artifact.path === '.planning/current/plan/design-contract.md');
}

function buildLocalReviewPersonaAgent(
  role: LocalReviewPersonaRole,
  gateAffecting: boolean,
): LocalReviewPersonaAgent {
  const title = titleCaseRole(role);
  return {
    role,
    gateAffecting,
    name: `nexus_review_${role}`,
    description: `Performs the ${title} perspective in Nexus local-provider review fan-out.`,
    systemPrompt: [
      `You are the Nexus local review ${title} persona.`,
      `Review focus: ${reviewPersonaFocus(role)}`,
      gateAffecting
        ? 'This persona is gate-affecting: explicit blocking defects may return Result: fail.'
        : 'This persona is advisory-only for this run: always return Result: pass and put concerns under Advisories.',
      'Stay within repo-visible artifacts and the current review scope. Do not edit files.',
      'Reply exactly in the requested markdown shape.',
    ].join('\n'),
  };
}

function buildLocalReviewPersonaPrompt(
  ctx: NexusAdapterContext,
  agent: LocalReviewPersonaAgent,
): string {
  const title = titleCaseRole(agent.role);
  return [
    buildPromptContextPreamble(ctx, 'Nexus local persona review'),
    `Perform the ${title} persona pass for Nexus /review.`,
    `Focus only on: ${reviewPersonaFocus(agent.role)}`,
    agent.gateAffecting
      ? 'This persona is gate-affecting. Use Result: fail only for material blocking defects in this persona domain.'
      : 'This persona is advisory-only for this run. Return Result: pass even when concerns exist; list those concerns under Advisories.',
    'Do not broaden into unrelated domains. Do not modify repository files.',
    'Reply with markdown only in this exact shape:',
    `# Local Review Persona: ${title}`,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
    '',
    'Advisories:',
    '- ...',
    '',
    'If there are no advisories, say "- none".',
  ].join('\n');
}

function localReviewPersonaAgentsForSlot(
  ctx: NexusAdapterContext,
  slot: 'a' | 'b',
): LocalReviewPersonaAgent[] {
  if (slot === 'a') {
    return [
      buildLocalReviewPersonaAgent('code', true),
      buildLocalReviewPersonaAgent('test', true),
    ];
  }

  return [
    buildLocalReviewPersonaAgent('security', true),
    buildLocalReviewPersonaAgent('design', designPersonaGateAffecting(ctx)),
  ];
}

function parseLocalPersonaVerdict(markdown: string, label: string): 'pass' | 'fail' {
  const matches = [...markdown.matchAll(/Result:\s*(pass|fail)/gi)];
  const verdict = matches.at(-1)?.[1]?.toLowerCase();
  if (!verdict) {
    throw new Error(`${label} persona audit is missing a canonical Result: pass|fail line`);
  }

  return verdict as 'pass' | 'fail';
}

function buildLocalPersonaGroupMarkdown(
  slot: 'a' | 'b',
  personaAudits: LocalReviewPersonaAuditRaw[],
): string {
  const gateFailures = personaAudits.filter((audit) => audit.gate_affecting && audit.verdict === 'fail');
  const advisoryOnlyFailures = personaAudits.filter((audit) => !audit.gate_affecting && audit.verdict === 'fail');
  const result = gateFailures.length === 0 ? 'pass' : 'fail';

  return [
    `# Local Persona Audit ${slot.toUpperCase()}`,
    '',
    `Result: ${result}`,
    '',
    'Findings:',
    ...(gateFailures.length === 0
      ? ['- none']
      : gateFailures.map((audit) => `- [${audit.role}] Gate-affecting persona failed. See ${audit.artifact_path}.`)),
    '',
    'Advisories:',
    ...(advisoryOnlyFailures.length === 0
      ? ['- none']
      : advisoryOnlyFailures.map((audit) => `- [${audit.role}] Advisory-only persona reported concerns. See ${audit.artifact_path}.`)),
    '',
    'Persona evidence:',
    ...personaAudits.map((audit) =>
      `- ${audit.role}: ${audit.verdict}; gate_affecting=${audit.gate_affecting}; artifact=${audit.artifact_path}`),
  ].join('\n');
}

function defaultLocalPersonaAudits(
  ctx: NexusAdapterContext,
  slot: 'a' | 'b',
): LocalReviewPersonaAuditRaw[] {
  return localReviewPersonaAgentsForSlot(ctx, slot).map((agent) => ({
    role: agent.role,
    markdown: [
      `# Local Review Persona: ${titleCaseRole(agent.role)}`,
      '',
      'Result: pass',
      '',
      'Findings:',
      '- none',
      '',
      'Advisories:',
      '- none',
    ].join('\n'),
    verdict: 'pass',
    gate_affecting: agent.gateAffecting,
    artifact_path: reviewPersonaAuditPath(agent.role),
  }));
}

function shipPersonaLabel(role: LocalShipPersonaRole): string {
  switch (role) {
    case 'release':
      return 'Release';
    case 'qa':
      return 'QA';
    case 'security':
      return 'Security';
    case 'docs_deploy':
      return 'Docs/Deploy';
  }
}

function shipPersonaFocus(role: LocalShipPersonaRole): string {
  switch (role) {
    case 'release':
      return 'Final release readiness, unresolved blockers, scope closure, review/QA gate consistency, and whether the run can safely move to merge/deploy.';
    case 'qa':
      return 'Validation sufficiency, verification matrix obligations, browser/manual evidence, regression coverage, and unverified release-critical behavior.';
    case 'security':
      return 'Release-blocking security risk, auth and permission boundaries, secrets exposure, dependency or deploy risk, and unsafe operational actions.';
    case 'docs_deploy':
      return 'PR/deploy handoff quality, deploy contract readiness, release notes or documentation obligations, rollback/canary evidence, and operational clarity.';
  }
}

function buildLocalShipPersonaAgent(role: LocalShipPersonaRole): LocalShipPersonaAgent {
  const label = shipPersonaLabel(role);
  return {
    role,
    gateAffecting: true,
    name: `nexus_ship_${role}`,
    description: `Performs the ${label} perspective in Nexus local-provider ship release-gate fan-out.`,
    systemPrompt: [
      `You are the Nexus local ship ${label} persona.`,
      `Release-gate focus: ${shipPersonaFocus(role)}`,
      'This persona is gate-affecting: explicit release blockers must return Result: fail.',
      'Stay within repo-visible artifacts and the current ship scope. Do not edit files.',
      'Reply exactly in the requested markdown shape.',
    ].join('\n'),
  };
}

function buildLocalShipPersonaPrompt(
  ctx: NexusAdapterContext,
  agent: LocalShipPersonaAgent,
): string {
  const label = shipPersonaLabel(agent.role);
  return [
    buildPromptContextPreamble(ctx, 'Nexus local persona ship'),
    `Perform the ${label} persona pass for Nexus /ship.`,
    `Focus only on: ${shipPersonaFocus(agent.role)}`,
    'This is a release gate, not a broad code review. Fail only for material blockers that should stop merge/deploy readiness.',
    'Do not broaden into unrelated domains. Do not modify repository files.',
    'Reply with markdown only in this exact shape:',
    `# Local Ship Persona: ${label}`,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'If there are no material findings, say "- none".',
    '',
    'Advisories:',
    '- ...',
    '',
    'If there are no advisories, say "- none".',
  ].join('\n');
}

function localShipPersonaAgents(): LocalShipPersonaAgent[] {
  return [
    buildLocalShipPersonaAgent('release'),
    buildLocalShipPersonaAgent('qa'),
    buildLocalShipPersonaAgent('security'),
    buildLocalShipPersonaAgent('docs_deploy'),
  ];
}

function buildLocalShipPersonaGateMarkdown(personaGates: LocalShipPersonaGateRaw[]): string {
  const gateFailures = personaGates.filter((gate) => gate.gate_affecting && gate.verdict === 'fail');
  const result = gateFailures.length === 0 ? 'pass' : 'fail';

  return [
    '# Local Ship Persona Release Gate',
    '',
    `Result: ${result}`,
    `Merge ready: ${result === 'pass' ? 'yes' : 'no'}`,
    '',
    'Findings:',
    ...(gateFailures.length === 0
      ? ['- none']
      : gateFailures.map((gate) => `- [${gate.role}] Gate-affecting persona failed. See ${gate.artifact_path}.`)),
    '',
    'Advisories:',
    '- none',
    '',
    'Persona evidence:',
    ...personaGates.map((gate) =>
      `- ${gate.role}: ${gate.verdict}; gate_affecting=${gate.gate_affecting}; artifact=${gate.artifact_path}`),
  ].join('\n');
}

function defaultLocalShipPersonaGates(): LocalShipPersonaGateRaw[] {
  return localShipPersonaAgents().map((agent) => ({
    role: agent.role,
    markdown: [
      `# Local Ship Persona: ${shipPersonaLabel(agent.role)}`,
      '',
      'Result: pass',
      '',
      'Findings:',
      '- none',
      '',
      'Advisories:',
      '- none',
    ].join('\n'),
    verdict: 'pass',
    gate_affecting: agent.gateAffecting,
    artifact_path: shipPersonaGatePath(agent.role),
  }));
}

function buildQaPrompt(ctx: NexusAdapterContext): string {
  return buildQaValidationPrompt(
    ctx,
    'Nexus stage',
    'Perform Nexus /qa validation for this repository.',
  );
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  const lines = trimmed.split('\n');
  return lines.slice(1, -1).join('\n').trim();
}

function normalizeOptionalQaLearningCandidates(rawCandidates: unknown): LearningCandidate[] | undefined {
  if (typeof rawCandidates === 'undefined') {
    return undefined;
  }

  if (!Array.isArray(rawCandidates)) {
    return undefined;
  }

  const candidates: LearningCandidate[] = [];
  for (const candidate of rawCandidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }

    const rawCandidate = candidate as Partial<LearningCandidate> & { files?: unknown };
    if (
      typeof rawCandidate.type !== 'string'
      || typeof rawCandidate.key !== 'string'
      || typeof rawCandidate.insight !== 'string'
      || typeof rawCandidate.confidence !== 'number'
      || typeof rawCandidate.source !== 'string'
      || !Array.isArray(rawCandidate.files)
    ) {
      continue;
    }

    const files = rawCandidate.files
      .filter((file): file is string => typeof file === 'string')
      .map((file) => file.trim())
      .filter(Boolean);

    if (!rawCandidate.key.trim() || !rawCandidate.insight.trim()) {
      continue;
    }

    candidates.push({
      type: rawCandidate.type,
      key: rawCandidate.key.trim(),
      insight: rawCandidate.insight.trim(),
      confidence: rawCandidate.confidence,
      source: rawCandidate.source,
      files,
    });
  }

  return candidates;
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
    advisories?: unknown;
    report_markdown?: unknown;
    learning_candidates?: unknown;
  };

  if (
    typeof parsed.ready !== 'boolean'
    || typeof parsed.report_markdown !== 'string'
    || !Array.isArray(parsed.findings)
    || parsed.findings.some((finding) => typeof finding !== 'string')
  ) {
    throw new Error('Malformed QA response: expected ready, findings, and report_markdown');
  }

  const advisories = typeof parsed.advisories === 'undefined'
    ? undefined
    : Array.isArray(parsed.advisories)
      ? parsed.advisories.filter((advisory): advisory is string => typeof advisory === 'string')
      : null;

  if (advisories === null) {
    throw new Error('Malformed QA response: advisories must be an array when present');
  }

  const learningCandidates = normalizeOptionalQaLearningCandidates(parsed.learning_candidates);

  return {
    ready: parsed.ready,
    findings: parsed.findings,
    ...(typeof advisories !== 'undefined' ? { advisories } : {}),
    report_markdown: parsed.report_markdown.trim(),
    ...(typeof learningCandidates !== 'undefined'
      ? { learning_candidates: learningCandidates }
      : {}),
  };
}

function buildClaudeNamedAgentCommand(agent: LocalRoleAgent): string[] {
  return [
    'claude',
    '-p',
    '--output-format',
    'text',
    '--dangerously-skip-permissions',
    '--agents',
    JSON.stringify({
      [agent.name]: {
        description: agent.description,
        prompt: agent.systemPrompt,
      },
    }),
    '--agent',
    agent.name,
  ];
}

function buildClaudeBuilderAgent(): LocalRoleAgent {
  return {
    name: 'nexus_builder',
    description: 'Implements the bounded Nexus local build contract.',
    systemPrompt: 'You are the Nexus local build implementer. Execute only the bounded build contract and reply exactly in the requested markdown format.',
  };
}

function buildClaudeVerifierAgent(): LocalRoleAgent {
  return {
    name: 'nexus_verifier',
    description: 'Verifies the repository state after the Nexus local build implementer runs.',
    systemPrompt: 'You are the Nexus local build verifier. Inspect the repository after the build subagent finishes and reply with exactly one markdown bullet that starts with "- Verification:".',
  };
}

function buildClaudeQaAgent(): LocalRoleAgent {
  return {
    name: 'nexus_qa',
    description: 'Performs local Nexus QA validation.',
    systemPrompt: 'You are the Nexus local QA subagent. Return only the requested JSON payload with ready, findings, and report_markdown. Use advisories for non-blocking concerns that should not make ready=false. You may also include optional learning_candidates for durable reusable learnings.',
  };
}

async function runClaudeNamedAgentCommand(
  agent: LocalRoleAgent,
  prompt: string,
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{ stdout: string; stderr: string; argv: string[] }> {
  const argv = buildClaudeNamedAgentCommand(agent);
  const result = await runCommand({ argv, cwd, stdin_text: prompt, timeout_ms: timeoutMs });
  if (result.exit_code !== 0) {
    throw new Error(localCommandFailureMessage(`claude subagent ${agent.name}`, result));
  }
  return { stdout: result.stdout, stderr: result.stderr, argv };
}

function buildCodexSubagentPrompt(agent: LocalRoleAgent, prompt: string): string {
  return [
    `Nexus local subagent role: ${agent.name}`,
    `Role description: ${agent.description}`,
    agent.systemPrompt,
    '',
    prompt.trim(),
  ].join('\n');
}

async function runCodexRoleCommand(
  agent: LocalRoleAgent,
  prompt: string,
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{ stdout: string; stderr: string; argv: string[] }> {
  return runProviderCommand(
    'codex',
    buildCodexSubagentPrompt(agent, prompt),
    cwd,
    timeoutMs,
    runCommand,
  );
}

function buildGeminiSubagentPrompt(agent: LocalRoleAgent, prompt: string): string {
  return [
    `Nexus local subagent role: ${agent.name}`,
    `Role description: ${agent.description}`,
    agent.systemPrompt,
    '',
    prompt.trim(),
  ].join('\n');
}

async function runGeminiRoleCommand(
  agent: LocalRoleAgent,
  prompt: string,
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{ stdout: string; stderr: string; argv: string[] }> {
  return runProviderCommand(
    'gemini',
    buildGeminiSubagentPrompt(agent, prompt),
    cwd,
    timeoutMs,
    runCommand,
  );
}

function localRoleRunnerForMode(mode: ActiveLocalTopology['mode']) {
  switch (mode) {
    case 'claude_subagents':
      return runClaudeNamedAgentCommand;
    case 'claude_agent_team':
      return null;
    case 'codex_subagents':
    case 'codex_multi_session':
      return runCodexRoleCommand;
    case 'gemini_subagents':
      return runGeminiRoleCommand;
    case 'single_agent':
      return null;
  }
}

function semanticVersionAtLeast(current: string, required: string): boolean {
  const currentParts = current.split('.').map((part) => Number.parseInt(part, 10));
  const requiredParts = required.split('.').map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < Math.max(currentParts.length, requiredParts.length); index += 1) {
    const currentPart = Number.isFinite(currentParts[index]) ? currentParts[index] : 0;
    const requiredPart = Number.isFinite(requiredParts[index]) ? requiredParts[index] : 0;
    if (currentPart > requiredPart) {
      return true;
    }
    if (currentPart < requiredPart) {
      return false;
    }
  }

  return true;
}

function parseClaudeVersion(output: string): string | null {
  return output.match(/\b([0-9]+[.][0-9]+[.][0-9]+)\b/)?.[1] ?? null;
}

function claudeAgentTeamsEnabled(): boolean {
  if (process.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1') {
    return true;
  }

  try {
    const settings = JSON.parse(readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8')) as {
      env?: Record<string, unknown>;
    };
    return settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1';
  } catch {
    return false;
  }
}

async function verifyClaudeAgentTeamSupport(
  cwd: string,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<LocalSupportVerification> {
  const argv = ['claude', '--version'];
  const result = await runCommand({
    argv,
    cwd,
    timeout_ms: DEFAULT_TIMEOUTS_MS.handoff,
  });
  const output = `${result.stdout}\n${result.stderr}`.trim();
  const version = parseClaudeVersion(output);
  const verificationCommands = [describeCommand(argv)];

  if (result.exit_code !== 0) {
    return {
      ok: false,
      message: output || 'claude --version failed while verifying local agent team support',
      verificationCommands,
      verificationOutput: output,
    };
  }

  if (!version || !semanticVersionAtLeast(version, '2.1.32')) {
    return {
      ok: false,
      message: 'Claude Code agent teams require claude >= 2.1.32',
      verificationCommands,
      verificationOutput: output,
    };
  }

  if (!claudeAgentTeamsEnabled()) {
    return {
      ok: false,
      message: 'Claude Code agent teams require CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1',
      verificationCommands,
      verificationOutput: output,
    };
  }

  return {
    ok: true,
    verificationCommands,
    verificationOutput: output,
  };
}

function buildClaudeAgentTeamCommand(): string[] {
  return [
    'claude',
    '-p',
    '--output-format',
    'text',
    '--dangerously-skip-permissions',
    '--teammate-mode',
    'in-process',
  ];
}

async function runClaudeAgentTeamCommand(
  prompt: string,
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{ stdout: string; stderr: string; argv: string[] }> {
  const argv = buildClaudeAgentTeamCommand();
  const result = await runCommand({ argv, cwd, stdin_text: prompt, timeout_ms: timeoutMs });
  if (result.exit_code !== 0) {
    throw new Error(localCommandFailureMessage('claude agent team', result));
  }
  return { stdout: result.stdout, stderr: result.stderr, argv };
}

function buildClaudeAgentTeamBuildPrompt(ctx: NexusAdapterContext): string {
  return [
    buildPromptContextPreamble(ctx, 'Nexus Claude agent-team build'),
    'Create a Claude Code agent team for this Nexus /build stage.',
    'Use at least two teammates: nexus_builder and nexus_verifier.',
    'The builder owns the bounded implementation contract. The verifier owns repository-state verification after the builder finishes.',
    'Avoid file conflicts: assign disjoint file ownership when implementation work is parallelized.',
    'Wait for teammates to finish before synthesizing.',
    'Return only the final build summary markdown in the standard Nexus shape.',
    '',
    buildGeneratorPrompt(ctx),
  ].join('\n');
}

function buildClaudeAgentTeamReviewPrompt(ctx: NexusAdapterContext, slot: 'a' | 'b'): string {
  const roles = slot === 'a'
    ? 'code and test'
    : 'security and design';
  return [
    buildPromptContextPreamble(ctx, 'Nexus Claude agent-team review'),
    `Create a Claude Code agent team for Nexus /review audit slot ${slot.toUpperCase()}.`,
    `Spawn teammates focused on ${roles}.`,
    'Each teammate should review independently, then challenge material findings before the lead synthesizes.',
    'Do not edit files.',
    'Return only markdown in this exact group shape:',
    `# Local Persona Audit ${slot.toUpperCase()}`,
    '',
    'Result: pass | fail',
    '',
    'Findings:',
    '- ...',
    '',
    'Advisories:',
    '- ...',
    '',
    'Persona evidence:',
    '- ...',
    '',
    buildAuditPrompt(ctx, slot),
  ].join('\n');
}

function buildClaudeAgentTeamQaPrompt(ctx: NexusAdapterContext): string {
  return [
    buildPromptContextPreamble(ctx, 'Nexus Claude agent-team QA'),
    'Create a Claude Code agent team for Nexus /qa validation.',
    'Use teammates for browser/manual validation, regression coverage, accessibility, and release-critical edge cases as applicable.',
    'Wait for teammates to finish and synthesize one JSON object only.',
    'Return only JSON with ready, findings, report_markdown, optional advisories, and optional learning_candidates.',
    '',
    buildQaPrompt(ctx),
  ].join('\n');
}

function buildClaudeAgentTeamShipPrompt(ctx: NexusAdapterContext): string {
  return [
    buildPromptContextPreamble(ctx, 'Nexus Claude agent-team ship'),
    'Create a Claude Code agent team for Nexus /ship release gate.',
    'Use teammates for release / QA / security / docs-deploy gates.',
    'This is release gating, not broad implementation work. Do not edit files.',
    'Wait for teammates to finish and synthesize one release gate markdown record.',
    'Return only markdown in this shape:',
    '# Local Agent Team Ship Release Gate',
    '',
    'Result: pass | fail',
    'Merge ready: yes | no',
    '',
    'Findings:',
    '- ...',
    '',
    'Advisories:',
    '- ...',
  ].join('\n');
}

function parseAgentTeamMergeReady(markdown: string): boolean {
  const verdict = [...markdown.matchAll(/Result:\s*(pass|fail)/gi)].at(-1)?.[1]?.toLowerCase();
  if (!verdict) {
    throw new Error('Claude agent team ship gate is missing Result: pass|fail');
  }
  return verdict === 'pass';
}

function buildClaudeAgentTeamShipPersonaGates(markdown: string): LocalShipPersonaGateRaw[] {
  const verdict = parseAgentTeamMergeReady(markdown) ? 'pass' : 'fail';
  return localShipPersonaAgents().map((agent) => ({
    role: agent.role,
    markdown,
    verdict,
    gate_affecting: agent.gateAffecting,
    artifact_path: shipPersonaGatePath(agent.role),
  }));
}

function combineBuildSummary(builderSummary: string, verifierSummary: string): string {
  const normalizedBuilder = builderSummary.trim();
  const normalizedVerifier = verifierSummary.trim();
  if (!normalizedVerifier) {
    return normalizedBuilder;
  }

  if (normalizedBuilder.includes('- Verification:')) {
    return normalizedBuilder.replace(/- Verification:[^\n]*/, normalizedVerifier);
  }

  return `${normalizedBuilder}\n${normalizedVerifier}`;
}

async function runLocalReviewPersonaSlot(
  ctx: NexusAdapterContext,
  slot: 'a' | 'b',
  mode: ActiveLocalTopology['mode'],
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{
  markdown: string;
  persona_audits: LocalReviewPersonaAuditRaw[];
  dispatch_commands: string[];
  agent_roles: string[];
}> {
  const runLocalSubagent = localRoleRunnerForMode(mode);
  if (!runLocalSubagent) {
    throw new Error(`no local role runner for topology ${mode}`);
  }

  const agents = localReviewPersonaAgentsForSlot(ctx, slot);
  const executions = await Promise.all(agents.map((agent) =>
    runLocalSubagent(
      agent,
      buildLocalReviewPersonaPrompt(ctx, agent),
      cwd,
      timeoutMs,
      runCommand,
    )));

  const personaAudits = agents.map((agent, index): LocalReviewPersonaAuditRaw => {
    const markdown = executions[index]?.stdout.trim() ?? '';
    return {
      role: agent.role,
      markdown,
      verdict: parseLocalPersonaVerdict(markdown, titleCaseRole(agent.role)),
      gate_affecting: agent.gateAffecting,
      artifact_path: reviewPersonaAuditPath(agent.role),
    };
  });

  return {
    markdown: buildLocalPersonaGroupMarkdown(slot, personaAudits),
    persona_audits: personaAudits,
    dispatch_commands: executions.map((execution) => describeCommand(execution.argv)),
    agent_roles: agents.map((agent) => agent.name),
  };
}

async function runLocalShipPersonas(
  ctx: NexusAdapterContext,
  mode: ActiveLocalTopology['mode'],
  cwd: string,
  timeoutMs: number,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<{
  release_gate_record: string;
  merge_ready: boolean;
  persona_gates: LocalShipPersonaGateRaw[];
  dispatch_commands: string[];
  agent_roles: string[];
}> {
  const runLocalSubagent = localRoleRunnerForMode(mode);
  if (!runLocalSubagent) {
    throw new Error(`no local role runner for topology ${mode}`);
  }

  const agents = localShipPersonaAgents();
  const executions = await Promise.all(agents.map((agent) =>
    runLocalSubagent(
      agent,
      buildLocalShipPersonaPrompt(ctx, agent),
      cwd,
      timeoutMs,
      runCommand,
    )));

  const personaGates = agents.map((agent, index): LocalShipPersonaGateRaw => {
    const markdown = executions[index]?.stdout.trim() ?? '';
    const label = shipPersonaLabel(agent.role);
    return {
      role: agent.role,
      markdown,
      verdict: parseLocalPersonaVerdict(markdown, label),
      gate_affecting: agent.gateAffecting,
      artifact_path: shipPersonaGatePath(agent.role),
    };
  });

  return {
    release_gate_record: buildLocalShipPersonaGateMarkdown(personaGates),
    merge_ready: personaGates.every((gate) => !gate.gate_affecting || gate.verdict === 'pass'),
    persona_gates: personaGates,
    dispatch_commands: executions.map((execution) => describeCommand(execution.argv)),
    agent_roles: agents.map((agent) => agent.name),
  };
}

async function verifyClaudeSubagentSupport(
  cwd: string,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<LocalSupportVerification> {
  const argv = ['claude', '--help'];
  const result = await runCommand({
    argv,
    cwd,
    timeout_ms: DEFAULT_TIMEOUTS_MS.handoff,
  });

  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (result.exit_code !== 0) {
    return {
      ok: false,
      message: output || 'claude --help failed while verifying local subagent support',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  if (!output.includes('--agents') || !output.includes('--agent')) {
    return {
      ok: false,
      message: 'claude CLI does not support --agents for local_provider subagents',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  return {
    ok: true,
    verificationCommands: [describeCommand(argv)],
    verificationOutput: output,
  };
}

async function verifyCodexSubagentSupport(
  cwd: string,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<LocalSupportVerification> {
  const argv = ['codex', '--help'];
  const result = await runCommand({
    argv,
    cwd,
    timeout_ms: DEFAULT_TIMEOUTS_MS.handoff,
  });

  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (result.exit_code !== 0) {
    return {
      ok: false,
      message: output || 'codex --help failed while verifying local subagent support',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  if (!output.includes('exec -')) {
    return {
      ok: false,
      message: 'codex CLI does not support exec - for local_provider subagents',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  return {
    ok: true,
    verificationCommands: [describeCommand(argv)],
    verificationOutput: output,
  };
}

async function verifyCodexMultiSessionSupport(
  cwd: string,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<LocalSupportVerification> {
  const argv = ['codex', '--help'];
  const result = await runCommand({
    argv,
    cwd,
    timeout_ms: DEFAULT_TIMEOUTS_MS.handoff,
  });

  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (result.exit_code !== 0) {
    return {
      ok: false,
      message: output || 'codex --help failed while verifying local multi_session support',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  if (!output.includes('exec') || !output.includes('resume')) {
    return {
      ok: false,
      message: 'codex CLI does not expose the required multi_session commands for local_provider',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  return {
    ok: true,
    verificationCommands: [describeCommand(argv)],
    verificationOutput: output,
  };
}

async function verifyGeminiSubagentSupport(
  cwd: string,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<LocalSupportVerification> {
  const argv = ['gemini', '--help'];
  const result = await runCommand({
    argv,
    cwd,
    timeout_ms: DEFAULT_TIMEOUTS_MS.handoff,
  });

  const output = `${result.stdout}\n${result.stderr}`.trim();
  if (result.exit_code !== 0) {
    return {
      ok: false,
      message: output || 'gemini --help failed while verifying local subagent support',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  if (!output.includes('-p') || !output.includes('--yolo')) {
    return {
      ok: false,
      message: 'gemini CLI does not support -p and --yolo for local_provider subagents',
      verificationCommands: [describeCommand(argv)],
      verificationOutput: output,
    };
  }

  return {
    ok: true,
    verificationCommands: [describeCommand(argv)],
    verificationOutput: output,
  };
}

async function verifyActiveLocalTopologySupport(
  topology: ActiveLocalTopology,
  cwd: string,
  runCommand: (spec: LocalCommandSpec) => Promise<LocalCommandResult>,
): Promise<LocalSupportVerification | null> {
  switch (topology.mode) {
    case 'claude_subagents':
      return verifyClaudeSubagentSupport(cwd, runCommand);
    case 'codex_subagents':
      return verifyCodexSubagentSupport(cwd, runCommand);
    case 'gemini_subagents':
      return verifyGeminiSubagentSupport(cwd, runCommand);
    case 'claude_agent_team':
      return verifyClaudeAgentTeamSupport(cwd, runCommand);
    case 'codex_multi_session':
      return verifyCodexMultiSessionSupport(cwd, runCommand);
    case 'single_agent':
      return null;
  }
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
    if (result.exit_code !== 0) {
      throw new Error(localCommandFailureMessage('claude local command', result));
    }
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
      if (result.exit_code !== 0) {
        throw new Error(localCommandFailureMessage('codex local command', result));
      }
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
  if (result.exit_code !== 0) {
    throw new Error(localCommandFailureMessage('gemini local command', result));
  }
  return { stdout: result.stdout, stderr: result.stderr, argv };
}

export function createDefaultLocalAdapter(): LocalAdapter {
  const buildPack = createBuildStagePack();
  const qaPack = createQaStagePack();
  const reviewPack = createReviewStagePack();

  return {
    kind: 'stub',
    resolve_route: async (ctx) => {
      const topology = activeLocalTopology(
        ctx.ledger.execution.primary_provider,
        ctx.ledger.execution.provider_topology,
      );
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            available: false,
            provider: ctx.ledger.execution.primary_provider,
            topology: ctx.ledger.execution.provider_topology,
          },
          ctx.requested_route,
          localTraceability('local-provider-routing'),
        );
      }

      return successResult<LocalResolveRouteRaw>(
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
      );
    },
    execute_generator: async (ctx) => {
      const topology = activeLocalTopology(
        ctx.ledger.execution.primary_provider,
        ctx.ledger.execution.provider_topology,
      );
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-execution'),
        );
      }

      return successResult<LocalExecuteGeneratorRaw>(
        {
          receipt: `local-build-${ctx.ledger.execution.primary_provider}`,
          summary_markdown: buildPack.buildExecutionSummary(ctx, topology.mode === 'single_agent'
            ? {
                actions: 'local provider build',
                verification: 'default Nexus local execution trace recorded',
              }
            : topology.mode === 'claude_subagents'
              ? {
                  actions: 'local claude subagent build',
                  verification: 'local verifier subagent',
                }
              : topology.mode === 'claude_agent_team'
                ? {
                    actions: 'local claude agent-team build',
                    verification: 'local agent-team synthesis',
                  }
                : topology.mode === 'codex_multi_session'
                  ? {
                      actions: 'local codex multi-session build',
                      verification: 'local verifier session',
                    }
                  : topology.mode === 'gemini_subagents'
                    ? {
                        actions: 'local gemini subagent build',
                        verification: 'local verifier pass',
                      }
                    : {
                        actions: 'local codex subagent build',
                        verification: 'local verifier pass',
                      }),
          agent_roles: topology.mode === 'single_agent' ? undefined : ['nexus_builder', 'nexus_verifier'],
        },
        buildActualRoute(
          ctx.ledger.execution.primary_provider,
          ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path,
          ctx.requested_route?.substrate ?? 'superpowers-core',
          'build',
        ),
        ctx.requested_route,
        localTraceability('local-provider-execution'),
      );
    },
    execute_audit_a: async (ctx) => {
      const topology = activeLocalTopology(
        ctx.ledger.execution.primary_provider,
        ctx.ledger.execution.provider_topology,
      );
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            markdown: '',
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-review-a'),
        );
      }

      const personaAudits = topology.mode === 'single_agent' ? [] : defaultLocalPersonaAudits(ctx, 'a');

      return successResult<LocalExecuteAuditRaw>(
        {
          markdown: topology.mode === 'single_agent'
            ? reviewPack.buildAuditMarkdown('local_a')
            : buildLocalPersonaGroupMarkdown('a', personaAudits),
          receipt: `local-review-a-${ctx.ledger.execution.primary_provider}`,
          agent_roles: topology.mode === 'single_agent'
            ? undefined
            : personaAudits.map((audit) => `nexus_review_${audit.role}`),
          persona_group: topology.mode === 'single_agent' ? undefined : 'code_test',
          persona_audits: topology.mode === 'single_agent' ? undefined : personaAudits,
        },
        buildActualRoute(
          ctx.ledger.execution.primary_provider,
          ctx.requested_route?.evaluator_a ?? ctx.ledger.execution.requested_path,
          ctx.requested_route?.substrate ?? 'superpowers-core',
          'review',
        ),
        ctx.requested_route,
        localTraceability('local-provider-review-a'),
      );
    },
    execute_audit_b: async (ctx) => {
      const topology = activeLocalTopology(
        ctx.ledger.execution.primary_provider,
        ctx.ledger.execution.provider_topology,
      );
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            markdown: '',
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-review-b'),
        );
      }

      const personaAudits = topology.mode === 'single_agent' ? [] : defaultLocalPersonaAudits(ctx, 'b');

      return successResult<LocalExecuteAuditRaw>(
        {
          markdown: topology.mode === 'single_agent'
            ? reviewPack.buildAuditMarkdown('local_b')
            : buildLocalPersonaGroupMarkdown('b', personaAudits),
          receipt: `local-review-b-${ctx.ledger.execution.primary_provider}`,
          agent_roles: topology.mode === 'single_agent'
            ? undefined
            : personaAudits.map((audit) => `nexus_review_${audit.role}`),
          persona_group: topology.mode === 'single_agent' ? undefined : 'security_design',
          persona_audits: topology.mode === 'single_agent' ? undefined : personaAudits,
        },
        buildActualRoute(
          ctx.ledger.execution.primary_provider,
          ctx.requested_route?.evaluator_b ?? ctx.ledger.execution.requested_path,
          ctx.requested_route?.substrate ?? 'superpowers-core',
          'review',
        ),
        ctx.requested_route,
        localTraceability('local-provider-review-b'),
      );
    },
    execute_qa: async (ctx) => {
      const topology = activeLocalTopology(
        ctx.ledger.execution.primary_provider,
        ctx.ledger.execution.provider_topology,
      );
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
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

      return successResult<LocalExecuteQaRaw>(
        {
          report_markdown: qaPack.buildQaReport(ctx, true, []),
          ready: true,
          findings: [],
          receipt: `local-qa-${ctx.ledger.execution.primary_provider}`,
          agent_roles: topology.mode === 'single_agent' ? undefined : ['nexus_qa'],
        },
        buildActualRoute(
          ctx.ledger.execution.primary_provider,
          ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path,
          ctx.requested_route?.substrate ?? 'superpowers-core',
          'qa',
        ),
        ctx.requested_route,
        localTraceability('local-provider-qa'),
      );
    },
    execute_ship_personas: async (ctx) => {
      const topology = activeLocalTopology(
        ctx.ledger.execution.primary_provider,
        ctx.ledger.execution.provider_topology,
      );
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            release_gate_record: '',
            merge_ready: false,
            persona_gates: [],
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-ship-personas'),
        );
      }

      const personaGates = topology.mode === 'single_agent' ? [] : defaultLocalShipPersonaGates();
      const releaseGateRecord = personaGates.length === 0 ? '' : buildLocalShipPersonaGateMarkdown(personaGates);

      return successResult<LocalExecuteShipPersonasRaw>(
        {
          release_gate_record: releaseGateRecord,
          merge_ready: personaGates.every((gate) => !gate.gate_affecting || gate.verdict === 'pass'),
          persona_gates: personaGates,
          receipt: `local-ship-personas-${ctx.ledger.execution.primary_provider}`,
          agent_roles: topology.mode === 'single_agent'
            ? undefined
            : personaGates.map((gate) => `nexus_ship_${gate.role}`),
        },
        buildActualRoute(
          ctx.ledger.execution.primary_provider,
          ctx.requested_route?.generator ?? `${ctx.ledger.execution.requested_path}-ship`,
          ctx.requested_route?.substrate ?? 'superpowers-core',
          'ship',
        ),
        ctx.requested_route,
        localTraceability('local-provider-ship-personas'),
      );
    },
  };
}

export function createRuntimeLocalAdapter(
  providedOptions: CreateRuntimeLocalAdapterOptions = {},
): LocalAdapter {
  const runCommand = providedOptions.runCommand ?? defaultRunCommand;
  const now = providedOptions.now ?? (() => new Date().toISOString());
  const executionWorkspacePath = (ctx: NexusAdapterContext): string => ctx.workspace?.path ?? ctx.cwd;

  return {
    kind: 'runtime',
    resolve_route: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      const topology = activeLocalTopology(provider, ctx.ledger.execution.provider_topology);
      const executionCwd = executionWorkspacePath(ctx);
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            available: false,
            provider,
            topology: ctx.ledger.execution.provider_topology,
          },
          ctx.requested_route,
          localTraceability('local-provider-routing'),
        );
      }

      try {
        const result = await runCommand({
          argv: ['which', providerCommand(provider)],
          cwd: executionCwd,
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

        const supportVerification = await verifyActiveLocalTopologySupport(topology, executionCwd, runCommand);

        if (supportVerification) {
          const verificationOutput = [result.stdout.trim(), supportVerification.verificationOutput].filter(Boolean).join('\n');
          const verificationCommands = [`which ${providerCommand(provider)}`, ...supportVerification.verificationCommands];
          if (!supportVerification.ok) {
            return blockedResult(
              ctx.stage,
              supportVerification.message,
              {
                available: false,
                provider,
                topology: ctx.ledger.execution.provider_topology,
                verification_command: `which ${providerCommand(provider)}`,
                verification_output: verificationOutput,
                verification_commands: verificationCommands,
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
              verification_output: verificationOutput,
              verification_commands: verificationCommands,
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'handoff'),
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
      const topology = activeLocalTopology(provider, ctx.ledger.execution.provider_topology);
      const executionCwd = executionWorkspacePath(ctx);
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-execution'),
        );
      }

      try {
        if (topology.mode === 'claude_agent_team') {
          const execution = await runClaudeAgentTeamCommand(
            buildClaudeAgentTeamBuildPrompt(ctx),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.build,
            runCommand,
          );

          return successResult<LocalExecuteGeneratorRaw>(
            {
              receipt: `local-build-${provider}-${sanitizeTimestamp(now())}`,
              summary_markdown: execution.stdout.trim(),
              dispatch_command: describeCommand(execution.argv),
              dispatch_commands: [describeCommand(execution.argv)],
              agent_roles: ['nexus_agent_team'],
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'build'),
            ctx.requested_route,
            localTraceability('local-provider-execution'),
          );
        }

        if (topology.mode !== 'single_agent') {
          const builderAgent = buildClaudeBuilderAgent();
          const verifierAgent = buildClaudeVerifierAgent();
          const runLocalSubagent = localRoleRunnerForMode(topology.mode);
          if (!runLocalSubagent) {
            throw new Error(`no local role runner for topology ${topology.mode}`);
          }
          const builderExecution = await runLocalSubagent(
            builderAgent,
            buildGeneratorPrompt(ctx),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.build,
            runCommand,
          );
          const verifierExecution = await runLocalSubagent(
            verifierAgent,
            buildBuildVerifierPrompt(ctx, builderExecution.stdout),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.build,
            runCommand,
          );

          return successResult<LocalExecuteGeneratorRaw>(
            {
              receipt: `local-build-${provider}-${sanitizeTimestamp(now())}`,
              summary_markdown: combineBuildSummary(builderExecution.stdout, verifierExecution.stdout),
              dispatch_command: describeCommand(builderExecution.argv),
              dispatch_commands: [
                describeCommand(builderExecution.argv),
                describeCommand(verifierExecution.argv),
              ],
              agent_roles: [builderAgent.name, verifierAgent.name],
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'build'),
            ctx.requested_route,
            localTraceability('local-provider-execution'),
          );
        }

        const execution = await runProviderCommand(
          provider,
          buildGeneratorPrompt(ctx),
          executionCwd,
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
      const topology = activeLocalTopology(provider, ctx.ledger.execution.provider_topology);
      const executionCwd = executionWorkspacePath(ctx);
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            markdown: '',
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-review-a'),
        );
      }

      try {
        if (topology.mode === 'claude_agent_team') {
          const execution = await runClaudeAgentTeamCommand(
            buildClaudeAgentTeamReviewPrompt(ctx, 'a'),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.review,
            runCommand,
          );

          return successResult<LocalExecuteAuditRaw>(
            {
              markdown: execution.stdout.trim(),
              receipt: `local-review-a-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: describeCommand(execution.argv),
              dispatch_commands: [describeCommand(execution.argv)],
              agent_roles: ['nexus_review_agent_team'],
              persona_group: 'code_test',
            },
            buildActualRoute(provider, ctx.requested_route?.evaluator_a ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'review'),
            ctx.requested_route,
            localTraceability('local-provider-review-a'),
          );
        }

        if (topology.mode !== 'single_agent') {
          const personaSlot = await runLocalReviewPersonaSlot(
            ctx,
            'a',
            topology.mode,
            executionCwd,
            DEFAULT_TIMEOUTS_MS.review,
            runCommand,
          );

          return successResult<LocalExecuteAuditRaw>(
            {
              markdown: personaSlot.markdown,
              receipt: `local-review-a-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: personaSlot.dispatch_commands[0],
              dispatch_commands: personaSlot.dispatch_commands,
              agent_roles: personaSlot.agent_roles,
              persona_group: 'code_test',
              persona_audits: personaSlot.persona_audits,
            },
            buildActualRoute(provider, ctx.requested_route?.evaluator_a ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'review'),
            ctx.requested_route,
            localTraceability('local-provider-review-a'),
          );
        }

        const execution = await runProviderCommand(
          provider,
          buildAuditPrompt(ctx, 'a'),
          executionCwd,
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
      const topology = activeLocalTopology(provider, ctx.ledger.execution.provider_topology);
      const executionCwd = executionWorkspacePath(ctx);
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            markdown: '',
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-review-b'),
        );
      }

      try {
        if (topology.mode === 'claude_agent_team') {
          const execution = await runClaudeAgentTeamCommand(
            buildClaudeAgentTeamReviewPrompt(ctx, 'b'),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.review,
            runCommand,
          );

          return successResult<LocalExecuteAuditRaw>(
            {
              markdown: execution.stdout.trim(),
              receipt: `local-review-b-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: describeCommand(execution.argv),
              dispatch_commands: [describeCommand(execution.argv)],
              agent_roles: ['nexus_review_agent_team'],
              persona_group: 'security_design',
            },
            buildActualRoute(provider, ctx.requested_route?.evaluator_b ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'review'),
            ctx.requested_route,
            localTraceability('local-provider-review-b'),
          );
        }

        if (topology.mode !== 'single_agent') {
          const personaSlot = await runLocalReviewPersonaSlot(
            ctx,
            'b',
            topology.mode,
            executionCwd,
            DEFAULT_TIMEOUTS_MS.review,
            runCommand,
          );

          return successResult<LocalExecuteAuditRaw>(
            {
              markdown: personaSlot.markdown,
              receipt: `local-review-b-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: personaSlot.dispatch_commands[0],
              dispatch_commands: personaSlot.dispatch_commands,
              agent_roles: personaSlot.agent_roles,
              persona_group: 'security_design',
              persona_audits: personaSlot.persona_audits,
            },
            buildActualRoute(provider, ctx.requested_route?.evaluator_b ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'review'),
            ctx.requested_route,
            localTraceability('local-provider-review-b'),
          );
        }

        const execution = await runProviderCommand(
          provider,
          buildAuditPrompt(ctx, 'b'),
          executionCwd,
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
      const topology = activeLocalTopology(provider, ctx.ledger.execution.provider_topology);
      const executionCwd = executionWorkspacePath(ctx);
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
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

      try {
        if (topology.mode === 'claude_agent_team') {
          const execution = await runClaudeAgentTeamCommand(
            buildClaudeAgentTeamQaPrompt(ctx),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.qa,
            runCommand,
          );
          const parsed = parseQaPayload(execution.stdout);

          return successResult<LocalExecuteQaRaw>(
            {
              ...parsed,
              receipt: `local-qa-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: describeCommand(execution.argv),
              dispatch_commands: [describeCommand(execution.argv)],
              agent_roles: ['nexus_qa_agent_team'],
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'qa'),
            ctx.requested_route,
            localTraceability('local-provider-qa'),
          );
        }

        if (topology.mode !== 'single_agent') {
          const agent = buildClaudeQaAgent();
          const runLocalSubagent = localRoleRunnerForMode(topology.mode);
          if (!runLocalSubagent) {
            throw new Error(`no local role runner for topology ${topology.mode}`);
          }
          const execution = await runLocalSubagent(
            agent,
            buildQaPrompt(ctx),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.qa,
            runCommand,
          );
          const parsed = parseQaPayload(execution.stdout);

          return successResult<LocalExecuteQaRaw>(
            {
              ...parsed,
              receipt: `local-qa-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: describeCommand(execution.argv),
              dispatch_commands: [describeCommand(execution.argv)],
              agent_roles: [agent.name],
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? ctx.ledger.execution.requested_path, ctx.requested_route?.substrate ?? 'superpowers-core', 'qa'),
            ctx.requested_route,
            localTraceability('local-provider-qa'),
          );
        }

        const execution = await runProviderCommand(
          provider,
          buildQaPrompt(ctx),
          executionCwd,
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
    execute_ship_personas: async (ctx) => {
      const provider = ctx.ledger.execution.primary_provider;
      const topology = activeLocalTopology(provider, ctx.ledger.execution.provider_topology);
      const executionCwd = executionWorkspacePath(ctx);
      if (typeof topology === 'string') {
        return blockedResult(
          ctx.stage,
          topology,
          {
            release_gate_record: '',
            merge_ready: false,
            persona_gates: [],
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-ship-personas'),
        );
      }

      try {
        if (topology.mode === 'claude_agent_team') {
          const execution = await runClaudeAgentTeamCommand(
            buildClaudeAgentTeamShipPrompt(ctx),
            executionCwd,
            DEFAULT_TIMEOUTS_MS.ship,
            runCommand,
          );
          const releaseGateRecord = execution.stdout.trim();
          const personaGates = buildClaudeAgentTeamShipPersonaGates(releaseGateRecord);

          return successResult<LocalExecuteShipPersonasRaw>(
            {
              release_gate_record: releaseGateRecord,
              merge_ready: personaGates.every((gate) => !gate.gate_affecting || gate.verdict === 'pass'),
              persona_gates: personaGates,
              receipt: `local-ship-personas-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: describeCommand(execution.argv),
              dispatch_commands: [describeCommand(execution.argv)],
              agent_roles: ['nexus_ship_agent_team'],
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? `${ctx.ledger.execution.requested_path}-ship`, ctx.requested_route?.substrate ?? 'superpowers-core', 'ship'),
            ctx.requested_route,
            localTraceability('local-provider-ship-personas'),
          );
        }

        if (topology.mode !== 'single_agent') {
          const personaGate = await runLocalShipPersonas(
            ctx,
            topology.mode,
            executionCwd,
            DEFAULT_TIMEOUTS_MS.ship,
            runCommand,
          );

          return successResult<LocalExecuteShipPersonasRaw>(
            {
              release_gate_record: personaGate.release_gate_record,
              merge_ready: personaGate.merge_ready,
              persona_gates: personaGate.persona_gates,
              receipt: `local-ship-personas-${provider}-${sanitizeTimestamp(now())}`,
              dispatch_command: personaGate.dispatch_commands[0],
              dispatch_commands: personaGate.dispatch_commands,
              agent_roles: personaGate.agent_roles,
            },
            buildActualRoute(provider, ctx.requested_route?.generator ?? `${ctx.ledger.execution.requested_path}-ship`, ctx.requested_route?.substrate ?? 'superpowers-core', 'ship'),
            ctx.requested_route,
            localTraceability('local-provider-ship-personas'),
          );
        }

        return successResult<LocalExecuteShipPersonasRaw>(
          {
            release_gate_record: '',
            merge_ready: true,
            persona_gates: [],
            receipt: `local-ship-personas-${provider}-${sanitizeTimestamp(now())}`,
          },
          buildActualRoute(provider, ctx.requested_route?.generator ?? `${ctx.ledger.execution.requested_path}-ship`, ctx.requested_route?.substrate ?? 'superpowers-core', 'ship'),
          ctx.requested_route,
          localTraceability('local-provider-ship-personas'),
        );
      } catch (error) {
        return blockedResult(
          ctx.stage,
          error instanceof Error ? error.message : String(error),
          {
            release_gate_record: '',
            merge_ready: false,
            persona_gates: [],
            receipt: '',
          },
          ctx.requested_route,
          localTraceability('local-provider-ship-personas'),
        );
      }
    },
  };
}
