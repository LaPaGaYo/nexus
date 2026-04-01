import { describe, expect, test } from 'bun:test';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus plan -> handoff -> build', () => {
  test('writes ledger, stage statuses, and build request artifacts', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');

      expect(await run.readJson('.planning/nexus/current-run.json')).toMatchObject({
        current_stage: 'build',
        status: 'active',
      });

      expect(await run.readJson('.planning/current/plan/status.json')).toMatchObject({
        stage: 'plan',
        state: 'completed',
        decision: 'ready',
      });

      expect(await run.readJson('.planning/current/build/build-request.json')).toMatchObject({
        requested_route: { command: 'build', governed: true },
      });
    });
  });
});
