import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, test } from 'bun:test';
import { buildReviewAuditPrompt } from '../../lib/nexus/adapters/prompt-contracts';
import { CANONICAL_MANIFEST } from '../../lib/nexus/command-manifest';
import { runReviewWithWriteAtomicFile } from '../../lib/nexus/commands/review';
import {
  reviewAdvisoriesPath,
  reviewAdvisoryDispositionPath,
  reviewLearningCandidatesPath,
  reviewAttemptAuditMarkdownPath,
  reviewAttemptAuditReceiptPath,
} from '../../lib/nexus/artifacts';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus review', () => {
  test('runs governed dual-audit review and writes nested audit provenance', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const calls: string[] = [];
      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => {
            calls.push('discipline');
            return {
              adapter_id: 'execution',
              outcome: 'success',
              raw_output: {
                discipline_summary: 'Verification-before-completion passed',
              },
              requested_route: null,
              actual_route: null,
              notices: [],
              conflict_candidates: [],
              traceability: {
                nexus_stage_pack: 'nexus-review-pack',
                absorbed_capability: 'superpowers-review-discipline',
                source_map: ['vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md'],
              },
            };
          },
        },
        ccb: {
          execute_audit_a: async (ctx) => {
            calls.push('audit_a');
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Codex Audit\n\nResult: pass\n',
                receipt: 'codex-review-receipt',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'codex',
                route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
              traceability: {
                nexus_stage_pack: 'nexus-review-pack',
                absorbed_capability: 'ccb-review-codex',
                source_map: ['vendor/upstream/claude-code-bridge/lib/codex_comm.py'],
              },
            };
          },
          execute_audit_b: async (ctx) => {
            calls.push('audit_b');
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Gemini Audit\n\nResult: pass\n',
                receipt: 'gemini-review-receipt',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'gemini',
                route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
              traceability: {
                nexus_stage_pack: 'nexus-review-pack',
                absorbed_capability: 'ccb-review-gemini',
                source_map: ['vendor/upstream/claude-code-bridge/lib/gemini_comm.py'],
              },
            };
          },
        },
      });

      await run('review', adapters);

      const buildStatus = await run.readJson('.planning/current/build/status.json');
      const ledger = await run.readJson('.planning/nexus/current-run.json');
      const reviewStatus = await run.readJson('.planning/current/review/status.json');
      const reviewAttemptId = reviewStatus.review_attempt_id as string;
      expect(calls).toEqual(['discipline', 'audit_a', 'audit_b']);
      expect(reviewStatus).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        review_complete: true,
        audit_set_complete: true,
        provenance_consistent: true,
        gate_decision: 'pass',
        learning_candidates_path: null,
        learnings_recorded: false,
        requested_route: buildStatus.requested_route,
        actual_route: buildStatus.actual_route,
        review_attempt_id: expect.any(String),
      });
      expect(existsSync(join(cwd, reviewLearningCandidatesPath()))).toBe(false);
      expect(ledger.artifact_index[reviewLearningCandidatesPath()]).toBeUndefined();
      expect(
        readdirSync(join(cwd, '.planning/current/review/attempts', reviewAttemptId)).sort(),
      ).toEqual(['codex.json', 'codex.md', 'gemini.json', 'gemini.md']);

      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain('Verification-before-completion passed');
      expect(await run.readJson('.planning/current/review/adapter-output.json')).toMatchObject({
        discipline: {
          adapter_id: 'execution',
          outcome: 'success',
          traceability: {
            nexus_stage_pack: 'nexus-review-pack',
            absorbed_capability: 'superpowers-review-discipline',
          },
        },
        audit_a: {
          adapter_id: 'ccb',
          outcome: 'success',
          traceability: {
            nexus_stage_pack: 'nexus-review-pack',
            absorbed_capability: 'ccb-review-codex',
          },
        },
        audit_b: {
          adapter_id: 'ccb',
          outcome: 'success',
          traceability: {
            nexus_stage_pack: 'nexus-review-pack',
            absorbed_capability: 'ccb-review-gemini',
          },
        },
      });

      const meta = await run.readJson('.planning/audits/current/meta.json');
      expect(meta).toMatchObject({
        run_id: expect.any(String),
        implementation: {
          path: expect.any(String),
          requested_route: buildStatus.requested_route,
          actual_route: buildStatus.actual_route,
        },
        audits: {
          codex: {
            provider: 'codex',
            path: '.planning/audits/current/codex.md',
            requested_route: {
              provider: 'codex',
              route: buildStatus.requested_route.evaluator_a,
              substrate: buildStatus.requested_route.substrate,
              transport: 'ccb',
            },
            actual_route: {
              provider: 'codex',
              route: buildStatus.requested_route.evaluator_a,
              substrate: buildStatus.requested_route.substrate,
              transport: 'ccb',
            },
            receipt_markdown_path: reviewAttemptAuditMarkdownPath(reviewAttemptId, 'codex'),
            receipt_record_path: reviewAttemptAuditReceiptPath(reviewAttemptId, 'codex'),
          },
          gemini: {
            provider: 'gemini',
            path: '.planning/audits/current/gemini.md',
            requested_route: {
              provider: 'gemini',
              route: buildStatus.requested_route.evaluator_b,
              substrate: buildStatus.requested_route.substrate,
              transport: 'ccb',
            },
            actual_route: {
              provider: 'gemini',
              route: buildStatus.requested_route.evaluator_b,
              substrate: buildStatus.requested_route.substrate,
              transport: 'ccb',
            },
            receipt_markdown_path: reviewAttemptAuditMarkdownPath(reviewAttemptId, 'gemini'),
            receipt_record_path: reviewAttemptAuditReceiptPath(reviewAttemptId, 'gemini'),
          },
        },
        review_discipline: {
          adapter: 'superpowers',
          summary: 'Verification-before-completion passed',
        },
      });
      expect(existsSync(join(cwd, meta.audits.codex.receipt_markdown_path))).toBe(true);
      expect(existsSync(join(cwd, meta.audits.codex.receipt_record_path))).toBe(true);
      expect(existsSync(join(cwd, meta.audits.gemini.receipt_markdown_path))).toBe(true);
      expect(existsSync(join(cwd, meta.audits.gemini.receipt_record_path))).toBe(true);
    });
  });

  test('writes optional learning candidates when audit raw outputs include valid candidates', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const candidateA = {
        type: 'pitfall' as const,
        key: 'serialize-owner-mutations',
        insight: 'Concurrent owner updates should serialize through the database layer.',
        confidence: 8,
        source: 'observed' as const,
        files: ['apps/web/src/server/workspaces/service.ts'],
      };
      const candidateB = {
        type: 'pattern' as const,
        key: 'prefer-explicit-review-scopes',
        insight: 'Bounded review scopes reduce false failures during fix cycles.',
        confidence: 7,
        source: 'inferred' as const,
        files: ['lib/nexus/review-scope.ts'],
      };

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'superpowers-review-discipline',
              source_map: ['vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md'],
            },
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n',
              receipt: 'codex-review-receipt',
              learning_candidates: [candidateA, { ...candidateA, key: ' ', insight: '' }],
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-codex',
              source_map: ['vendor/upstream/claude-code-bridge/lib/codex_comm.py'],
            },
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n',
              receipt: 'gemini-review-receipt',
              learning_candidates: [candidateA, candidateB],
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-gemini',
              source_map: ['vendor/upstream/claude-code-bridge/lib/gemini_comm.py'],
            },
          }),
        },
      });

      await run('review', adapters);

      const learningCandidatesPath = reviewLearningCandidatesPath();
      const status = await run.readJson('.planning/current/review/status.json');
      const ledger = await run.readJson('.planning/nexus/current-run.json');
      const candidates = await run.readJson(learningCandidatesPath);

      expect(status).toMatchObject({
        learning_candidates_path: learningCandidatesPath,
        learnings_recorded: true,
      });
      expect(status.outputs).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: learningCandidatesPath })]),
      );
      expect(ledger.artifact_index).toMatchObject({
        [learningCandidatesPath]: {
          kind: 'json',
          path: learningCandidatesPath,
        },
      });
      expect(candidates).toMatchObject({
        schema_version: 1,
        stage: 'review',
        candidates: [candidateA, candidateB],
      });
    });
  });

  test('dispatches codex and gemini audits in parallel after review discipline succeeds', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      let auditBStarted = false;
      let auditBObservedBeforeAuditACompleted = false;

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'superpowers-review-discipline',
              source_map: ['vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md'],
            },
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => {
            await new Promise((resolve) => setTimeout(resolve, 25));
            auditBObservedBeforeAuditACompleted = auditBStarted;
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Codex Audit\n\nResult: pass\n',
                receipt: 'codex-review-receipt',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'codex',
                route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
              traceability: {
                nexus_stage_pack: 'nexus-review-pack',
                absorbed_capability: 'ccb-review-codex',
                source_map: ['vendor/upstream/claude-code-bridge/lib/codex_comm.py'],
              },
            };
          },
          execute_audit_b: async (ctx) => {
            auditBStarted = true;
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Gemini Audit\n\nResult: pass\n',
                receipt: 'gemini-review-receipt',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'gemini',
                route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
              traceability: {
                nexus_stage_pack: 'nexus-review-pack',
                absorbed_capability: 'ccb-review-gemini',
                source_map: ['vendor/upstream/claude-code-bridge/lib/gemini_comm.py'],
              },
            };
          },
        },
      });

      await run('review', adapters);

      expect(auditBObservedBeforeAuditACompleted).toBe(true);
      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        gate_decision: 'pass',
      });
    });
  });

  test('review passes the approved design contract as predecessor provenance when present', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      writeFileSync(
        join(cwd, '.planning/current/plan/status.json'),
        JSON.stringify(
          {
            ...(await run.readJson('.planning/current/plan/status.json')),
            design_impact: 'material',
            design_contract_required: true,
            design_contract_path: '.planning/current/plan/design-contract.md',
            design_verified: false,
          },
          null,
          2,
        ) + '\n',
      );
      writeFileSync(
        join(cwd, '.planning/current/plan/design-contract.md'),
        '# Design Contract\n\nApproved material UI contract\n',
      );

      const buildStatusPath = join(cwd, '.planning/current/build/status.json');
      const buildStatus = JSON.parse(readFileSync(buildStatusPath, 'utf8'));
      buildStatus.inputs = [
        ...(buildStatus.inputs ?? []),
        { kind: 'markdown', path: '.planning/current/plan/design-contract.md' },
      ];
      writeFileSync(buildStatusPath, JSON.stringify(buildStatus, null, 2) + '\n');

      const seen: string[][] = [];
      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => {
            seen.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                receipt: 'codex-review-receipt',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'codex',
                route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
          execute_audit_b: async (ctx) => {
            seen.push(ctx.predecessor_artifacts.map((artifact) => artifact.path));
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- none\n',
                receipt: 'gemini-review-receipt',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'gemini',
                route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('review', adapters);

      expect(seen).toHaveLength(2);
      for (const paths of seen) {
        expect(paths).toEqual(expect.arrayContaining([
          '.planning/current/build/status.json',
          '.planning/current/handoff/governed-handoff.md',
          '.planning/current/plan/execution-readiness-packet.md',
          '.planning/current/plan/sprint-contract.md',
          '.planning/current/plan/verification-matrix.json',
          '.planning/current/plan/design-contract.md',
        ]));
      }
      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        design_impact: 'material',
        design_contract_required: true,
        design_contract_path: '.planning/current/plan/design-contract.md',
        design_verified: false,
      });
    });
  });

  test('design-bearing review prompt requires advisories without broadening into open-ended critique', () => {
    const prompt = buildReviewAuditPrompt(
      {
        cwd: '/repo',
        workspace: null,
        run_id: 'run-1',
        command: 'review',
        stage: 'review',
        ledger: {
          run_id: 'run-1',
          continuation_mode: 'phase',
          status: 'active',
          current_command: 'review',
          current_stage: 'review',
          previous_stage: 'build',
          allowed_next_stages: ['qa', 'ship', 'closeout'],
          command_history: [],
          artifact_index: {},
          execution: {
            mode: 'governed_ccb',
            primary_provider: 'codex',
            provider_topology: 'multi_session',
            requested_path: 'codex-via-ccb',
            actual_path: 'codex-via-ccb',
          },
          route_intent: {
            planner: 'claude+pm-gsd',
            generator: 'codex-via-ccb',
            evaluator_a: 'codex-via-ccb',
            evaluator_b: 'gemini-via-ccb',
            synthesizer: 'claude',
            substrate: 'superpowers-core',
            fallback_policy: 'disabled',
          },
        },
        manifest: CANONICAL_MANIFEST.review,
        predecessor_artifacts: [
          { kind: 'json', path: '.planning/current/build/status.json' },
          { kind: 'markdown', path: '.planning/current/handoff/governed-handoff.md' },
          { kind: 'markdown', path: '.planning/current/plan/execution-readiness-packet.md' },
          { kind: 'markdown', path: '.planning/current/plan/sprint-contract.md' },
          { kind: 'markdown', path: '.planning/current/plan/design-contract.md' },
        ],
        requested_route: {
          command: 'build',
          governed: true,
          execution_mode: 'governed_ccb',
          primary_provider: 'codex',
          provider_topology: 'multi_session',
          planner: 'claude+pm-gsd',
          generator: 'codex-via-ccb',
          evaluator_a: 'codex-via-ccb',
          evaluator_b: 'gemini-via-ccb',
          synthesizer: 'claude',
          substrate: 'superpowers-core',
          transport: 'ccb',
          fallback_policy: 'disabled',
        },
        review_scope: {
          mode: 'full_acceptance',
          source_stage: 'plan',
          blocking_items: [],
          advisory_policy: 'out_of_scope_advisory',
        },
      },
      'Nexus governed stage',
      'Perform the governed Nexus /review audit for the gemini path.',
      '# Gemini Audit',
    );

    expect(prompt).toContain('This is a design-bearing review. The approved design contract is .planning/current/plan/design-contract.md.');
    expect(prompt).toContain('Do not turn this review into open-ended design critique.');
    expect(prompt).toContain('Additional visual concerns are advisories unless they show a clear contract violation.');
    expect(prompt).toContain('Advisories:');
  });

  test('writes review advisories and an unresolved disposition record when review passes with advisories', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- Identifier is not visibly sortable.\n- The implementation has duplicated branching and should be simplified without behavior changes.\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n\nAdvisories:\n- Build warning about multiple lockfiles.\n- Security-sensitive auth flow deserves a follow-up hardening pass.\n- New frontend data loading may need performance measurement.\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', adapters);

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        gate_decision: 'pass',
        ready: true,
        advisory_count: 5,
        advisory_categories: ['maintainability', 'performance', 'security'],
        advisories_path: reviewAdvisoriesPath(),
        advisory_disposition: null,
        advisory_disposition_path: reviewAdvisoryDispositionPath(),
      });
      expect(await run.readJson(reviewAdvisoriesPath())).toMatchObject({
        advisories: [
          'Identifier is not visibly sortable.',
          'The implementation has duplicated branching and should be simplified without behavior changes.',
          'Build warning about multiple lockfiles.',
          'Security-sensitive auth flow deserves a follow-up hardening pass.',
          'New frontend data loading may need performance measurement.',
        ],
        categories: ['maintainability', 'performance', 'security'],
      });
      expect(await run.readJson(reviewAdvisoryDispositionPath())).toMatchObject({
        selected: null,
        advisory_count: 5,
      });
    });
  });

  test('counts inline ADVISORY finding bullets as review advisories', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: [
                '# Gemini Audit',
                '',
                'Result: pass',
                '',
                'Findings:',
                '- ADVISORY (medium): project-open status refresh should be scheduled for Sprint 2.',
                '- ADVISORY (low): build-request design_impact should be reconciled with DESIGN.md.',
                '- INFO: all blocking gates pass.',
              ].join('\n'),
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', adapters);

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        gate_decision: 'pass',
        ready: true,
        advisory_count: 2,
        advisories_path: reviewAdvisoriesPath(),
      });
      expect(await run.readJson(reviewAdvisoriesPath())).toMatchObject({
        advisories: [
          'project-open status refresh should be scheduled for Sprint 2.',
          'build-request design_impact should be reconciled with DESIGN.md.',
        ],
      });
    });
  });

  test('default review discipline summary carries Nexus-owned absorbed review guidance', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain(
        'Nexus-owned review guidance for governed dual-audit completion, synthesis, and explicit gate state.',
      );
      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain(
        'run dual audits through Nexus-owned review completion',
      );
      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain(
        'Advance to `/qa`, `/ship`, or `/closeout` only through Nexus-authored review completion state.',
      );
    });
  });

  test('default review audits carry Nexus-owned absorbed review guidance', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      expect(await run.readFile('.planning/audits/current/codex.md')).toContain(
        'Nexus-owned review guidance for governed dual-audit completion, synthesis, and explicit gate state.',
      );
      expect(await run.readFile('.planning/audits/current/codex.md')).toContain(
        'run dual audits through Nexus-owned review completion',
      );
      expect(await run.readFile('.planning/audits/current/gemini.md')).toContain(
        'Superpowers review discipline and CCB dual-audit transport remain subordinate runtime seams and never own lifecycle authority.',
      );
    });
  });

  test('blocks material review when required design contract provenance is missing', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      writeFileSync(
        join(cwd, '.planning/current/plan/status.json'),
        JSON.stringify(
          {
            ...(await run.readJson('.planning/current/plan/status.json')),
            design_impact: 'material',
            design_contract_required: true,
            design_contract_path: '.planning/current/plan/design-contract.md',
            design_verified: false,
          },
          null,
          2,
        ) + '\n',
      );
      writeFileSync(
        join(cwd, '.planning/current/plan/design-contract.md'),
        '# Design Contract\n\nApproved material UI contract\n',
      );

      const buildStatusPath = join(cwd, '.planning/current/build/status.json');
      const buildStatus = JSON.parse(readFileSync(buildStatusPath, 'utf8'));
      buildStatus.inputs = (buildStatus.inputs ?? []).filter(
        (artifact: { path?: string }) => artifact.path !== '.planning/current/plan/design-contract.md',
      );
      writeFileSync(buildStatusPath, JSON.stringify(buildStatus, null, 2) + '\n');

      await expect(run('review')).rejects.toThrow(
        'Build inputs are missing required design contract provenance for a material design-bearing run',
      );

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'blocked',
        ready: false,
        gate_decision: 'blocked',
        design_impact: 'material',
        design_contract_required: true,
        design_contract_path: '.planning/current/plan/design-contract.md',
        design_verified: false,
        errors: ['Build inputs are missing required design contract provenance for a material design-bearing run'],
      });
      expect(existsSync(join(cwd, '.planning/audits/current/codex.md'))).toBe(false);
      expect(existsSync(join(cwd, '.planning/audits/current/gemini.md'))).toBe(false);
    });
  });

  test('records a failing review gate and leaves the work unit in fix-cycle state', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'superpowers-review-discipline',
              source_map: ['vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md'],
            },
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Generate and commit the missing Drizzle migration.\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-codex',
              source_map: ['vendor/upstream/claude-code-bridge/lib/codex_comm.py'],
            },
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-gemini',
              source_map: ['vendor/upstream/claude-code-bridge/lib/gemini_comm.py'],
            },
          }),
        },
      });

      await run('review', adapters);

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        ready: false,
        gate_decision: 'fail',
        review_complete: true,
        audit_set_complete: true,
        provenance_consistent: true,
        errors: ['Review gate failed; fix cycle required before QA, ship, or closeout'],
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: ['Generate and commit the missing Drizzle migration.'],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readFile('.planning/audits/current/gate-decision.md')).toContain('Gate: fail');
      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain('Result: fix cycle required');
      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: ['Generate and commit the missing Drizzle migration.'],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'review',
        allowed_next_stages: ['build', 'review'],
      });

      await expect(run('qa')).rejects.toThrow('Review must be completed before QA');
      expect(await run.readFile('.planning/current/review/status.json')).toContain('"gate_decision": "fail"');
    });
  });

  test('blocks review when an audit route diverges from the requested governed route', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'superpowers-review-discipline',
              source_map: ['vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md'],
            },
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-codex',
              source_map: ['vendor/upstream/claude-code-bridge/lib/codex_comm.py'],
            },
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: 'gemini-direct',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-gemini',
              source_map: ['vendor/upstream/claude-code-bridge/lib/gemini_comm.py'],
            },
          }),
        },
      });

      await expect(run('review', adapters)).rejects.toThrow('Requested and actual audit route diverged');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'blocked',
        ready: false,
        provenance_consistent: false,
      });
      expect(await run.readJson('.planning/current/conflicts/review-ccb.json')).toMatchObject({
        stage: 'review',
        adapter: 'ccb',
        kind: 'route_mismatch',
        message: 'Requested and actual audit route diverged',
      });
    });
  });

  test('falls back to the canonical build route when a QA fix-cycle build left QA routing in build status', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const buildStatusPath = join(cwd, '.planning/current/build/status.json');
      const corruptedBuildStatus = JSON.parse(readFileSync(buildStatusPath, 'utf8'));
      writeFileSync(
        buildStatusPath,
        JSON.stringify(
          {
            ...corruptedBuildStatus,
            requested_execution_path: 'gemini-via-ccb',
            actual_execution_path: 'gemini-via-ccb',
            requested_route: {
              command: 'qa',
              governed: true,
              execution_mode: 'governed_ccb',
              primary_provider: 'codex',
              provider_topology: 'multi_session',
              planner: null,
              generator: 'gemini-via-ccb',
              evaluator_a: null,
              evaluator_b: null,
              synthesizer: null,
              substrate: 'superpowers-core',
              transport: 'ccb',
              fallback_policy: 'disabled',
            },
            actual_route: {
              provider: 'gemini',
              route: 'gemini-via-ccb',
              substrate: 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
          },
          null,
          2,
        ) + '\n',
      );

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'superpowers-review-discipline',
              source_map: ['vendor/upstream/superpowers/skills/verification-before-completion/SKILL.md'],
            },
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-codex',
              source_map: ['vendor/upstream/claude-code-bridge/lib/codex_comm.py'],
            },
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
            traceability: {
              nexus_stage_pack: 'nexus-review-pack',
              absorbed_capability: 'ccb-review-gemini',
              source_map: ['vendor/upstream/claude-code-bridge/lib/gemini_comm.py'],
            },
          }),
        },
      });

      await run('review', adapters);

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        ready: true,
        gate_decision: 'pass',
      });
      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        audits: {
          codex: {
            requested_route: {
              provider: 'codex',
              route: 'codex-via-ccb',
            },
          },
          gemini: {
            requested_route: {
              provider: 'gemini',
              route: 'gemini-via-ccb',
            },
          },
        },
      });
    });
  });

  test('blocks review when canonical audit writeback partially fails', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters();

      await expect(
        runReviewWithWriteAtomicFile(
          {
            cwd,
            clock: () => new Date().toISOString(),
            via: null,
            adapters,
          },
          (targetCwd, relativePath, content) => {
            if (relativePath === '.planning/audits/current/synthesis.md') {
              throw new Error('disk full');
            }

            const absolutePath = join(targetCwd, relativePath);
            const tempPath = `${absolutePath}.tmp`;
            mkdirSync(dirname(absolutePath), { recursive: true });
            writeFileSync(tempPath, content);
            renameSync(tempPath, absolutePath);
          },
        ),
      ).rejects.toThrow('Canonical writeback failed');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'blocked',
        ready: false,
      });
      expect(await run.readJson('.planning/current/conflicts/review-normalizer.json')).toMatchObject({
        stage: 'review',
        adapter: 'normalizer',
        kind: 'partial_write_failure',
      });
    });
  });

  test('allows a failing review gate to rerun review directly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const failingReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: fail\n\nFindings:\n- stale audit\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', failingReviewAdapters);

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'review',
        previous_stage: 'build',
        allowed_next_stages: ['build', 'review'],
      });

      await run('review');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        ready: true,
        gate_decision: 'pass',
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'active',
        current_stage: 'review',
        previous_stage: 'build',
        command_history: [
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          {
            command: 'review',
            at: expect.any(String),
            via: 'retry',
          },
        ],
      });
      expect(await run.readFile('.planning/audits/current/gemini.md')).toContain('Result: pass');
    });
  });

  test('allows a blocked review to retry review directly', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const blockedReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'codex-review-receipt',
              request_id: 'codex-review-request-1',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async () => ({
            adapter_id: 'ccb',
            outcome: 'blocked',
            raw_output: {
              markdown: '',
              receipt: '',
              request_id: 'gemini-review-request-1',
            },
            requested_route: null,
            actual_route: null,
            notices: ['Gemini review session reset failed'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('review', blockedReviewAdapters)).rejects.toThrow('CCB gemini audit blocked review');

      const blockedStatus = await run.readJson('.planning/current/review/status.json');
      expect(blockedStatus).toMatchObject({
        review_attempt_id: expect.any(String),
        audit_request_ids: {
          codex: 'codex-review-request-1',
          gemini: 'gemini-review-request-1',
        },
      });
      const firstAttemptId = blockedStatus.review_attempt_id;

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'review',
        previous_stage: 'build',
        allowed_next_stages: ['review'],
      });

      await run('review');

      const retriedStatus = await run.readJson('.planning/current/review/status.json');
      expect(retriedStatus).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        ready: true,
        gate_decision: 'pass',
        review_attempt_id: expect.any(String),
        audit_request_ids: {
          codex: null,
          gemini: null,
        },
      });
      expect(retriedStatus.review_attempt_id).not.toBe(firstAttemptId);
      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        review_attempt_id: retriedStatus.review_attempt_id,
        audits: {
          codex: {
            request_id: null,
            receipt: expect.any(String),
          },
          gemini: {
            request_id: null,
            receipt: expect.any(String),
          },
        },
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        command_history: [
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          expect.any(Object),
          {
            command: 'review',
            at: expect.any(String),
            via: 'retry',
          },
        ],
      });
    });
  });

  test('clears stale current audits when a review retry blocks before the audit set completes', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const failingReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Fix the webhook signature verification.\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', failingReviewAdapters);
      expect(existsSync(join(cwd, '.planning/audits/current/codex.md'))).toBe(true);
      expect(existsSync(join(cwd, '.planning/audits/current/gemini.md'))).toBe(true);

      const blockedReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Fix the webhook signature verification.\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async () => ({
            adapter_id: 'ccb',
            outcome: 'blocked',
            raw_output: {
              markdown: '',
              receipt: '',
            },
            requested_route: null,
            actual_route: null,
            notices: ['Gemini review session reset failed'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('review', blockedReviewAdapters)).rejects.toThrow('CCB gemini audit blocked review');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'blocked',
        ready: false,
        review_complete: false,
        audit_set_complete: false,
        gate_decision: 'blocked',
      });
      expect(existsSync(join(cwd, '.planning/audits/current/codex.md'))).toBe(false);
      expect(existsSync(join(cwd, '.planning/audits/current/gemini.md'))).toBe(false);
      expect(existsSync(join(cwd, '.planning/audits/current/synthesis.md'))).toBe(false);
      expect(existsSync(join(cwd, '.planning/audits/current/gate-decision.md'))).toBe(false);
      expect(existsSync(join(cwd, '.planning/audits/current/meta.json'))).toBe(false);
      expect(existsSync(join(cwd, reviewLearningCandidatesPath()))).toBe(false);
      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        status: 'blocked',
        current_stage: 'review',
        allowed_next_stages: ['review'],
      });
      expect(await run.readJson('.planning/nexus/current-run.json')).not.toMatchObject({
        artifact_index: expect.objectContaining({
          '.planning/audits/current/codex.md': expect.anything(),
          [reviewLearningCandidatesPath()]: expect.anything(),
        }),
      });
    });
  });

  test('surfaces human-readable latency diagnostics when a CCB review audit blocks', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const blockedReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async () => ({
            adapter_id: 'ccb',
            outcome: 'blocked',
            raw_output: {
              markdown: '',
              receipt: '',
              latency_summary: {
                path: 'watchdog_recovery',
                likely_cause: 'provider_slow',
                foreground_exit: 'timeout',
                foreground_retry_count: 0,
                finalize_nudge_issued: true,
                pend_attempts: 2,
                recovered_via: null,
              },
            },
            requested_route: null,
            actual_route: null,
            notices: ['Gemini review timed out'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('review', blockedReviewAdapters)).rejects.toThrow('CCB gemini audit blocked review');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        state: 'blocked',
        errors: [
          expect.stringContaining('cause=provider slow'),
        ],
      });
      expect(await run.readJson('.planning/current/review/adapter-output.json')).toMatchObject({
        latency_diagnostics: {
          audit_a: null,
          audit_b: expect.stringContaining('cause=provider slow'),
        },
      });
    });
  });

  test('clears stale learning candidates when a review retry is refused before audits run', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const candidate = {
        type: 'pitfall' as const,
        key: 'serialize-owner-mutations',
        insight: 'Concurrent owner updates should serialize through the database layer.',
        confidence: 8,
        source: 'observed' as const,
        files: ['apps/web/src/server/workspaces/service.ts'],
      };

      const learningReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Fix the owner mutation race.\n',
              receipt: 'codex-review-receipt',
              learning_candidates: [candidate],
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', learningReviewAdapters);
      expect(existsSync(join(cwd, reviewLearningCandidatesPath()))).toBe(true);
      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        gate_decision: 'fail',
      });

      const refusedReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'refused',
            raw_output: {
              discipline_summary: 'Verification-before-completion refused',
            },
            requested_route: null,
            actual_route: null,
            notices: ['Review discipline refused retry'],
            conflict_candidates: [],
          }),
        },
      });

      await expect(run('review', refusedReviewAdapters)).rejects.toThrow('Superpowers review discipline refused review');

      expect(existsSync(join(cwd, reviewLearningCandidatesPath()))).toBe(false);
      const refusedStatus = await run.readJson('.planning/current/review/status.json');
      expect(refusedStatus).toMatchObject({
        stage: 'review',
        state: 'refused',
        gate_decision: 'blocked',
      });
      expect(refusedStatus.learning_candidates_path).toBeUndefined();
      expect(refusedStatus.learnings_recorded).toBeUndefined();
      expect(await run.readJson('.planning/nexus/current-run.json')).not.toMatchObject({
        artifact_index: expect.objectContaining({
          [reviewLearningCandidatesPath()]: expect.anything(),
        }),
      });
    });
  });

  test('recovers bounded fix-cycle scope for review when a stale build contract omits review_scope', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const failingReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Codex Audit\n\nResult: fail\n\nFindings:\n- Generate and commit the missing Drizzle migration.\n',
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_generator: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              receipt: 'ccb-build-fix-cycle',
              summary_markdown: [
                '# Build Execution Summary',
                '',
                '- Status: completed',
                '- Actions: Applied the bounded fix items from the failing review gate.',
                '- Files touched: packages/db/drizzle/',
                '- Verification: Verified the fix cycle changed repository implementation state.',
              ].join('\n'),
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.generator ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/build/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', failingReviewAdapters);
      await run('build', failingReviewAdapters);

      const staleBuildStatusPath = join(cwd, '.planning/current/build/status.json');
      const staleBuildStatus = await run.readJson('.planning/current/build/status.json');
      delete staleBuildStatus.review_scope;
      writeFileSync(staleBuildStatusPath, JSON.stringify(staleBuildStatus, null, 2) + '\n');

      const recoveredScopeCalls: Array<{ provider: 'codex' | 'gemini'; reviewScope: unknown }> = [];
      const recoveredReviewAdapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => {
            recoveredScopeCalls.push({ provider: 'codex', reviewScope: ctx.review_scope });
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Codex Audit\n\nResult: pass\n\nFindings:\n- none\n',
                receipt: 'codex-review-pass',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'codex',
                route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
          execute_audit_b: async (ctx) => {
            recoveredScopeCalls.push({ provider: 'gemini', reviewScope: ctx.review_scope });
            return {
              adapter_id: 'ccb',
              outcome: 'success',
              raw_output: {
                markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
                receipt: 'gemini-review-pass',
              },
              requested_route: ctx.requested_route,
              actual_route: {
                provider: 'gemini',
                route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
                substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
                transport: 'ccb',
                receipt_path: '.planning/current/review/adapter-output.json',
              },
              notices: [],
              conflict_candidates: [],
            };
          },
        },
      });

      await run('review', recoveredReviewAdapters);

      expect(recoveredScopeCalls).toEqual([
        {
          provider: 'codex',
          reviewScope: {
            mode: 'bounded_fix_cycle',
            source_stage: 'review',
            blocking_items: ['Generate and commit the missing Drizzle migration.'],
            advisory_policy: 'out_of_scope_advisory',
          },
        },
        {
          provider: 'gemini',
          reviewScope: {
            mode: 'bounded_fix_cycle',
            source_stage: 'review',
            blocking_items: ['Generate and commit the missing Drizzle migration.'],
            advisory_policy: 'out_of_scope_advisory',
          },
        },
      ]);
      expect(await run.readJson('.planning/current/review/adapter-request.json')).toMatchObject({
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: ['Generate and commit the missing Drizzle migration.'],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        ready: true,
        gate_decision: 'pass',
      });
    });
  });

  test('uses the final canonical review verdict when audit markdown contains an earlier misleading Result line', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters({
        execution: {
          review_discipline: async () => ({
            adapter_id: 'execution',
            outcome: 'success',
            raw_output: {
              discipline_summary: 'Verification-before-completion passed',
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
          }),
        },
        ccb: {
          execute_audit_a: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: [
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
              receipt: 'codex-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'codex',
              route: ctx.requested_route?.evaluator_a ?? 'codex-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
          execute_audit_b: async (ctx) => ({
            adapter_id: 'ccb',
            outcome: 'success',
            raw_output: {
              markdown: '# Gemini Audit\n\nResult: pass\n\nFindings:\n- none\n',
              receipt: 'gemini-review-receipt',
            },
            requested_route: ctx.requested_route,
            actual_route: {
              provider: 'gemini',
              route: ctx.requested_route?.evaluator_b ?? 'gemini-via-ccb',
              substrate: ctx.requested_route?.substrate ?? 'superpowers-core',
              transport: 'ccb',
              receipt_path: '.planning/current/review/adapter-output.json',
            },
            notices: [],
            conflict_candidates: [],
          }),
        },
      });

      await run('review', adapters);

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        gate_decision: 'fail',
        ready: false,
      });
      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain('Codex audit result: fail');
      expect(await run.readFile('.planning/audits/current/gate-decision.md')).toContain('Gate: fail');
    });
  });

  test('normalizes duplicated inherited fix-cycle scope before persisting a passing review', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const buildStatusPath = join(cwd, '.planning/current/build/status.json');
      const buildStatus = await run.readJson('.planning/current/build/status.json');
      buildStatus.review_scope = {
        mode: 'bounded_fix_cycle',
        source_stage: 'review',
        blocking_items: [
          'Phase 1 task `1.2` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:50-55` requires a seed script for development data, but the repo-visible database scripts still stop at generate/migrate.',
          'Phase 1 task `1.2` is incomplete: Verified that there is no seed script for development data in the repository.',
          'Phase 1 task `1.5` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:67-70` requires a separate worker deployment pipeline, but the only GitHub workflow is CI.',
          'Phase 1 task `1.5` is incomplete: No separate worker deployment pipeline exists.',
          'The Phase 1 exit criterion for the web shell is still not met. `.planning/current/plan/execution-readiness-packet.md:77-82` requires `npm run dev` to show a blank page at localhost, but `apps/web/src/app/page.tsx` renders a styled foundation landing page instead.',
          'Exit criterion missed: `apps/web/src/app/page.tsx` renders a fully designed foundation landing page, failing the Phase 1 exit criterion which explicitly requires `npm run dev` to show a blank page at localhost.',
        ],
        advisory_policy: 'out_of_scope_advisory',
      };
      writeFileSync(buildStatusPath, JSON.stringify(buildStatus, null, 2) + '\n');

      await run('review');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        ready: true,
        gate_decision: 'pass',
        review_scope: {
          mode: 'bounded_fix_cycle',
          source_stage: 'review',
          blocking_items: [
            'Phase 1 task `1.2` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:50-55` requires a seed script for development data, but the repo-visible database scripts still stop at generate/migrate.',
            'Phase 1 task `1.5` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:67-70` requires a separate worker deployment pipeline, but the only GitHub workflow is CI.',
            'The Phase 1 exit criterion for the web shell is still not met. `.planning/current/plan/execution-readiness-packet.md:77-82` requires `npm run dev` to show a blank page at localhost, but `apps/web/src/app/page.tsx` renders a styled foundation landing page instead.',
          ],
          advisory_policy: 'out_of_scope_advisory',
        },
      });
      expect(await run.readJson('.planning/current/review/adapter-request.json')).toMatchObject({
        review_scope: {
          blocking_items: [
            'Phase 1 task `1.2` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:50-55` requires a seed script for development data, but the repo-visible database scripts still stop at generate/migrate.',
            'Phase 1 task `1.5` remains incomplete. `.planning/current/plan/execution-readiness-packet.md:67-70` requires a separate worker deployment pipeline, but the only GitHub workflow is CI.',
            'The Phase 1 exit criterion for the web shell is still not met. `.planning/current/plan/execution-readiness-packet.md:77-82` requires `npm run dev` to show a blank page at localhost, but `apps/web/src/app/page.tsx` renders a styled foundation landing page instead.',
          ],
        },
      });
    });
  });
});
