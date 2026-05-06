import { discoverExternalInstalledSkills } from '../external-skills';
import { withLedgerSchemaVersion } from '../ledger-schema';
import { readVerificationMatrix } from '../verification-matrix';
import { discoverInstalledSkills } from '../skill-registry/discovery';
import type { SkillRecord } from '../skill-registry/types';
import type { CompletionAdvisorRecord, InstalledSkillRecord, VerificationMatrixRecord } from '../types';
import { attachExternalInstalledSkillRecommendations } from './resolver';
import { stageAwareAdvisor } from './stage-aware-advisor';

export interface CompletionAdvisorWriteOptions {
  verificationMatrix?: VerificationMatrixRecord | null;
  externalSkills?: InstalledSkillRecord[];
  /**
   * Optional pre-discovered skill registry records (with manifests). When
   * omitted, the writer discovers from `cwd` using the same roots as
   * external skills. Phase 3 (Track D-D3) uses these to populate
   * `recommended_skills` on the advisor record via stage-aware-advisor.
   */
  installedSkills?: SkillRecord[];
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

  // Phase 3 (Track D-D3): manifest-driven stage-aware recommendations.
  // Uses the same discovery roots as external skills, but loads the full
  // SkillRecord including manifests.
  const installedSkills = options.installedSkills ?? discoverInstalledSkills({
    cwd,
    home: options.home,
  });
  if (installedSkills.length > 0) {
    record.recommended_skills = stageAwareAdvisor({
      skills: installedSkills,
      stage: record.stage,
    });
  }

  const versionedRecord = withLedgerSchemaVersion(record);
  return {
    path: `.planning/current/${record.stage}/completion-advisor.json`,
    content: JSON.stringify(versionedRecord, null, 2) + '\n',
  };
}
