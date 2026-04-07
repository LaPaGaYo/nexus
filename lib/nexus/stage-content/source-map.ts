import { CCB_SOURCE_MAP } from '../absorption/ccb/source-map';
import { GSD_SOURCE_MAP } from '../absorption/gsd/source-map';
import { PM_SOURCE_MAP } from '../absorption/pm/source-map';
import { SUPERPOWERS_SOURCE_MAP } from '../absorption/superpowers/source-map';
import type { AbsorbedSourceRef } from '../absorption/types';
import type { NexusStageContentId } from '../types';
import type { NexusStageContentSourceBinding } from './types';

const REVIEW_SOURCE_REFS: AbsorbedSourceRef[] = [
  {
    system: 'superpowers',
    imported_path: 'upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'upstream/superpowers/skills/requesting-code-review/SKILL.md',
    canonical_stage: 'review',
    absorbed_capability: 'superpowers-review-discipline',
  },
  {
    system: 'gsd',
    imported_path: 'upstream/gsd',
    upstream_repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    pinned_commit: 'caf337508fe9c84f4d1a0edb423b76b83f256e91',
    upstream_file: 'upstream/gsd/sdk/prompts/workflows/verify-phase.md',
    canonical_stage: 'review',
    absorbed_capability: 'gsd-review-verification',
  },
];

const QA_SOURCE_REFS: AbsorbedSourceRef[] = [
  {
    system: 'superpowers',
    imported_path: 'upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'upstream/superpowers/skills/verification-before-completion/SKILL.md',
    canonical_stage: 'qa',
    absorbed_capability: 'superpowers-qa-verification',
  },
  {
    system: 'gsd',
    imported_path: 'upstream/gsd',
    upstream_repo_url: 'https://github.com/gsd-build/get-shit-done.git',
    pinned_commit: 'caf337508fe9c84f4d1a0edb423b76b83f256e91',
    upstream_file: 'upstream/gsd/sdk/prompts/workflows/verify-phase.md',
    canonical_stage: 'qa',
    absorbed_capability: 'gsd-qa-verification',
  },
];

const SHIP_SOURCE_REFS: AbsorbedSourceRef[] = [
  {
    system: 'superpowers',
    imported_path: 'upstream/superpowers',
    upstream_repo_url: 'https://github.com/obra/superpowers.git',
    pinned_commit: '917e5f53b16b115b70a3a355ed5f4993b9f8b73d',
    upstream_file: 'upstream/superpowers/skills/finishing-a-development-branch/SKILL.md',
    canonical_stage: 'ship',
    absorbed_capability: 'superpowers-ship-discipline',
  },
  {
    system: 'ccb',
    imported_path: 'upstream/claude-code-bridge',
    upstream_repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    upstream_file: 'upstream/claude-code-bridge/lib/providers.py',
    canonical_stage: 'ship',
    absorbed_capability: 'ccb-ship-transport',
  },
];

const STAGE_CONTENT_SOURCE_MAP: Record<NexusStageContentId, NexusStageContentSourceBinding> = {
  'nexus-discover-content': {
    content_id: 'nexus-discover-content',
    canonical_stage: 'discover',
    content_root: 'lib/nexus/stage-content/discover',
    source_refs: PM_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'discover'),
  },
  'nexus-frame-content': {
    content_id: 'nexus-frame-content',
    canonical_stage: 'frame',
    content_root: 'lib/nexus/stage-content/frame',
    source_refs: PM_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'frame'),
  },
  'nexus-plan-content': {
    content_id: 'nexus-plan-content',
    canonical_stage: 'plan',
    content_root: 'lib/nexus/stage-content/plan',
    source_refs: GSD_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'plan'),
  },
  'nexus-handoff-content': {
    content_id: 'nexus-handoff-content',
    canonical_stage: 'handoff',
    content_root: 'lib/nexus/stage-content/handoff',
    source_refs: CCB_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'handoff'),
  },
  'nexus-build-content': {
    content_id: 'nexus-build-content',
    canonical_stage: 'build',
    content_root: 'lib/nexus/stage-content/build',
    source_refs: [
      ...SUPERPOWERS_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'build'),
      ...CCB_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'build'),
    ],
  },
  'nexus-review-content': {
    content_id: 'nexus-review-content',
    canonical_stage: 'review',
    content_root: 'lib/nexus/stage-content/review',
    source_refs: REVIEW_SOURCE_REFS,
  },
  'nexus-qa-content': {
    content_id: 'nexus-qa-content',
    canonical_stage: 'qa',
    content_root: 'lib/nexus/stage-content/qa',
    source_refs: QA_SOURCE_REFS,
  },
  'nexus-ship-content': {
    content_id: 'nexus-ship-content',
    canonical_stage: 'ship',
    content_root: 'lib/nexus/stage-content/ship',
    source_refs: SHIP_SOURCE_REFS,
  },
  'nexus-closeout-content': {
    content_id: 'nexus-closeout-content',
    canonical_stage: 'closeout',
    content_root: 'lib/nexus/stage-content/closeout',
    source_refs: GSD_SOURCE_MAP.filter((entry) => entry.canonical_stage === 'closeout'),
  },
};

export function getStageContentSourceBinding(content_id: NexusStageContentId): NexusStageContentSourceBinding {
  return STAGE_CONTENT_SOURCE_MAP[content_id];
}
