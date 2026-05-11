/**
 * Pin the post-#137 `lib/nexus/` structural invariants (#150).
 *
 * The big lib/nexus reorg (PR #137) moved all flat `.ts` files under
 * concern-based subdirectories. The decision (#83 / ST2) and barrel
 * design (#151) both lean on this invariant: `lib/nexus/` root must
 * stay clean. Without an enforced check, a future contributor can
 * drop `lib/nexus/foo.ts` back into the root and the layout silently
 * degrades.
 *
 * This test runs as part of the `nexus` unit-tests cell (per
 * .github/workflows/unit-tests.yml), so PRs that violate the
 * structure get caught at the gate.
 *
 * The allow-list below is the ONLY non-subdirectory content permitted
 * in `lib/nexus/`. Adding entries requires a deliberate code review.
 */

import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const LIB_NEXUS_ROOT = path.resolve(import.meta.dir, '..', '..', 'lib', 'nexus');

// The only files permitted at lib/nexus/ root. Subdirectories are open.
// `index.ts` is the curated public barrel (issue #151).
// `README.md` documents the layout, conventions, and barrel.
const ALLOWED_ROOT_FILES = new Set(['index.ts', 'README.md']);

describe('lib/nexus/ structure invariants (#150)', () => {
  test('root contains only subdirectories plus the documented allow-list', () => {
    const entries = fs.readdirSync(LIB_NEXUS_ROOT, { withFileTypes: true });

    const unexpectedFiles: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) continue;
      if (ALLOWED_ROOT_FILES.has(entry.name)) continue;
      unexpectedFiles.push(entry.name);
    }

    // Helpful error message — explains why this is failing and points at
    // the resolution paths.
    expect(unexpectedFiles, [
      'Found flat files at lib/nexus/ root that are not in the allow-list.',
      '',
      'The post-#137 reorg requires every implementation file to live under a',
      'concern-based subdirectory (adapters/, contracts/, io/, runtime/, etc.).',
      '',
      'If you are adding a new concern:',
      '  1. Create a subdirectory: lib/nexus/<your-concern>/',
      '  2. Put the .ts files inside it.',
      '  3. If the subdirectory needs an entry point, add lib/nexus/<your-concern>/index.ts.',
      '',
      'If you are extending an existing concern, find the matching subdirectory',
      'and add the file there.',
      '',
      'If you genuinely need a new root-level file (rare), update the',
      'ALLOWED_ROOT_FILES allow-list in this test along with a comment',
      'explaining why.',
      '',
      'Unexpected files: ' + unexpectedFiles.join(', '),
    ].join('\n')).toEqual([]);
  });

  test('every subdirectory has at least one .ts file or an index.ts', () => {
    const subdirs = fs
      .readdirSync(LIB_NEXUS_ROOT, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    expect(subdirs.length).toBeGreaterThan(0);

    const emptyOrInvalid: string[] = [];
    for (const sub of subdirs) {
      const subPath = path.join(LIB_NEXUS_ROOT, sub);
      const contents = fs.readdirSync(subPath);
      const hasTs = contents.some((name) => name.endsWith('.ts'));
      if (!hasTs) {
        emptyOrInvalid.push(sub);
      }
    }

    expect(emptyOrInvalid).toEqual([]);
  });

  test('barrel file index.ts exists and is non-trivial', () => {
    const indexPath = path.join(LIB_NEXUS_ROOT, 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, 'utf-8');
    // Sanity floor — barrel should re-export at least a dozen symbols.
    // Counting `export ` statements (with trailing space) catches both
    // `export {` and `export type {` forms.
    const exportLines = content
      .split('\n')
      .filter((line) => /^export[\s{]/.test(line.trim()));
    expect(exportLines.length).toBeGreaterThanOrEqual(8);
  });
});
