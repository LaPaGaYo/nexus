import { describe, expect, test } from 'bun:test';
import * as path from 'path';
import { CANONICAL_MANIFEST, LEGACY_ALIASES } from '../../lib/nexus/command-manifest';
import {
  SAFETY_SKILL_NAMES,
  SUPPORT_SKILL_NAMES,
  allPlannedSkillStructureEntries,
  describeSkillSourcePath,
  skillSourceCategoryForName,
  targetSkillSourcePathForName,
} from '../../lib/nexus/skill-structure';
import { discoverTemplates } from '../../scripts/discover-skills';

const ROOT = path.resolve(import.meta.dir, '..', '..');

describe('nexus skill source structure', () => {
  test('classifies every current source template into the planned taxonomy', () => {
    const templates = discoverTemplates(ROOT);
    const unknown: string[] = [];

    for (const { tmpl } of templates) {
      try {
        describeSkillSourcePath(tmpl);
      } catch {
        unknown.push(tmpl);
      }
    }

    expect(unknown).toEqual([]);
  });

  test('maps canonical lifecycle commands to the canonical namespace', () => {
    for (const command of Object.keys(CANONICAL_MANIFEST)) {
      expect(skillSourceCategoryForName(command)).toBe('canonical');
      expect(targetSkillSourcePathForName(command)).toBe(`skills/canonical/${command}/SKILL.md.tmpl`);
    }
  });

  test('maps aliases, safety, support, and root entrypoint to distinct namespaces', () => {
    for (const alias of Object.keys(LEGACY_ALIASES)) {
      expect(skillSourceCategoryForName(alias)).toBe('alias');
      expect(targetSkillSourcePathForName(alias)).toBe(`skills/aliases/${alias}/SKILL.md.tmpl`);
    }

    for (const safety of SAFETY_SKILL_NAMES) {
      expect(skillSourceCategoryForName(safety)).toBe('safety');
      expect(targetSkillSourcePathForName(safety)).toBe(`skills/safety/${safety}/SKILL.md.tmpl`);
    }

    for (const support of SUPPORT_SKILL_NAMES) {
      expect(skillSourceCategoryForName(support)).toBe('support');
      expect(targetSkillSourcePathForName(support)).toBe(`skills/support/${support}/SKILL.md.tmpl`);
    }

    expect(describeSkillSourcePath('SKILL.md.tmpl')).toMatchObject({
      name: 'nexus',
      category: 'root',
      targetSourcePath: 'SKILL.md.tmpl',
      movePolicy: 'in_place',
    });
  });

  test('declares planned moves without requiring the physical migration yet', () => {
    expect(describeSkillSourcePath('review/SKILL.md.tmpl')).toMatchObject({
      name: 'review',
      category: 'canonical',
      targetSourcePath: 'skills/canonical/review/SKILL.md.tmpl',
      movePolicy: 'planned_move',
    });

    expect(describeSkillSourcePath('simplify/SKILL.md.tmpl')).toMatchObject({
      name: 'simplify',
      category: 'support',
      targetSourcePath: 'skills/support/simplify/SKILL.md.tmpl',
      movePolicy: 'planned_move',
    });

    expect(describeSkillSourcePath('guard/SKILL.md.tmpl')).toMatchObject({
      name: 'guard',
      category: 'safety',
      targetSourcePath: 'skills/safety/guard/SKILL.md.tmpl',
      movePolicy: 'planned_move',
    });
  });

  test('recognizes future structured source namespace paths', () => {
    expect(describeSkillSourcePath('skills/canonical/review/SKILL.md.tmpl')).toMatchObject({
      name: 'review',
      category: 'canonical',
      movePolicy: 'in_place',
    });

    expect(describeSkillSourcePath('skills/support/simplify/SKILL.md.tmpl')).toMatchObject({
      name: 'simplify',
      category: 'support',
      movePolicy: 'in_place',
    });

    expect(describeSkillSourcePath('skills/safety/guard/SKILL.md.tmpl')).toMatchObject({
      name: 'guard',
      category: 'safety',
      movePolicy: 'in_place',
    });
  });

  test('has one planned entry per known skill name', () => {
    const entries = allPlannedSkillStructureEntries();
    const names = entries.map((entry) => entry.name);

    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('nexus');
    expect(names).toContain('discover');
    expect(names).toContain('plan-ceo-review');
    expect(names).toContain('simplify');
    expect(names).toContain('guard');
  });
});
