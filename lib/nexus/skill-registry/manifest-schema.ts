import type { CanonicalCommandId, InstalledSkillNamespace } from '../types';

export const NEXUS_SKILL_MANIFEST_SCHEMA_VERSION = 1 as const;

export type NexusSkillManifestSchemaVersion = typeof NEXUS_SKILL_MANIFEST_SCHEMA_VERSION;
export type NexusSkillLifecycleStage = CanonicalCommandId;
export const NEXUS_SKILL_NAMESPACES = [
  'nexus_canonical',
  'nexus_support',
  'nexus_safety',
  'nexus_root',
  'external_installed',
] as const satisfies readonly InstalledSkillNamespace[];
export type NexusSkillManifestNamespace = (typeof NEXUS_SKILL_NAMESPACES)[number];
export type NexusSkillHost = 'claude' | 'codex' | 'gemini-cli';
export type NexusSkillContext = 'solo' | 'pair' | 'team';

export interface NexusSkillClassification {
  namespace?: NexusSkillManifestNamespace;
  category?: string;
}

export interface NexusSkillAppliesTo {
  hosts?: readonly NexusSkillHost[];
  contexts?: readonly NexusSkillContext[];
}

export interface NexusSkillInputDecl {
  name: string;
  description?: string;
  artifact?: string;
  optional?: boolean;
}

export interface NexusSkillOutputDecl {
  name: string;
  description?: string;
  artifact?: string;
  optional?: boolean;
}

export interface NexusSkillRankingBoost {
  context?: string;
  tag?: string;
  delta: number;
}

export interface NexusSkillRankingHints {
  base_score?: number;
  boosts?: readonly NexusSkillRankingBoost[];
}

export interface NexusSkillProvenance {
  author?: string;
  source_url?: string;
  version?: string;
  license?: string;
}

export interface NexusSkillManifest {
  schema_version: NexusSkillManifestSchemaVersion;
  name: string;
  summary: string;
  intent_keywords: readonly string[];
  lifecycle_stages?: readonly NexusSkillLifecycleStage[];
  classification?: NexusSkillClassification;
  applies_to?: NexusSkillAppliesTo;
  inputs?: readonly NexusSkillInputDecl[];
  outputs?: readonly NexusSkillOutputDecl[];
  ranking?: NexusSkillRankingHints;
  provenance?: NexusSkillProvenance;
  notes?: readonly string[];
}
