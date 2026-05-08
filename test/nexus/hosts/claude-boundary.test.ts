import { describe, expect, test } from 'bun:test';
import { existsSync, lstatSync, readFileSync, readlinkSync } from 'fs';
import { join } from 'path';
import { readSkill } from '../../helpers/skill-paths';

const ROOT = join(import.meta.dir, '..', '..', '..');

describe('nexus claude boundary', () => {
  test('CLAUDE.md routing rules stay Nexus-owned and do not define governed artifact truth', () => {
    const content = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
    const routingSection = content.slice(
      content.indexOf('## Nexus Skill Routing'),
      content.indexOf('\n## Project Truths'),
    );
    const normalizedSection = routingSection.replace(/\s+/g, ' ');

    expect(routingSection).toContain('## Nexus Skill Routing');
    expect(normalizedSection).toContain(
      'Contracts, transitions, governed artifacts, and lifecycle truth are owned by `lib/nexus/` and canonical `.planning/` artifacts.',
    );
    expect(routingSection).not.toMatch(/current-run\.json|status\.json|ready\/blocked\/refused/i);
    expect(content.split('\n').length).toBeLessThan(200);
    expect(content).toContain('.claude/rules/');
    expect(content).not.toContain('.agents/skills/');
  });

  test('generated canonical wrappers do not ship gstack-owned routing contract language', () => {
    const content = readSkill(ROOT, 'discover');

    expect(content).toContain('Add Nexus invocation guidance to CLAUDE.md');
    expect(content).toContain('## Nexus Skill Routing');
    expect(content).not.toContain('gstack works best when');
    expect(content).not.toContain('gstack follows the **Boil the Lake** principle');
    expect(content).toContain('Nexus follows the **Completeness Principle**');
    expect(content).not.toContain('garryslist.org');
    expect(content).not.toContain('specialized workflows that produce better results than ad-hoc answers');
  });

  test('Claude-facing maintenance guidance is split into topic rules', () => {
    expect(existsSync(join(ROOT, '.claude', 'rules', 'maintainer-surface.md'))).toBe(true);
    expect(existsSync(join(ROOT, '.claude', 'rules', 'skill-authoring.md'))).toBe(true);
    expect(existsSync(join(ROOT, 'hosts', 'claude', 'rules', 'maintainer-surface.md'))).toBe(true);
    expect(existsSync(join(ROOT, 'hosts', 'claude', 'rules', 'skill-authoring.md'))).toBe(true);
    expect(lstatSync(join(ROOT, '.claude', 'rules', 'maintainer-surface.md')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(ROOT, '.claude', 'rules', 'skill-authoring.md')).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(ROOT, '.claude', 'rules', 'maintainer-surface.md'))).toBe(
      '../../hosts/claude/rules/maintainer-surface.md'
    );
    expect(readlinkSync(join(ROOT, '.claude', 'rules', 'skill-authoring.md'))).toBe(
      '../../hosts/claude/rules/skill-authoring.md'
    );

    const maintainerRule = readFileSync(join(ROOT, '.claude', 'rules', 'maintainer-surface.md'), 'utf8');
    const skillRule = readFileSync(join(ROOT, '.claude', 'rules', 'skill-authoring.md'), 'utf8');

    expect(maintainerRule).toContain('paths:');
    expect(maintainerRule).toContain('release-based');
    expect(skillRule).toContain('SKILL.md');
    expect(skillRule).toContain('bun run gen:skill-docs --host codex');
  });
});
