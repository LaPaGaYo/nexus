import { classifyInstalledSkill } from './classification';
import { discoverInstalledSkills } from './discovery';
import { rankInstalledSkillsForAdvisor } from './ranking';
import type { SkillRegistryDiscoveryOptions } from './types';

export type {
  DiscoverInstalledSkillsOptions,
  InstalledSkillRecord,
  SkillRecord,
  SkillRegistryDiscoveryOptions,
} from './types';
// Issue #151: re-export the manifest schema surface so this directory's
// index.ts is the complete public API for the skill-registry concern.
// External consumers (the lib/nexus barrel + any future SDK clients)
// should not have to drill into ./manifest-schema directly.
export {
  NEXUS_SKILL_MANIFEST_SCHEMA_VERSION,
  NEXUS_SKILL_NAMESPACES,
} from './manifest-schema';
export type {
  NexusSkillManifest,
  NexusSkillClassification,
} from './manifest-schema';
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
