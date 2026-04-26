import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, test } from 'bun:test';
import { frameDesignIntentPath, planVerificationMatrixPath } from '../../lib/nexus/artifacts';
import { buildVerificationMatrix, readVerificationMatrix } from '../../lib/nexus/verification-matrix';
import { runInTempRepo } from './helpers/temp-repo';

describe('nexus verification matrix', () => {
  test('records checklist-backed rationale for support skill signals', async () => {
    await runInTempRepo(async ({ cwd }) => {
      mkdirSync(join(cwd, '.planning/current/frame'), { recursive: true });
      mkdirSync(join(cwd, 'apps/web/src/app/api/auth'), { recursive: true });

      writeFileSync(
        join(cwd, frameDesignIntentPath()),
        JSON.stringify({
          impact: 'material',
          affected_surfaces: [
            'apps/web/src/app/page.tsx',
            'apps/web/src/app/api/auth/route.ts',
          ],
          design_system_source: 'design_md',
          contract_required: true,
          verification_required: true,
        }, null, 2) + '\n',
      );
      writeFileSync(
        join(cwd, 'package.json'),
        JSON.stringify({
          name: 'matrix-checklist-backed-rationale',
          dependencies: {
            next: '^15.0.0',
            react: '^19.0.0',
            'next-auth': '^5.0.0',
          },
        }, null, 2) + '\n',
      );

      const matrix = buildVerificationMatrix(cwd, 'run-1', '2026-04-22T00:00:00.000Z');

      expect(Object.keys(matrix.checklists).sort()).toEqual([
        'accessibility',
        'design',
        'maintainability',
        'performance',
        'security',
        'testing',
      ]);
      expect(matrix.checklists.testing).toMatchObject({
        applies: true,
        source_path: 'review/specialists/testing.md',
      });
      expect(matrix.checklists.security).toMatchObject({
        applies: true,
        source_path: 'review/specialists/security.md',
      });
      expect(matrix.checklists.performance).toMatchObject({
        applies: true,
        source_path: 'review/specialists/performance.md',
      });
      expect(matrix.checklists.maintainability).toMatchObject({
        applies: true,
        source_path: 'review/specialists/maintainability.md',
      });
      expect(matrix.checklists.accessibility).toMatchObject({
        applies: true,
        source_path: 'review/design-checklist.md',
      });
      expect(matrix.checklists.design).toMatchObject({
        applies: true,
        source_path: 'review/design-checklist.md',
      });

      expect(matrix.support_skill_signals.design_review.checklist_rationale).toEqual(expect.arrayContaining([
        expect.objectContaining({ category: 'design', source_path: 'review/design-checklist.md' }),
        expect.objectContaining({ category: 'accessibility', source_path: 'review/design-checklist.md' }),
      ]));
      expect(matrix.support_skill_signals.browse.checklist_rationale).toEqual(expect.arrayContaining([
        expect.objectContaining({ category: 'testing', source_path: 'review/specialists/testing.md' }),
        expect.objectContaining({ category: 'accessibility', source_path: 'review/design-checklist.md' }),
      ]));
      expect(matrix.support_skill_signals.benchmark.checklist_rationale).toEqual([
        expect.objectContaining({ category: 'performance', source_path: 'review/specialists/performance.md' }),
      ]);
      expect(matrix.support_skill_signals.simplify.checklist_rationale).toEqual([
        expect.objectContaining({ category: 'maintainability', source_path: 'review/specialists/maintainability.md' }),
      ]);
      expect(matrix.support_skill_signals.cso.checklist_rationale).toEqual([
        expect.objectContaining({ category: 'security', source_path: 'review/specialists/security.md' }),
      ]);
      expect(matrix.support_skill_signals.setup_browser_cookies.checklist_rationale).toEqual(expect.arrayContaining([
        expect.objectContaining({ category: 'security', source_path: 'review/specialists/security.md' }),
        expect.objectContaining({ category: 'accessibility', source_path: 'review/design-checklist.md' }),
      ]));
    });
  });

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
        reason: expect.stringContaining('Checklist-backed rationale: testing review/specialists/testing.md'),
      });
      expect(matrix.support_skill_signals.connect_chrome).toMatchObject({
        suggested: true,
        reason: expect.stringContaining('Checklist-backed rationale: testing review/specialists/testing.md'),
      });
      expect(matrix.support_skill_signals.setup_browser_cookies).toMatchObject({
        suggested: true,
        reason: expect.stringContaining('Checklist-backed rationale: security review/specialists/security.md'),
      });
      expect(matrix.support_skill_signals.cso).toMatchObject({
        suggested: true,
        reason: expect.stringContaining('Checklist-backed rationale: security review/specialists/security.md'),
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

  test('preserves explicit empty checklist triggers when normalizing an existing matrix', async () => {
    await runInTempRepo(async ({ cwd }) => {
      mkdirSync(join(cwd, '.planning/current/frame'), { recursive: true });
      mkdirSync(join(cwd, '.planning/current/plan'), { recursive: true });
      mkdirSync(join(cwd, 'apps/web/src/app/api/auth'), { recursive: true });

      writeFileSync(
        join(cwd, frameDesignIntentPath()),
        JSON.stringify({
          impact: 'none',
          affected_surfaces: ['apps/web/src/app/api/auth/route.ts'],
          design_system_source: 'none',
          contract_required: false,
          verification_required: false,
        }, null, 2) + '\n',
      );
      writeFileSync(
        join(cwd, planVerificationMatrixPath()),
        JSON.stringify({
          schema_version: 1,
          run_id: 'legacy-run',
          generated_at: '2026-04-22T00:00:00.000Z',
          design_impact: 'none',
          verification_required: false,
          checklists: {
            security: {
              category: 'security',
              source_path: 'review/specialists/security.md',
              applies: false,
              rationale: 'Explicitly out of scope for this run.',
              triggers: [],
              support_surfaces: [],
            },
          },
          support_skill_signals: {
            cso: {
              suggested: false,
              reason: null,
              checklist_rationale: [],
            },
          },
        }, null, 2) + '\n',
      );

      const matrix = readVerificationMatrix(cwd);

      expect(matrix?.checklists.security.applies).toBe(false);
      expect(matrix?.checklists.security.triggers).toEqual([]);
      expect(matrix?.checklists.security.support_surfaces).toEqual([]);
      expect(matrix?.support_skill_signals.cso.checklist_rationale).toEqual([]);
    });
  });
});
