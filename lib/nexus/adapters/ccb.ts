import { createBuildStagePack, createHandoffStagePack, createQaStagePack, createReviewStagePack } from '../stage-packs';
import type { ActualRouteRecord } from '../types';
import type { AdapterResult, AdapterTraceability, CcbAdapter } from './types';

export interface CcbResolveRouteRaw {
  available: boolean;
  provider: string | null;
}

export interface CcbExecuteGeneratorRaw {
  receipt: string;
}

export interface CcbExecuteAuditRaw {
  markdown: string;
  receipt: string;
}

export interface CcbExecuteQaRaw {
  report_markdown: string;
  ready: boolean;
  findings: string[];
  receipt: string;
}

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
          markdown: '# Codex Audit\n\nResult: pass\n',
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
          markdown: '# Gemini Audit\n\nResult: pass\n',
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
          report_markdown: '# QA Report\n\nResult: pass\n',
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
