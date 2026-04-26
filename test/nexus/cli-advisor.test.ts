import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildCliErrorEnvelope,
  formatCompletionAdvisorForCli,
  formatCompletionAdvisorForInteractiveCli,
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
        why_this_skill: null,
        evidence_signal: null,
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
      why_this_skill: null,
      evidence_signal: null,
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
          why_this_skill: 'Use this because the run has material UI work.',
          evidence_signal: {
            kind: 'verification_matrix',
            summary: 'Design checklist applies to material UI work.',
            source_paths: ['review/design-checklist.md'],
            checklist_categories: ['design'],
          },
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
    expect(rendered).toContain('Why this skill: Use this because the run has material UI work.');
    expect(rendered).toContain('Evidence: verification_matrix');
    expect(rendered).toContain('review/design-checklist.md');
    expect(rendered).toContain('Project/setup gaps:');
    expect(rendered).toContain('Design contract is still missing.');
  });

  test('formats advisor records into a host-independent interactive chooser', () => {
    const rendered = formatCompletionAdvisorForInteractiveCli(sampleAdvisor({
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
          why_this_skill: 'Use this because the run has material UI work.',
          evidence_signal: {
            kind: 'verification_matrix',
            summary: 'Design checklist applies to material UI work.',
            source_paths: ['review/design-checklist.md'],
            checklist_categories: ['design'],
          },
        },
      ],
      recommended_external_skills: [
        {
          id: 'run_external_brand_audit',
          kind: 'external_installed_skill',
          surface: '/brand-audit',
          invocation: '/brand-audit',
          label: 'Run installed skill `/brand-audit`',
          description: 'External visual design audit.',
          recommended: false,
          visibility_reason: 'Installed skill matches /frame because it is tagged design.',
          why_this_skill: 'Use this because the installed skill matches design context.',
          evidence_signal: {
            kind: 'installed_skill',
            summary: 'Installed skill tags matched: design.',
            source_paths: ['/tmp/brand-audit/SKILL.md'],
            checklist_categories: [],
          },
        },
      ],
    }));

    expect(rendered).toContain('Nexus interactive chooser: /frame');
    expect(rendered).toContain('Default: 1');
    expect(rendered).toContain('1. Run `/plan` (recommended)');
    expect(rendered).toContain('2. Run `/plan-design-review`');
    expect(rendered).toContain('   Why this skill: Use this because the run has material UI work.');
    expect(rendered).toContain('   Evidence: verification_matrix');
    expect(rendered).toContain('3. Run installed skill `/brand-audit`');
    expect(rendered).toContain('4. Stop here');
    expect(rendered).toContain('Reply with the number to choose when an agent is mediating this output');
    expect(rendered).toContain('Nexus will not auto-execute a choice from this renderer without an agent/user action.');
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

  test('interactive output mode prints a chooser to stdout instead of json', () => {
    const repo = mkdtempSync(join(tmpdir(), 'nexus-cli-advisor-'));

    try {
      mkdirSync(join(repo, '.planning'), { recursive: true });

      const result = Bun.spawnSync(['bun', 'run', SCRIPT, 'frame', '--output', 'interactive'], {
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
      expect(stdout).toContain('Nexus interactive chooser: /frame');
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
