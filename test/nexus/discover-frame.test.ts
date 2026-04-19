import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'fs';
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
import { bootstrapResumeArtifacts } from '../../lib/nexus/run-bootstrap';
import {
  buildSessionContinuationAdvice,
  findLatestContextTransferArtifact,
  renderSessionContinuationMarkdown,
} from '../../lib/nexus/session-continuation-advice';
import { CONTINUATION_ADVICE_OPTIONS } from '../../lib/nexus/types';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

type TempGitRepoRun = {
  run: (
    command: string,
    adapters?: NexusAdapters,
    execution?: ExecutionSelection,
    options?: { continuationModeOverride?: 'task' | 'phase' | 'project_reset' | null },
  ) => Promise<void>;
  runFrom: (
    cwd: string,
    command: string,
    adapters?: NexusAdapters,
    execution?: ExecutionSelection,
    options?: { continuationModeOverride?: 'task' | 'phase' | 'project_reset' | null },
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
    options: { continuationModeOverride?: 'task' | 'phase' | 'project_reset' | null } = {},
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
      continuation_mode_override: options.continuationModeOverride ?? null,
    });
  };

  try {
    await fn({
      cwd,
      run: (command, adapters, execution, options) => invoke(cwd, command, adapters, execution, options),
      runFrom: (commandCwd, command, adapters, execution, options) => invoke(commandCwd, command, adapters, execution, options),
      readJson: (path: string) => JSON.parse(readFileSync(join(cwd, path), 'utf8')),
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

describe('nexus discover/frame PM seams', () => {
  test('builds continuation advice for project reset runs', () => {
    const advice = buildSessionContinuationAdvice({
      runId: 'run-1',
      boundaryKind: 'fresh_run_phase',
      continuationMode: 'project_reset',
      hostCompactSupported: false,
      contextTransferArtifactPath: null,
      recommendedNextCommand: '/frame',
      generatedAt: '2026-04-16T00:00:00.000Z',
    });

    expect(advice).toEqual({
      schema_version: 1,
      run_id: 'run-1',
      boundary_kind: 'fresh_run_phase',
      continuation_mode: 'project_reset',
      lifecycle_can_continue_here: true,
      recommended_option: 'continue_here',
      available_options: [...CONTINUATION_ADVICE_OPTIONS],
      host_compact_supported: false,
      resume_artifacts: bootstrapResumeArtifacts(),
      supporting_context_artifacts: [],
      recommended_next_command: '/frame',
      summary: 'Nexus can continue in this session.',
      generated_at: '2026-04-16T00:00:00.000Z',
    });

    expect(renderSessionContinuationMarkdown(advice)).toBe([
      '# Session Continuation Advisory',
      '',
      '- Lifecycle can continue here: yes',
      '- Recommended option: continue_here',
      '- Recommended next command: /frame',
      '- Host compact supported: no',
      '',
      '## Summary',
      '',
      'Nexus can continue in this session.',
      '',
      '## Resume Artifacts',
      '',
      '- .planning/current/discover/NEXT-RUN.md',
      '- .planning/current/discover/next-run-bootstrap.json',
      '',
      '## Available Options',
      '',
      '- continue_here',
      '- compact_then_continue',
      '- fresh_session_continue',
      '',
    ].join('\n'));
  });

  test('builds continuation advice for phase continuations', () => {
    const advice = buildSessionContinuationAdvice({
      runId: 'run-2',
      boundaryKind: 'fresh_run_phase',
      continuationMode: 'phase',
      hostCompactSupported: true,
      contextTransferArtifactPath: '.ccb/history/<latest>.md',
      recommendedNextCommand: '/frame',
      generatedAt: '2026-04-16T00:00:01.000Z',
    });

    expect(advice).toEqual({
      schema_version: 1,
      run_id: 'run-2',
      boundary_kind: 'fresh_run_phase',
      continuation_mode: 'phase',
      lifecycle_can_continue_here: true,
      recommended_option: 'compact_then_continue',
      available_options: [...CONTINUATION_ADVICE_OPTIONS],
      host_compact_supported: true,
      resume_artifacts: [
        ...bootstrapResumeArtifacts(),
        '.ccb/history/<latest>.md',
      ],
      supporting_context_artifacts: [],
      recommended_next_command: '/frame',
      summary: 'Nexus can continue in this session. Because this is a new phase boundary, compacting first or resuming in a fresh session is recommended.',
      generated_at: '2026-04-16T00:00:01.000Z',
    });

    expect(renderSessionContinuationMarkdown(advice)).toBe([
      '# Session Continuation Advisory',
      '',
      '- Lifecycle can continue here: yes',
      '- Recommended option: compact_then_continue',
      '- Recommended next command: /frame',
      '- Host compact supported: yes',
      '',
      '## Summary',
      '',
      'Nexus can continue in this session. Because this is a new phase boundary, compacting first or resuming in a fresh session is recommended.',
      '',
      '## Resume Artifacts',
      '',
      '- .planning/current/discover/NEXT-RUN.md',
      '- .planning/current/discover/next-run-bootstrap.json',
      '- .ccb/history/<latest>.md',
      '',
      '## Available Options',
      '',
      '- continue_here',
      '- compact_then_continue',
      '- fresh_session_continue',
      '',
    ].join('\n'));
  });

  test('falls back to fresh-session recommendation when phase continuation cannot compact', () => {
    const advice = buildSessionContinuationAdvice({
      runId: 'run-3',
      boundaryKind: 'fresh_run_phase',
      continuationMode: 'phase',
      hostCompactSupported: false,
      contextTransferArtifactPath: null,
      recommendedNextCommand: '/frame',
      generatedAt: '2026-04-16T00:00:02.000Z',
    });

    expect(advice).toEqual({
      schema_version: 1,
      run_id: 'run-3',
      boundary_kind: 'fresh_run_phase',
      continuation_mode: 'phase',
      lifecycle_can_continue_here: true,
      recommended_option: 'fresh_session_continue',
      available_options: [...CONTINUATION_ADVICE_OPTIONS],
      host_compact_supported: false,
      resume_artifacts: bootstrapResumeArtifacts(),
      supporting_context_artifacts: [],
      recommended_next_command: '/frame',
      summary: 'Nexus can continue in this session. Because this is a new phase boundary and host-managed compact is unavailable, a fresh session is recommended; manual compact remains an option.',
      generated_at: '2026-04-16T00:00:02.000Z',
    });
  });

  test('renders supporting retro continuity artifacts in continuation advice markdown', () => {
    const advice = buildSessionContinuationAdvice({
      runId: 'run-4',
      boundaryKind: 'fresh_run_phase',
      continuationMode: 'phase',
      hostCompactSupported: false,
      contextTransferArtifactPath: null,
      supportingContextArtifacts: [
        '.planning/current/discover/retro-continuity.json',
        '.planning/current/discover/RETRO-CONTINUITY.md',
      ],
      recommendedNextCommand: '/frame',
      generatedAt: '2026-04-16T00:00:03.000Z',
    });

    expect(renderSessionContinuationMarkdown(advice)).toContain('## Supporting Context');
    expect(renderSessionContinuationMarkdown(advice)).toContain(
      '- .planning/current/discover/retro-continuity.json',
    );
  });

  test('finds the latest context-transfer artifact from the repo history folders', () => {
    const cwd = createTempGitRepo();

    try {
      const historyRoot = join(cwd, '.ccb', 'history');
      mkdirSync(historyRoot, { recursive: true });
      const olderPath = join(historyRoot, 'older.md');
      const newerPath = join(historyRoot, 'newer.md');
      writeFileSync(olderPath, '# older\n');
      writeFileSync(newerPath, '# newer\n');
      utimesSync(olderPath, new Date('2026-04-16T00:00:00.000Z'), new Date('2026-04-16T00:00:00.000Z'));
      utimesSync(newerPath, new Date('2026-04-16T00:00:01.000Z'), new Date('2026-04-16T00:00:01.000Z'));

      expect(findLatestContextTransferArtifact(cwd)).toBe('.ccb/history/newer.md');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

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
              design_intent: {
                impact: 'none',
                affected_surfaces: [],
                design_system_source: 'none',
                contract_required: false,
                verification_required: false,
              },
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
        design_impact: 'none',
        design_contract_required: false,
        design_verified: null,
      });
      expect(await run.readFile('docs/product/decision-brief.md')).toContain('Decision Brief');
      expect(await run.readFile('docs/product/prd.md')).toContain('PRD');
      expect(await run.readJson('.planning/current/frame/design-intent.json')).toMatchObject({
        impact: 'none',
        affected_surfaces: [],
        design_system_source: 'none',
        contract_required: false,
        verification_required: false,
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        artifact_index: {
          '.planning/current/frame/design-intent.json': {
            path: '.planning/current/frame/design-intent.json',
          },
        },
      });
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

  test('writes a material design intent artifact for UI-bearing frame work', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: material UI work\n',
              prd_markdown: '# PRD\n\nSuccess criteria: material UI work\n',
              design_intent: {
                impact: 'material',
                affected_surfaces: ['apps/web/src/app/page.tsx', 'apps/web/src/app/layout.tsx'],
                design_system_source: 'design_md',
                contract_required: true,
                verification_required: true,
              },
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

      expect(await run.readJson('.planning/current/frame/design-intent.json')).toMatchObject({
        impact: 'material',
        affected_surfaces: ['apps/web/src/app/page.tsx', 'apps/web/src/app/layout.tsx'],
        design_system_source: 'design_md',
        contract_required: true,
        verification_required: true,
      });
      expect(await run.readJson('.planning/current/frame/status.json')).toMatchObject({
        stage: 'frame',
        state: 'completed',
        decision: 'ready',
        ready: true,
        design_impact: 'material',
        design_contract_required: true,
        design_verified: false,
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        artifact_index: {
          '.planning/current/frame/design-intent.json': {
            path: '.planning/current/frame/design-intent.json',
          },
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
      expect(await run.readJson('.planning/current/frame/design-intent.json')).toMatchObject({
        impact: 'none',
        affected_surfaces: [],
        design_system_source: 'none',
        contract_required: false,
        verification_required: false,
      });
      expect(await run.readJson('.planning/current/frame/status.json')).toMatchObject({
        stage: 'frame',
        state: 'completed',
        decision: 'ready',
        ready: true,
        design_impact: 'none',
        design_contract_required: false,
        design_verified: null,
      });
    });
  });

  test('blocks plan when material design work has no design contract', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      const frameAdapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: material plan gate\n',
              prd_markdown: '# PRD\n\nSuccess criteria: enforce design contract\n',
              design_intent: {
                impact: 'material',
                affected_surfaces: ['apps/web/src/app/page.tsx'],
                design_system_source: 'design_md',
                contract_required: true,
                verification_required: true,
              },
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

      await run('discover');
      await run('frame', frameAdapters);

      await expect(run('plan')).rejects.toThrow('Plan is not ready for execution');
      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'blocked',
        decision: 'not_ready',
        ready: false,
        design_impact: 'material',
        design_contract_required: true,
        design_contract_path: null,
        design_verified: false,
      });
      expect(await run.readJson('.planning/current/plan/verification-matrix.json')).toMatchObject({
        run_id: expect.any(String),
        design_impact: 'material',
        verification_required: true,
        obligations: {
          build: {
            owner_stage: 'build',
            required: true,
            gate_affecting: true,
          },
          review: {
            owner_stage: 'review',
            required: true,
            gate_affecting: true,
            mode: 'full_acceptance',
          },
          qa: {
            owner_stage: 'qa',
            required: true,
            gate_affecting: true,
            design_verification_required: true,
          },
          ship: {
            owner_stage: 'ship',
            required: true,
            gate_affecting: true,
            deploy_readiness_required: true,
          },
        },
        attached_evidence: {
          benchmark: {
            supported: true,
            required: false,
          },
          canary: {
            supported: true,
            required: false,
          },
          qa_only: {
            supported: true,
            required: false,
          },
        },
      });
      expect(() => readFileSync(join(cwd, '.planning/current/plan/design-contract.md'), 'utf8')).toThrow();
    });
  });

  test('writes the plan design contract when material design work provides one', async () => {
    await runInTempRepo(async ({ run }) => {
      const frameAdapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: material plan contract\n',
              prd_markdown: '# PRD\n\nSuccess criteria: persist design contract\n',
              design_intent: {
                impact: 'material',
                affected_surfaces: ['apps/web/src/app/page.tsx'],
                design_system_source: 'design_md',
                contract_required: true,
                verification_required: true,
              },
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
        gsd: {
          plan: async () => ({
            adapter_id: 'gsd',
            outcome: 'success',
            raw_output: {
              execution_readiness_packet: '# Execution Readiness Packet\n\nReady\n',
              sprint_contract: '# Sprint Contract\n\nWave 1\n',
              design_contract: '# Design Contract\n\nMaterial UI constraints\n',
              ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-plan-pack',
              absorbed_capability: 'gsd-plan',
              source_map: ['upstream/gsd/commands/gsd/plan-phase.md'],
            },
          }),
        },
      });

      await run('discover');
      await run('frame', frameAdapters);
      await run('plan', frameAdapters);

      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'completed',
        decision: 'ready',
        ready: true,
        design_impact: 'material',
        design_contract_required: true,
        design_contract_path: '.planning/current/plan/design-contract.md',
        design_verified: false,
      });
      expect(await run.readJson('.planning/current/plan/verification-matrix.json')).toMatchObject({
        run_id: expect.any(String),
        design_impact: 'material',
        verification_required: true,
        obligations: {
          build: {
            owner_stage: 'build',
            required: true,
            gate_affecting: true,
          },
          review: {
            owner_stage: 'review',
            required: true,
            gate_affecting: true,
            mode: 'full_acceptance',
          },
          qa: {
            owner_stage: 'qa',
            required: true,
            gate_affecting: true,
            design_verification_required: true,
          },
          ship: {
            owner_stage: 'ship',
            required: true,
            gate_affecting: true,
            deploy_readiness_required: true,
          },
        },
      });
      expect(await run.readFile('.planning/current/plan/design-contract.md')).toContain('Material UI constraints');
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        artifact_index: {
          '.planning/current/plan/design-contract.md': {
            path: '.planning/current/plan/design-contract.md',
          },
          '.planning/current/plan/verification-matrix.json': {
            path: '.planning/current/plan/verification-matrix.json',
          },
        },
      });
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

  test('blocks frame when a success payload carries malformed design intent', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('discover');
      const adapters = makeFakeAdapters({
        pm: {
          frame: async () => ({
            adapter_id: 'pm',
            outcome: 'success',
            raw_output: {
              decision_brief_markdown: '# Decision Brief\n\nScope: malformed design intent\n',
              prd_markdown: '# PRD\n\nSuccess criteria: reject poisoned design intent\n',
              design_intent: {
                impact: 'material',
                affected_surfaces: 'apps/web/src/app/page.tsx',
                design_system_source: 'design_md',
                contract_required: true,
                verification_required: true,
              },
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

      await expect(run('frame', adapters)).rejects.toThrow('Canonical writeback failed');
      expect(await run.readJson('.planning/current/frame/status.json')).toMatchObject({
        stage: 'frame',
        state: 'blocked',
        ready: false,
      });
      expect(await run.readJson('.planning/current/conflicts/frame-pm.json')).toMatchObject({
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
        continuation_mode: 'phase',
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
      expect(completedLedger.continuation_mode).toBe('project_reset');

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
      expect(readFileSync(
        join(cwd, '.planning/archive/runs', completedLedger.run_id, 'closeout', 'NEXT-RUN.md'),
        'utf8',
      )).toContain('Next Run Bootstrap');
      expect(readJson('.planning/current/discover/status.json')).toMatchObject({
        run_id: nextLedger.run_id,
        stage: 'discover',
        inputs: [
          { kind: 'json', path: '.planning/current/discover/next-run-bootstrap.json' },
          { kind: 'markdown', path: '.planning/current/discover/NEXT-RUN.md' },
        ],
      });
      expect(readJson('.planning/current/discover/next-run-bootstrap.json')).toMatchObject({
        previous_run_id: completedLedger.run_id,
        recommended_entrypoint: 'discover',
        recommended_continuation_mode: 'phase',
      });
      expect(readFileSync(join(cwd, '.planning/current/discover/NEXT-RUN.md'), 'utf8')).toContain(
        `Previous run: ${completedLedger.run_id}`,
      );
      expect(() => readJson('.planning/current/plan/status.json')).toThrow();
    });
  });

  test('fresh discover seeds continuation advice after archived closeout', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
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
      const advice = readJson('.planning/current/discover/session-continuation-advice.json');
      expect(nextLedger.run_id).not.toBe(completedLedger.run_id);
      expect(advice).toMatchObject({
        schema_version: 1,
        run_id: nextLedger.run_id,
        boundary_kind: 'fresh_run_phase',
        continuation_mode: 'phase',
        lifecycle_can_continue_here: true,
        recommended_option: 'fresh_session_continue',
        available_options: [...CONTINUATION_ADVICE_OPTIONS],
        host_compact_supported: false,
        resume_artifacts: bootstrapResumeArtifacts(),
        supporting_context_artifacts: [
          `.planning/archive/runs/${completedLedger.run_id}/closeout/FOLLOW-ON-SUMMARY.md`,
          `.planning/archive/runs/${completedLedger.run_id}/closeout/follow-on-summary.json`,
        ],
        recommended_next_command: '/frame',
        summary: 'Nexus can continue in this session. Because this is a new phase boundary and host-managed compact is unavailable, a fresh session is recommended; manual compact remains an option.',
      });
      expect(advice.generated_at).toBe('2026-04-13T12:00:00.009Z');
      expect(readFileSync(join(cwd, '.planning/current/discover/SESSION-CONTINUATION.md'), 'utf8')).toBe(
        renderSessionContinuationMarkdown(advice),
      );
      expect(nextLedger).toMatchObject({
        artifact_index: {
          '.planning/current/discover/session-continuation-advice.json': {
            path: '.planning/current/discover/session-continuation-advice.json',
          },
          '.planning/current/discover/SESSION-CONTINUATION.md': {
            path: '.planning/current/discover/SESSION-CONTINUATION.md',
          },
        },
      });
    });
  });

  test('fresh discover includes the latest context-transfer artifact when present', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      const historyRoot = join(cwd, '.ccb', 'history');
      mkdirSync(historyRoot, { recursive: true });
      writeFileSync(join(historyRoot, 'phase-3.md'), '# phase 3 handoff\n');

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

      expect(readJson('.planning/current/discover/session-continuation-advice.json')).toMatchObject({
        resume_artifacts: [
          ...bootstrapResumeArtifacts(),
          '.ccb/history/phase-3.md',
        ],
        supporting_context_artifacts: [
          expect.stringMatching(/\/closeout\/FOLLOW-ON-SUMMARY\.md$/),
          expect.stringMatching(/\/closeout\/follow-on-summary\.json$/),
        ],
      });
    });
  });

  test('fresh discover writes retro continuity from recent archived retros', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
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
      const retroRoot = join(cwd, '.planning/archive/retros/2026-04-17-01');
      mkdirSync(retroRoot, { recursive: true });
      writeFileSync(join(retroRoot, 'retro.json'), JSON.stringify({
        schema_version: 1,
        retro_id: '2026-04-17-01',
        mode: 'repo',
        date: '2026-04-17',
        window: '7d',
        generated_at: '2026-04-17T00:00:00.000Z',
        repository_root: cwd,
        linked_run_ids: [completedLedger.run_id],
        source_artifacts: [
          `.planning/archive/runs/${completedLedger.run_id}/closeout/CLOSEOUT-RECORD.md`,
        ],
        summary: 'Recent retro context is available.',
        key_findings: ['Fix-cycle volume dropped after the auth cleanup.'],
        recommended_attention_areas: ['shipping cadence'],
      }, null, 2) + '\n');

      await run('discover');

      const nextLedger = readJson('.planning/nexus/current-run.json');
      expect(readJson('.planning/current/discover/retro-continuity.json')).toMatchObject({
        run_id: nextLedger.run_id,
        source_retro_artifacts: ['.planning/archive/retros/2026-04-17-01/retro.json'],
        recent_findings: ['Fix-cycle volume dropped after the auth cleanup.'],
        recommended_attention_areas: ['shipping cadence'],
      });
      expect(readFileSync(join(cwd, '.planning/current/discover/RETRO-CONTINUITY.md'), 'utf8')).toContain(
        'Fix-cycle volume dropped after the auth cleanup.',
      );
      expect(readJson('.planning/current/discover/session-continuation-advice.json')).toMatchObject({
        supporting_context_artifacts: [
          `.planning/archive/runs/${completedLedger.run_id}/closeout/FOLLOW-ON-SUMMARY.md`,
          `.planning/archive/runs/${completedLedger.run_id}/closeout/follow-on-summary.json`,
          '.planning/current/discover/retro-continuity.json',
          '.planning/current/discover/RETRO-CONTINUITY.md',
        ],
      });
      expect(readJson('.planning/current/discover/status.json')).toMatchObject({
        inputs: expect.arrayContaining([
          { kind: 'json', path: '.planning/archive/retros/2026-04-17-01/retro.json' },
        ]),
      });
      expect(nextLedger).toMatchObject({
        artifact_index: {
          '.planning/current/discover/retro-continuity.json': {
            path: '.planning/current/discover/retro-continuity.json',
          },
          '.planning/current/discover/RETRO-CONTINUITY.md': {
            path: '.planning/current/discover/RETRO-CONTINUITY.md',
          },
        },
      });
    });
  });

  test('fresh discover falls back to legacy repo retros during migration', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      await run('discover');
      await run('frame');
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      const legacyRetroRoot = join(cwd, '.context/retros');
      mkdirSync(legacyRetroRoot, { recursive: true });
      writeFileSync(join(legacyRetroRoot, '2026-04-17-1.json'), JSON.stringify({
        date: '2026-04-17',
        window: '7d',
        tweetable: 'Week of Apr 10: review latency dropped and auth work stayed focused.',
      }, null, 2) + '\n');

      await run('discover');

      expect(readJson('.planning/current/discover/retro-continuity.json')).toMatchObject({
        source_retro_artifacts: ['.context/retros/2026-04-17-1.json'],
        recent_findings: ['Week of Apr 10: review latency dropped and auth work stayed focused.'],
      });
    });
  });

  test('ignores a continuation mode override when discover stays on the same run', async () => {
    await runInTempGitRepo(async ({ cwd, run, readJson }) => {
      await run('discover', undefined, undefined, { continuationModeOverride: 'task' });

      expect(readJson('.planning/nexus/current-run.json')).toMatchObject({
        continuation_mode: 'task',
      });
      expect(readJson('.planning/current/discover/adapter-request.json')).toMatchObject({
        continuation_mode: 'task',
        requested_continuation_mode: 'task',
        effective_continuation_mode: 'task',
      });
      expect(() => readJson('.planning/current/discover/session-continuation-advice.json')).toThrow();
      expect(() => readFileSync(join(cwd, '.planning/current/discover/SESSION-CONTINUATION.md'), 'utf8')).toThrow();

      await run('discover', undefined, undefined, { continuationModeOverride: 'phase' });

      expect(readJson('.planning/nexus/current-run.json')).toMatchObject({
        continuation_mode: 'task',
      });
      expect(readJson('.planning/current/discover/adapter-request.json')).toMatchObject({
        continuation_mode: 'task',
        requested_continuation_mode: 'phase',
        effective_continuation_mode: 'task',
      });
      expect(() => readJson('.planning/current/discover/session-continuation-advice.json')).toThrow();
      expect(() => readFileSync(join(cwd, '.planning/current/discover/SESSION-CONTINUATION.md'), 'utf8')).toThrow();
    });
  });

  test('applies an explicit continuation mode override when discover starts a fresh run', async () => {
    await runInTempGitRepo(async ({ run, readJson }) => {
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
      expect(completedLedger.current_stage).toBe('closeout');

      await run('discover', undefined, undefined, { continuationModeOverride: 'task' });

      const nextLedger = readJson('.planning/nexus/current-run.json');
      expect(nextLedger.run_id).not.toBe(completedLedger.run_id);
      expect(nextLedger).toMatchObject({
        continuation_mode: 'task',
      });
      expect(readJson('.planning/current/discover/adapter-request.json')).toMatchObject({
        continuation_mode: 'task',
        requested_continuation_mode: 'task',
        effective_continuation_mode: 'task',
      });
      expect(readJson('.planning/current/discover/status.json')).toMatchObject({
        run_id: nextLedger.run_id,
      });
      expect(readJson('.planning/current/discover/next-run-bootstrap.json')).toMatchObject({
        recommended_continuation_mode: 'phase',
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

  test('mirrors product and planning artifacts into the run-owned worktree when commands run from the repo root', async () => {
    await runInTempGitRepo(async ({ run, readJson, cwd }) => {
      await run('discover');
      await run('frame');
      await run('plan');

      const ledger = readJson('.planning/nexus/current-run.json');
      const workspacePath = realpathSync.native(join(cwd, '.nexus-worktrees', ledger.run_id));

      expect(readFileSync(join(workspacePath, 'docs/product/idea-brief.md'), 'utf8')).toBe(
        readFileSync(join(cwd, 'docs/product/idea-brief.md'), 'utf8'),
      );
      expect(readFileSync(join(workspacePath, 'docs/product/decision-brief.md'), 'utf8')).toBe(
        readFileSync(join(cwd, 'docs/product/decision-brief.md'), 'utf8'),
      );
      expect(readFileSync(join(workspacePath, 'docs/product/prd.md'), 'utf8')).toBe(
        readFileSync(join(cwd, 'docs/product/prd.md'), 'utf8'),
      );
      expect(readFileSync(join(workspacePath, '.planning/current/plan/execution-readiness-packet.md'), 'utf8')).toBe(
        readFileSync(join(cwd, '.planning/current/plan/execution-readiness-packet.md'), 'utf8'),
      );
      expect(readFileSync(join(workspacePath, '.planning/current/plan/sprint-contract.md'), 'utf8')).toBe(
        readFileSync(join(cwd, '.planning/current/plan/sprint-contract.md'), 'utf8'),
      );
      expect(JSON.parse(readFileSync(join(workspacePath, '.planning/nexus/current-run.json'), 'utf8'))).toMatchObject({
        run_id: ledger.run_id,
        current_stage: 'plan',
      });
    });
  });
});
