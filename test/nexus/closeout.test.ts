import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
import { makeFakeAdapters } from './helpers/fake-adapters';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus closeout', () => {
  test('archives the current audit set and records closeout status', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('closeout');

      const closeout = await run.readJson('.planning/current/closeout/status.json');
      expect(closeout).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        archive_required: true,
        archive_state: 'archived',
      });
      expect(readFileSync(join(cwd, '.planning/audits/archive', closeout.run_id, 'meta.json'), 'utf8')).toContain(
        closeout.run_id,
      );
    });
  });

  test('rejects illegal transition history', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const ledgerPath = join(cwd, '.planning/nexus/current-run.json');
      const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
        command_history: Array<{ command: string; at: string; via: string | null }>;
      };
      ledger.command_history = ledger.command_history.filter((entry) => entry.command !== 'handoff');
      writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow('Illegal Nexus transition history');
    });
  });

  test('rejects inconsistent reviewed provenance', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const metaPath = join(cwd, '.planning/audits/current/meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        implementation: {
          requested_route: {
            generator: string;
          };
        };
      };
      meta.implementation.requested_route.generator = 'local-claude';
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow('Reviewed provenance route does not match ledger route intent');
    });
  });

  test('prefers nested implementation provenance over flat compatibility fields', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const metaPath = join(cwd, '.planning/audits/current/meta.json');
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        implementation_route: string;
        implementation_substrate: string;
      };
      meta.implementation_route = 'local-claude';
      meta.implementation_substrate = 'local-agent';
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

      await run('closeout');

      expect(await run.readJson('.planning/current/closeout/status.json')).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        provenance_consistent: true,
      });
    });
  });

  test('normalizes a GSD closeout result only after Nexus closeout gates pass', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const adapters = makeFakeAdapters({
        gsd: {
          closeout: async () => ({
            adapter_id: 'gsd',
            outcome: 'success',
            raw_output: {
              closeout_record: '# Closeout Record\n\nResult: merge ready\n',
              archive_required: true,
              merge_ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              absorbed_capability: 'gsd-closeout',
              source_map: ['upstream/gsd/commands/gsd/complete-milestone.md'],
            },
          }),
        },
      });

      await run('closeout', adapters);

      const closeout = await run.readJson('.planning/current/closeout/status.json');
      expect(closeout).toMatchObject({
        stage: 'closeout',
        state: 'completed',
        archive_required: true,
        archive_state: 'archived',
        provenance_consistent: true,
      });
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain('merge ready');
      expect(await run.readJson('.planning/current/closeout/adapter-output.json')).toMatchObject({
        adapter_id: 'gsd',
        outcome: 'success',
        traceability: {
          absorbed_capability: 'gsd-closeout',
        },
      });
      expect(readFileSync(join(cwd, '.planning/audits/archive', closeout.run_id, 'meta.json'), 'utf8')).toContain(
        closeout.run_id,
      );
    });
  });

  test('blocks closeout when the archive is required but missing', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      const runId = (await run.readJson('.planning/current/review/status.json')).run_id as string;
      const archiveRoot = join(cwd, '.planning/audits/archive', runId);
      mkdirSync(archiveRoot, { recursive: true });
      for (const file of ['codex.md', 'gemini.md', 'synthesis.md', 'gate-decision.md']) {
        writeFileSync(join(archiveRoot, file), '# archived\n');
      }
      const archiveMetaPath = join(cwd, '.planning/audits/archive', runId, 'meta.json');
      writeFileSync(archiveMetaPath, '');

      const adapters = makeFakeAdapters({
        gsd: {
          closeout: async () => ({
            adapter_id: 'gsd',
            outcome: 'success',
            raw_output: {
              closeout_record: '# Closeout Record\n\nResult: merge ready\n',
              archive_required: true,
              merge_ready: true,
            },
            requested_route: null,
            actual_route: null,
            notices: [],
            conflict_candidates: [],
            traceability: {
              absorbed_capability: 'gsd-closeout',
              source_map: ['upstream/gsd/commands/gsd/complete-milestone.md'],
            },
          }),
        },
      });

      await expect(run('closeout', adapters)).rejects.toThrow('Missing archived audit artifact: meta.json');
    });
  });
});
