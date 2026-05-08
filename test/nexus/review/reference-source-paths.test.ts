import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { REVIEW_DESIGN_CHECKLIST_SOURCE_PATH } from '../../../lib/nexus/io/repo-paths';
import { buildVerificationMatrix } from '../../../lib/nexus/review/verification-matrix';

const ROOT = join(import.meta.dir, '..', '..', '..');

describe('reference source paths', () => {
  test('active verification metadata does not emit legacy review source paths', () => {
    const matrix = buildVerificationMatrix(
      ROOT,
      'guard-run',
      '2026-04-30T00:00:00.000Z',
    );

    const sourcePaths = [
      ...Object.values(matrix.checklists).map((checklist) => checklist.source_path),
      ...Object.values(matrix.support_skill_signals).flatMap((signal) =>
        signal.checklist_rationale.map((entry) => entry.source_path)
      ),
    ];

    expect(sourcePaths.filter((sourcePath) => sourcePath.startsWith('review/'))).toEqual([]);
    expect(sourcePaths).toContain(REVIEW_DESIGN_CHECKLIST_SOURCE_PATH);
  });
});
