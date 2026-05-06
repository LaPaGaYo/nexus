import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { withLedgerSchemaVersion } from '../ledger-schema';
import { readVerificationMatrix } from '../verification-matrix';
import { discoverInstalledSkills, type SkillRecord } from '../skill-registry';
import {
  buildTelemetryEvent,
  emitTelemetryEventForCwd,
  type StageAdvisorRecordedEvent,
  type StageReEnteredEvent,
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
  const installedSkills = options.installedSkills ?? discoverInstalledSkills({
    cwd,
    home: options.home,
  });
  const externalSkills = options.externalSkills ?? installedSkills;
  const enriched = attachExternalInstalledSkillRecommendations(record, verificationMatrix, externalSkills);
  Object.assign(record, enriched);

  // Phase 3 (Track D-D3): manifest-driven stage-aware recommendations.
  // Uses the same discovery roots as external skills, but loads the full
  // SkillRecord including manifests.
  if (installedSkills.length > 0) {
    record.recommended_skills = stageAwareAdvisor({
      skills: installedSkills,
      stage: record.stage,
    });
  }

  // Phase H (adoption telemetry — Track D-D3 follow-up): emit
  // stage_advisor_recorded for every advisor write (chokepoint).
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

  // Also emit stage_re_entered to capture Iron Law re-entry patterns
  // (/build Law 2 3-strike re-entry, /review Law 2 two-round, etc).
  // Detected by checking if a prior advisor record exists for the same
  // run_id at this stage's canonical path.
  emitTelemetryEventForCwd(
    buildTelemetryEvent<StageReEnteredEvent>({
      run_id: record.run_id,
      kind: 'stage_re_entered',
      stage: record.stage,
      is_re_entry: detectStageReEntry(cwd, record.stage, record.run_id),
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

/**
 * Detect whether a stage advisor record write is a re-entry: an advisor
 * record already exists for this run_id at the same stage's canonical
 * path. This signals an Iron Law re-entry pattern (e.g., /build Law 2
 * 3-strike, /review Law 2 two-round).
 *
 * Best-effort: returns false on any read error (fail open — we'd rather
 * miss a re-entry signal than emit a false positive).
 */
function detectStageReEntry(cwd: string, stage: string, runId: string): boolean {
  const path = join(cwd, '.planning', 'current', stage, 'completion-advisor.json');
  if (!existsSync(path)) return false;
  try {
    const content = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(content) as { run_id?: string };
    return parsed.run_id === runId;
  } catch {
    return false;
  }
}
