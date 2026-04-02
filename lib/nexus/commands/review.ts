import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { currentAuditPointer, stageStatusPath } from '../artifacts';
import { gateRequiresArchive, assertSameRunId } from '../governance';
import { readLedger, writeLedger } from '../ledger';
import { readStageStatus, writeStageStatus } from '../status';
import { assertLegalTransition, getAllowedNextStages } from '../transitions';
import type { ArtifactPointer, StageStatus } from '../types';
import type { CommandContext, CommandResult } from './index';

function artifactPointerFor(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

function writeRepoFile(cwd: string, relativePath: string, content: string): void {
  writeFileSync(join(cwd, relativePath), content);
}

export async function runReview(ctx: CommandContext): Promise<CommandResult> {
  const ledger = readLedger(ctx.cwd);
  const buildStatusPath = stageStatusPath('build');
  const buildStatus = readStageStatus(buildStatusPath, ctx.cwd);

  if (!ledger || !buildStatus?.ready) {
    throw new Error('Build must be completed before review');
  }

  assertSameRunId(ledger.run_id, buildStatus.run_id, 'build status');
  assertLegalTransition(ledger.current_stage, 'review');

  if (!buildStatus.requested_route || !buildStatus.actual_route) {
    throw new Error('Build must record requested and actual route before review');
  }

  const provenanceConsistent = buildStatus.requested_route.generator === buildStatus.actual_route.route
    && buildStatus.requested_route.substrate === buildStatus.actual_route.substrate;
  if (!provenanceConsistent) {
    throw new Error('Build provenance is inconsistent before review');
  }

  const startedAt = ctx.clock();
  const codexPath = '.planning/audits/current/codex.md';
  const geminiPath = '.planning/audits/current/gemini.md';
  const synthesisPath = '.planning/audits/current/synthesis.md';
  const gateDecisionPath = '.planning/audits/current/gate-decision.md';
  const metaPath = '.planning/audits/current/meta.json';
  const reviewStatusPath = stageStatusPath('review');
  const gateDecisionMarkdown = '# Gate Decision\n\nGate: pass\n';
  const requestedRoute = buildStatus.requested_route;
  const actualRoute = buildStatus.actual_route;

  mkdirSync(join(ctx.cwd, '.planning', 'audits', 'current'), { recursive: true });
  mkdirSync(join(ctx.cwd, '.planning', 'current', 'review'), { recursive: true });

  writeRepoFile(ctx.cwd, codexPath, '# Codex Audit\n\nStatus: recorded\n');
  writeRepoFile(ctx.cwd, geminiPath, '# Gemini Audit\n\nStatus: recorded\n');
  writeRepoFile(ctx.cwd, synthesisPath, '# Synthesis\n\nResult: review complete\n');
  writeRepoFile(ctx.cwd, gateDecisionPath, gateDecisionMarkdown);
  writeRepoFile(
    ctx.cwd,
    metaPath,
    JSON.stringify(
      {
        run_id: ledger.run_id,
        implementation_provider: 'codex',
        implementation_path: '.planning/current/build/build-result.md',
        implementation_route: requestedRoute.generator,
        implementation_substrate: requestedRoute.substrate,
        implementation: {
          path: '.planning/current/build/build-result.md',
          requested_route: requestedRoute,
          actual_route: actualRoute,
        },
        codex_audit: {
          provider: 'codex',
          path: codexPath,
          route: ledger.route_intent.evaluator_a ?? 'codex-via-ccb',
          substrate: ledger.route_intent.substrate ?? 'superpowers-core',
        },
        gemini_audit: {
          provider: 'gemini',
          path: geminiPath,
          route: ledger.route_intent.evaluator_b ?? 'gemini-via-ccb',
          substrate: ledger.route_intent.substrate ?? 'superpowers-core',
        },
        pm_skill: 'frame',
        execution_skill_chain: ['plan', 'handoff', 'build', 'review'],
        lifecycle_stage: 'review',
        handoff_from: '.planning/current/handoff/governed-handoff.md',
        handoff_to: '.planning/audits/current/',
      },
      null,
      2,
    ) + '\n',
  );

  const outputs = [
    currentAuditPointer('codex'),
    currentAuditPointer('gemini'),
    currentAuditPointer('synthesis'),
    currentAuditPointer('gate-decision'),
    currentAuditPointer('meta'),
    artifactPointerFor(reviewStatusPath),
  ];

  const status: StageStatus = {
    run_id: ledger.run_id,
    stage: 'review',
    state: 'completed',
    decision: 'audit_recorded',
    ready: true,
    inputs: [artifactPointerFor(buildStatusPath)],
    outputs,
    started_at: startedAt,
    completed_at: startedAt,
    errors: [],
    requested_route: requestedRoute,
    actual_route: actualRoute,
    review_complete: true,
    audit_set_complete: true,
    provenance_consistent: provenanceConsistent,
    gate_decision: 'pass',
    archive_required: gateRequiresArchive(gateDecisionMarkdown),
    archive_state: gateRequiresArchive(gateDecisionMarkdown) ? 'pending' : 'not_required',
  };

  ledger.status = 'active';
  ledger.previous_stage = 'build';
  ledger.current_command = 'review';
  ledger.current_stage = 'review';
  ledger.allowed_next_stages = getAllowedNextStages('review');
  ledger.command_history = [
    ...ledger.command_history,
    { command: 'review', at: startedAt, via: ctx.via },
  ];
  ledger.artifact_index = {
    ...ledger.artifact_index,
    [codexPath]: currentAuditPointer('codex'),
    [geminiPath]: currentAuditPointer('gemini'),
    [synthesisPath]: currentAuditPointer('synthesis'),
    [gateDecisionPath]: currentAuditPointer('gate-decision'),
    [metaPath]: currentAuditPointer('meta'),
    [reviewStatusPath]: artifactPointerFor(reviewStatusPath),
  };

  writeStageStatus(reviewStatusPath, status, ctx.cwd);
  writeLedger(ledger, ctx.cwd);

  return { command: 'review', status };
}
