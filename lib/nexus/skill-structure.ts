import { CANONICAL_MANIFEST, LEGACY_ALIASES } from './command-manifest';

export type SkillStructureCategory = 'root' | 'canonical' | 'support' | 'safety' | 'alias';

export type SkillStructureEntry = {
  name: string;
  category: SkillStructureCategory;
  currentSourcePath: string;
  targetSourcePath: string;
  movePolicy: 'in_place' | 'planned_move';
};

export const SAFETY_SKILL_NAMES = [
  'careful',
  'freeze',
  'guard',
  'unfreeze',
] as const;

export const SUPPORT_SKILL_NAMES = [
  'benchmark',
  'browse',
  'canary',
  'codex',
  'connect-chrome',
  'cso',
  'deploy',
  'design-consultation',
  'design-html',
  'design-review',
  'design-shotgun',
  'document-release',
  'investigate',
  'land',
  'land-and-deploy',
  'learn',
  'nexus-upgrade',
  'plan-design-review',
  'qa-only',
  'retro',
  'setup-browser-cookies',
  'setup-deploy',
  'simplify',
] as const;

const CANONICAL_SKILL_NAMES = new Set(Object.keys(CANONICAL_MANIFEST));
const ALIAS_SKILL_NAMES = new Set(Object.keys(LEGACY_ALIASES));
const SAFETY_SKILL_NAME_SET = new Set<string>(SAFETY_SKILL_NAMES);
const SUPPORT_SKILL_NAME_SET = new Set<string>(SUPPORT_SKILL_NAMES);

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

function isKnownExactSkillName(name: string): boolean {
  return name === 'nexus'
    || CANONICAL_SKILL_NAMES.has(name)
    || ALIAS_SKILL_NAMES.has(name)
    || SAFETY_SKILL_NAME_SET.has(name)
    || SUPPORT_SKILL_NAME_SET.has(name);
}

function stripGeneratedPrefix(name: string): string {
  const normalized = name.trim().replace(/^\/+/, '').toLowerCase();
  if (isKnownExactSkillName(normalized)) {
    return normalized;
  }

  const unprefixed = normalized.startsWith('nexus-') ? normalized.slice('nexus-'.length) : normalized;
  return isKnownExactSkillName(unprefixed) ? unprefixed : normalized;
}

export function skillNameFromSourcePath(filePath: string): string {
  const normalized = normalizePath(filePath);
  if (normalized === 'SKILL.md' || normalized === 'SKILL.md.tmpl') {
    return 'nexus';
  }

  const structuredMatch = normalized.match(/^skills\/(?:canonical|support|safety|aliases)\/([^/]+)\/SKILL\.md(?:\.tmpl)?$/);
  if (structuredMatch?.[1]) {
    return structuredMatch[1];
  }

  const generatedMatch = normalized.match(/^(?:\.agents|\.factory)\/skills\/([^/]+)\/SKILL\.md$/);
  if (generatedMatch?.[1]) {
    return stripGeneratedPrefix(generatedMatch[1]);
  }

  return normalized.split('/')[0] ?? 'nexus';
}

export function skillSourceCategoryForName(name: string): SkillStructureCategory | null {
  const normalized = stripGeneratedPrefix(name);
  if (normalized === 'nexus') {
    return 'root';
  }
  if (CANONICAL_SKILL_NAMES.has(normalized)) {
    return 'canonical';
  }
  if (ALIAS_SKILL_NAMES.has(normalized)) {
    return 'alias';
  }
  if (SAFETY_SKILL_NAME_SET.has(normalized)) {
    return 'safety';
  }
  if (SUPPORT_SKILL_NAME_SET.has(normalized)) {
    return 'support';
  }
  return null;
}

export function currentSkillSourcePathForName(name: string): string {
  const normalized = stripGeneratedPrefix(name);
  return normalized === 'nexus' ? 'SKILL.md.tmpl' : `${normalized}/SKILL.md.tmpl`;
}

export function targetSkillSourcePathForName(name: string): string {
  const normalized = stripGeneratedPrefix(name);
  const category = skillSourceCategoryForName(normalized);
  if (!category) {
    throw new Error(`Unknown Nexus skill source: ${name}`);
  }

  switch (category) {
    case 'root':
      return 'SKILL.md.tmpl';
    case 'canonical':
      return `skills/canonical/${normalized}/SKILL.md.tmpl`;
    case 'alias':
      return `skills/aliases/${normalized}/SKILL.md.tmpl`;
    case 'safety':
      return `skills/safety/${normalized}/SKILL.md.tmpl`;
    case 'support':
      return `skills/support/${normalized}/SKILL.md.tmpl`;
  }
}

export function describeSkillSourcePath(filePath: string): SkillStructureEntry {
  const normalizedPath = normalizePath(filePath);
  const name = skillNameFromSourcePath(normalizedPath);
  const category = skillSourceCategoryForName(name);
  if (!category) {
    throw new Error(`Unknown Nexus skill source: ${filePath}`);
  }

  const targetSourcePath = targetSkillSourcePathForName(name);
  return {
    name,
    category,
    currentSourcePath: normalizedPath,
    targetSourcePath,
    movePolicy: normalizedPath === targetSourcePath ? 'in_place' : 'planned_move',
  };
}

export function allPlannedSkillStructureEntries(): SkillStructureEntry[] {
  const names = [
    'nexus',
    ...Object.keys(CANONICAL_MANIFEST),
    ...Object.keys(LEGACY_ALIASES),
    ...SAFETY_SKILL_NAMES,
    ...SUPPORT_SKILL_NAMES,
  ];
  return [...new Set(names)]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const category = skillSourceCategoryForName(name);
      if (!category) {
        throw new Error(`Unknown Nexus skill source: ${name}`);
      }
      const currentSourcePath = currentSkillSourcePathForName(name);
      const targetSourcePath = targetSkillSourcePathForName(name);
      return {
        name,
        category,
        currentSourcePath,
        targetSourcePath,
        movePolicy: currentSourcePath === targetSourcePath ? 'in_place' : 'planned_move',
      };
    });
}
