import {
  stageAdapterOutputPath,
  stageAdapterRequestPath,
  stageNormalizationPath,
} from '../artifacts';
import { localExecutionPath } from '../execution-topology';
import type { AdapterResult } from '../adapters/types';
import type { CcbExecuteAuditRaw, CcbExecuteGeneratorRaw, CcbExecuteQaRaw, CcbResolveRouteRaw } from '../adapters/ccb';
import type { LocalExecuteAuditRaw, LocalExecuteQaRaw, LocalResolveRouteRaw } from '../adapters/local';
import type {
  ActualRouteRecord,
  ReviewRequestedRouteRecord,
  RequestedRouteRecord,
  ReviewScopeRecord,
  RouteCheckRecord,
  RouteValidationRecord,
  RunLedger,
  WorkspaceRecord,
} from '../types';

interface ArtifactWrite {
  path: string;
  content: string;
}

function buildTraceWrites(
  stage: 'handoff' | 'build' | 'review' | 'qa',
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

export function expectedProvidersForRequestedRoute(requestedRoute: RequestedRouteRecord): string[] {
  return [...new Set([
    requestedRoute.generator,
    requestedRoute.evaluator_a,
    requestedRoute.evaluator_b,
  ]
    .filter((route): route is string => typeof route === 'string')
    .map((route) => route.startsWith('codex') ? 'codex' : route.startsWith('gemini') ? 'gemini' : null)
    .filter((provider): provider is string => provider !== null))];
}

export function validateGovernedHandoffRouteValidation(
  requestedRoute: RequestedRouteRecord,
  routeValidation: RouteValidationRecord | null | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (requestedRoute.transport !== 'ccb') {
    return { ok: true };
  }

  if (!routeValidation || routeValidation.transport !== 'ccb') {
    return {
      ok: false,
      reason: 'Governed handoff contract is missing CCB route validation. Rerun /handoff with the current Nexus version before /build.',
    };
  }

  const expectedProviders = expectedProvidersForRequestedRoute(requestedRoute);
  if (expectedProviders.length === 0) {
    return { ok: true };
  }

  const checks = new Map(
    (routeValidation.provider_checks ?? []).map((check) => [check.provider, check] as const),
  );
  const missingChecks = expectedProviders.filter((provider) => !checks.has(provider));
  if (missingChecks.length > 0) {
    return {
      ok: false,
      reason: `Governed handoff contract does not record verification for required provider(s): ${missingChecks.join(', ')}. Rerun /handoff with the current Nexus version before /build.`,
    };
  }

  const unavailableProviders = expectedProviders.filter((provider) => checks.get(provider)?.available !== true);
  if (unavailableProviders.length > 0) {
    return {
      ok: false,
      reason: `Governed handoff contract records unavailable provider(s): ${unavailableProviders.join(', ')}. Mount the missing providers and rerun /handoff before /build.`,
    };
  }

  if (routeValidation.available !== true || routeValidation.approved !== true) {
    return {
      ok: false,
      reason: 'Governed handoff contract is not fully approved for build execution. Rerun /handoff before /build.',
    };
  }

  return { ok: true };
}

function buildCcbProviderChecks(
  requestedRoute: RequestedRouteRecord,
  raw: Partial<CcbResolveRouteRaw> | null,
): NonNullable<RouteValidationRecord['provider_checks']> {
  const expectedProviders = expectedProvidersForRequestedRoute(requestedRoute);
  const mountedProviders = new Set(raw?.mounted ?? (raw?.available ? expectedProviders : []));
  const pingedProviders = new Set(
    raw?.provider_checks?.map((check) => check.provider)
      ?? (raw?.available ? expectedProviders : raw?.provider ? [raw.provider] : []),
  );

  return expectedProviders.map((provider) => {
    const pinged = pingedProviders.has(provider);
    const mounted = mountedProviders.has(provider);
    const available = pinged && mounted;

    return {
      provider,
      available,
      mounted,
      reason: !pinged
        ? `CCB ${provider} route check failed`
        : !mounted
          ? `CCB mounted providers do not include ${provider}`
          : `CCB ${provider} route check passed`,
    };
  });
}

export function requestedBuildRouteFromLedger(ledger: RunLedger): RequestedRouteRecord {
  if (ledger.execution.mode === 'local_provider') {
    return {
      command: 'build',
      governed: false,
      execution_mode: ledger.execution.mode,
      primary_provider: ledger.execution.primary_provider,
      provider_topology: ledger.execution.provider_topology,
      planner: ledger.route_intent.planner ?? 'claude+pm-gsd',
      generator: ledger.route_intent.generator ?? ledger.execution.requested_path,
      evaluator_a: ledger.route_intent.evaluator_a ?? localExecutionPath(ledger.execution.primary_provider, ledger.execution.provider_topology, 'audit_a'),
      evaluator_b: ledger.route_intent.evaluator_b ?? localExecutionPath(ledger.execution.primary_provider, ledger.execution.provider_topology, 'audit_b'),
      synthesizer: ledger.route_intent.synthesizer ?? ledger.execution.primary_provider,
      substrate: ledger.route_intent.substrate ?? 'superpowers-core',
      transport: 'local',
      fallback_policy: 'disabled',
    };
  }

  return {
    command: 'build',
    governed: true,
    execution_mode: ledger.execution.mode,
    primary_provider: ledger.execution.primary_provider,
    provider_topology: ledger.execution.provider_topology,
    planner: ledger.route_intent.planner ?? 'claude+pm-gsd',
    generator: ledger.route_intent.generator ?? 'codex-via-ccb',
    evaluator_a: ledger.route_intent.evaluator_a ?? 'codex-via-ccb',
    evaluator_b: ledger.route_intent.evaluator_b ?? 'gemini-via-ccb',
    synthesizer: ledger.route_intent.synthesizer ?? 'claude',
    substrate: ledger.route_intent.substrate ?? 'superpowers-core',
    transport: 'ccb',
    fallback_policy: 'disabled',
  };
}

export function normalizeHandoffRouteValidation(
  requestedRoute: RequestedRouteRecord,
  result: AdapterResult<CcbResolveRouteRaw | LocalResolveRouteRaw>,
): { route_validation: RouteValidationRecord; approved: boolean } {
  if (requestedRoute.transport === 'local') {
    const raw = result.raw_output as LocalResolveRouteRaw;
    const approved = raw.available
      && requestedRoute.generator === localExecutionPath(requestedRoute.primary_provider, requestedRoute.provider_topology)
      && requestedRoute.fallback_policy === 'disabled';

    return {
      route_validation: {
        transport: 'local',
        available: raw.available,
        approved,
        reason: !raw.available
          ? 'Local provider route is unavailable'
          : approved
            ? 'Nexus approved the requested local provider route'
            : 'Nexus rejected the requested local provider route',
      },
      approved,
    };
  }

  const raw = (result.raw_output ?? null) as Partial<CcbResolveRouteRaw> | null;
  const providerChecks = buildCcbProviderChecks(requestedRoute, raw);
  const available = providerChecks.length > 0
    ? providerChecks.every((check) => check.available)
    : Boolean(raw?.available);
  const expectedProvider = expectedProviderFor(requestedRoute);
  const approved = available
    && requestedRoute.generator === 'codex-via-ccb'
    && requestedRoute.substrate === 'superpowers-core'
    && requestedRoute.fallback_policy === 'disabled'
    && (expectedProvider === null || raw?.provider === expectedProvider);

  return {
    route_validation: {
      transport: 'ccb',
      available,
      approved,
      reason: !available
        ? result.notices[0] ?? 'CCB reported the requested route unavailable'
        : approved
          ? 'Nexus approved the requested governed route'
          : 'Nexus rejected the requested governed route',
      mounted_providers: raw?.mounted ?? [],
      provider_checks: providerChecks,
    },
    approved,
  };
}

export function buildRunLevelRouteCheck(
  checkedAt: string,
  requestedRoute: RequestedRouteRecord,
  routeValidation: RouteValidationRecord,
): RouteCheckRecord {
  return {
    checked_at: checkedAt,
    requested_route: requestedRoute,
    route_validation: routeValidation,
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
    && actualRoute.transport === requestedRoute.transport
    && (expectedProvider === null || actualRoute.provider === expectedProvider);
}

export function buildGovernedExecutionRoutingMarkdown(
  requestedRoute: RequestedRouteRecord,
  routeValidation: RouteValidationRecord,
  workspace?: WorkspaceRecord | null,
): string {
  const lines = [
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
  ];

  if (workspace) {
    lines.push(`Execution workspace: ${workspace.path}`);
    lines.push(`Workspace kind: ${workspace.kind}`);
    lines.push(`Workspace branch: ${workspace.branch ?? 'detached'}`);
  }

  if (routeValidation.mounted_providers && routeValidation.mounted_providers.length > 0) {
    lines.push(`Mounted providers: ${routeValidation.mounted_providers.join(', ')}`);
  }

  if (routeValidation.provider_checks && routeValidation.provider_checks.length > 0) {
    lines.push('');
    lines.push('Provider checks:');
    for (const check of routeValidation.provider_checks) {
      lines.push(`- ${check.provider}: ${check.available ? 'available' : 'unavailable'} (mounted: ${check.mounted ? 'yes' : 'no'})`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function buildGovernedHandoffMarkdown(
  requestedRoute: RequestedRouteRecord,
  routeValidation: RouteValidationRecord,
  reviewScope?: ReviewScopeRecord | null,
  workspace?: WorkspaceRecord | null,
): string {
  const lines = [
    '# Governed Handoff',
    '',
    `Planner: ${requestedRoute.planner ?? 'unset'}`,
    `Generator route: ${requestedRoute.generator ?? 'unset'}`,
    `Execution substrate: ${requestedRoute.substrate ?? 'unset'}`,
    `Route validation: ${routeValidation.reason}`,
  ];

  if (workspace) {
    lines.push(`Execution workspace: ${workspace.path}`);
    lines.push(`Workspace kind: ${workspace.kind}`);
    lines.push(`Workspace branch: ${workspace.branch ?? 'detached'}`);
  }

  if (routeValidation.provider_checks && routeValidation.provider_checks.length > 0) {
    lines.push('');
    lines.push('## Provider Verification');
    lines.push('');
    for (const check of routeValidation.provider_checks) {
      lines.push(`- ${check.provider}: ${check.reason}`);
    }
  }

  lines.push('');
  lines.push('## Execution Contract');
  lines.push('');
  lines.push('- .planning/current/plan/execution-readiness-packet.md');
  lines.push('- .planning/current/plan/sprint-contract.md');

  if (reviewScope) {
    lines.push('');
    lines.push('## Review Scope');
    lines.push('');
    lines.push(`Mode: ${reviewScope.mode}`);
    if (reviewScope.blocking_items.length > 0) {
      lines.push('Blocking items:');
      for (const item of reviewScope.blocking_items) {
        lines.push(`- ${item}`);
      }
    } else {
      lines.push('Blocking items: full phase acceptance');
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function buildBuildResultMarkdown(
  requestedRoute: RequestedRouteRecord,
  actualRoute: ActualRouteRecord,
  receipt: string,
  verificationSummary: string | null = null,
  reviewScope?: ReviewScopeRecord | null,
  workspace?: WorkspaceRecord | null,
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

  if (workspace) {
    lines.push(`Execution workspace: ${workspace.path}`);
    lines.push(`Workspace kind: ${workspace.kind}`);
    lines.push(`Workspace branch: ${workspace.branch ?? 'detached'}`);
    lines.push('');
  }

  if (reviewScope) {
    lines.push(`Review scope: ${reviewScope.mode}`);
    if (reviewScope.blocking_items.length > 0) {
      for (const item of reviewScope.blocking_items) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

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

export function requestedAuditRouteFromBuild(
  requestedRoute: RequestedRouteRecord,
  provider: 'codex' | 'gemini',
): ReviewRequestedRouteRecord {
  if (requestedRoute.transport === 'local') {
    return {
      provider: requestedRoute.primary_provider,
      route: provider === 'codex' ? requestedRoute.evaluator_a : requestedRoute.evaluator_b,
      substrate: requestedRoute.substrate,
      transport: 'local',
    };
  }

  return {
    provider,
    route: provider === 'codex' ? requestedRoute.evaluator_a : requestedRoute.evaluator_b,
    substrate: requestedRoute.substrate,
    transport: 'ccb',
  };
}

export function requestedAndActualAuditRouteMatch(
  requestedRoute: ReviewRequestedRouteRecord,
  actualRoute: ActualRouteRecord | null,
): boolean {
  return actualRoute !== null
    && actualRoute.provider === requestedRoute.provider
    && actualRoute.route === requestedRoute.route
    && actualRoute.substrate === requestedRoute.substrate
    && actualRoute.transport === requestedRoute.transport;
}

export function buildReviewSynthesisMarkdown(
  disciplineSummary: string,
  codexMarkdown: string,
  geminiMarkdown: string,
  gateDecision: 'pass' | 'fail',
): string {
  const codexResult = codexMarkdown.match(/Result:\s*(pass|fail)/i)?.[1]?.toLowerCase() ?? 'unknown';
  const geminiResult = geminiMarkdown.match(/Result:\s*(pass|fail)/i)?.[1]?.toLowerCase() ?? 'unknown';

  return [
    '# Synthesis',
    '',
    `Discipline: ${disciplineSummary}`,
    '',
    `Codex audit result: ${codexResult}`,
    `Gemini audit result: ${geminiResult}`,
    '',
    `Result: ${gateDecision === 'pass' ? 'review complete' : 'fix cycle required'}`,
    '',
  ].join('\n');
}

export function buildReviewGateDecisionMarkdown(
  gateDecision: 'pass' | 'fail' | 'blocked',
): string {
  return [
    '# Gate Decision',
    '',
    `Gate: ${gateDecision}`,
    '',
  ].join('\n');
}

export function buildReviewTraceabilityPayloads(
  runId: string,
  inputs: string[],
  requestedRoute: RequestedRouteRecord,
  reviewScope: ReviewScopeRecord | null,
  workspace: WorkspaceRecord | null,
  disciplineResult: AdapterResult<unknown> | null,
  auditAResult: AdapterResult<CcbExecuteAuditRaw | LocalExecuteAuditRaw> | null,
  auditBResult: AdapterResult<CcbExecuteAuditRaw | LocalExecuteAuditRaw> | null,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return [
    {
      path: stageAdapterRequestPath('review'),
      content: JSON.stringify(
        {
          run_id: runId,
          inputs,
          adapter_chain: ['superpowers', requestedRoute.transport, requestedRoute.transport],
          requested_route: requestedRoute,
          review_scope: reviewScope,
          workspace,
          requested_audit_routes: {
            codex: requestedAuditRouteFromBuild(requestedRoute, 'codex'),
            gemini: requestedAuditRouteFromBuild(requestedRoute, 'gemini'),
          },
        },
        null,
        2,
      ) + '\n',
    },
    {
      path: stageAdapterOutputPath('review'),
      content: JSON.stringify(
        {
          discipline: disciplineResult,
          audit_a: auditAResult,
          audit_b: auditBResult,
        },
        null,
        2,
      ) + '\n',
    },
    {
      path: stageNormalizationPath('review'),
      content: JSON.stringify(normalizationPayload, null, 2) + '\n',
    },
  ];
}

export function requestedQaRouteFromLedger(ledger: RunLedger): RequestedRouteRecord {
  if (ledger.execution.mode === 'local_provider') {
    return {
      command: 'qa',
      governed: false,
      execution_mode: ledger.execution.mode,
      primary_provider: ledger.execution.primary_provider,
      provider_topology: ledger.execution.provider_topology,
      planner: null,
      generator: localExecutionPath(ledger.execution.primary_provider, ledger.execution.provider_topology, 'qa'),
      evaluator_a: null,
      evaluator_b: null,
      synthesizer: null,
      substrate: ledger.route_intent.substrate ?? 'superpowers-core',
      transport: 'local',
      fallback_policy: 'disabled',
    };
  }

  return {
    command: 'qa',
    governed: true,
    execution_mode: ledger.execution.mode,
    primary_provider: ledger.execution.primary_provider,
    provider_topology: ledger.execution.provider_topology,
    planner: null,
    generator: ledger.route_intent.evaluator_b ?? 'gemini-via-ccb',
    evaluator_a: null,
    evaluator_b: null,
    synthesizer: null,
    substrate: ledger.route_intent.substrate ?? 'superpowers-core',
    transport: 'ccb',
    fallback_policy: 'disabled',
  };
}

export function buildQaTraceabilityPayloads(
  runId: string,
  inputs: string[],
  requestedRoute: RequestedRouteRecord,
  workspace: WorkspaceRecord | null,
  result: AdapterResult<CcbExecuteQaRaw | LocalExecuteQaRaw>,
  normalizationPayload: Record<string, unknown>,
): ArtifactWrite[] {
  return buildTraceWrites(
    'qa',
    {
      run_id: runId,
      inputs,
      adapter_chain: [requestedRoute.transport],
      requested_route: requestedRoute,
      workspace,
    },
    result,
    normalizationPayload,
  );
}
