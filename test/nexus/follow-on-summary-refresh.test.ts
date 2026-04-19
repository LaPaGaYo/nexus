import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus-refresh-follow-on-summary', () => {
  test('refreshes closeout-owned follow-on artifacts after post-closeout evidence arrives', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');
      await run('qa');
      await run('ship');
      await run('closeout');

      writeFileSync(
        join(cwd, '.planning/current/qa/perf-verification.md'),
        '# Perf Verification\n\n- P95 stayed under budget.\n',
      );
      writeFileSync(
        join(cwd, '.planning/current/ship/canary-status.json'),
        JSON.stringify({ status: 'healthy', summary: 'Canary stayed clean.' }, null, 2) + '\n',
      );
      writeFileSync(
        join(cwd, '.planning/current/ship/deploy-result.json'),
        JSON.stringify({
          source: 'land-and-deploy',
          deploy_status: 'verified',
          verification_status: 'healthy',
          production_url: 'https://example.com',
          summary: 'Deploy verified healthy in production.',
        }, null, 2) + '\n',
      );
      writeFileSync(
        join(cwd, '.planning/current/closeout/documentation-sync.md'),
        '# Documentation Sync\n\n- README updated after deploy.\n',
      );

      const result = spawnSync(
        join('/Users/henry/Documents/nexus', 'bin', 'nexus-refresh-follow-on-summary'),
        [],
        {
          cwd,
          env: { ...process.env, NEXUS_DIR: cwd },
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('UPDATED');
      expect(await run.readJson('.planning/current/closeout/follow-on-summary.json')).toMatchObject({
        source_artifacts: [
          '.planning/current/qa/perf-verification.md',
          '.planning/current/ship/canary-status.json',
          '.planning/current/ship/deploy-result.json',
          '.planning/current/closeout/documentation-sync.md',
        ],
        evidence: {
          ship: {
            deploy_status: 'verified',
            verification_status: 'healthy',
          },
        },
      });
      expect(await run.readFile('.planning/current/closeout/FOLLOW-ON-SUMMARY.md')).toContain(
        'Deploy result: .planning/current/ship/deploy-result.json (verified)',
      );
      expect(await run.readFile('.planning/current/closeout/CLOSEOUT-RECORD.md')).toContain(
        'Deploy result evidence: .planning/current/ship/deploy-result.json',
      );
      expect(await run.readJson('.planning/current/closeout/next-run-bootstrap.json')).toMatchObject({
        summary: expect.stringContaining('Ship canary evidence recorded: yes.'),
      });
    });
  });

  test('skips cleanly when no active closeout exists', async () => {
    await runInTempRepo(async ({ cwd, run }) => {
      await run('plan');
      const result = spawnSync(
        join('/Users/henry/Documents/nexus', 'bin', 'nexus-refresh-follow-on-summary'),
        [],
        {
          cwd,
          env: { ...process.env, NEXUS_DIR: cwd },
          encoding: 'utf8',
        },
      );

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('SKIPPED no_active_closeout');
    });
  });
});
