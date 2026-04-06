import type { AbsorbedSourceRef } from '../types';

export const GSD_SOURCE_MAP: AbsorbedSourceRef[] = [
  {
    system: 'gsd',
    imported_path: 'upstream/gsd',
    upstream_repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    pinned_commit: 'caf337508fe9c84f4d1a0edb423b76b83f256e91',
    upstream_file: 'upstream/gsd/commands/gsd/plan-phase.md',
    canonical_stage: 'plan',
    absorbed_capability: 'gsd-plan',
  },
  {
    system: 'gsd',
    imported_path: 'upstream/gsd',
    upstream_repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    pinned_commit: 'caf337508fe9c84f4d1a0edb423b76b83f256e91',
    upstream_file: 'upstream/gsd/commands/gsd/complete-milestone.md',
    canonical_stage: 'closeout',
    absorbed_capability: 'gsd-closeout',
  },
];
