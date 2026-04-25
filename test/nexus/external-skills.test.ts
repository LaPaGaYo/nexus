import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  classifyInstalledSkill,
  discoverExternalInstalledSkills,
  rankExternalInstalledSkillsForAdvisor,
} from '../../lib/nexus/external-skills';
import type { InstalledSkillRecord, VerificationMatrixRecord } from '../../lib/nexus/types';

function writeSkill(root: string, name: string, description: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  return file;
}

function matrixWithSignals(): VerificationMatrixRecord {
  return {
    schema_version: 1,
    run_id: 'run-1',
    generated_at: '2026-04-25T00:00:00.000Z',
    design_impact: 'material',
    verification_required: true,
    obligations: {
      build: { owner_stage: 'build', required: true, gate_affecting: true, expected_artifacts: [] },
      review: { owner_stage: 'review', required: true, gate_affecting: true, mode: 'full_acceptance', expected_artifacts: [] },
      qa: { owner_stage: 'qa', required: true, gate_affecting: true, design_verification_required: true, expected_artifacts: [] },
      ship: { owner_stage: 'ship', required: true, gate_affecting: true, deploy_readiness_required: true, expected_artifacts: [] },
    },
    attached_evidence: {
      benchmark: { supported: true, required: false },
      canary: { supported: true, required: false },
      qa_only: { supported: true, required: false },
    },
    support_skill_signals: {
      design_review: { suggested: true, reason: 'Design-bearing work.' },
      browse: { suggested: true, reason: 'Browser-facing surface.' },
      benchmark: { suggested: false, reason: null },
      cso: { suggested: false, reason: null },
      connect_chrome: { suggested: false, reason: null },
      setup_browser_cookies: { suggested: false, reason: null },
    },
  };
}

describe('external installed skill discovery and ranking', () => {
  test('discovers user-installed skills and classifies Nexus-owned names separately', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-external-skills-'));
    const externalPath = writeSkill(root, 'jobs-to-be-done', 'Explore customer jobs, discovery, and opportunity framing.');
    writeSkill(root, 'nexus-review', 'Canonical Nexus review wrapper.');

    const skills = discoverExternalInstalledSkills({ roots: [root] });

    expect(skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'jobs-to-be-done',
        surface: '/jobs-to-be-done',
        path: externalPath,
        namespace: 'external_installed',
        tags: expect.arrayContaining(['discovery', 'customer-research']),
      }),
      expect.objectContaining({
        name: 'nexus-review',
        surface: '/nexus-review',
        namespace: 'nexus_canonical',
      }),
    ]));
  });

  test('ranks external skills behind Nexus surfaces and blocks canonical name collisions', () => {
    const skills: InstalledSkillRecord[] = [
      classifyInstalledSkill({
        name: 'brand-audit',
        description: 'External visual design review and brand quality audit.',
        path: '/tmp/brand-audit/SKILL.md',
        source_root: '/tmp',
      }),
      classifyInstalledSkill({
        name: 'review',
        description: 'External code review skill.',
        path: '/tmp/review/SKILL.md',
        source_root: '/tmp',
      }),
      classifyInstalledSkill({
        name: 'jobs-to-be-done',
        description: 'Customer discovery interviews and opportunity research.',
        path: '/tmp/jobs-to-be-done/SKILL.md',
        source_root: '/tmp',
      }),
    ];

    const ranked = rankExternalInstalledSkillsForAdvisor({
      stage: 'review',
      verification_matrix: matrixWithSignals(),
      skills,
      existing_surfaces: ['/review', '/design-review', '/browse'],
      limit: 3,
    });

    expect(ranked.map((skill) => skill.surface)).toEqual(['/brand-audit']);
    expect(ranked[0]).toMatchObject({
      kind: 'external_installed_skill',
      label: 'Run installed skill `/brand-audit`',
      recommended: false,
    });
    expect(ranked[0]?.visibility_reason).toContain('design');
  });
});
