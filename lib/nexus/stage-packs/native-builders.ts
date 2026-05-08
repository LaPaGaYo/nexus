import { stageAdapterOutputPath } from '../io/artifacts';
import type { NexusAdapterContext } from '../adapters/types';
import { getStageContentForStage } from '../stage-content';
import type { CanonicalCommandId } from '../contracts/types';

type DefaultReviewAuditSlot = 'codex' | 'gemini' | 'local_a' | 'local_b';

interface NativeStageSections {
  overview: string;
  checklist: string[];
  artifact_contract: string;
  routing: string;
}

function getNativeStageSections(stage: CanonicalCommandId): NativeStageSections {
  const content = getStageContentForStage(stage);

  return {
    overview: content.sections.overview.trim(),
    checklist: content.sections.checklist
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^- /, '')),
    artifact_contract: content.sections.artifact_contract.trim(),
    routing: content.sections.routing.trim(),
  };
}

function renderChecklist(title: string, items: string[]): string {
  return [
    `## ${title}`,
    '',
    ...items.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function renderExecutionContext(ctx: NexusAdapterContext): string {
  const predecessorSection = ctx.predecessor_artifacts.length > 0
    ? [
      '### Predecessor Artifacts',
      '',
      ...ctx.predecessor_artifacts.map((artifact) => `- ${artifact.path}`),
      '',
    ]
    : [];

  return [
    '## Nexus Execution Context',
    '',
    `- Run ID: ${ctx.run_id}`,
    `- Command: ${ctx.command}`,
    `- Stage: ${ctx.stage}`,
    `- Continuation mode: ${ctx.ledger.continuation_mode}`,
    `- Execution mode: ${ctx.ledger.execution.mode}`,
    `- Primary provider: ${ctx.ledger.execution.primary_provider}`,
    `- Provider topology: ${ctx.ledger.execution.provider_topology}`,
    '',
    ...predecessorSection,
  ].join('\n');
}

function expectedProvider(generator: string | null): string {
  const route = generator ?? 'codex-via-ccb';
  const normalized = route.toLowerCase().trim();

  if (normalized.startsWith('codex')) {
    return 'codex';
  }

  if (normalized.startsWith('gemini')) {
    return 'gemini';
  }

  console.warn(`native-builder: unknown generator '${generator}' classified as 'unknown'`);

  return 'unknown';
}

function headerFor(slot: DefaultReviewAuditSlot): string {
  switch (slot) {
    case 'codex':
      return '# Codex Audit';
    case 'gemini':
      return '# Gemini Audit';
    case 'local_a':
      return '# Local Audit A';
    case 'local_b':
      return '# Local Audit B';
  }
}

export function buildPmDiscoverIdeaBrief(ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('discover');

  return [
    '# Idea Brief',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Discovery Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Transition Rule',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildPmDecisionBrief(ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('frame');

  return [
    '# Decision Brief',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Framing Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Transition Rule',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildPmPrd(_ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('frame');

  return [
    '# PRD',
    '',
    '## Scope and Success',
    '',
    sections.overview,
    '',
    renderChecklist('Success Criteria', sections.checklist),
    '## Routing',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildExecutionReadinessPacket(ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('plan');

  return [
    '# Execution Readiness Packet',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Readiness Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
  ].join('\n');
}

export function buildSprintContract(_ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('plan');

  return [
    '# Sprint Contract',
    '',
    '## Bounded Scope',
    '',
    sections.overview,
    '',
    renderChecklist('Execution Commitments', sections.checklist),
    '## Transition Rule',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildCloseoutRecord(ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('closeout');

  return [
    '# Closeout Record',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderExecutionContext(ctx),
    renderChecklist('Closeout Checklist', sections.checklist),
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Final Gate',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildExecutionSummary(
  _ctx: NexusAdapterContext,
  options: {
    actions: string;
    verification: string;
    files_touched?: string;
  },
): string {
  const sections = getNativeStageSections('build');

  return [
    '# Build Execution Summary',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderChecklist('Execution Checklist', sections.checklist).trimEnd(),
    '## Actions',
    '',
    `- ${options.actions}`,
    `- Files touched: ${options.files_touched ?? 'none'}`,
    `- Verification: ${options.verification}`,
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
  ].join('\n');
}

export function buildGeneratorExecution(ctx: NexusAdapterContext, summary_markdown?: string) {
  const provider = expectedProvider(ctx.requested_route?.generator ?? null);

  return {
    raw_output: {
      receipt: 'ccb-default',
      summary_markdown,
    },
    actual_route: {
      provider,
      route: ctx.requested_route?.generator ?? 'codex-via-ccb',
      substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
      transport: 'ccb' as const,
      receipt_path: stageAdapterOutputPath('build'),
    },
  };
}

export function buildVerificationSummary(_ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('build');

  return [
    sections.overview,
    ...sections.checklist,
    sections.routing,
  ].join('; ');
}

export function buildReviewAuditMarkdown(slot: DefaultReviewAuditSlot): string {
  const sections = getNativeStageSections('review');

  return [
    headerFor(slot),
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderChecklist('Audit Checklist', sections.checklist).trimEnd(),
    '## Findings',
    '',
    '- none',
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
    'Result: pass',
    '',
  ].join('\n');
}

export function buildReviewDisciplineSummary(_ctx: NexusAdapterContext): string {
  const sections = getNativeStageSections('review');

  return [
    sections.overview,
    ...sections.checklist,
    sections.routing,
  ].join('; ');
}

export function buildQaReport(
  _ctx: NexusAdapterContext,
  ready: boolean,
  findings: string[],
  advisories: string[] = [],
): string {
  const sections = getNativeStageSections('qa');

  return [
    '# QA Report',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    renderChecklist('Validation Checklist', sections.checklist).trimEnd(),
    '## Findings',
    '',
    ...(findings.length > 0 ? findings.map((finding) => `- ${finding}`) : ['- none']),
    '',
    '## Advisories',
    '',
    ...(advisories.length > 0 ? advisories.map((advisory) => `- ${advisory}`) : ['- none']),
    '',
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
    `Result: ${ready ? 'pass' : 'fail'}`,
    '',
  ].join('\n');
}

export function buildReleaseGateRecord(_ctx: NexusAdapterContext, mergeReady: boolean): string {
  const sections = getNativeStageSections('ship');

  return [
    '# Release Gate Record',
    '',
    '## Overview',
    '',
    sections.overview,
    '',
    '## Gate Checklist',
    '',
    ...sections.checklist.map((item) => `- ${item}`),
    '',
    '## Canonical Artifact Contract',
    '',
    sections.artifact_contract,
    '',
    '## Routing and Governance',
    '',
    sections.routing,
    '',
    `Result: ${mergeReady ? 'merge ready' : 'blocked'}`,
    '',
  ].join('\n');
}
