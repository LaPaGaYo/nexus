import type { AdapterResult, PmAdapter } from './types';

export interface PmDiscoverRaw {
  idea_brief_markdown: string;
}

export interface PmFrameRaw {
  decision_brief_markdown: string;
  prd_markdown: string;
}

function successResult<TRaw>(raw_output: TRaw): AdapterResult<TRaw> {
  return {
    adapter_id: 'pm',
    outcome: 'success',
    raw_output,
    requested_route: null,
    actual_route: null,
    notices: [],
    conflict_candidates: [],
  };
}

export function createDefaultPmAdapter(): PmAdapter {
  return {
    discover: async () =>
      successResult<PmDiscoverRaw>({
        idea_brief_markdown: '# Idea Brief\n\nProblem: normalized by Nexus\n',
      }),
    frame: async () =>
      successResult<PmFrameRaw>({
        decision_brief_markdown: '# Decision Brief\n\nScope: Nexus PM seam\n',
        prd_markdown: '# PRD\n\nSuccess: repo-visible PM outputs\n',
      }),
  };
}
