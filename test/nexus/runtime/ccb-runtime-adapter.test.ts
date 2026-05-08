import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
import { CANONICAL_MANIFEST } from '../../../lib/nexus/contracts/command-manifest';
import { createRuntimeCcbAdapter } from '../../../lib/nexus/adapters/ccb';
import { reviewAttemptAuditMarkdownPath, reviewAttemptAuditReceiptPath } from '../../../lib/nexus/io/artifacts';
import { readActiveCcbDispatchState, readCcbDispatchState, readCcbProviderState, startCcbDispatchState } from '../../../lib/nexus/runtime/ccb-runtime-state';
import { withExecutionSessionRoot, withExecutionWorkspace } from '../../../lib/nexus/runtime/execution-topology';
import { startLedger } from '../../../lib/nexus/governance/ledger';
import { buildReviewAuditReceiptRecord, persistReviewAuditReceipt } from '../../../lib/nexus/review/receipts';
import type { NexusAdapterContext } from '../../../lib/nexus/adapters/types';
import type { ArtifactPointer, RequestedRouteRecord, ReviewScopeRecord, SessionRootRecord, WorkspaceRecord } from '../../../lib/nexus/contracts/types';

interface RecordedCommand {
  argv: string[];
  cwd: string;
  env: Record<string, string>;
  stdin_text?: string;
  timeout_ms?: number;
}

const REQUESTED_ROUTE: RequestedRouteRecord = {
  command: 'build',
  governed: true,
  planner: 'claude+pm-gsd',
  generator: 'codex-via-ccb',
  evaluator_a: 'codex-via-ccb',
  evaluator_b: 'gemini-via-ccb',
  synthesizer: 'claude',
  substrate: 'superpowers-core',
  fallback_policy: 'disabled',
};

function buildContext(
  stage: 'handoff' | 'build' | 'review' | 'qa',
  command: 'handoff' | 'build' | 'review' | 'qa',
  requestedRoute: RequestedRouteRecord = REQUESTED_ROUTE,
  reviewScope: ReviewScopeRecord | null = null,
  options: {
    cwd?: string;
    contextWorkspace?: WorkspaceRecord;
    ledgerWorkspace?: WorkspaceRecord;
    ledgerSessionRoot?: SessionRootRecord;
    predecessorArtifacts?: ArtifactPointer[];
    reviewAttemptId?: string;
  } = {},
): NexusAdapterContext {
  const contextWorkspace = options.contextWorkspace ?? {
    path: '/repo/root/.nexus-worktrees/feature',
    kind: 'worktree',
    branch: 'feature',
    source: 'existing:nexus_worktree',
  };
  const ledgerWorkspace = options.ledgerWorkspace ?? contextWorkspace;
  const ledgerSessionRoot = options.ledgerSessionRoot ?? {
    path: '/repo/root',
    kind: 'repo_root',
    source: 'ccb_root',
  };
  const ledger = withExecutionSessionRoot(
    withExecutionWorkspace(startLedger('run-123', stage), ledgerWorkspace),
    ledgerSessionRoot,
  );

  return {
    cwd: options.cwd ?? '/repo/root',
    workspace: contextWorkspace,
    run_id: 'run-123',
    command,
    stage,
    ledger,
    manifest: CANONICAL_MANIFEST[command],
    predecessor_artifacts: options.predecessorArtifacts ?? [{ kind: 'json', path: `.planning/current/${stage}/status.json` }],
    requested_route: requestedRoute,
    review_scope: reviewScope,
    review_attempt_id: options.reviewAttemptId,
  };
}

