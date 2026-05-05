export {
  classifyInstalledSkill,
  classifyNamespace,
  defaultExternalSkillRoots,
  discoverInstalledSkills as discoverExternalInstalledSkills,
  rankInstalledSkillsForAdvisor as rankExternalInstalledSkillsForAdvisor,
} from './skill-registry';

export type {
  DiscoverInstalledSkillsOptions as DiscoverExternalInstalledSkillsOptions,
  SkillRecord as InstalledSkillRecord,
} from './skill-registry';
