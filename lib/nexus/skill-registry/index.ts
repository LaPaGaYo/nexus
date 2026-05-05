import { classifyInstalledSkill } from './classification';
import { discoverInstalledSkills } from './discovery';
import { rankInstalledSkillsForAdvisor } from './ranking';
import type { SkillRegistryDiscoveryOptions } from './types';

export type {
  DiscoverInstalledSkillsOptions,
  SkillRecord,
  SkillRegistryDiscoveryOptions,
} from './types';
export {
  NEXUS_SAFETY_SKILL_NAMES,
  NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES,
  NEXUS_SUPPORT_SKILL_NAMES,
  assertNoDuplicateSupportRegistries,
  type NexusSafetySkillName,
  type NexusStructuredSupportSkillName,
  type NexusSupportSkillName,
} from './support-skills';
export {
  classifyInstalledSkill,
  classifyNamespace,
  inferSkillTags,
  normalizeSkillName,
  skillCommandSurface,
  stripNexusSkillPrefix,
} from './classification';
export {
  defaultExternalSkillRoots,
  discoverInstalledSkills,
  discoverSkillFiles,
  parseSkillFrontmatter,
} from './discovery';
export { rankInstalledSkillsForAdvisor } from './ranking';

export function createSkillRegistry(options: SkillRegistryDiscoveryOptions = {}) {
  return {
    discover: () => discoverInstalledSkills(options.roots
      ? { roots: options.roots, cwd: options.cwd, home: options.home }
      : { cwd: options.cwd ?? process.cwd(), home: options.home }),
    classify: classifyInstalledSkill,
    rank: rankInstalledSkillsForAdvisor,
  };
}
