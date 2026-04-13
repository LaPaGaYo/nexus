import { describe, expect, test } from 'bun:test';
import { createDiscoverStagePack } from '../../lib/nexus/stage-packs/discover';
import { createFrameStagePack } from '../../lib/nexus/stage-packs/frame';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus discover/frame PM seams', () => {
  test('pm stage packs stay Nexus-owned internal units', () => {
    const discoverPack = createDiscoverStagePack();
    const framePack = createFrameStagePack();

    expect(discoverPack.id).toBe('nexus-discover-pack');
    expect(discoverPack.stage).toBe('discover');
    expect(discoverPack.source_binding.absorbed_capabilities).toContain('pm-discover');

    expect(framePack.id).toBe('nexus-frame-pack');
    expect(framePack.stage).toBe('frame');
    expect(framePack.source_binding.absorbed_capabilities).toContain('pm-frame');
  });

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
            traceability: {
              nexus_stage_pack: 'nexus-discover-pack',
              absorbed_capability: 'pm-discover',
              source_map: ['upstream/pm-skills/commands/discover.md'],
            },
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
        traceability: {
          nexus_stage_pack: 'nexus-discover-pack',
          absorbed_capability: 'pm-discover',
        },
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
            traceability: {
              nexus_stage_pack: 'nexus-frame-pack',
              absorbed_capability: 'pm-frame',
              source_map: ['upstream/pm-skills/commands/write-prd.md'],
            },
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
      expect(await run.readJson('.planning/current/frame/adapter-output.json')).toMatchObject({
        adapter_id: 'pm',
        outcome: 'success',
        traceability: {
          nexus_stage_pack: 'nexus-frame-pack',
          absorbed_capability: 'pm-frame',
        },
      });
    });
  });

  test('default discover and frame outputs use Nexus-owned absorbed stage content', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      await run('frame');

      expect(await run.readFile('docs/product/idea-brief.md')).toContain(
        'Nexus-owned discovery guidance for clarifying the problem before framing.',
      );
      expect(await run.readFile('docs/product/idea-brief.md')).toContain('capture goals');
      expect(await run.readFile('docs/product/idea-brief.md')).toContain(
        'Advance to `/frame` only after Nexus writes the discovery artifacts.',
      );

      expect(await run.readFile('docs/product/decision-brief.md')).toContain(
        'Nexus-owned framing guidance for scope, non-goals, and success criteria.',
      );
      expect(await run.readFile('docs/product/decision-brief.md')).toContain('define scope');
      expect(await run.readFile('docs/product/prd.md')).toContain('define success criteria');
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
            traceability: {
              nexus_stage_pack: 'nexus-discover-pack',
              absorbed_capability: 'pm-discover',
              source_map: ['upstream/pm-skills/commands/discover.md'],
            },
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

  test('rolls over to a fresh discover run after a completed closeout', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      const completedLedger = await run.readJson('.planning/nexus/current-run.json');

      await run('discover');

      const nextLedger = await run.readJson('.planning/nexus/current-run.json');
      expect(nextLedger.run_id).not.toBe(completedLedger.run_id);
      expect(nextLedger).toMatchObject({
        status: 'active',
        current_command: 'discover',
        current_stage: 'discover',
        previous_stage: null,
        allowed_next_stages: ['frame'],
      });
      expect(nextLedger.command_history).toHaveLength(1);
      expect(nextLedger.command_history[0]).toMatchObject({
        command: 'discover',
        via: null,
      });

      expect(await run.readJson(`.planning/archive/runs/${completedLedger.run_id}/current-run.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        current_stage: 'closeout',
        status: 'completed',
      });
      expect(await run.readJson(`.planning/archive/runs/${completedLedger.run_id}/closeout/status.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        stage: 'closeout',
        state: 'completed',
        ready: true,
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
