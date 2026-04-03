import {
  stageAdapterOutputPath,
  stageAdapterRequestPath,
  stageNormalizationPath,
} from '../artifacts';
import type { AdapterResult } from '../adapters/types';
import type { CcbExecuteGeneratorRaw, CcbResolveRouteRaw } from '../adapters/ccb';
import type {
  ActualRouteRecord,
  RequestedRouteRecord,
  RouteValidationRecord,
  RunLedger,
} from '../types';

interface ArtifactWrite {
  path: string;
  content: string;
}

function buildTraceWrites(
  stage: 'handoff' | 'build',
  requestPayload: Record<string, unknown>,
  result: AdapterResult<unknown>,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return [
    {
      path: stageAdapterRequestPath(stage),
      content: JSON.stringify(requestPayload, null, 2) + '\n',
    },
    {
      path: stageAdapterOutputPath(stage),
      content: JSON.stringify(result, null, 2) + '\n',
    },
    {
      path: stageNormalizationPath(stage),
      content: JSON.stringify(normalizationPayload, null, 2) + '\n',
    },
  ];
}

function expectedProviderFor(requestedRoute: RequestedRouteRecord): string | null {
  if (requestedRoute.generator?.startsWith('codex')) {
    return 'codex';
  }

  if (requestedRoute.generator?.startsWith('gemini')) {
    return 'gemini';
  }

  return null;
}

export function requestedBuildRouteFromLedger(ledger: RunLedger): RequestedRouteRecord {
  return {
    command: 'build',
    governed: true,
    planner: ledger.route_intent.planner ?? 'claude+pm-gsd',
    generator: ledger.route_intent.generator ?? 'codex-via-ccb',
    evaluator_a: ledger.route_intent.evaluator_a ?? 'codex-via-ccb',
    evaluator_b: ledger.route_intent.evaluator_b ?? 'gemini-via-ccb',
    synthesizer: ledger.route_intent.synthesizer ?? 'claude',
    substrate: ledger.route_intent.substrate ?? 'superpowers-core',
    fallback_policy: 'disabled',
  };
}

export function normalizeHandoffRouteValidation(
  requestedRoute: RequestedRouteRecord,
  result: AdapterResult<CcbResolveRouteRaw>,
): { route_validation: RouteValidationRecord; approved: boolean } {
  const expectedProvider = expectedProviderFor(requestedRoute);
  const approved = result.raw_output.available
    && requestedRoute.generator === 'codex-via-ccb'
    && requestedRoute.substrate === 'superpowers-core'
    && requestedRoute.fallback_policy === 'disabled'
    && (expectedProvider === null || result.raw_output.provider === expectedProvider);

  return {
    route_validation: {
      transport: 'ccb',
      available: result.raw_output.available,
      approved,
      reason: !result.raw_output.available
        ? 'CCB reported the requested route unavailable'
        : approved
          ? 'Nexus approved the requested governed route'
          : 'Nexus rejected the requested governed route',
    },
    approved,
  };
}

export function requestedAndActualRouteMatch(
  requestedRoute: RequestedRouteRecord,
  actualRoute: ActualRouteRecord | null,
): boolean {
  const expectedProvider = expectedProviderFor(requestedRoute);

  return actualRoute !== null
    && actualRoute.route === requestedRoute.generator
    && actualRoute.substrate === requestedRoute.substrate
    && actualRoute.transport === 'ccb'
    && (expectedProvider === null || actualRoute.provider === expectedProvider);
}

export function buildGovernedExecutionRoutingMarkdown(
  requestedRoute: RequestedRouteRecord,
  routeValidation: RouteValidationRecord,
): string {
  return [
    '# Governed Execution Routing',
    '',
    `Command: ${requestedRoute.command}`,
    `Generator: ${requestedRoute.generator ?? 'unset'}`,
    `Evaluator A: ${requestedRoute.evaluator_a ?? 'unset'}`,
    `Evaluator B: ${requestedRoute.evaluator_b ?? 'unset'}`,
    `Substrate: ${requestedRoute.substrate ?? 'unset'}`,
    `Fallback: ${requestedRoute.fallback_policy}`,
    `Transport availability: ${routeValidation.available ? 'available' : 'unavailable'}`,
    `Nexus approval: ${routeValidation.approved ? 'approved' : 'blocked'}`,
    '',
  ].join('\n');
}

export function buildGovernedHandoffMarkdown(
  requestedRoute: RequestedRouteRecord,
  routeValidation: RouteValidationRecord,
): string {
  return [
    '# Governed Handoff',
    '',
    `Planner: ${requestedRoute.planner ?? 'unset'}`,
    `Generator route: ${requestedRoute.generator ?? 'unset'}`,
    `Execution substrate: ${requestedRoute.substrate ?? 'unset'}`,
    `Route validation: ${routeValidation.reason}`,
    '',
  ].join('\n');
}

export function buildBuildResultMarkdown(
  requestedRoute: RequestedRouteRecord,
  actualRoute: ActualRouteRecord,
  receipt: string,
  verificationSummary: string | null = null,
): string {
  const lines = [
    '# Build Result',
    '',
  ];

  if (verificationSummary) {
    lines.push(`Verification: ${verificationSummary}`);
    lines.push('');
  }

  lines.push(
    'Status: ready for review',
    `Requested route: ${requestedRoute.generator ?? 'unset'}`,
    `Actual route: ${actualRoute.route ?? 'unset'}`,
    `Receipt: ${receipt}`,
    '',
  );

  return lines.join('\n');
}

export function buildCcbTraceabilityPayloads(
  stage: 'handoff' | 'build',
  runId: string,
  inputs: string[],
  requestPayload: Record<string, unknown>,
  result: AdapterResult<unknown>,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return buildTraceWrites(stage, { run_id: runId, inputs, ...requestPayload }, result, normalizationPayload);
}
