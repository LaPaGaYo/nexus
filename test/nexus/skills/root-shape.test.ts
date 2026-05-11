/**
 * Pin Phase 4.4 ST8 decision (#87): `skills/root/` stays single-child.
 *
 * `skills/root/` deliberately contains only `skills/root/nexus/` because
 * the root `/nexus` entrypoint has different install behavior from
 * canonical/support/safety/alias skills (it is generated from the
 * structured source tree but mirrored at the repository root for host
 * compatibility). Drop and Fold options were rejected because either
 * would shift install paths in `lib/nexus/io/host-roots.ts`,
 * `lib/nexus/skills/structure.ts`, and host install layouts.
 *
 * This test pins the single-child shape so future contributors who try
 * to add a second sibling under `skills/root/` trip a hard gate and
 * have to revisit the ST8 decision deliberately. See
 * `skills/root/README.md` for the rationale.
 */

import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..', '..');
const SKILLS_ROOT = path.join(REPO_ROOT, 'skills', 'root');

// The only directory permitted under skills/root/.
const ALLOWED_SUBDIRS = new Set(['nexus']);

// Non-directory files permitted at skills/root/ root.
const ALLOWED_ROOT_FILES = new Set(['README.md']);

describe('skills/root/ shape invariant (ST8 / #87)', () => {
  test('contains exactly the documented sibling set', () => {
    const entries = fs.readdirSync(SKILLS_ROOT, { withFileTypes: true });

    const unexpected: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && ALLOWED_SUBDIRS.has(entry.name)) continue;
      if (entry.isFile() && ALLOWED_ROOT_FILES.has(entry.name)) continue;
      unexpected.push(`${entry.isDirectory() ? 'dir' : 'file'}:${entry.name}`);
    }

    expect(unexpected, [
      'Found unexpected entries under skills/root/.',
      '',
      '`skills/root/` is intentionally single-child (only `nexus/`) because the',
      'root /nexus entrypoint has different install behavior from canonical,',
      'support, safety, and alias skills.',
      '',
      'If you are introducing a new top-level entrypoint skill that also has',
      'different install behavior from canonical/support/safety/alias, update',
      'this test\'s ALLOWED_SUBDIRS list AND update skills/root/README.md to',
      'document the rationale for the new sibling.',
      '',
      'Otherwise, the file you want to add probably belongs under one of:',
      '  - skills/canonical/ (lifecycle commands)',
      '  - skills/support/   (advisor / non-lifecycle support skills)',
      '  - skills/safety/    (careful / freeze / guard / unfreeze)',
      '  - skills/aliases/   (legacy / compatibility aliases)',
      '',
      'Unexpected: ' + unexpected.join(', '),
    ].join('\n')).toEqual([]);
  });

  test('skills/root/nexus/ retains its required source files', () => {
    const nexusDir = path.join(SKILLS_ROOT, 'nexus');
    expect(fs.existsSync(path.join(nexusDir, 'SKILL.md.tmpl'))).toBe(true);
    expect(fs.existsSync(path.join(nexusDir, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(nexusDir, 'nexus.skill.yaml'))).toBe(true);
  });
});
