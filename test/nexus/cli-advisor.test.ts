import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildCliErrorEnvelope,
  formatCompletionAdvisorForCli,
  resolveCliCompletionContext,
} from '../../lib/nexus/cli-advisor';
import type { CompletionAdvisorRecord } from '../../lib/nexus/types';

const SCRIPT = join(import.meta.dir, '..', '..', 'bin', 'nexus.ts');
const REPO_ROOT = join(import.meta.dir, '..', '..');

function sampleAdvisor(overrides: Partial<CompletionAdvisorRecord> = {}): CompletionAdvisorRecord {
  return {
    schema_version: 1,
    run_id: 'run-1',
    stage: 'frame',
    generated_at: '2026-04-20T00:00:00.000Z',
    stage_outcome: 'ready',
    interaction_mode: 'recommended_choice',
    summary: 'Framing is complete. The canonical next step is planning.',
    requires_user_choice: false,
    choice_reason: null,
    default_action_id: 'run_plan',
    primary_next_actions: [
      {
        id: 'run_plan',
        kind: 'canonical_stage',
        surface: '/plan',
        invocation: '/plan',
        label: 'Run `/plan`',
        description: 'Turn framing into an execution-ready packet.',
        recommended: true,
        visibility_reason: 'Framing is complete and planning is the canonical next lifecycle step.',
      },
    ],
    alternative_next_actions: [],
    recommended_side_skills: [],
    stop_action: {
      id: 'stop_after_frame',
      kind: 'stop',
      surface: 'stop',
      invocation: null,
      label: 'Stop here',
      description: 'Do not advance yet. Keep the current artifacts as-is and decide on the next step later.',
      recommended: false,
      visibility_reason: 'Always available as the minimal non-advancing choice after a completed stage.',
    },
    project_setup_gaps: [],
    hidden_compat_aliases: [],
    hidden_utility_skills: [],
    suppressed_surfaces: [],
    ...overrides,
  };
}

describe('nexus cli advisor rendering', () => {
  test('formats advisor records into a human-readable runtime summary', () => {
    const rendered = formatCompletionAdvisorForCli(sampleAdvisor({
      recommended_side_skills: [
        {
          id: 'run_plan_design_review',
          kind: 'support_skill',
          surface: '/plan-design-review',
          invocation: '/plan-design-review',
          label: 'Run `/plan-design-review`',
          description: 'Tighten the design contract before execution.',
          recommended: false,
          visibility_reason: 'The run is design-bearing.',
        },
      ],
      project_setup_gaps: ['Design contract is still missing.'],
    }));

    expect(rendered).toContain('Completion advisor: /frame');
    expect(rendered).toContain('Outcome: ready');
    expect(rendered).toContain('Interaction mode: recommended_choice');
    expect(rendered).toContain('Primary next actions:');
    expect(rendered).toContain('Run `/plan`');
    expect(rendered).toContain('Recommended side skills:');
    expect(rendered).toContain('Run `/plan-design-review`');
    expect(rendered).toContain('Project/setup gaps:');
    expect(rendered).toContain('Design contract is still missing.');
  });

  test('blocked frame CLI output includes the advisor summary and suppresses ready-path actions', () => {
    const repo = mkdtempSync(join(tmpdir(), 'nexus-cli-advisor-'));

    try {
      mkdirSync(join(repo, '.planning'), { recursive: true });

      const result = Bun.spawnSync(['bun', 'run', SCRIPT, 'frame'], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NEXUS_PROJECT_CWD: repo,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = JSON.parse(result.stdout.toString()) as ReturnType<typeof buildCliErrorEnvelope>;
      const stderr = result.stderr.toString();
      expect(result.exitCode).toBe(1);
      expect(stdout).toMatchObject({
        ok: false,
        command: 'frame',
        error: 'Missing required input artifact: docs/product/idea-brief.md',
        completion_context: {
          stage: 'frame',
          completion_advisor: {
            stage: 'frame',
            stage_outcome: 'blocked',
            interaction_mode: 'summary_only',
          },
          status: {
            stage: 'frame',
            state: 'blocked',
            ready: false,
          },
        },
      });
      expect(stderr).toContain('Missing required input artifact: docs/product/idea-brief.md');
      expect(stderr).toContain('Completion advisor: /frame');
      expect(stderr).toContain('Outcome: blocked');
      expect(stderr).toContain('Interaction mode: summary_only');
      expect(stderr).not.toContain('Run `/plan`');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('json output mode suppresses human stderr summaries and still emits the error envelope', () => {
    const repo = mkdtempSync(join(tmpdir(), 'nexus-cli-advisor-'));

    try {
      mkdirSync(join(repo, '.planning'), { recursive: true });

      const result = Bun.spawnSync(['bun', 'run', SCRIPT, 'frame', '--output', 'json'], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NEXUS_PROJECT_CWD: repo,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = JSON.parse(result.stdout.toString()) as ReturnType<typeof buildCliErrorEnvelope>;
      expect(result.exitCode).toBe(1);
      expect(stdout.ok).toBe(false);
      expect(result.stderr.toString()).toBe('');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('human output mode prints advisor guidance to stdout instead of json', () => {
    const repo = mkdtempSync(join(tmpdir(), 'nexus-cli-advisor-'));

    try {
      mkdirSync(join(repo, '.planning'), { recursive: true });

      const result = Bun.spawnSync(['bun', 'run', SCRIPT, 'frame', '--output', 'human'], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NEXUS_PROJECT_CWD: repo,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = result.stdout.toString();
      expect(result.exitCode).toBe(1);
      expect(stdout).toContain('Missing required input artifact: docs/product/idea-brief.md');
      expect(stdout).toContain('Completion advisor: /frame');
      expect(stdout).not.toContain('"ok": false');
      expect(result.stderr.toString()).toBe('');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('buildCliErrorEnvelope preserves runtime-owned completion context', () => {
    const advisor = sampleAdvisor();
    const context = resolveCliCompletionContext(process.cwd(), 'frame', {
      completionAdvisor: advisor,
      status: {
        run_id: 'run-1',
        stage: 'frame',
        state: 'completed',
        decision: 'ready',
        ready: true,
        inputs: [],
        outputs: [],
        started_at: '2026-04-20T00:00:00.000Z',
        completed_at: '2026-04-20T00:00:00.000Z',
        errors: [],
      },
    });

    expect(buildCliErrorEnvelope('frame failed', context, 'frame')).toMatchObject({
      ok: false,
      command: 'frame',
      error: 'frame failed',
      completion_context: {
        stage: 'frame',
        completion_advisor: {
          stage: 'frame',
        },
        status: {
          stage: 'frame',
          ready: true,
        },
      },
    });
  });
});
