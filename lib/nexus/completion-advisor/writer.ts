import { discoverExternalInstalledSkills } from '../external-skills';
import { withLedgerSchemaVersion } from '../ledger-schema';
import { readVerificationMatrix } from '../verification-matrix';
import type { CompletionAdvisorRecord, InstalledSkillRecord, VerificationMatrixRecord } from '../types';
import { attachExternalInstalledSkillRecommendations } from '../completion-advisor';

export interface CompletionAdvisorWriteOptions {
  verificationMatrix?: VerificationMatrixRecord | null;
  externalSkills?: InstalledSkillRecord[];
  cwd: string;
  home?: string;
}

export function buildCompletionAdvisorWrite(
  record: CompletionAdvisorRecord,
  options: CompletionAdvisorWriteOptions,
): { path: string; content: string } {
  const { cwd } = options;
  const verificationMatrix = options.verificationMatrix ?? readVerificationMatrix(cwd);
  const externalSkills = options.externalSkills ?? discoverExternalInstalledSkills({
    cwd,
    home: options.home,
  });
  const enriched = attachExternalInstalledSkillRecommendations(record, verificationMatrix, externalSkills);
  Object.assign(record, enriched);
  const versionedRecord = withLedgerSchemaVersion(record);
  return {
    path: `.planning/current/${record.stage}/completion-advisor.json`,
    content: JSON.stringify(versionedRecord, null, 2) + '\n',
  };
}
