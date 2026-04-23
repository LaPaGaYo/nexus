import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
import { frameDesignIntentPath } from '../../lib/nexus/artifacts';
import { buildVerificationMatrix } from '../../lib/nexus/verification-matrix';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus verification matrix', () => {
  test('surfaces browser, auth, and security support skills from repo capabilities beyond narrow path heuristics', async () => {
    await runInTempRepo(async ({ cwd }) => {
      mkdirSync(join(cwd, '.planning/current/frame'), { recursive: true });
      mkdirSync(join(cwd, 'frontend/src/routes'), { recursive: true });
      mkdirSync(join(cwd, 'frontend/src/lib/auth'), { recursive: true });

      writeFileSync(
        join(cwd, frameDesignIntentPath()),
        JSON.stringify({
          impact: 'none',
          affected_surfaces: ['packages/shell/main.ts', 'services/identity/client.ts'],
          design_system_source: 'none',
          contract_required: false,
          verification_required: false,
        }, null, 2) + '\n',
      );
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          name: 'matrix-surfacing',
          dependencies: {
            react: '^19.0.0',
            'next-auth': '^5.0.0',
          },
        }, null, 2) + '\n',
      );

      const matrix = buildVerificationMatrix(cwd, 'run-1', '2026-04-22T00:00:00.000Z');

      expect(matrix.support_skill_signals.browse).toMatchObject({
        suggested: true,
        reason: 'Browser-facing surfaces changed, so `/browse` should be available from the advisor.',
      });
      expect(matrix.support_skill_signals.connect_chrome).toMatchObject({
        suggested: true,
        reason: 'A browser-facing flow exists, so real-browser verification through `/connect-chrome` is available.',
      });
      expect(matrix.support_skill_signals.setup_browser_cookies).toMatchObject({
        suggested: true,
        reason: 'Authenticated browser verification is likely relevant, so `/setup-browser-cookies` should be available.',
      });
      expect(matrix.support_skill_signals.cso).toMatchObject({
        suggested: true,
        reason: 'Auth, permission, webhook, or security-sensitive surfaces changed, so `/cso` should be available.',
      });
    });
  });

  test('does not over-surface auth-only support skills when the repo is browser-facing but unauthenticated', async () => {
    await runInTempRepo(async ({ cwd }) => {
      mkdirSync(join(cwd, '.planning/current/frame'), { recursive: true });
      mkdirSync(join(cwd, 'frontend/src/routes'), { recursive: true });

      writeFileSync(
        join(cwd, frameDesignIntentPath()),
        JSON.stringify({
          impact: 'none',
          affected_surfaces: ['packages/shell/main.ts'],
          design_system_source: 'none',
          contract_required: false,
          verification_required: false,
        }, null, 2) + '\n',
      );
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          name: 'matrix-browser-only',
          dependencies: {
            react: '^19.0.0',
          },
        }, null, 2) + '\n',
      );

      const matrix = buildVerificationMatrix(cwd, 'run-2', '2026-04-22T00:00:01.000Z');

      expect(matrix.support_skill_signals.browse.suggested).toBe(true);
      expect(matrix.support_skill_signals.connect_chrome.suggested).toBe(true);
      expect(matrix.support_skill_signals.setup_browser_cookies.suggested).toBe(false);
      expect(matrix.support_skill_signals.cso.suggested).toBe(false);
    });
  });
});
