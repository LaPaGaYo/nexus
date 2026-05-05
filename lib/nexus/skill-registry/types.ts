import type { InstalledSkillRecord } from '../types';

export interface SkillRecord extends InstalledSkillRecord {}

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
