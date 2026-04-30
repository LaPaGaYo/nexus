import type { AbsorbedSourceRef } from '../types';

export const SUPERPOWERS_SOURCE_MAP: AbsorbedSourceRef[] = [
  {
    system: 'superpowers',
    imported_path: 'vendor/upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'vendor/upstream/superpowers/skills/test-driven-development/SKILL.md',
    canonical_stage: 'build',
    absorbed_capability: 'superpowers-build-discipline',
  },
  {
    system: 'superpowers',
    imported_path: 'vendor/upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md',
    canonical_stage: 'build',
    absorbed_capability: 'superpowers-build-verification',
  },
  {
    system: 'superpowers',
    imported_path: 'vendor/upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md',
    canonical_stage: 'review',
    absorbed_capability: 'superpowers-review-discipline',
  },
  {
    system: 'superpowers',
    imported_path: 'vendor/upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'vendor/upstream/superpowers/skills/finishing-a-development-branch/SKILL.md',
    canonical_stage: 'ship',
    absorbed_capability: 'superpowers-ship-discipline',
  },
];
