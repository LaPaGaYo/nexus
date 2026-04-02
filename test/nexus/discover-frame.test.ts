import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus discover/frame PM seams', () => {
  test('normalizes a happy-path discover result into canonical docs and status', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          discover: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              idea_brief_markdown: '# Idea Brief\n\nProblem: governed seams\n',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('discover', adapters);

      expect(await run.readJson('.planning/current/discover/status.json')).toMatchObject({
        stage: 'discover',
        state: 'completed',
        decision: 'ready',
        ready: true,
      });
      expect(await run.readFile('docs/product/idea-brief.md')).toContain('Idea Brief');
      expect(await run.readJson('.planning/current/discover/adapter-request.json')).toMatchObject({
        adapter: 'pm',
        stage: 'discover',
      });
      expect(await run.readJson('.planning/current/discover/adapter-output.json')).toMatchObject({
        adapter_id: 'pm',
        outcome: 'success',
      });
    });
  });

  test('normalizes a happy-path frame result into canonical docs and status', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: PM seam\n',
              prd_markdown: '# PRD\n\nSuccess criteria: normalized writeback\n',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('frame', adapters);

      expect(await run.readJson('.planning/current/frame/status.json')).toMatchObject({
        stage: 'frame',
        state: 'completed',
        decision: 'ready',
        ready: true,
      });
      expect(await run.readFile('docs/product/decision-brief.md')).toContain('Decision Brief');
      expect(await run.readFile('docs/product/prd.md')).toContain('PRD');
    });
  });

  test('blocks discover when normalized PM output is malformed', async () => {
    await runInTempRepo(async ({ run }) => {
      const adapters = makeFakeAdapters({
        pm: {
          discover: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              idea_brief_markdown: '',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('discover', adapters)).rejects.toThrow('Canonical writeback failed');
      expect(await run.readJson('.planning/current/discover/status.json')).toMatchObject({
        stage: 'discover',
        state: 'blocked',
        ready: false,
      });
      expect(await run.readJson('.planning/current/conflicts/discover-pm.json')).toMatchObject({
        kind: 'backend_conflict',
      });
    });
  });

  test('records refused framing without advancing the lifecycle', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'refused',
            raw_output: { reason: 'missing product context' },
            requested_route: null,
            actual_route: null,
            notices: ['missing context'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('frame', adapters)).rejects.toThrow('PM framing refused');
      expect(await run.readJson('.planning/current/frame/status.json')).toMatchObject({
        stage: 'frame',
        state: 'refused',
        decision: 'refused',
        ready: false,
      });
    });
  });
});
