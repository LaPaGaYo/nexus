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
    discover: () => {
      if (options.roots) {
        return discoverInstalledSkills({ roots: options.roots, cwd: options.cwd, home: options.home });
      }
      if (options.cwd === undefined) {
        throw new Error(
          'createSkillRegistry: cwd is required when no roots are provided. ' +
            'Pass { cwd } explicitly — library helpers must not depend on the ambient working directory.',
        );
      }
      return discoverInstalledSkills({ cwd: options.cwd, home: options.home });
    },
    classify: classifyInstalledSkill,
    rank: rankInstalledSkillsForAdvisor,
  };
}
