import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { describe, expect, test } from 'bun:test';
import { createDiscoverStagePack } from '../../lib/nexus/stage-packs/discover';
import { createFrameStagePack } from '../../lib/nexus/stage-packs/frame';
import { getDefaultNexusAdapters } from '../../lib/nexus/adapters/registry';
import type { NexusAdapters } from '../../lib/nexus/adapters/types';
import type { ExecutionSelection } from '../../lib/nexus/execution-topology';
import { resolveInvocation } from '../../lib/nexus/commands/index';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

type TempGitRepoRun = {
  run: (command: string, adapters?: NexusAdapters, execution?: ExecutionSelection) => Promise<void>;
  runFrom: (
    cwd: string,
    command: string,
    adapters?: NexusAdapters,
    execution?: ExecutionSelection,
  ) => Promise<void>;
  readJson: (path: string) => any;
  cwd: string;
};

function createTempGitRepo(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'nexus-discover-frame-'));
  mkdirSync(join(cwd, '.planning'), { recursive: true });
  mkdirSync(join(cwd, '.ccb'), { recursive: true });
  writeFileSync(join(cwd, 'README.md'), '# temp repo\n');
  spawnSync('git', ['init', '-b', 'main'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['add', 'README.md'], { cwd, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd, stdio: 'pipe' });
  return cwd;
}

function createLinkedWorktree(
  repoRoot: string,
  worktreeRoot: '.nexus-worktrees' | '.worktrees',
  name = 'implement',
  branch = 'feature/implement',
): string {
  const base = join(repoRoot, worktreeRoot);
  mkdirSync(base, { recursive: true });
  spawnSync('git', ['branch', branch], { cwd: repoRoot, stdio: 'pipe' });
  const worktreePath = join(base, name);
  const result = spawnSync('git', ['worktree', 'add', worktreePath, branch], {
    cwd: repoRoot,
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.toString() || result.stdout.toString() || 'failed to create linked worktree');
  }

  return worktreePath;
}

