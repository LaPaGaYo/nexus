import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  archivedCloseoutRootFor,
  closeoutNextRunBootstrapJsonPath,
  closeoutNextRunMarkdownPath,
  discoverBootstrapJsonPath,
  discoverBootstrapMarkdownPath,
} from './artifacts';
import type { ArtifactPointer, ContinuationMode, RunLedger, StageStatus, WorkspaceRecord } from './types';
import { readJsonPartial } from './validation-helpers';

export interface NextRunBootstrapRecord {
  schema_version: 1;
  previous_run_id: string;
  archived_run_root: string;
  previous_workspace: WorkspaceRecord | null;
  recommended_entrypoint: 'discover';
  recommended_continuation_mode: ContinuationMode;
  landing_reentry: LandingReentryRecord | null;
  summary: string;
  carry_forward_artifacts: ArtifactPointer[];
  generated_at: string;
}

export interface LandingReentryRecord {
  deploy_result_path: string;
  merge_status: string | null;
  deploy_status: string | null;
  verification_status: string | null;
  failure_kind: string | null;
  next_action: string | null;
  ship_handoff_current: boolean | null;
  ship_handoff_head_sha: string | null;
  pull_request_head_sha: string | null;
}

function bootstrapArtifactPointer(path: string): ArtifactPointer {
  return {
    kind: path.endsWith('.json') ? 'json' : 'markdown',
    path,
  };
}

export function bootstrapResumeArtifacts(): string[] {
  return [discoverBootstrapMarkdownPath(), discoverBootstrapJsonPath()];
}

export function buildNextRunBootstrap(input: {
  ledger: RunLedger;
  reviewStatus: StageStatus;
  qaStatus: StageStatus | null;
  shipStatus: StageStatus | null;
  generatedAt: string;
  followOnSummaryRecorded?: boolean;
  canaryEvidencePath?: string | null;
  documentationSyncPath?: string | null;
  deployResultPath?: string | null;
  landingReentry?: LandingReentryRecord | null;
}): NextRunBootstrapRecord {
  const carryForwardArtifacts: ArtifactPointer[] = [
    bootstrapArtifactPointer('docs/product/idea-brief.md'),
    bootstrapArtifactPointer('docs/product/decision-brief.md'),
    bootstrapArtifactPointer('docs/product/prd.md'),
    bootstrapArtifactPointer(`.planning/archive/runs/${input.ledger.run_id}/current-run.json`),
    bootstrapArtifactPointer(`.planning/archive/runs/${input.ledger.run_id}/closeout/CLOSEOUT-RECORD.md`),
  ];

  if (input.followOnSummaryRecorded) {
    carryForwardArtifacts.push(
      bootstrapArtifactPointer(`.planning/archive/runs/${input.ledger.run_id}/closeout/FOLLOW-ON-SUMMARY.md`),
      bootstrapArtifactPointer(`.planning/archive/runs/${input.ledger.run_id}/closeout/follow-on-summary.json`),
    );
  }

  if (input.deployResultPath) {
    carryForwardArtifacts.push(
      bootstrapArtifactPointer(`.planning/archive/runs/${input.ledger.run_id}/ship/deploy-result.json`),
    );
  }

  if (input.documentationSyncPath) {
    carryForwardArtifacts.push(
      bootstrapArtifactPointer(`.planning/archive/runs/${input.ledger.run_id}/closeout/documentation-sync.md`),
    );
  }

  const landingReentryLine = input.landingReentry
    ? `Landing re-entry guidance: next_action=${input.landingReentry.next_action ?? 'none'}, ship_handoff_current=${
        input.landingReentry.ship_handoff_current === true
          ? 'yes'
          : input.landingReentry.ship_handoff_current === false
            ? 'no'
            : 'unknown'
      }, merge_status=${input.landingReentry.merge_status ?? 'unknown'}, verification_status=${
        input.landingReentry.verification_status ?? 'unknown'
      }.`
    : 'Landing re-entry guidance: not recorded.';

  const summary = [
    `Completed governed run ${input.ledger.run_id} through /closeout.`,
    `Review gate: ${input.reviewStatus.gate_decision ?? 'pass'}.`,
    `QA ready: ${input.qaStatus?.ready === true ? 'yes' : 'not recorded'}.`,
    `Ship ready: ${input.shipStatus?.ready === true ? 'yes' : 'not recorded'}.`,
    `Follow-on evidence summary recorded: ${input.followOnSummaryRecorded ? 'yes' : 'no'}.`,
    `Ship canary evidence recorded: ${input.canaryEvidencePath ? 'yes' : 'no'}.`,
    `Deploy result evidence recorded: ${input.deployResultPath ? 'yes' : 'no'}.`,
    `Documentation sync recorded: ${input.documentationSyncPath ? 'yes' : 'no'}.`,
    landingReentryLine,
    'Start the next run from /discover, but continue from the repo-visible product artifacts and archived closeout record rather than rediscovering blind.',
  ].join(' ');

  return {
    schema_version: 1,
    previous_run_id: input.ledger.run_id,
    archived_run_root: `.planning/archive/runs/${input.ledger.run_id}`,
    previous_workspace: input.ledger.execution.workspace ?? null,
    recommended_entrypoint: 'discover',
    recommended_continuation_mode: 'phase',
    landing_reentry: input.landingReentry ?? null,
    summary,
    carry_forward_artifacts: carryForwardArtifacts,
    generated_at: input.generatedAt,
  };
}

