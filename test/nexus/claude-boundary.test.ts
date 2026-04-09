import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..', '..');

describe('nexus claude boundary', () => {
  test('CLAUDE.md routing rules stay Nexus-owned and do not define governed artifact truth', () => {
    const content = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
    const routingSection = content.slice(
      content.indexOf('## Nexus Skill Routing'),
      content.indexOf('\n## Commands'),
    );
    const normalizedSection = routingSection.replace(/\s+/g, ' ');

    expect(routingSection).toContain('## Nexus Skill Routing');
    expect(normalizedSection).toContain(
      'Contracts, transitions, governed artifacts, and lifecycle truth are owned by `lib/nexus/` and canonical `.planning/` artifacts.',
    );
    expect(routingSection).not.toMatch(/current-run\.json|status\.json|ready\/blocked\/refused/i);
  });

  test('generated canonical wrappers do not ship gstack-owned routing contract language', () => {
    const content = readFileSync(join(ROOT, 'discover', 'SKILL.md'), 'utf8');

    expect(content).toContain('Add Nexus invocation guidance to CLAUDE.md');
    expect(content).toContain('## Nexus Skill Routing');
    expect(content).not.toContain('gstack works best when');
    expect(content).not.toContain('gstack follows the **Boil the Lake** principle');
    expect(content).toContain('Nexus follows the **Boil the Lake** principle');
    expect(content).not.toContain('specialized workflows that produce better results than ad-hoc answers');
  });
});
