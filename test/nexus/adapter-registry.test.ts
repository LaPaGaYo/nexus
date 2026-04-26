import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { readFileSync } from 'fs';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';
import { applyNormalizationPlan } from '../../lib/nexus/normalizers';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus adapter registry', () => {
  test('activates both governed and local execution seams in the Nexus runtime', () => {
    const registry = getDefaultAdapterRegistry();

    expect(registry.discover.pm).toBe('active');
    expect(registry.frame.pm).toBe('active');
    expect(registry.plan.gsd).toBe('active');
    expect(registry.handoff.ccb).toBe('active');
    expect(registry.handoff.local).toBe('active');
    expect(registry.build.superpowers).toBe('active');
    expect(registry.build.ccb).toBe('active');
    expect(registry.build.local).toBe('active');
    expect(registry.review.superpowers).toBe('active');
    expect(registry.review.ccb).toBe('active');
    expect(registry.review.local).toBe('active');
    expect(registry.qa.ccb).toBe('active');
    expect(registry.qa.local).toBe('active');
    expect(registry.ship.superpowers).toBe('active');
    expect(registry.ship.local).toBe('active');
    expect(registry.closeout.gsd).toBe('active');
  });
});

describe('nexus normalization writeback', () => {
  test('marks the stage blocked when canonical writeback partially fails', async () => {
    await runInTempRepo(async ({ cwd }) => {
      await expect(
        applyNormalizationPlan({
          cwd,
          stage: 'build',
          statusPath: '.planning/current/build/status.json',
          canonicalWrites: [
            {
              path: '.planning/current/build/build-result.md',
              content: '# Build Result\n',
            },
            {
              path: '.planning/current/build/build-request.json',
              content: '{"requested_route":{}}\n',
            },
          ],
          traceWrites: [],
          status: {
            run_id: 'run-1',
            stage: 'build',
            state: 'completed',
            decision: 'build_recorded',
            ready: true,
            inputs: [],
            outputs: [],
            started_at: '2026-04-01T00:00:00.000Z',
            completed_at: '2026-04-01T00:00:00.000Z',
            errors: [],
          },
          writeAtomicFile: (_cwd, relativePath) => {
            if (relativePath.endsWith('build-request.json')) {
              throw new Error('disk full');
            }
          },
        }),
      ).rejects.toThrow('Canonical writeback failed');

      const status = JSON.parse(
        readFileSync(join(cwd, '.planning/current/build/status.json'), 'utf8'),
      ) as {
        state: string;
        ready: boolean;
        errors: string[];
      };
      const conflict = JSON.parse(
        readFileSync(join(cwd, '.planning/current/conflicts/build-normalizer.json'), 'utf8'),
      ) as {
        kind: string;
        message: string;
      };

      expect(status).toMatchObject({
        state: 'blocked',
        ready: false,
      });
      expect(status.errors).toContain('Canonical writeback failed');
      expect(conflict).toMatchObject({
        kind: 'partial_write_failure',
        message: 'disk full',
      });
    });
  });
});
