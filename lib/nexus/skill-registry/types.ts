import type { InstalledSkillRecord } from '../contracts/types';
import type { NexusSkillManifest } from './manifest-schema';

// Re-exported so this directory's barrel (index.ts) can surface it from './types'.
export type { InstalledSkillRecord };

export interface SkillRecord extends InstalledSkillRecord {
  /**
   * Parsed `nexus.skill.yaml` manifest if present alongside SKILL.md.
   * Phase 2.b (Track D-D3): discovery loads manifests when present.
   * Skills without manifests use heuristic classification (Phase 1 fallback).
   */
  manifest?: NexusSkillManifest;
}

export type DiscoverInstalledSkillsOptions =
  | {
    roots: string[];
    cwd?: string;
    home?: string;
  }
  | {
    roots?: undefined;
    cwd: string;
    home?: string;
  };

export interface SkillRegistryDiscoveryOptions {
  roots?: string[];
  cwd?: string;
  home?: string;
}