async function runInTempGitRepo(
  fn: (ctx: TempGitRepoRun) => Promise<void>,
): Promise<void> {
  const cwd = createTempGitRepo();
  let tick = 0;

  const invoke = async (
    commandCwd: string,
    command: string,
    adapters = getDefaultNexusAdapters(),
    execution: ExecutionSelection = {
      mode: 'governed_ccb',
      primary_provider: 'codex',
      provider_topology: 'multi_session',
      requested_execution_path: 'codex-via-ccb',
    },
  ) => {
    const invocation = resolveInvocation(command);
    const at = new Date(Date.UTC(2026, 3, 13, 12, 0, 0, tick)).toISOString();
    tick += 1;
    await invocation.handler({
      cwd: commandCwd,
      clock: () => at,
      via: invocation.via,
      adapters,
      execution,
    });
  };

  try {
    await fn({
      cwd,
      run: (command, adapters, execution) => invoke(cwd, command, adapters, execution),
      runFrom: (commandCwd, command, adapters, execution) => invoke(commandCwd, command, adapters, execution),
      readJson: (path: string) => JSON.parse(readFileSync(join(cwd, path), 'utf8')),
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

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
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      const legacyWorktreePath = createLinkedWorktree(cwd, '.worktrees');

      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      const completedLedger = readJson('.planning/nexus/current-run.json');

      await run('discover');

      const nextLedger = readJson('.planning/nexus/current-run.json');
      expect(nextLedger.run_id).not.toBe(completedLedger.run_id);
      expect(nextLedger).toMatchObject({
        status: 'active',
        current_command: 'discover',
        current_stage: 'discover',
        previous_stage: null,
        allowed_next_stages: ['frame'],
        execution: {
          workspace: {
            path: realpathSync.native(join(cwd, '.nexus-worktrees', nextLedger.run_id)),
            kind: 'worktree',
            branch: `codex/${nextLedger.run_id}`,
            source: 'allocated:fresh_run',
            run_id: nextLedger.run_id,
            retirement_state: 'active',
          },
          session_root: {
            path: realpathSync.native(cwd),
            kind: 'repo_root',
            source: 'ccb_root',
          },
        },
      });
      expect(nextLedger.command_history).toHaveLength(1);
      expect(nextLedger.command_history[0]).toMatchObject({
        command: 'discover',
        via: null,
      });
      expect(nextLedger.execution.workspace.path).not.toBe(realpathSync.native(legacyWorktreePath));
      expect(nextLedger.execution.workspace.path).not.toBe(completedLedger.execution.workspace.path);
      expect(nextLedger.execution.workspace.path).toContain(`${cwd}/.nexus-worktrees/`);
      expect(nextLedger.execution.workspace.path).not.toContain(`${cwd}/.worktrees/`);

      expect(readJson(`.planning/archive/runs/${completedLedger.run_id}/current-run.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        current_stage: 'closeout',
        status: 'completed',
      });
      expect(readJson(`.planning/archive/runs/${completedLedger.run_id}/closeout/status.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        stage: 'closeout',
        state: 'completed',
        ready: true,
      });
    });
  });

  test('starts the next fresh discover from an old linked worktree but allocates under the repository root', async () => {
    await runInTempGitRepo(async ({ cwd, run, runFrom, readJson }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      const completedLedger = readJson('.planning/nexus/current-run.json');
      const oldWorktreePath = realpathSync.native(join(cwd, '.nexus-worktrees', completedLedger.run_id));

      await runFrom(oldWorktreePath, 'discover');

      const nextLedger = readJson('.planning/nexus/current-run.json');
      expect(nextLedger.run_id).not.toBe(completedLedger.run_id);
      expect(nextLedger.execution.workspace).toMatchObject({
        path: realpathSync.native(join(cwd, '.nexus-worktrees', nextLedger.run_id)),
        kind: 'worktree',
        branch: `codex/${nextLedger.run_id}`,
        source: 'allocated:fresh_run',
        run_id: nextLedger.run_id,
        retirement_state: 'active',
      });
      expect(nextLedger.execution.workspace.path).not.toContain(`${oldWorktreePath}/.nexus-worktrees/`);
      expect(nextLedger.execution.workspace.path).not.toBe(oldWorktreePath);
      expect(nextLedger.execution.session_root).toEqual({
        path: realpathSync.native(cwd),
        kind: 'repo_root',
        source: 'ccb_root',
      });
    });
  });

  test('next fresh discover removes the retired run worktree when cleanup is safe', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const completedLedger = readJson('.planning/nexus/current-run.json');
      const retiredPath = realpathSync.native(join(cwd, '.nexus-worktrees', completedLedger.run_id));

      await run('discover');

      expect(readJson(`.planning/archive/runs/${completedLedger.run_id}/current-run.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        execution: {
          workspace: {
            path: retiredPath,
            retirement_state: 'removed',
          },
        },
      });
      expect(readJson(`.planning/archive/runs/${completedLedger.run_id}/closeout/status.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        stage: 'closeout',
        workspace: {
          path: retiredPath,
          retirement_state: 'removed',
        },
      });
      expect(() => realpathSync.native(retiredPath)).toThrow();
    });
  });

  test('next fresh discover retains the retired run worktree when cleanup is not safe', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const completedLedger = readJson('.planning/nexus/current-run.json');
      const retiredPath = realpathSync.native(join(cwd, '.nexus-worktrees', completedLedger.run_id));
      writeFileSync(join(retiredPath, 'DIRTY.txt'), 'preserve me\n');

      await run('discover');

      expect(readJson(`.planning/archive/runs/${completedLedger.run_id}/current-run.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        execution: {
          workspace: {
            path: retiredPath,
            retirement_state: 'retained',
          },
        },
      });
      expect(readJson(`.planning/archive/runs/${completedLedger.run_id}/closeout/status.json`)).toMatchObject({
        run_id: completedLedger.run_id,
        stage: 'closeout',
        workspace: {
          path: retiredPath,
          retirement_state: 'retained',
        },
      });
      expect(realpathSync.native(retiredPath)).toBe(retiredPath);
    });
  });

  test('continues from fresh discover to frame when invoked inside the newly allocated worktree', async () => {
    await runInTempGitRepo(async ({ cwd, run, runFrom, readJson }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      await run('discover');
      const nextLedger = readJson('.planning/nexus/current-run.json');
      const freshWorktreePath = realpathSync.native(join(cwd, '.nexus-worktrees', nextLedger.run_id));

      await runFrom(freshWorktreePath, 'frame');

      expect(readJson('.planning/current/frame/status.json')).toMatchObject({
        run_id: nextLedger.run_id,
        stage: 'frame',
        state: 'completed',
        decision: 'ready',
        ready: true,
      });
      expect(readJson('.planning/nexus/current-run.json')).toMatchObject({
        run_id: nextLedger.run_id,
        current_stage: 'frame',
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
