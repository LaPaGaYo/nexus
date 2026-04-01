import { describe, expect, test } from 'bun:test';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus review', () => {
  test('writes the required audit workspace and structured review status', async () => {
    await runInTempRepo(async ({ run }) => {
      await run('plan');
      await run('handoff');
      await run('build');
      await run('review');

      expect(await run.readJson('.planning/current/review/status.json')).toMatchObject({
        stage: 'review',
        state: 'completed',
        decision: 'audit_recorded',
        review_complete: true,
        audit_set_complete: true,
        provenance_consistent: true,
        gate_decision: 'pass',
      });

      expect(await run.readJson('.planning/audits/current/meta.json')).toMatchObject({
        run_id: expect.any(String),
        implementation: {
          path: expect.any(String),
          requested_route: expect.objectContaining({
            command: 'build',
            governed: true,
            generator: expect.any(String),
            substrate: expect.any(String),
            fallback_policy: 'disabled',
          }),
          actual_route: null,
        },
        codex_audit: expect.any(Object),
        gemini_audit: expect.any(Object),
      });
    });
  });
});
