import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
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
        implementation_route: string;
      };
      meta.implementation_route = 'local-claude';
      writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');

      await expect(run('closeout')).rejects.toThrow('Reviewed provenance route does not match ledger route intent');
    });
  });
});
