import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  NEXUS_SAFETY_SKILL_NAMES,
  NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES,
  NEXUS_SUPPORT_SKILL_NAMES,
  assertNoDuplicateSupportRegistries,
  classifyInstalledSkill,
  createSkillRegistry,
  discoverSkillFiles,
  discoverInstalledSkills,
  rankInstalledSkillsForAdvisor,
} from '../../lib/nexus/skill-registry';
import {
  discoverExternalInstalledSkills,
  rankExternalInstalledSkillsForAdvisor,
} from '../../lib/nexus/external-skills';
import {
  SAFETY_SKILL_NAMES,
  SUPPORT_SKILL_NAMES,
} from '../../lib/nexus/skill-structure';

function writeSkill(root: string, name: string, description: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  return file;
}

function writeRawSkill(root: string, dirName: string, content: string): string {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'SKILL.md');
  fs.writeFileSync(file, content);
  return file;
}

describe('SkillRegistry Phase 1 consolidation', () => {
  test('support skill names are sourced from one registry module', () => {
    assertNoDuplicateSupportRegistries();

    expect(SUPPORT_SKILL_NAMES).toBe(NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES);
    expect(SAFETY_SKILL_NAMES).toBe(NEXUS_SAFETY_SKILL_NAMES);
    expect(NEXUS_SUPPORT_SKILL_NAMES).toEqual(
      [...NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES, ...NEXUS_SAFETY_SKILL_NAMES]
        .sort((left, right) => left.localeCompare(right))
    );
    expect(NEXUS_SUPPORT_SKILL_NAMES).toContain('simplify');
    expect(NEXUS_SUPPORT_SKILL_NAMES).toContain('guard');
  });

  test('discover returns the same shape as the compatibility shim', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-'));
    const skillPath = writeSkill(root, 'jobs-to-be-done', 'Explore customer jobs, discovery, and opportunity framing.');

    const discovered = discoverInstalledSkills({ roots: [root] });
    const legacyDiscovered = discoverExternalInstalledSkills({ roots: [root] });

    expect(discovered).toEqual(legacyDiscovered);
    expect(discovered).toEqual([
      expect.objectContaining({
        name: 'jobs-to-be-done',
        surface: '/jobs-to-be-done',
        description: 'Explore customer jobs, discovery, and opportunity framing.',
        path: skillPath,
        source_root: root,
        namespace: 'external_installed',
        tags: expect.arrayContaining(['discovery', 'customer-research']),
      }),
    ]);
  });

  test('discover treats a missing root as an empty installed skill surface', () => {
    const root = path.join(os.tmpdir(), `nexus-skill-registry-missing-${Date.now()}`);

    expect(discoverSkillFiles(root)).toEqual([]);
    expect(discoverInstalledSkills({ roots: [root] })).toEqual([]);
  });

  test('discover preserves malformed SKILL.md fallback behavior', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-'));
    const skillPath = writeRawSkill(root, 'loose-skill', '# Loose Skill\n\nNo frontmatter here.\n');

    expect(discoverInstalledSkills({ roots: [root] })).toEqual([
      expect.objectContaining({
        name: 'loose-skill',
        surface: '/loose-skill',
        description: null,
        path: skillPath,
        source_root: root,
        namespace: 'external_installed',
      }),
    ]);
  });

  test('discover deduplicates repeated roots by resolved skill path', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-'));
    writeSkill(root, 'review-helper', 'Code review audit support.');

    const discovered = discoverInstalledSkills({ roots: [root, root] });

    expect(discovered.map((skill) => skill.surface)).toEqual(['/review-helper']);
  });

  test('discover intentionally swallows invalid root walk errors', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-'));
    const fileRoot = path.join(root, 'not-a-directory');
    fs.writeFileSync(fileRoot, 'not a directory');

    expect(discoverSkillFiles(fileRoot)).toEqual([]);
  });

  test('classifies canonical support safety and external skills', () => {
    expect(classifyInstalledSkill({
      name: 'review',
      description: null,
      path: '/tmp/review/SKILL.md',
      source_root: '/tmp',
    }).namespace).toBe('nexus_canonical');

    expect(classifyInstalledSkill({
      name: 'simplify',
      description: null,
      path: '/tmp/simplify/SKILL.md',
      source_root: '/tmp',
    }).namespace).toBe('nexus_support');

    expect(classifyInstalledSkill({
      name: 'guard',
      description: null,
      path: '/tmp/guard/SKILL.md',
      source_root: '/tmp',
    }).namespace).toBe('nexus_support');

    expect(classifyInstalledSkill({
      name: 'jobs-to-be-done',
      description: null,
      path: '/tmp/jobs-to-be-done/SKILL.md',
      source_root: '/tmp',
    }).namespace).toBe('external_installed');
  });

  test('discover preserves the external skill kill switch', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-'));
    writeSkill(root, 'jobs-to-be-done', 'Explore customer jobs.');
    const previous = process.env.NEXUS_EXTERNAL_SKILLS;

    try {
      process.env.NEXUS_EXTERNAL_SKILLS = '0';
      expect(discoverInstalledSkills({ roots: [root] })).toEqual([]);
      expect(createSkillRegistry({ roots: [root] }).discover()).toEqual([]);
    } finally {
      if (previous === undefined) {
        delete process.env.NEXUS_EXTERNAL_SKILLS;
      } else {
        process.env.NEXUS_EXTERNAL_SKILLS = previous;
      }
    }
  });

  test('rank delegates through the compatibility shim unchanged', () => {
    const skills = [
      classifyInstalledSkill({
        name: 'code-review-helper',
        description: 'External code review audit for maintainability and quality.',
        path: '/tmp/code-review-helper/SKILL.md',
        source_root: '/tmp',
      }),
    ];
    const input = {
      stage: 'review' as const,
      verification_matrix: null,
      skills,
      existing_surfaces: [],
      limit: 3,
    };

    expect(rankInstalledSkillsForAdvisor(input)).not.toEqual([]);
    expect(rankInstalledSkillsForAdvisor(input)).toEqual(rankExternalInstalledSkillsForAdvisor(input));
  });
});
