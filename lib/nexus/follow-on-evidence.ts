import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  CanaryEvidenceStatus,
  CanaryStatusRecord,
  DeployResultRecord,
  FollowOnEvidenceSummaryRecord,
} from './types';

function readJsonRecord<T>(cwd: string, relativePath: string): Partial<T> | null {
  const absolutePath = join(cwd, relativePath);
  if (!existsSync(absolutePath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(absolutePath, 'utf8')) as Partial<T>;
  } catch {
    return null;
  }
}

function readCanaryEvidence(
  cwd: string,
  canaryEvidencePath: string | null,
): { path: string | null; status: CanaryEvidenceStatus | null } {
  if (!canaryEvidencePath) {
    return { path: null, status: null };
  }

  const record = readJsonRecord<CanaryStatusRecord>(cwd, canaryEvidencePath);
  const status = record?.status;

  return {
    path: canaryEvidencePath,
    status: status === 'healthy' || status === 'degraded' || status === 'broken' ? status : null,
  };
}

function readDeployEvidence(
  cwd: string,
  deployResultPath: string | null,
): {
  path: string | null;
  deployStatus: DeployResultRecord['deploy_status'] | null;
  verificationStatus: DeployResultRecord['verification_status'] | null;
  productionUrl: string | null;
} {
  if (!deployResultPath) {
    return {
      path: null,
      deployStatus: null,
      verificationStatus: null,
      productionUrl: null,
    };
  }

  const record = readJsonRecord<DeployResultRecord>(cwd, deployResultPath);
  const deployStatus = record?.deploy_status;
  const verificationStatus = record?.verification_status;

  return {
    path: deployResultPath,
    deployStatus:
      deployStatus === 'pending'
      || deployStatus === 'verified'
      || deployStatus === 'degraded'
      || deployStatus === 'failed'
      || deployStatus === 'skipped'
        ? deployStatus
        : null,
    verificationStatus:
      verificationStatus === 'healthy'
      || verificationStatus === 'degraded'
      || verificationStatus === 'broken'
      || verificationStatus === 'skipped'
        ? verificationStatus
        : null,
    productionUrl: typeof record?.production_url === 'string' ? record.production_url : null,
  };
}

export function buildFollowOnEvidenceSummary(input: {
  cwd: string;
  runId: string;
  generatedAt: string;
  perfVerificationPath: string | null;
  canaryEvidencePath: string | null;
  deployResultPath: string | null;
  documentationSyncPath: string | null;
}): FollowOnEvidenceSummaryRecord {
  const canaryEvidence = readCanaryEvidence(input.cwd, input.canaryEvidencePath);
  const deployEvidence = readDeployEvidence(input.cwd, input.deployResultPath);
  const sourceArtifacts = [
    input.perfVerificationPath,
    input.canaryEvidencePath,
    input.deployResultPath,
    input.documentationSyncPath,
  ].filter((artifactPath): artifactPath is string => Boolean(artifactPath));

  const summaryParts: string[] = [];
  if (input.perfVerificationPath) {
    summaryParts.push('QA performance evidence recorded.');
  }
  if (canaryEvidence.path) {
    summaryParts.push(`Ship canary evidence recorded${canaryEvidence.status ? ` (${canaryEvidence.status})` : ''}.`);
  }
  if (deployEvidence.path) {
    summaryParts.push(
      `Deploy result recorded${deployEvidence.deployStatus ? ` (${deployEvidence.deployStatus})` : ''}.`,
    );
  }
  if (input.documentationSyncPath) {
    summaryParts.push('Documentation sync evidence recorded.');
  }

  return {
    schema_version: 1,
    run_id: input.runId,
    generated_at: input.generatedAt,
    source_artifacts: sourceArtifacts,
    evidence: {
      qa: {
        perf_verification_path: input.perfVerificationPath,
      },
      ship: {
        canary_status_path: canaryEvidence.path,
        canary_status: canaryEvidence.status,
        deploy_result_path: deployEvidence.path,
        deploy_status: deployEvidence.deployStatus,
        verification_status: deployEvidence.verificationStatus,
        production_url: deployEvidence.productionUrl,
      },
      closeout: {
        documentation_sync_path: input.documentationSyncPath,
      },
    },
    summary: summaryParts.length > 0
      ? summaryParts.join(' ')
      : 'No attached follow-on evidence was recorded for this run.',
  };
}

export function renderFollowOnEvidenceMarkdown(record: FollowOnEvidenceSummaryRecord): string {
  return [
    '# Follow-On Evidence Summary',
    '',
    `- Run: ${record.run_id}`,
    `- Generated at: ${record.generated_at}`,
    '',
    '## Summary',
    '',
    record.summary,
    '',
    '## Evidence Index',
    '',
    `- QA perf verification: ${record.evidence.qa.perf_verification_path ?? 'none'}`,
    `- Ship canary evidence: ${record.evidence.ship.canary_status_path ?? 'none'}${record.evidence.ship.canary_status ? ` (${record.evidence.ship.canary_status})` : ''}`,
    `- Deploy result: ${record.evidence.ship.deploy_result_path ?? 'none'}${record.evidence.ship.deploy_status ? ` (${record.evidence.ship.deploy_status})` : ''}`,
    `- Documentation sync: ${record.evidence.closeout.documentation_sync_path ?? 'none'}`,
    '',
    '## Source Artifacts',
    '',
    ...(record.source_artifacts.length > 0
      ? record.source_artifacts.map((artifact) => `- ${artifact}`)
      : ['- none']),
    '',
  ].join('\n');
}
