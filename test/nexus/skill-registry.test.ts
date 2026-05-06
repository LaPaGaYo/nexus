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

  test('discover returns installed skills with the stable advisor shape', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-'));
    const skillPath = writeSkill(root, 'jobs-to-be-done', 'Explore customer jobs, discovery, and opportunity framing.');

    const discovered = discoverInstalledSkills({ roots: [root] });

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

  test('rank emits advisor actions for matching installed skills', () => {
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
    expect(rankInstalledSkillsForAdvisor(input)[0]).toMatchObject({
      surface: '/code-review-helper',
      kind: 'external_installed_skill',
    });
  });
});

describe('SkillRegistry Phase 2.b — manifest discovery', () => {
  function writeSkillWithManifest(root: string, name: string, description: string, manifest: string): string {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
    fs.writeFileSync(path.join(dir, 'nexus.skill.yaml'), manifest);
    return dir;
  }

  test('discovery loads nexus.skill.yaml manifest when present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-manifest-'));
    writeSkillWithManifest(root, 'with-manifest', 'A test skill with a manifest', `schema_version: 1
name: with-manifest
summary: Test skill summary
intent_keywords: ["do test thing", "run a test"]
lifecycle_stages: [build]
classification:
  namespace: nexus_canonical
`);

    const discovered = discoverInstalledSkills({ roots: [root] });
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.manifest).toBeDefined();
    expect(discovered[0]?.manifest?.name).toBe('with-manifest');
    expect(discovered[0]?.manifest?.intent_keywords).toEqual(['do test thing', 'run a test']);
    expect(discovered[0]?.manifest?.lifecycle_stages).toEqual(['build']);
  });

  test('discovery returns skill record without manifest field when nexus.skill.yaml absent', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-no-manifest-'));
    writeSkill(root, 'plain-skill', 'A skill without a manifest');

    const discovered = discoverInstalledSkills({ roots: [root] });
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.manifest).toBeUndefined();
  });

  test('discovery skips invalid manifest gracefully (record has no manifest field)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-skill-registry-invalid-manifest-'));
    writeSkillWithManifest(root, 'bad-manifest', 'A skill with a malformed manifest', `schema_version: 99
name: bad-manifest
summary: Has unsupported version
intent_keywords: ["x"]
`);

    const discovered = discoverInstalledSkills({ roots: [root] });
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.manifest).toBeUndefined();
  });

  test('discovery loads manifest for canonical /build skill (regression for SKIP_DIRS bug)', () => {
    // Phase 2.b also fixed a pre-existing bug: 'build' was in SKIP_DIRS,
    // causing skills/canonical/build/ to be silently excluded.
    const root = path.resolve('./skills/canonical');
    const discovered = discoverInstalledSkills({ roots: [root] });
    const buildSkill = discovered.find((s) => s.name === 'build');
    expect(buildSkill).toBeDefined();
    expect(buildSkill?.manifest).toBeDefined();
    expect(buildSkill?.manifest?.intent_keywords.length).toBeGreaterThan(0);
    expect(buildSkill?.manifest?.lifecycle_stages).toEqual(['build']);
  });

  test('discovery loads manifests for all 9 canonical skills', () => {
    const root = path.resolve('./skills/canonical');
    const discovered = discoverInstalledSkills({ roots: [root] });
    const canonicalNames = ['discover', 'frame', 'plan', 'handoff', 'build', 'review', 'qa', 'ship', 'closeout'];
    for (const name of canonicalNames) {
      const skill = discovered.find((s) => s.name === name);
      expect(skill, `canonical /${name} should be discovered`).toBeDefined();
      expect(skill?.manifest, `canonical /${name} should have manifest`).toBeDefined();
      expect(skill?.manifest?.classification?.namespace).toBe('nexus_canonical');
      expect(skill?.manifest?.lifecycle_stages).toEqual([name]);
    }
  });
});
