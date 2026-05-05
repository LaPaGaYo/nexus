export const NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES = [
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

export const NEXUS_SAFETY_SKILL_NAMES = [
  'careful',
  'freeze',
  'guard',
  'unfreeze',
] as const;

export type NexusStructuredSupportSkillName = (typeof NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES)[number];
export type NexusSafetySkillName = (typeof NEXUS_SAFETY_SKILL_NAMES)[number];
export type NexusSupportSkillName = NexusStructuredSupportSkillName | NexusSafetySkillName;

export const NEXUS_SUPPORT_SKILL_NAMES: readonly NexusSupportSkillName[] = [
  ...NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES,
  ...NEXUS_SAFETY_SKILL_NAMES,
].sort((left, right) => left.localeCompare(right));

export function assertNoDuplicateSupportRegistries(): void {
  const names = new Set<string>();
  for (const name of NEXUS_SUPPORT_SKILL_NAMES) {
    if (names.has(name)) {
      throw new Error(`Duplicate Nexus support skill name: ${name}`);
    }
    names.add(name);
  }
}
