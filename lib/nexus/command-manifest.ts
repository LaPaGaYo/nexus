import type { CanonicalCommandId, ImplementationStatus } from './types';

export type CommandOwner =
  | 'pm-core'
  | 'gsd-core'
  | 'routing-core'
  | 'governance-core'
  | 'superpowers-core'
  | 'audit-core';

export interface CommandContract {
  id: CanonicalCommandId;
  owner: CommandOwner;
  implementation: ImplementationStatus;
  purpose: string;
  required_inputs: string[];
  durable_outputs: string[];
  exit_condition: string;
  legal_predecessors: CanonicalCommandId[];
}

export const CANONICAL_MANIFEST: Record<CanonicalCommandId, CommandContract> = {
  discover: {
    id: 'discover',
    owner: 'pm-core',
    implementation: 'implemented',
    purpose: 'Clarify the problem.',
    required_inputs: [],
    durable_outputs: [
      'docs/product/idea-brief.md',
      '.planning/current/discover/status.json',
    ],
    exit_condition: 'Problem is clarified or deferred.',
    legal_predecessors: [],
  },
  frame: {
    id: 'frame',
    owner: 'pm-core',
    implementation: 'implemented',
    purpose: 'Define scope and success criteria.',
    required_inputs: ['docs/product/idea-brief.md'],
    durable_outputs: [
      'docs/product/decision-brief.md',
      'docs/product/prd.md',
      '.planning/current/frame/status.json',
    ],
    exit_condition: 'Framing is structured or sent back to discover.',
    legal_predecessors: ['discover'],
  },
  plan: {
    id: 'plan',
    owner: 'gsd-core',
    implementation: 'implemented',
    purpose: 'Write the execution-ready planning packet.',
    required_inputs: [],
    durable_outputs: [
      '.planning/current/plan/execution-readiness-packet.md',
      '.planning/current/plan/sprint-contract.md',
      '.planning/current/plan/status.json',
    ],
    exit_condition: 'Execution is ready or blocked.',
    legal_predecessors: ['frame'],
  },
  handoff: {
    id: 'handoff',
    owner: 'routing-core',
    implementation: 'implemented',
    purpose: 'Produce governed routing and handoff artifacts.',
    required_inputs: ['.planning/current/plan/status.json'],
    durable_outputs: [
      '.planning/current/handoff/governed-execution-routing.md',
      '.planning/current/handoff/governed-handoff.md',
      '.planning/current/handoff/status.json',
    ],
    exit_condition: 'Governed handoff is explicit or refused.',
    legal_predecessors: ['plan', 'handoff', 'review'],
  },
  build: {
    id: 'build',
    owner: 'superpowers-core',
    implementation: 'implemented',
    purpose: 'Record the bounded build result.',
    required_inputs: ['.planning/current/handoff/status.json'],
    durable_outputs: [
      '.planning/current/build/build-request.json',
      '.planning/current/build/build-result.md',
      '.planning/current/build/status.json',
    ],
    exit_condition: 'Build result exists or the route is refused.',
    legal_predecessors: ['handoff', 'review'],
  },
  review: {
    id: 'review',
    owner: 'audit-core',
    implementation: 'implemented',
    purpose: 'Write the current audit set and reviewed provenance.',
    required_inputs: ['.planning/current/build/status.json'],
    durable_outputs: [
      '.planning/audits/current/codex.md',
      '.planning/audits/current/gemini.md',
      '.planning/audits/current/synthesis.md',
      '.planning/audits/current/gate-decision.md',
      '.planning/audits/current/meta.json',
      '.planning/current/review/status.json',
    ],
    exit_condition: 'Audit set is complete and gate state is explicit.',
    legal_predecessors: ['build', 'review'],
  },
  qa: {
    id: 'qa',
    owner: 'audit-core',
    implementation: 'implemented',
    purpose: 'Record explicit QA validation scope.',
    required_inputs: ['.planning/current/review/status.json'],
    durable_outputs: [
      '.planning/current/qa/qa-report.md',
      '.planning/current/qa/status.json',
    ],
    exit_condition: 'QA scope is validated and recorded.',
    legal_predecessors: ['review'],
  },
  ship: {
    id: 'ship',
    owner: 'governance-core',
    implementation: 'implemented',
    purpose: 'Record release-gate intent.',
    required_inputs: ['.planning/current/review/status.json'],
    durable_outputs: [
      '.planning/current/ship/release-gate-record.md',
      '.planning/current/ship/checklist.json',
      '.planning/current/ship/status.json',
    ],
    exit_condition: 'Release-gate state is explicitly recorded.',
    legal_predecessors: ['review', 'qa'],
  },
  closeout: {
    id: 'closeout',
    owner: 'gsd-core',
    implementation: 'implemented',
    purpose: 'Verify and conclude the governed work unit.',
    required_inputs: ['.planning/current/review/status.json'],
    durable_outputs: [
      '.planning/current/closeout/CLOSEOUT-RECORD.md',
      '.planning/current/closeout/status.json',
    ],
    exit_condition: 'Final readiness status is explicit.',
    legal_predecessors: ['review', 'qa', 'ship'],
  },
};

export const LEGACY_ALIASES: Record<string, CanonicalCommandId> = {
  'office-hours': 'discover',
  'plan-ceo-review': 'frame',
  'plan-eng-review': 'frame',
  autoplan: 'plan',
  'start-work': 'discover',
  'execute-wave': 'build',
  'governed-execute': 'build',
  'verify-close': 'closeout',
};

export function resolveCommandName(name: string): CanonicalCommandId {
  if (name in CANONICAL_MANIFEST) {
    return name as CanonicalCommandId;
  }

  const resolved = LEGACY_ALIASES[name];
  if (!resolved) {
    throw new Error(`Unknown Nexus command: ${name}`);
  }

  return resolved;
}

export function documentedLifecycleEntrypoints(): string[] {
  return [...Object.keys(CANONICAL_MANIFEST), ...Object.keys(LEGACY_ALIASES)];
}