describe('nexus runtime ccb adapter', () => {
  test('persists repo-visible provider session state during governed route verification', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-state-'));

    try {
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
        }),
        runCommand: async (spec) => {
          if (spec.argv[0] === '/opt/ccb/bin/ccb-ping') {
            return {
              exit_code: 0,
              stdout: `✅ ${spec.argv[1]} connection OK (Session healthy)\n`,
              stderr: '',
            };
          }

          return {
            exit_code: 0,
            stdout: JSON.stringify({ cwd: root, mounted: ['codex', 'gemini'] }) + '\n',
            stderr: '',
          };
        },
        now: () => '2026-04-16T02:00:00.000Z',
      });

      await adapter.resolve_route(buildContext('handoff', 'handoff', REQUESTED_ROUTE, null, {
        cwd: root,
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
        reviewAttemptId: 'review-2026-04-21T01-23-45-678Z',
      }));

      const providerStatePath = join(root, '.planning/nexus/providers.json');
      expect(existsSync(providerStatePath)).toBe(true);
      expect(JSON.parse(readFileSync(providerStatePath, 'utf8'))).toMatchObject({
        schema_version: 2,
        providers: {
          codex: {
            provider: 'codex',
            session_root: root,
            mounted: true,
            ping_ok: true,
          },
          gemini: {
            provider: 'gemini',
            session_root: root,
            mounted: true,
            ping_ok: true,
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('verifies governed route availability from the Nexus session root', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/ccb-ping') {
          const provider = spec.argv[1];
          return {
            exit_code: 0,
            stdout: `✅ ${provider} connection OK (Session healthy)\n`,
            stderr: '',
          };
        }
        return {
          exit_code: 0,
          stdout: '{"cwd":"/repo/root/.nexus-worktrees/feature","mounted":["codex","gemini"]}\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.resolve_route(buildContext('handoff', 'handoff'));

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      argv: ['/opt/ccb/bin/ccb-mounted', '--autostart'],
      cwd: '/repo/root',
      env: {
        PWD: '/repo/root',
      },
    });
    expect(calls[1]).toMatchObject({
      argv: ['/opt/ccb/bin/ccb-ping', 'codex'],
      cwd: '/repo/root',
      env: {
        PWD: '/repo/root',
      },
    });
    expect(calls[2]).toMatchObject({
      argv: ['/opt/ccb/bin/ccb-ping', 'gemini'],
      cwd: '/repo/root',
      env: {
        PWD: '/repo/root',
      },
    });
    expect(calls[0]?.stdin_text).toBeUndefined();
    expect(calls[1]?.stdin_text).toBeUndefined();
    expect(calls[2]?.stdin_text).toBeUndefined();
    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      available: true,
      provider: 'codex',
      providers: ['codex', 'gemini'],
      mounted: ['codex', 'gemini'],
      verification_commands: [
        '/opt/ccb/bin/ccb-mounted --autostart',
        '/opt/ccb/bin/ccb-ping codex',
        '/opt/ccb/bin/ccb-ping gemini',
      ],
    });
    expect(result.actual_route).toMatchObject({
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
    });
  });

  test('prefers ledger session root over execution workspace for route verification', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/wrong/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/ccb-ping') {
          return {
            exit_code: 0,
            stdout: `✅ ${spec.argv[1]} connection OK (Session healthy)\n`,
            stderr: '',
          };
        }
        return {
          exit_code: 0,
          stdout: '{"cwd":"/repo/ledger-session","mounted":["codex","gemini"]}\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    await adapter.resolve_route(buildContext('handoff', 'handoff', REQUESTED_ROUTE, null, {
      contextWorkspace: {
        path: '/repo/root/.worktrees/stale',
        kind: 'worktree',
        branch: 'stale',
        source: 'existing:legacy_worktree',
      },
      ledgerWorkspace: {
        path: '/repo/root/.nexus-worktrees/run-owned',
        kind: 'worktree',
        branch: 'codex/run-owned',
        source: 'allocated:fresh_run',
        run_id: 'run-123',
        retirement_state: 'active',
      },
      ledgerSessionRoot: {
        path: '/repo/ledger-session',
        kind: 'repo_root',
        source: 'ccb_root',
      },
    }));

    expect(calls.map((call) => call.cwd)).toEqual([
      '/repo/ledger-session',
      '/repo/ledger-session',
      '/repo/ledger-session',
    ]);
  });

  test('autostarts mounted providers before pinging required routes', async () => {
    const calls: RecordedCommand[] = [];
    let mountedReady = false;
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/ccb-mounted') {
          mountedReady = true;
          return {
            exit_code: 0,
            stdout: '{"cwd":"/repo/root/.nexus-worktrees/feature","mounted":["codex","gemini"]}\n',
            stderr: '',
          };
        }

        return {
          exit_code: mountedReady ? 0 : 1,
          stdout: mountedReady ? `✅ ${spec.argv[1]} connection OK (Session healthy)\n` : '',
          stderr: mountedReady ? '' : `[ERROR] ${spec.argv[1]} is not mounted\n`,
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.resolve_route(buildContext('handoff', 'handoff'));

    expect(calls.map((call) => call.argv)).toEqual([
      ['/opt/ccb/bin/ccb-mounted', '--autostart'],
      ['/opt/ccb/bin/ccb-ping', 'codex'],
      ['/opt/ccb/bin/ccb-ping', 'gemini'],
    ]);
    expect(calls[0]?.cwd).toBe('/repo/root');
    expect(calls[1]?.cwd).toBe('/repo/root');
    expect(calls[2]?.cwd).toBe('/repo/root');
    expect(result.outcome).toBe('success');
  });

  test('dispatches build execution through ask with claude caller semantics', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        return {
          exit_code: 0,
          stdout: '# Build Execution Summary\n\nImplemented the bounded contract.\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_generator(buildContext('build', 'build', REQUESTED_ROUTE, null, {
      contextWorkspace: {
        path: '/repo/root/.worktrees/stale',
        kind: 'worktree',
        branch: 'stale',
        source: 'existing:legacy_worktree',
      },
      ledgerWorkspace: {
        path: '/repo/root/.nexus-worktrees/run-owned',
        kind: 'worktree',
        branch: 'codex/run-owned',
        source: 'allocated:fresh_run',
        run_id: 'run-123',
        retirement_state: 'active',
      },
    }));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toEqual([
      '/opt/ccb/bin/ask',
      'codex',
      '--foreground',
      '--no-wrap',
      '--timeout',
      '1800',
    ]);
    expect(calls[0]?.env).toMatchObject({
      CCB_CALLER: 'claude',
      CCB_ASKD_AUTOSTART: '1',
      PWD: '/repo/root/.nexus-worktrees/run-owned',
    });
    expect(calls[0]?.stdin_text).toContain('.planning/current/build/status.json');
    expect(calls[0]?.stdin_text).toContain('codex-via-ccb');
    expect(calls[0]?.stdin_text).toContain('Repository cwd: /repo/root');
    expect(calls[0]?.stdin_text).toContain('Execution workspace cwd: /repo/root/.nexus-worktrees/run-owned');
    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      receipt: 'ccb-build-codex-2026-04-08T00-00-00.000Z',
      summary_markdown: '# Build Execution Summary\n\nImplemented the bounded contract.',
    });
    expect(result.actual_route).toMatchObject({
      provider: 'codex',
      route: 'codex-via-ccb',
      substrate: 'superpowers-core',
      transport: 'ccb',
    });
  });

  test('includes bounded fix-cycle review scope in governed build and review prompts', async () => {
    const calls: RecordedCommand[] = [];
    const reviewScope: ReviewScopeRecord = {
      mode: 'bounded_fix_cycle',
      source_stage: 'review',
      blocking_items: [
        'Generate and commit the initial Drizzle migration.',
        'Remove the legacy Vue root app files.',
      ],
      advisory_policy: 'out_of_scope_advisory',
    };
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/autonew') {
          return { exit_code: 0, stdout: '', stderr: '' };
        }

        return {
          exit_code: 0,
          stdout: spec.argv[1] === 'codex'
            ? '# Build Execution Summary\n\n- Status: completed\n- Actions: applied the bounded fix cycle\n- Files touched: packages/db/drizzle/\n- Verification: verified the bounded fix cycle\n'
            : '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    await adapter.execute_generator(buildContext('build', 'build', REQUESTED_ROUTE, reviewScope));
    await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, reviewScope));

    expect(calls[0]?.stdin_text).toContain('"mode": "bounded_fix_cycle"');
    expect(calls[0]?.stdin_text).toContain('This is a bounded fix-cycle build.');
    expect(calls[0]?.stdin_text).toContain('Generate and commit the initial Drizzle migration.');
    expect(calls[1]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
    expect(calls[2]?.stdin_text).toContain('"mode": "bounded_fix_cycle"');
    expect(calls[2]?.stdin_text).toContain('This is a bounded fix-cycle review.');
    expect(calls[2]?.stdin_text).toContain('Operate as a fast bounded auditor, not an open-ended investigator.');
    expect(calls[2]?.stdin_text).toContain('Do not activate extra review workflows or broad repo-search procedures for this bounded review.');
    expect(calls[2]?.stdin_text).toContain('As soon as the blocking items are confirmed pass/fail from repo-visible evidence, finalize immediately.');
    expect(calls[2]?.stdin_text).toContain('Additional out-of-scope concerns may be noted as advisories only');
    expect(calls[2]?.stdin_text).toContain('Remove the legacy Vue root app files.');
  });

  test('full-acceptance build prompt points the generator at the current execution contract artifacts', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        return {
          exit_code: 0,
          stdout: '# Build Execution Summary\n\n- Status: completed\n- Actions: implemented the current execution packet\n- Files touched: apps/web\n- Verification: verified the current execution packet\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    await adapter.execute_generator(buildContext('build', 'build', REQUESTED_ROUTE, null, {
      predecessorArtifacts: [
        { kind: 'json', path: '.planning/current/handoff/status.json' },
        { kind: 'markdown', path: '.planning/current/handoff/governed-handoff.md' },
        { kind: 'markdown', path: '.planning/current/plan/execution-readiness-packet.md' },
        { kind: 'markdown', path: '.planning/current/plan/sprint-contract.md' },
      ],
    }));

    expect(calls[0]?.stdin_text).toContain('- .planning/current/handoff/governed-handoff.md');
    expect(calls[0]?.stdin_text).toContain('- .planning/current/plan/execution-readiness-packet.md');
    expect(calls[0]?.stdin_text).toContain('- .planning/current/plan/sprint-contract.md');
    expect(calls[0]?.stdin_text).toContain('This is a full-acceptance build for the current execution packet.');
    expect(calls[0]?.stdin_text).toContain('If the repository only satisfies an earlier phase, implement the missing work required by the current execution packet instead of re-validating the earlier phase.');
  });

  test('resets the provider session before governed review audit dispatch', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/autonew') {
          return {
            exit_code: 0,
            stdout: '',
            stderr: '',
          };
        }
        return {
          exit_code: 0,
          stdout: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, null, {
      contextWorkspace: {
        path: '/repo/root/.worktrees/stale',
        kind: 'worktree',
        branch: 'stale',
        source: 'existing:legacy_worktree',
      },
      ledgerWorkspace: {
        path: '/repo/root/.nexus-worktrees/run-owned',
        kind: 'worktree',
        branch: 'codex/run-owned',
        source: 'allocated:fresh_run',
        run_id: 'run-123',
        retirement_state: 'active',
      },
      ledgerSessionRoot: {
        path: '/repo/ledger-session',
        kind: 'repo_root',
        source: 'ccb_root',
      },
    }));

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      argv: ['/opt/ccb/bin/autonew', 'gemini'],
      cwd: '/repo/ledger-session',
      env: {
        CCB_CALLER: 'claude',
        CCB_SESSION_FILE: '/repo/ledger-session/.ccb/.gemini-session',
        PWD: '/repo/ledger-session',
      },
    });
    expect(calls[1]?.argv).toEqual([
      '/opt/ccb/bin/ask',
      'gemini',
      '--foreground',
      '--no-wrap',
      '--timeout',
      '180',
    ]);
    expect(calls[1]?.cwd).toBe('/repo/root/.nexus-worktrees/run-owned');
    expect(calls[1]?.env.PWD).toBe('/repo/root/.nexus-worktrees/run-owned');
    expect(result.outcome).toBe('success');
    expect(result.actual_route).toMatchObject({
      provider: 'gemini',
      route: 'gemini-via-ccb',
      transport: 'ccb',
    });
  });

  test('writes review attempt receipts when a governed review audit succeeds', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-review-receipt-'));

    try {
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
        }),
        runCommand: async (spec) => {
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          return {
            exit_code: 0,
            stdout: '# Gemini Audit\n\nResult: fail\n\nFindings:\n- Receipt persisted.\n',
            stderr: '',
          };
        },
        now: () => '2026-04-21T01:23:45.678Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, null, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees', 'run-owned'),
          kind: 'worktree',
          branch: 'codex/run-owned',
          source: 'allocated:fresh_run',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees', 'run-owned'),
          kind: 'worktree',
          branch: 'codex/run-owned',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
        reviewAttemptId: 'review-2026-04-21T01-23-45-678Z',
      }));

      expect(result.outcome).toBe('success');
      const reviewAttemptId = 'review-2026-04-21T01-23-45-678Z';
      const markdownPath = join(root, reviewAttemptAuditMarkdownPath(reviewAttemptId, 'gemini'));
      const receiptPath = join(root, reviewAttemptAuditReceiptPath(reviewAttemptId, 'gemini'));
      expect(existsSync(markdownPath)).toBe(true);
      expect(existsSync(receiptPath)).toBe(true);
      expect(readFileSync(markdownPath, 'utf8')).toContain('# Gemini Audit');
      expect(JSON.parse(readFileSync(receiptPath, 'utf8'))).toMatchObject({
        schema_version: 1,
        review_attempt_id: reviewAttemptId,
        provider: 'gemini',
        verdict: 'fail',
        markdown_path: reviewAttemptAuditMarkdownPath(reviewAttemptId, 'gemini'),
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('recovers a governed review audit from the current attempt receipt when transport recovery still misses the reply', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-receipt-recovery-'));
    const reviewAttemptId = 'review-2026-04-21T01-23-45-678Z';

    try {
      persistReviewAuditReceipt({
        cwd: root,
        review_attempt_id: reviewAttemptId,
        provider: 'gemini',
        markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
        record: buildReviewAuditReceiptRecord({
          review_attempt_id: reviewAttemptId,
          provider: 'gemini',
          request_id: '20260421-123456-1',
          generated_at: '2026-04-21T01:23:45.678Z',
          requested_route: {
            provider: 'gemini',
            route: REQUESTED_ROUTE.evaluator_b,
            substrate: REQUESTED_ROUTE.substrate,
            transport: 'ccb',
          },
          actual_route: {
            provider: 'gemini',
            route: REQUESTED_ROUTE.evaluator_b,
            substrate: REQUESTED_ROUTE.substrate,
            transport: 'ccb',
            receipt_path: '.planning/current/review/adapter-output.json',
          },
          verdict: 'pass',
          markdown_path: reviewAttemptAuditMarkdownPath(reviewAttemptId, 'gemini'),
        }),
      });

      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
          pend_path: '/opt/ccb/bin/pend',
        }),
        runCommand: async (spec) => {
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          return {
            exit_code: 1,
            stdout: '',
            stderr: 'foreground false-start',
          };
        },
        now: () => '2026-04-21T01:24:00.000Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, null, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees', 'run-owned'),
          kind: 'worktree',
          branch: 'codex/run-owned',
          source: 'allocated:fresh_run',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees', 'run-owned'),
          kind: 'worktree',
          branch: 'codex/run-owned',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
        reviewAttemptId,
      }));

      expect(result.outcome).toBe('success');
      expect(result.raw_output.request_id).toBe('20260421-123456-1');
      expect(result.raw_output.markdown).toContain('# Gemini Audit');
      expect(result.raw_output.markdown).toContain('Result: pass');
      expect(result.raw_output.latency_summary).toMatchObject({
        path: 'late_recovery',
        recovered_via: 'receipt',
      });
      const providerState = readCcbProviderState(root, '2026-04-21T01:24:00.000Z');
      expect(providerState.providers.gemini).toMatchObject({
        last_dispatch_status: 'recovered_late',
        last_request_status: 'recovered_late',
      });
      expect(readFileSync(join(root, reviewAttemptAuditMarkdownPath(reviewAttemptId, 'gemini')), 'utf8')).toContain('Result: pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('marks a previously active governed dispatch as superseded when a newer dispatch starts', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-superseded-'));
    try {
      startCcbDispatchState({
        repoRoot: root,
        dispatchId: 'review-gemini-2026-04-07T23-59-59-000Z',
        provider: 'gemini',
        stage: 'review',
        sessionRoot: root,
        sessionFile: `${root}/.ccb/.gemini-session`,
        executionWorkspace: `${root}/.nexus-worktrees/run-old`,
        dispatchCommand: '/opt/ccb/bin/ask gemini --foreground --no-wrap --timeout 180',
        dispatchedAt: '2026-04-07T23:59:59.000Z',
      });

      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
        }),
        runCommand: async (spec) => {
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          return {
            exit_code: 0,
            stdout: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
            stderr: '',
          };
        },
        sleep: async () => {},
        now: () => '2026-04-08T00:00:00.000Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, null, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees/run-new'),
          kind: 'worktree',
          branch: 'codex/run-new',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees/run-new'),
          kind: 'worktree',
          branch: 'codex/run-new',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
      }));

      expect(result.outcome).toBe('success');
      expect(readActiveCcbDispatchState(root, 'gemini', '2026-04-08T00:00:00.000Z')).toBeNull();
      expect(readCcbDispatchState(root, 'review-gemini-2026-04-07T23-59-59-000Z')).toMatchObject({
        status: 'superseded',
        stderr: expect.stringContaining('[SUPERSEDED] replaced by a newer governed dispatch before completion'),
      });
      expect(readCcbProviderState(root, '2026-04-08T00:00:00.000Z')).toMatchObject({
        providers: {
          gemini: {
            active_dispatch_id: null,
            last_dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
            last_dispatch_status: 'completed',
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks review audit dispatch when the provider command fails', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/autonew') {
          return {
            exit_code: 0,
            stdout: '',
            stderr: '',
          };
        }

        return {
          exit_code: 1,
          stdout: '',
          stderr: '[ERROR] Unified askd daemon not running',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_audit_b(buildContext('review', 'review'));

    expect(calls).toHaveLength(2);
    expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
    expect(calls[1]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'gemini', '--foreground']);
    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('Unified askd daemon not running');
    expect(result.conflict_candidates[0]).toMatchObject({
      stage: 'review',
      adapter: 'ccb',
      kind: 'backend_conflict',
    });
    expect(result.raw_output).toMatchObject({
      receipt: '',
      exit_code: 1,
      stdout: '',
      stderr: '[ERROR] Unified askd daemon not running',
      request_id: null,
    });
  });

  test('recovers a successful review audit when ask exits nonzero but stdout contains a canonical audit payload', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        if (spec.argv[0] === '/opt/ccb/bin/autonew') {
          return {
            exit_code: 0,
            stdout: '',
            stderr: '',
          };
        }

        return {
          exit_code: 1,
          stdout: [
            'I have completed the governed Nexus review for the Phase 2 implementation.',
            '',
            '# Gemini Audit',
            '',
            'Result: pass',
            '',
            'Findings:',
            '- none',
          ].join('\n'),
          stderr: 'CCB_REQ_ID: 20260415-000000-000-00000-1',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_audit_b(buildContext('review', 'review'));

    expect(calls).toHaveLength(2);
    expect(result.outcome).toBe('success');
    expect(result.actual_route).toMatchObject({
      provider: 'gemini',
      route: 'gemini-via-ccb',
      transport: 'ccb',
    });
    expect(result.raw_output).toMatchObject({
      markdown: expect.stringContaining('Result: pass'),
      exit_code: 1,
      request_id: '20260415-000000-000-00000-1',
    });
  });

  test('extracts the canonical review audit block when provider adds leading prose with an earlier misleading Result line', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        if (spec.argv[0] === '/opt/ccb/bin/autonew') {
          return {
            exit_code: 0,
            stdout: '',
            stderr: '',
          };
        }

        return {
          exit_code: 0,
          stdout: [
            'I initially thought the build looked healthy.',
            'Result: pass',
            '',
            '# Codex Audit',
            '',
            'Result: fail',
            '',
            'Findings:',
            '- Identifier column is not sortable.',
          ].join('\n'),
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_audit_a(buildContext('review', 'review'));

    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      markdown: [
        '# Codex Audit',
        '',
        'Result: fail',
        '',
        'Findings:',
        '- Identifier column is not sortable.',
      ].join('\n'),
      exit_code: 0,
    });
  });

  test('recovers a successful review audit from pend when ask exits nonzero before the provider reply is flushed', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-pend-'));
    try {
      const calls: RecordedCommand[] = [];
      let pendAttempts = 0;
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
          pend_path: '/opt/ccb/bin/pend',
        }),
        runCommand: async (spec) => {
          calls.push(spec);
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }
          if (spec.argv[0] === '/opt/ccb/bin/ask') {
            return {
              exit_code: 1,
              stdout: '',
              stderr: [
                'CCB_REQ_ID: 20260415-000000-000-00000-2',
                '[TIMEOUT] foreground wait ended before provider reply was surfaced',
              ].join('\n'),
            };
          }

          pendAttempts += 1;
          if (pendAttempts === 1) {
            return {
              exit_code: 2,
              stdout: '',
              stderr: 'No reply available yet',
            };
          }

          return {
            exit_code: 0,
            stdout: [
              '# Gemini Audit',
              '',
              'Result: pass',
              '',
              'Findings:',
              '- none',
            ].join('\n'),
            stderr: '',
          };
        },
        sleep: async () => {},
        now: () => '2026-04-08T00:00:00.000Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, null, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
      }));

      expect(calls).toHaveLength(5);
      expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
      expect(calls[1]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'gemini', '--foreground']);
      expect(calls[2]?.argv).toEqual([
        '/opt/ccb/bin/ask',
        'gemini',
        '--foreground',
        '--no-wrap',
        '--timeout',
        '45',
      ]);
      expect(calls[2]?.stdin_text).toContain('exceeded the bounded review soft deadline');
      expect(calls[3]).toMatchObject({
        argv: ['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`],
        cwd: root,
        env: {
          CCB_SESSION_FILE: `${root}/.ccb/.gemini-session`,
          PWD: root,
        },
      });
      expect(calls[4]?.argv).toEqual(['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`]);
      expect(result.outcome).toBe('success');
      expect(result.raw_output).toMatchObject({
        markdown: expect.stringContaining('Result: pass'),
        exit_code: 1,
        request_id: '20260415-000000-000-00000-2',
      });

      const dispatchStatePath = join(root, '.planning/nexus/dispatch/review-gemini-2026-04-08T00-00-00-000Z.json');
      expect(existsSync(dispatchStatePath)).toBe(true);
      expect(JSON.parse(readFileSync(dispatchStatePath, 'utf8'))).toMatchObject({
        schema_version: 3,
        dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
        request_id: '20260415-000000-000-00000-2',
        provider: 'gemini',
        stage: 'review',
        status: 'recovered_late',
        payload_source: 'pend',
        session_root: root,
        session_file: `${root}/.ccb/.gemini-session`,
        execution_workspace: join(root, '.nexus-worktrees/run-123'),
        latency_summary: {
          path: 'watchdog_recovery',
          likely_cause: 'provider_slow',
          foreground_exit: 'timeout',
          finalize_nudge_issued: true,
          pend_attempts: 2,
          recovered_via: 'pend',
        },
      });

      const providerStatePath = join(root, '.planning/nexus/providers.json');
      expect(JSON.parse(readFileSync(providerStatePath, 'utf8'))).toMatchObject({
        providers: {
          gemini: {
            provider: 'gemini',
            session_root: root,
            autonew_ok: true,
            active_dispatch_id: null,
            last_dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
            last_dispatch_stage: 'review',
            last_dispatch_status: 'recovered_late',
            last_request_id: '20260415-000000-000-00000-2',
            last_request_stage: 'review',
            last_request_status: 'recovered_late',
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('retries a Gemini foreground false-start once after session reset and completes in-foreground', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-pend-noreqid-'));
    try {
      const calls: RecordedCommand[] = [];
      const sleepCalls: number[] = [];
      let askAttempts = 0;
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
          pend_path: '/opt/ccb/bin/pend',
        }),
        runCommand: async (spec) => {
          calls.push(spec);
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          if (spec.argv[0] === '/opt/ccb/bin/ask') {
            askAttempts += 1;
            if (askAttempts === 1) {
              return {
                exit_code: 2,
                stdout: 'I will inspect the webhook verification path and owner safeguards before finalizing the audit.',
                stderr: '',
              };
            }

            return {
              exit_code: 0,
              stdout: [
                'CCB_REQ_ID: 20260415-000000-000-00000-3',
                '',
                '# Gemini Audit',
                '',
                'Result: pass',
                '',
                'Findings:',
                '- none',
              ].join('\n'),
              stderr: '',
            };
          }

          throw new Error(`Unexpected command: ${spec.argv.join(' ')}`);
        },
        sleep: async (ms) => {
          sleepCalls.push(ms);
        },
        now: () => '2026-04-08T00:00:00.000Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, null, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
      }));

      expect(calls).toHaveLength(4);
      expect(sleepCalls).toEqual([500, 500]);
      expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
      expect(calls[1]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'gemini', '--foreground']);
      expect(calls[2]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
      expect(calls[3]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'gemini', '--foreground']);
      expect(result.outcome).toBe('success');
      expect(result.raw_output).toMatchObject({
        markdown: expect.stringContaining('Result: pass'),
        exit_code: 0,
        request_id: '20260415-000000-000-00000-3',
      });

      const dispatchStatePath = join(root, '.planning/nexus/dispatch/review-gemini-2026-04-08T00-00-00-000Z.json');
      expect(existsSync(dispatchStatePath)).toBe(true);
      expect(JSON.parse(readFileSync(dispatchStatePath, 'utf8'))).toMatchObject({
        schema_version: 3,
        dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
        request_id: '20260415-000000-000-00000-3',
        provider: 'gemini',
        stage: 'review',
        status: 'completed',
        payload_source: 'ask',
        retry_provenance: {
          reason: 'foreground_false_start',
          retry_count: 1,
          initial_exit_code: 2,
          initial_request_id: null,
          initial_stdout_excerpt: 'I will inspect the webhook verification path and owner safeguards before finalizing the audit.',
        },
        latency_summary: {
          path: 'foreground_retry',
          likely_cause: 'orchestration_false_start',
          foreground_exit: 'success',
          foreground_retry_count: 1,
          finalize_nudge_issued: false,
          pend_attempts: 0,
          recovered_via: 'ask',
        },
      });

      const providerStatePath = join(root, '.planning/nexus/providers.json');
      expect(JSON.parse(readFileSync(providerStatePath, 'utf8'))).toMatchObject({
        providers: {
          gemini: {
            provider: 'gemini',
            active_dispatch_id: null,
            last_dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
            last_dispatch_stage: 'review',
            last_dispatch_status: 'completed',
            last_request_id: '20260415-000000-000-00000-3',
            last_request_stage: 'review',
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('retries a Codex foreground false-start once after session reset and completes in-foreground', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-codex-retry-'));
    try {
      const calls: RecordedCommand[] = [];
      const sleepCalls: number[] = [];
      let askAttempts = 0;
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
          pend_path: '/opt/ccb/bin/pend',
        }),
        runCommand: async (spec) => {
          calls.push(spec);
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          if (spec.argv[0] === '/opt/ccb/bin/ask') {
            askAttempts += 1;
            if (askAttempts === 1) {
              return {
                exit_code: 2,
                stdout: 'I am loading the bounded review scope and repo-visible evidence before finalizing the audit.',
                stderr: '',
              };
            }

            return {
              exit_code: 0,
              stdout: [
                'CCB_REQ_ID: 20260415-000000-000-00000-4',
                '',
                '# Codex Audit',
                '',
                'Result: pass',
                '',
                'Findings:',
                '- none',
              ].join('\n'),
              stderr: '',
            };
          }

          throw new Error(`Unexpected command: ${spec.argv.join(' ')}`);
        },
        sleep: async (ms) => {
          sleepCalls.push(ms);
        },
        now: () => '2026-04-08T00:00:00.000Z',
      });

      const result = await adapter.execute_audit_a(buildContext('review', 'review', REQUESTED_ROUTE, null, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
      }));

      expect(calls).toHaveLength(4);
      expect(sleepCalls).toEqual([250, 250]);
      expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'codex']);
      expect(calls[1]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'codex', '--foreground']);
      expect(calls[2]?.argv).toEqual(['/opt/ccb/bin/autonew', 'codex']);
      expect(calls[3]?.argv.slice(0, 3)).toEqual(['/opt/ccb/bin/ask', 'codex', '--foreground']);
      expect(result.outcome).toBe('success');
      expect(result.raw_output).toMatchObject({
        markdown: expect.stringContaining('Result: pass'),
        exit_code: 0,
        request_id: '20260415-000000-000-00000-4',
      });

      const dispatchStatePath = join(root, '.planning/nexus/dispatch/review-codex-2026-04-08T00-00-00-000Z.json');
      expect(existsSync(dispatchStatePath)).toBe(true);
      expect(JSON.parse(readFileSync(dispatchStatePath, 'utf8'))).toMatchObject({
        schema_version: 3,
        dispatch_id: 'review-codex-2026-04-08T00-00-00-000Z',
        request_id: '20260415-000000-000-00000-4',
        provider: 'codex',
        stage: 'review',
        status: 'completed',
        payload_source: 'ask',
        retry_provenance: {
          reason: 'foreground_false_start',
          retry_count: 1,
          initial_exit_code: 2,
          initial_request_id: null,
          initial_stdout_excerpt: 'I am loading the bounded review scope and repo-visible evidence before finalizing the audit.',
        },
        latency_summary: {
          path: 'foreground_retry',
          likely_cause: 'orchestration_false_start',
          foreground_exit: 'success',
          foreground_retry_count: 1,
          finalize_nudge_issued: false,
          pend_attempts: 0,
          recovered_via: 'ask',
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks review retry when the provider session reset fails', async () => {
    const calls: RecordedCommand[] = [];
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        calls.push(spec);
        return {
          exit_code: 1,
          stdout: '',
          stderr: '[ERROR] could not reset gemini session',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.execute_audit_b(buildContext('review', 'review'));

    expect(calls).toHaveLength(1);
    expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('could not reset gemini session');
  });

  test('issues a review finalize nudge and slow-lane pend recovery after a bounded review soft timeout', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-review-watchdog-'));
    try {
      const calls: RecordedCommand[] = [];
      let pendAttempts = 0;
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
          pend_path: '/opt/ccb/bin/pend',
        }),
        runCommand: async (spec) => {
          calls.push(spec);
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          if (spec.argv[0] === '/opt/ccb/bin/ask' && spec.stdin_text?.includes('Perform the governed Nexus /review audit')) {
            return {
              exit_code: 124,
              stdout: '',
              stderr: '[TIMEOUT] command exceeded 190000ms',
            };
          }

          if (spec.argv[0] === '/opt/ccb/bin/ask') {
            return {
              exit_code: 1,
              stdout: 'I have enough repo-visible evidence and I am finalizing the audit now.',
              stderr: '',
            };
          }

          pendAttempts += 1;
          if (pendAttempts < 3) {
            return {
              exit_code: 2,
              stdout: '',
              stderr: 'No reply available yet',
            };
          }

          return {
            exit_code: 0,
            stdout: [
              '# Gemini Audit',
              '',
              'Result: pass',
              '',
              'Findings:',
              '- none',
              '',
              'Advisories:',
              '- none',
            ].join('\n'),
            stderr: '',
          };
        },
        sleep: async () => {},
        now: () => '2026-04-08T00:00:00.000Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, {
        mode: 'bounded_fix_cycle',
        source_stage: 'review',
        blocking_items: ['Verify the webhook signature fix only.'],
        advisory_policy: 'out_of_scope_advisory',
      }, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
      }));

      expect(result.outcome).toBe('success');
      expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
      expect(calls[1]?.argv).toEqual([
        '/opt/ccb/bin/ask',
        'gemini',
        '--foreground',
        '--no-wrap',
        '--timeout',
        '180',
      ]);
      expect(calls[2]?.argv).toEqual([
        '/opt/ccb/bin/ask',
        'gemini',
        '--foreground',
        '--no-wrap',
        '--timeout',
        '45',
      ]);
      expect(calls[2]?.stdin_text).toContain('exceeded the bounded review soft deadline');
      expect(calls[2]?.stdin_text).toContain('Do not restart the investigation or broaden scope.');
      expect(calls[2]?.stdin_text).toContain('Use the repo-visible evidence already gathered in this session and finalize immediately.');
      expect(calls[3]?.argv).toEqual(['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`]);
      expect(calls[4]?.argv).toEqual(['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`]);
      expect(calls[5]?.argv).toEqual(['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`]);
      expect(result.raw_output).toMatchObject({
        markdown: expect.stringContaining('Result: pass'),
        exit_code: 124,
      });

      const dispatchStatePath = join(root, '.planning/nexus/dispatch/review-gemini-2026-04-08T00-00-00-000Z.json');
      expect(JSON.parse(readFileSync(dispatchStatePath, 'utf8'))).toMatchObject({
        schema_version: 3,
        dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
        status: 'recovered_late',
        payload_source: 'pend',
        latency_summary: {
          path: 'watchdog_recovery',
          likely_cause: 'provider_slow',
          foreground_exit: 'timeout',
          finalize_nudge_issued: true,
          pend_attempts: 3,
          recovered_via: 'pend',
        },
      });

      const providerStatePath = join(root, '.planning/nexus/providers.json');
      expect(JSON.parse(readFileSync(providerStatePath, 'utf8'))).toMatchObject({
        providers: {
          gemini: {
            last_dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
            last_dispatch_status: 'recovered_late',
          },
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('recovers a successful review audit after a silent nonzero ask exit', async () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-ccb-review-silent-'));
    try {
      const calls: RecordedCommand[] = [];
      let pendAttempts = 0;
      const adapter = createRuntimeCcbAdapter({
        resolveSessionRoot: () => root,
        resolveToolPaths: () => ({
          ask_path: '/opt/ccb/bin/ask',
          ping_path: '/opt/ccb/bin/ccb-ping',
          mounted_path: '/opt/ccb/bin/ccb-mounted',
          autonew_path: '/opt/ccb/bin/autonew',
          pend_path: '/opt/ccb/bin/pend',
        }),
        runCommand: async (spec) => {
          calls.push(spec);
          if (spec.argv[0] === '/opt/ccb/bin/autonew') {
            return {
              exit_code: 0,
              stdout: '',
              stderr: '',
            };
          }

          if (spec.argv[0] === '/opt/ccb/bin/ask' && spec.stdin_text?.includes('Perform the governed Nexus /review audit')) {
            return {
              exit_code: 1,
              stdout: '',
              stderr: '',
            };
          }

          if (spec.argv[0] === '/opt/ccb/bin/ask') {
            return {
              exit_code: 1,
              stdout: '',
              stderr: '',
            };
          }

          pendAttempts += 1;
          if (pendAttempts === 1) {
            return {
              exit_code: 2,
              stdout: '',
              stderr: 'No reply available yet',
            };
          }

          return {
            exit_code: 0,
            stdout: [
              '# Gemini Audit',
              '',
              'Result: pass',
              '',
              'Findings:',
              '- none',
              '',
              'Advisories:',
              '- none',
            ].join('\n'),
            stderr: '',
          };
        },
        sleep: async () => {},
        now: () => '2026-04-08T00:00:00.000Z',
      });

      const result = await adapter.execute_audit_b(buildContext('review', 'review', REQUESTED_ROUTE, {
        mode: 'bounded_fix_cycle',
        source_stage: 'review',
        blocking_items: ['Verify the owner mutation serialization fix only.'],
        advisory_policy: 'out_of_scope_advisory',
      }, {
        cwd: root,
        contextWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerWorkspace: {
          path: join(root, '.nexus-worktrees/run-123'),
          kind: 'worktree',
          branch: 'codex/run-123',
          source: 'allocated:fresh_run',
          run_id: 'run-123',
          retirement_state: 'active',
        },
        ledgerSessionRoot: {
          path: root,
          kind: 'repo_root',
          source: 'ccb_root',
        },
      }));

      expect(result.outcome).toBe('success');
      expect(calls[0]?.argv).toEqual(['/opt/ccb/bin/autonew', 'gemini']);
      expect(calls[1]?.argv).toEqual([
        '/opt/ccb/bin/ask',
        'gemini',
        '--foreground',
        '--no-wrap',
        '--timeout',
        '180',
      ]);
      expect(calls[2]?.argv).toEqual([
        '/opt/ccb/bin/ask',
        'gemini',
        '--foreground',
        '--no-wrap',
        '--timeout',
        '45',
      ]);
      expect(calls[3]?.argv).toEqual(['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`]);
      expect(calls[4]?.argv).toEqual(['/opt/ccb/bin/pend', 'gemini', '--session-file', `${root}/.ccb/.gemini-session`]);
      expect(result.raw_output).toMatchObject({
        markdown: expect.stringContaining('Result: pass'),
        exit_code: 1,
        request_id: null,
      });

      const dispatchStatePath = join(root, '.planning/nexus/dispatch/review-gemini-2026-04-08T00-00-00-000Z.json');
      expect(JSON.parse(readFileSync(dispatchStatePath, 'utf8'))).toMatchObject({
        schema_version: 3,
        dispatch_id: 'review-gemini-2026-04-08T00-00-00-000Z',
        status: 'recovered_late',
        payload_source: 'pend',
        latency_summary: {
          path: 'watchdog_recovery',
          likely_cause: 'orchestration_false_start',
          foreground_exit: 'nonzero',
          finalize_nudge_issued: true,
          pend_attempts: 2,
          recovered_via: 'pend',
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('blocks gracefully when the ccb-ping binary is missing instead of throwing', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/missing/ask',
        ping_path: '/missing/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async () => {
        throw new Error('spawn /missing/ccb-ping ENOENT');
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.resolve_route(buildContext('handoff', 'handoff'));

    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('ENOENT');
    expect(result.conflict_candidates[0]).toMatchObject({
      stage: 'handoff',
      adapter: 'ccb',
      kind: 'backend_conflict',
    });
  });

  test('blocks handoff when mounted providers do not include every governed provider required by the route', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async (spec) => {
        if (spec.argv[0] === '/opt/ccb/bin/ccb-ping') {
          return {
            exit_code: 0,
            stdout: `✅ ${spec.argv[1]} connection OK (Session healthy)\n`,
            stderr: '',
          };
        }

        return {
          exit_code: 0,
          stdout: '{"cwd":"/repo/root/.nexus-worktrees/feature","mounted":["codex"]}\n',
          stderr: '',
        };
      },
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const result = await adapter.resolve_route(buildContext('handoff', 'handoff'));

    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('mounted providers do not include gemini');
    expect(result.raw_output).toMatchObject({
      available: false,
      provider: 'codex',
      providers: ['codex', 'gemini'],
      mounted: ['codex'],
    });
  });

  test('blocks qa when CCB returns malformed structured validation output', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async () => ({
        exit_code: 0,
        stdout: '# QA Report\n\nThis is not JSON.\n',
        stderr: '',
      }),
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const requestedRoute: RequestedRouteRecord = {
      ...REQUESTED_ROUTE,
      command: 'qa',
      generator: 'gemini-via-ccb',
      evaluator_a: null,
      evaluator_b: null,
      planner: null,
      synthesizer: null,
    };
    const result = await adapter.execute_qa(buildContext('qa', 'qa', requestedRoute));

    expect(result.outcome).toBe('blocked');
    expect(result.actual_route).toBeNull();
    expect(result.notices[0]).toContain('Malformed QA response');
    expect(result.conflict_candidates[0]).toMatchObject({
      stage: 'qa',
      adapter: 'ccb',
      kind: 'backend_conflict',
    });
  });

  test('extracts the canonical QA JSON object when provider adds trailing prose', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async () => ({
        exit_code: 0,
        stdout: [
          '{"ready":true,"findings":[],"report_markdown":"# QA Report\\n\\nResult: pass\\n"}',
          '',
          'I have responded with the requested message and included the mandatory completion marker as instructed.',
        ].join('\n'),
        stderr: '',
      }),
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const requestedRoute: RequestedRouteRecord = {
      ...REQUESTED_ROUTE,
      command: 'qa',
      generator: 'gemini-via-ccb',
      evaluator_a: null,
      evaluator_b: null,
      planner: null,
      synthesizer: null,
    };
    const result = await adapter.execute_qa(buildContext('qa', 'qa', requestedRoute));

    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      ready: true,
      findings: [],
      report_markdown: '# QA Report\n\nResult: pass',
    });
  });

  test('extracts optional QA advisories from structured provider output', async () => {
    const adapter = createRuntimeCcbAdapter({
      resolveSessionRoot: () => '/repo/root',
      resolveToolPaths: () => ({
        ask_path: '/opt/ccb/bin/ask',
        ping_path: '/opt/ccb/bin/ccb-ping',
        mounted_path: '/opt/ccb/bin/ccb-mounted',
        autonew_path: '/opt/ccb/bin/autonew',
      }),
      runCommand: async () => ({
        exit_code: 0,
        stdout: [
          JSON.stringify({
            ready: true,
            findings: [],
            advisories: ['WorkspaceError is duplicated across module boundaries.'],
            report_markdown: '# QA Report\n\nResult: pass\n\nAdvisories:\n- WorkspaceError is duplicated across module boundaries.\n',
          }),
        ].join('\n'),
        stderr: '',
      }),
      now: () => '2026-04-08T00:00:00.000Z',
    });

    const requestedRoute: RequestedRouteRecord = {
      ...REQUESTED_ROUTE,
      command: 'qa',
      generator: 'gemini-via-ccb',
      evaluator_a: null,
      evaluator_b: null,
      planner: null,
      synthesizer: null,
    };
    const result = await adapter.execute_qa(buildContext('qa', 'qa', requestedRoute));

    expect(result.outcome).toBe('success');
    expect(result.raw_output).toMatchObject({
      ready: true,
      findings: [],
      advisories: ['WorkspaceError is duplicated across module boundaries.'],
    });
  });
});
