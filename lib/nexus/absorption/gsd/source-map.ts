import type { AbsorbedSourceRef } from '../types';

export const GSD_SOURCE_MAP: AbsorbedSourceRef[] = [
  {
    system: 'gsd',
    imported_path: 'upstream/gsd',
    upstream_repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    pinned_commit: '295a5726dc6139f383acfc0dbef6b88d4ec94dfa',
    upstream_file: 'upstream/gsd/commands/gsd/plan-phase.md',
    canonical_stage: 'plan',
    absorbed_capability: 'gsd-plan',
  },
  {
    system: 'gsd',
    imported_path: 'upstream/gsd',
    upstream_repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    pinned_commit: '295a5726dc6139f383acfc0dbef6b88d4ec94dfa',
    upstream_file: 'upstream/gsd/commands/gsd/complete-milestone.md',
    canonical_stage: 'closeout',
    absorbed_capability: 'gsd-closeout',
  },
];
