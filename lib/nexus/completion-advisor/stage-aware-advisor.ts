import type { CanonicalCommandId, RecommendedSkill } from '../types';
import type { SkillRecord } from '../skill-registry/types';

export interface StageAwareAdvisorOptions {
  /**
   * Discovered skills from the SkillRegistry. Each may carry an optional
   * `manifest` field (Phase 2.b) that is consulted for lifecycle_stages.
   */
  skills: readonly SkillRecord[];
  /** Lifecycle stage just completed (e.g., 'build', 'review'). */
  stage: CanonicalCommandId;
  /** Free-form tags from the just-completed stage (e.g., 'security', 'design'). */
  tags?: readonly string[];
  /**
   * Top-N to surface. Default 5. Set to 0 or negative to disable budget.
   */
  limit?: number;
  /**
   * Minimum score to include. Default 1 — filters out base-rank-0 noise.
   */
  minScore?: number;
}

/**
 * Phase 3 (Track D-D3): consult manifest-driven recommendations after a stage
 * write. Pure function over the registry's skill list — no I/O, no globals.
 *
 * For each skill, score:
 *   - manifest declares stage in lifecycle_stages → base score 5
 *   - manifest's intent_keywords overlaps with stage tags → +1 per tag match
 *   - heuristic match (no manifest, but description mentions stage) → score 1
 *
 * Returns sorted by score descending, capped at `limit`.
 */
export function stageAwareAdvisor(opts: StageAwareAdvisorOptions): RecommendedSkill[] {
  const { skills, stage, tags = [], limit = 5, minScore = 1 } = opts;

  const ranked = skills
    .map((skill) => scoreSkillForStage(skill, stage, tags))
    .filter((entry) => entry !== null) as Array<{ record: SkillRecord; score: number; manifestBacked: boolean }>;

  ranked.sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));

  const filtered = ranked.filter((entry) => entry.score >= minScore);
  const capped = limit > 0 ? filtered.slice(0, limit) : filtered;

  return capped.map((entry) => toRecommendedSkill(entry.record, stage, entry.score, entry.manifestBacked));
}

function scoreSkillForStage(
  skill: SkillRecord,
  stage: CanonicalCommandId,
  tags: readonly string[],
): { record: SkillRecord; score: number; manifestBacked: boolean } | null {
  const manifest = skill.manifest;

  if (manifest) {
    const declaresStage = manifest.lifecycle_stages?.includes(stage) ?? false;
    if (!declaresStage) {
      return null;
    }
    let score = 5;
    // Boost: each tag that overlaps with intent_keywords adds 1
    if (tags.length > 0 && manifest.intent_keywords.length > 0) {
      const keywordSet = new Set(manifest.intent_keywords.map((k) => k.toLowerCase()));
      for (const tag of tags) {
        if (keywordSet.has(tag.toLowerCase())) {
          score += 1;
        }
      }
    }
    // Apply manifest base_score override if specified
    if (manifest.ranking?.base_score !== undefined) {
      score = manifest.ranking.base_score;
    }
    return { record: skill, score, manifestBacked: true };
  }

  // Heuristic fallback: skill has no manifest, but description mentions stage
  const description = (skill.description ?? '').toLowerCase();
  if (description.includes(stage)) {
    return { record: skill, score: 1, manifestBacked: false };
  }

  return null;
}

function toRecommendedSkill(
  skill: SkillRecord,
  stage: CanonicalCommandId,
  score: number,
  manifestBacked: boolean,
): RecommendedSkill {
  const namespace = skill.manifest?.classification?.namespace ?? skill.namespace;
  const summary = skill.manifest?.summary ?? skill.description ?? '';
  return {
    name: skill.name,
    surface: `/${skill.name}`,
    namespace,
    summary,
    why_relevant: deriveWhyRelevant(skill, stage, manifestBacked),
    score,
    manifest_backed: manifestBacked,
  };
}

function deriveWhyRelevant(skill: SkillRecord, stage: CanonicalCommandId, manifestBacked: boolean): string {
  if (manifestBacked) {
    return `Declared as relevant to ${stage} stage in nexus.skill.yaml.`;
  }
  return `Heuristic match (no manifest) for ${stage} stage.`;
}
