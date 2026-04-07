import { mkdirSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, test } from 'bun:test';
import { runReviewWithWriteAtomicFile } from '../../lib/nexus/commands/review';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus review', () => {
  test('runs governed dual-audit review and writes nested audit provenance', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const calls: string[] = [];
      const adapters = makeFakeAdapters({
        superpowers: {
          review_discipline: async () => {
            calls.push('discipline');
            return {
              adapter_id: 'superpowers',
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
                source_map: ['upstream/superpowers/skills/verification-before-completion/SKILL.md'],
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
                source_map: ['upstream/claude-code-bridge/lib/codex_comm.py'],
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
                source_map: ['upstream/claude-code-bridge/lib/gemini_comm.py'],
              },
            };
          },
        },
      });

      await run('review', adapters);

      const buildStatus = await run.readJson('.planning/current/build/status.json');
      expect(calls).toEqual(['discipline', 'audit_a', 'audit_b']);
      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        review_complete: true,
        audit_set_complete: true,
        provenance_consistent: true,
        gate_decision: 'pass',
        requested_route: buildStatus.requested_route,
        actual_route: buildStatus.actual_route,
      });

      expect(await run.readFile('.planning/audits/current/synthesis.md')).toContain('Verification-before-completion passed');
      expect(await run.readJson('.planning/current/review/adapter-output.json')).toMatchObject({
        discipline: {
          adapter_id: 'superpowers',
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

      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
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
          },
        },
        review_discipline: {
          adapter: 'superpowers',
          summary: 'Verification-before-completion passed',
        },
      });
    });
  });

  test('blocks review when an audit route diverges from the requested governed route', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      const adapters = makeFakeAdapters({
        superpowers: {
          review_discipline: async () => ({
            adapter_id: 'superpowers',
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
              source_map: ['upstream/superpowers/skills/verification-before-completion/SKILL.md'],
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
              source_map: ['upstream/claude-code-bridge/lib/codex_comm.py'],
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
              source_map: ['upstream/claude-code-bridge/lib/gemini_comm.py'],
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
});
