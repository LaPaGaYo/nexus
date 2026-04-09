import type { AbsorbedSourceRef } from '../types';

export const PM_SOURCE_MAP: AbsorbedSourceRef[] = [
  {
    system: 'pm-skills',
    imported_path: 'upstream/pm-skills',
    upstream_repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
    pinned_commit: '4aa4196c14873b84f5af7316e7f66328cb6dee4c',
    upstream_file: 'upstream/pm-skills/commands/discover.md',
    canonical_stage: 'discover',
    absorbed_capability: 'pm-discover',
  },
  {
    system: 'pm-skills',
    imported_path: 'upstream/pm-skills',
    upstream_repo_url: 'https://github.com/deanpeters/Product-Manager-Skills.git',
    pinned_commit: '4aa4196c14873b84f5af7316e7f66328cb6dee4c',
    upstream_file: 'upstream/pm-skills/commands/write-prd.md',
    canonical_stage: 'frame',
    absorbed_capability: 'pm-frame',
  },
];