export function renderNextRunBootstrapMarkdown(record: NextRunBootstrapRecord): string {
  const workspaceLine = record.previous_workspace
    ? `- Previous workspace: ${record.previous_workspace.path} (${record.previous_workspace.retirement_state ?? 'active'})`
    : '- Previous workspace: repo root';

  return [
    '# Next Run Bootstrap',
    '',
    `- Previous run: ${record.previous_run_id}`,
    `- Recommended entrypoint: /${record.recommended_entrypoint}`,
    `- Recommended continuation mode: ${record.recommended_continuation_mode}`,
    `- Archived run root: ${record.archived_run_root}`,
    workspaceLine,
    '',
    '## Summary',
    '',
    record.summary,
    '',
    '## Landing Re-entry',
    '',
    record.landing_reentry
      ? [
          `- Deploy result: ${record.landing_reentry.deploy_result_path}`,
          `- Merge status: ${record.landing_reentry.merge_status ?? 'unknown'}`,
          `- Deploy status: ${record.landing_reentry.deploy_status ?? 'unknown'}`,
          `- Verification status: ${record.landing_reentry.verification_status ?? 'unknown'}`,
          `- Failure kind: ${record.landing_reentry.failure_kind ?? 'unknown'}`,
          `- Next action: ${record.landing_reentry.next_action ?? 'none'}`,
          `- Ship handoff current: ${
            record.landing_reentry.ship_handoff_current === true
              ? 'yes'
              : record.landing_reentry.ship_handoff_current === false
                ? 'no'
                : 'unknown'
          }`,
          `- Ship handoff head SHA: ${record.landing_reentry.ship_handoff_head_sha ?? 'unknown'}`,
          `- PR head SHA: ${record.landing_reentry.pull_request_head_sha ?? 'unknown'}`,
        ].join('\n')
      : '- none',
    '',
    '## Carry Forward Artifacts',
    '',
    ...record.carry_forward_artifacts.map((artifact) => `- ${artifact.path}`),
    '',
  ].join('\n');
}

function writeRepoFile(cwd: string, relativePath: string, content: string): void {
  const absolutePath = join(cwd, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
}

export function persistCloseoutBootstrap(
  cwd: string,
  record: NextRunBootstrapRecord,
): Array<{ path: string; content: string }> {
  return [
    {
      path: closeoutNextRunBootstrapJsonPath(),
      content: JSON.stringify(record, null, 2) + '\n',
    },
    {
      path: closeoutNextRunMarkdownPath(),
      content: renderNextRunBootstrapMarkdown(record),
    },
  ];
}

export function resetCurrentPlanningStateForFreshRun(cwd: string): void {
  rmSync(join(cwd, '.planning', 'current'), { recursive: true, force: true });
}

export function seedDiscoverBootstrapFromArchivedRun(cwd: string, previousRunId: string): ArtifactPointer[] {
  const archivedCloseoutRoot = join(cwd, archivedCloseoutRootFor(previousRunId));
  const archivedJson = join(archivedCloseoutRoot, 'next-run-bootstrap.json');
  const archivedMarkdown = join(archivedCloseoutRoot, 'NEXT-RUN.md');
  const seeded: ArtifactPointer[] = [];

  if (existsSync(archivedJson)) {
    const relativePath = discoverBootstrapJsonPath();
    writeRepoFile(cwd, relativePath, readFileSync(archivedJson, 'utf8'));
    seeded.push(bootstrapArtifactPointer(relativePath));
  }

  if (existsSync(archivedMarkdown)) {
    const relativePath = discoverBootstrapMarkdownPath();
    writeRepoFile(cwd, relativePath, readFileSync(archivedMarkdown, 'utf8'));
    seeded.push(bootstrapArtifactPointer(relativePath));
  }

  return seeded;
}

export function resolveContinuationModeFromBootstrap(cwd: string): ContinuationMode {
  const parsed = readJsonPartial<NextRunBootstrapRecord>(join(cwd, discoverBootstrapJsonPath()));
  return parsed?.recommended_continuation_mode === 'task' || parsed?.recommended_continuation_mode === 'phase'
    ? parsed.recommended_continuation_mode
    : 'project_reset';
}

export function discoverBootstrapSupportingContextArtifacts(cwd: string): string[] {
  const parsed = readJsonPartial<NextRunBootstrapRecord>(join(cwd, discoverBootstrapJsonPath()));
  return (parsed?.carry_forward_artifacts ?? [])
    .map((artifact) => artifact.path)
    .filter((artifactPath): artifactPath is string => (
      typeof artifactPath === 'string'
      && (
        artifactPath.endsWith('/FOLLOW-ON-SUMMARY.md')
        || artifactPath.endsWith('/follow-on-summary.json')
      )
    ));
}

export function mirrorBootstrapIntoWorkspace(
  repoRoot: string,
  workspacePath: string,
  relativePath: string,
): void {
  const sourcePath = join(repoRoot, relativePath);
  if (!existsSync(sourcePath)) {
    return;
  }

  const targetPath = join(workspacePath, relativePath);
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath, { force: true });
}
