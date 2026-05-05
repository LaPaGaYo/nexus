import { CANONICAL_COMMANDS, type InstalledSkillNamespace } from '../types';
import type { SkillRecord } from './types';
import { NEXUS_SUPPORT_SKILL_NAMES } from './support-skills';

const CANONICAL_COMMAND_SET = new Set<string>(CANONICAL_COMMANDS);
const NEXUS_SUPPORT_SKILL_NAME_SET = new Set<string>(NEXUS_SUPPORT_SKILL_NAMES);

const TAG_KEYWORDS: Array<{ tag: string; patterns: RegExp[] }> = [
  { tag: 'discovery', patterns: [/discover/i, /research/i, /interview/i, /jobs?[- ]to[- ]be[- ]done/i] },
  { tag: 'customer-research', patterns: [/customer/i, /persona/i, /journey/i, /jobs?[- ]to[- ]be[- ]done/i] },
  { tag: 'problem', patterns: [/problem/i, /hypothesis/i] },
  { tag: 'market', patterns: [/market/i, /competitor/i, /pestel/i, /tam/i] },
  { tag: 'opportunity', patterns: [/opportunit/i, /solution tree/i] },
  { tag: 'framing', patterns: [/fram/i, /scope/i, /canvas/i] },
  { tag: 'positioning', patterns: [/position/i, /brand/i] },
  { tag: 'requirements', patterns: [/requirement/i, /prd/i, /story/i] },
  { tag: 'planning', patterns: [/plan/i, /roadmap/i, /prioriti/i] },
  { tag: 'architecture', patterns: [/architect/i, /system/i, /technical/i] },
  { tag: 'stories', patterns: [/story/i, /epic/i, /mapping/i] },
  { tag: 'breakdown', patterns: [/breakdown/i, /split/i, /decompos/i] },
  { tag: 'risk', patterns: [/risk/i, /threat/i] },
  { tag: 'security', patterns: [/security/i, /auth/i, /permission/i, /secret/i, /threat/i, /cso/i] },
  { tag: 'code-review', patterns: [/code review/i, /\breview\b/i] },
  { tag: 'audit', patterns: [/audit/i, /quality/i, /check/i] },
  { tag: 'maintainability', patterns: [/maintain/i, /readab/i, /complex/i, /dead code/i, /unused/i, /duplication/i] },
  { tag: 'simplification', patterns: [/simplif/i, /refactor/i, /clarity/i, /cleanup/i] },
  { tag: 'design', patterns: [/design/i, /visual/i, /brand/i, /ux/i, /ui/i] },
  { tag: 'design-review', patterns: [/design review/i, /visual audit/i, /brand audit/i, /ux review/i] },
  { tag: 'performance', patterns: [/perf/i, /benchmark/i, /latency/i, /load/i] },
  { tag: 'qa', patterns: [/\bqa\b/i, /test/i, /validation/i] },
  { tag: 'browser', patterns: [/browser/i, /chrome/i, /playwright/i, /web/i] },
  { tag: 'accessibility', patterns: [/accessib/i, /\ba11y\b/i] },
  { tag: 'auth', patterns: [/auth/i, /cookie/i, /login/i, /session/i] },
  { tag: 'release', patterns: [/release/i, /ship/i, /changelog/i] },
  { tag: 'docs', patterns: [/docs?/i, /document/i] },
  { tag: 'deploy', patterns: [/deploy/i, /canary/i, /production/i] },
  { tag: 'retro', patterns: [/retro/i, /retrospective/i] },
  { tag: 'learning', patterns: [/learn/i, /memory/i] },
];

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeSkillName(name: string): string {
  return name.trim().replace(/^\/+/, '').toLowerCase();
}

export function skillCommandSurface(name: string): string {
  return `/${normalizeSkillName(name)}`;
}

export function stripNexusSkillPrefix(name: string): string {
  const normalized = normalizeSkillName(name);
  return normalized.startsWith('nexus-') ? normalized.slice('nexus-'.length) : normalized;
}

export function classifyNamespace(name: string): InstalledSkillNamespace {
  const normalized = normalizeSkillName(name);
  const unprefixed = stripNexusSkillPrefix(normalized);
  if (CANONICAL_COMMAND_SET.has(unprefixed)) {
    return 'nexus_canonical';
  }
  if (NEXUS_SUPPORT_SKILL_NAME_SET.has(normalized) || NEXUS_SUPPORT_SKILL_NAME_SET.has(unprefixed)) {
    return 'nexus_support';
  }
  return 'external_installed';
}

export function inferSkillTags(name: string, description: string | null): string[] {
  const haystack = `${name} ${description ?? ''}`;
  const tags: string[] = [];
  for (const rule of TAG_KEYWORDS) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      tags.push(rule.tag);
    }
  }
  return unique(tags);
}

export function classifyInstalledSkill(input: {
  name: string;
  description: string | null;
  path: string;
  source_root: string;
}): SkillRecord {
  const name = normalizeSkillName(input.name);
  const namespace = classifyNamespace(name);
  return {
    name,
    surface: skillCommandSurface(name),
    description: input.description,
    path: input.path,
    source_root: input.source_root,
    namespace,
    tags: inferSkillTags(name, input.description),
  };
}
