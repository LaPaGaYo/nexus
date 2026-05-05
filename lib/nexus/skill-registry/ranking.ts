import type {
  CanonicalCommandId,
  CompletionAdvisorActionRecord,
  VerificationChecklistCategory,
  VerificationMatrixRecord,
} from '../types';
import type { SkillRecord } from './types';

const STAGE_INTENT_TAGS: Record<CanonicalCommandId, string[]> = {
  discover: ['discovery', 'customer-research', 'problem', 'market', 'opportunity', 'interview', 'persona'],
  frame: ['framing', 'scope', 'positioning', 'requirements', 'business-case', 'product-strategy'],
  plan: ['planning', 'architecture', 'stories', 'breakdown', 'risk', 'security', 'roadmap', 'prioritization'],
  handoff: ['handoff', 'routing', 'provenance'],
  build: ['implementation', 'debugging', 'code', 'frontend', 'backend'],
  review: ['code-review', 'audit', 'security', 'design-review', 'performance', 'quality', 'maintainability', 'simplification'],
  qa: ['qa', 'browser', 'testing', 'performance', 'accessibility', 'auth'],
  ship: ['release', 'docs', 'deploy', 'governance'],
  closeout: ['retro', 'learning', 'documentation', 'follow-on'],
};

const CHECKLIST_TAGS = new Set<VerificationChecklistCategory>([
  'testing',
  'security',
  'maintainability',
  'performance',
  'accessibility',
  'design',
]);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function contextTags(matrix: VerificationMatrixRecord | null | undefined): string[] {
  const tags: string[] = [];
  if (matrix?.design_impact && matrix.design_impact !== 'none') {
    tags.push('design', 'design-review');
  }
  if (matrix?.support_skill_signals?.browse?.suggested) {
    tags.push('browser', 'qa');
  }
  if (matrix?.support_skill_signals?.connect_chrome?.suggested) {
    tags.push('browser');
  }
  if (matrix?.support_skill_signals?.setup_browser_cookies?.suggested) {
    tags.push('auth', 'browser');
  }
  if (matrix?.support_skill_signals?.cso?.suggested) {
    tags.push('security', 'risk');
  }
  if (matrix?.support_skill_signals?.benchmark?.suggested) {
    tags.push('performance');
  }
  if (matrix?.support_skill_signals?.simplify?.suggested) {
    tags.push('maintainability', 'simplification');
  }
  return unique(tags);
}

function skillScore(skill: SkillRecord, stage: CanonicalCommandId, matrix: VerificationMatrixRecord | null | undefined): number {
  const stageTags = STAGE_INTENT_TAGS[stage] ?? [];
  const ctxTags = contextTags(matrix);
  let score = 0;
  for (const tag of skill.tags) {
    if (stageTags.includes(tag)) {
      score += 3;
    }
    if (ctxTags.includes(tag)) {
      score += 2;
    }
  }
  return score;
}

function externalAction(skill: SkillRecord, stage: CanonicalCommandId, matrix: VerificationMatrixRecord | null | undefined): CompletionAdvisorActionRecord {
  const matchedTags = skill.tags.filter((tag) =>
    (STAGE_INTENT_TAGS[stage] ?? []).includes(tag) || contextTags(matrix).includes(tag)
  );
  const reason = matchedTags.length > 0
    ? `Installed skill matches /${stage} because it is tagged ${matchedTags.join(', ')}.`
    : `Installed skill matches /${stage} by stage intent.`;
  const checklistCategories = matchedTags.filter((tag): tag is VerificationChecklistCategory =>
    CHECKLIST_TAGS.has(tag as VerificationChecklistCategory)
  );
  return {
    id: `run_external_${skill.name.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`,
    kind: 'external_installed_skill',
    surface: skill.surface,
    invocation: skill.surface,
    label: `Run installed skill \`${skill.surface}\``,
    description: skill.description ?? `Run the installed ${skill.surface} skill as supporting context.`,
    recommended: false,
    visibility_reason: reason,
    why_this_skill: matchedTags.length > 0
      ? `Use this because the installed skill matches ${matchedTags.join(', ')} context for /${stage}.`
      : `Use this because the installed skill matches /${stage} stage intent.`,
    evidence_signal: {
      kind: 'installed_skill',
      summary: matchedTags.length > 0
        ? `Installed skill tags matched: ${matchedTags.join(', ')}.`
        : `Installed skill was selected from /${stage} stage intent.`,
      source_paths: [skill.path],
      checklist_categories: checklistCategories,
    },
  };
}

export function rankInstalledSkillsForAdvisor(input: {
  stage: CanonicalCommandId;
  verification_matrix?: VerificationMatrixRecord | null;
  skills: SkillRecord[];
  existing_surfaces: string[];
  limit?: number;
}): CompletionAdvisorActionRecord[] {
  const existing = new Set(input.existing_surfaces);
  const emitted = new Set<string>();
  return input.skills
    .filter((skill) => skill.namespace === 'external_installed')
    .filter((skill) => !existing.has(skill.surface))
    .map((skill) => ({
      skill,
      score: skillScore(skill, input.stage, input.verification_matrix),
    }))
    .filter((ranked) => ranked.score >= 2)
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .filter((ranked) => {
      if (emitted.has(ranked.skill.surface)) {
        return false;
      }
      emitted.add(ranked.skill.surface);
      return true;
    })
    .slice(0, input.limit ?? 3)
    .map(({ skill }) => externalAction(skill, input.stage, input.verification_matrix));
}
