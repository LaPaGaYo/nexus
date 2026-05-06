import { discoverExternalInstalledSkills } from '../external-skills';
import { withLedgerSchemaVersion } from '../ledger-schema';
import { readVerificationMatrix } from '../verification-matrix';
import { discoverInstalledSkills } from '../skill-registry/discovery';
import type { SkillRecord } from '../skill-registry/types';
import {
  buildTelemetryEvent,
  emitTelemetryEventForCwd,
  type StageAdvisorRecordedEvent,
} from '../telemetry';
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

  // Phase H (adoption telemetry — Track D-D3 follow-up): emit a
  // stage_advisor_recorded event for every advisor write. This is the
  // chokepoint where every stage's lifecycle outcome flows through —
  // instrumenting here captures the canonical 9 with one integration.
  // No-op when NEXUS_TELEMETRY != '1' (zero cost for default users).
  emitTelemetryEventForCwd(
    buildTelemetryEvent<StageAdvisorRecordedEvent>({
      run_id: record.run_id,
      kind: 'stage_advisor_recorded',
      stage: record.stage,
      stage_outcome: record.stage_outcome,
      interaction_mode: record.interaction_mode,
      requires_user_choice: record.requires_user_choice,
      recommended_skills_count: record.recommended_skills?.length ?? 0,
      primary_action_count: record.primary_next_actions.length,
    }),
    cwd,
    options.home,
  );

  const versionedRecord = withLedgerSchemaVersion(record);
  return {
    path: `.planning/current/${record.stage}/completion-advisor.json`,
    content: JSON.stringify(versionedRecord, null, 2) + '\n',
  };
}
