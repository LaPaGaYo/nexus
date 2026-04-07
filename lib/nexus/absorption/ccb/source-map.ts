import type { AbsorbedSourceRef } from '../types';

export const CCB_SOURCE_MAP: AbsorbedSourceRef[] = [
  {
    system: 'ccb',
    imported_path: 'upstream/claude-code-bridge',
    upstream_repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    upstream_file: 'upstream/claude-code-bridge/lib/providers.py',
    canonical_stage: 'handoff',
    absorbed_capability: 'ccb-routing',
  },
  {
    system: 'ccb',
    imported_path: 'upstream/claude-code-bridge',
    upstream_repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    upstream_file: 'upstream/claude-code-bridge/lib/codex_comm.py',
    canonical_stage: 'build',
    absorbed_capability: 'ccb-execution',
  },
  {
    system: 'ccb',
    imported_path: 'upstream/claude-code-bridge',
    upstream_repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    upstream_file: 'upstream/claude-code-bridge/lib/codex_comm.py',
    canonical_stage: 'review',
    absorbed_capability: 'ccb-review-codex',
  },
  {
    system: 'ccb',
    imported_path: 'upstream/claude-code-bridge',
    upstream_repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    upstream_file: 'upstream/claude-code-bridge/lib/gemini_comm.py',
    canonical_stage: 'review',
    absorbed_capability: 'ccb-review-gemini',
  },
  {
    system: 'ccb',
    imported_path: 'upstream/claude-code-bridge',
    upstream_repo_url: 'https://github.com/bfly123/claude_code_bridge.git',
    pinned_commit: '2bb9a1b2f33ab258723de10412fd048690121bc2',
    upstream_file: 'upstream/claude-code-bridge/lib/gemini_comm.py',
    canonical_stage: 'qa',
    absorbed_capability: 'ccb-qa',
  },
];
