/**
 * `lib/nexus` curated public barrel — Issue #151.
 *
 * Most internal consumers should keep importing from specific
 * subdirectories (`lib/nexus/contracts/types`, `lib/nexus/adapters/local`,
 * etc.). The repo has 200+ subdir imports already and they're more precise
 * than barrel imports.
 *
 * This barrel exists for:
 *   1. External integrations — anyone consuming `lib/nexus` as a package
 *      gets a stable, named surface rather than guessing at internal paths.
 *   2. Test harnesses that want a one-import setup for fixture wiring.
 *   3. Future generated SKILL.md prose that needs types but should not be
 *      coupled to internal file paths.
 *
 * Selection rule: every symbol below is referenced from outside its own
 * subdirectory by ≥1 non-test caller in the current tree. Internal helpers
 * (validation-helpers, normalizers, host-roots, install-metadata, CLI
 * entry points, observability/release/review/governance internals) are
 * intentionally NOT re-exported — they should be reached via specific
 * subdirectory imports if needed.
 *
 * When extending: prefer adding a new export here only when a real
 * cross-boundary caller appears. A barrel that lists things "in case
 * someone wants them" drifts; a barrel that mirrors observed usage is
 * stable.
 */

// ─── Type contracts (the most-shared shapes) ───
export type {
  StageStatus,
  CompletionAdvisorRecord,
  VerificationMatrixRecord,
  PullRequestRecord,
  DeployReadinessRecord,
  CanonicalCommandId,
  ReviewAuditReceiptRecord,
  DesignIntentRecord,
  InstalledSkillNamespace,
  NexusStageContentId,
} from './contracts/types';

// ─── Canonical identifiers (pinned across many tests + runtime call sites) ───
export {
  CANONICAL_COMMANDS,
  LEARNING_SOURCES,
  LEARNING_TYPES,
  NEXUS_LEDGER_SCHEMA_VERSION,
  PRIMARY_PROVIDERS,
  PROVIDER_TOPOLOGIES,
} from './contracts/types';
export {
  CANONICAL_MANIFEST,
  LEGACY_ALIASES,
} from './contracts/command-manifest';

// ─── Adapter API (the standard wiring entry points) ───
export {
  getDefaultNexusAdapters,
  getRuntimeNexusAdapters,
} from './adapters/registry';
export { createRuntimeLocalAdapter } from './adapters/local';
export type { NexusAdapters } from './adapters/types';

// ─── Skill registry (manifest discovery + classification) ───
export {
  NEXUS_SAFETY_SKILL_NAMES,
  NEXUS_SUPPORT_SKILL_NAMES,
  NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES,
  NEXUS_SKILL_NAMESPACES,
  NEXUS_SKILL_MANIFEST_SCHEMA_VERSION,
  discoverInstalledSkills,
} from './skill-registry';
export type {
  NexusSkillManifest,
  InstalledSkillRecord,
  NexusSkillClassification,
} from './skill-registry';

// ─── Stage taxonomy and packs ───
export { NEXUS_STAGE_CONTENT } from './stage-content';
export { getStagePackSourceMap } from './stage-packs';
