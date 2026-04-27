import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  REFERENCE_COMPAT_MAPPINGS,
  REPO_TAXONOMY_CATEGORIES,
  REPO_TAXONOMY_ENTRIES,
  findRepoTaxonomyEntry,
  plannedTopLevelRoots,
  referenceCompatSourceCandidates,
} from '../../lib/nexus/repo-taxonomy';

const ROOT = join(import.meta.dir, '..', '..');

describe('nexus repo taxonomy v2', () => {
  test('defines the intended top-level maintenance categories without moving files yet', () => {
    expect(plannedTopLevelRoots()).toEqual([
      'skills',
      'runtimes',
      'references',
      'lib',
      'hosts',
      'vendor',
      'bin',
      'scripts',
      'docs',
      'test',
    ]);

    expect(REPO_TAXONOMY_CATEGORIES.hosts.children).toEqual([
      'claude',
      'codex',
      'gemini-cli',
      'factory',
      'kiro',
    ]);
  });

  test('keeps current paths as the active source of truth while recording future target paths', () => {
    expect(findRepoTaxonomyEntry('browse')).toMatchObject({
      current_path: 'browse',
      target_path: 'runtimes/browse',
      move_policy: 'future_move',
      risk_level: 'high',
    });

    expect(findRepoTaxonomyEntry('review')).toMatchObject({
      current_path: 'review',
      target_path: 'references/review',
      move_policy: 'compat_required',
      risk_level: 'high',
    });

    expect(findRepoTaxonomyEntry('upstream')).toMatchObject({
      current_path: 'upstream',
      target_path: 'vendor/upstream',
      move_policy: 'future_move',
    });
  });

  test('records compatibility paths for runtime and reference assets installed under NEXUS_ROOT', () => {
    const browse = findRepoTaxonomyEntry('browse');
    const review = findRepoTaxonomyEntry('review');
    const qa = findRepoTaxonomyEntry('qa');
    const design = findRepoTaxonomyEntry('design');

    expect(browse?.runtime_compat_paths).toContain('$NEXUS_ROOT/browse/dist');
    expect(browse?.runtime_compat_paths).toContain('$NEXUS_ROOT/browse/bin');
    expect(review?.runtime_compat_paths).toContain('$NEXUS_ROOT/review/checklist.md');
    expect(review?.runtime_compat_paths).toContain('$NEXUS_ROOT/review/specialists/testing.md');
    expect(qa?.runtime_compat_paths).toContain('$NEXUS_ROOT/qa/templates/qa-report-template.md');
    expect(design?.runtime_compat_paths).toContain('$NEXUS_ROOT/design/references');
  });

  test('defines future references source candidates while preserving installed compatibility paths', () => {
    expect(REFERENCE_COMPAT_MAPPINGS).toContainEqual({
      compat_path: 'review/specialists',
      future_source_path: 'references/review/specialists',
      current_source_path: 'review/specialists',
      kind: 'directory',
    });
    expect(REFERENCE_COMPAT_MAPPINGS).toContainEqual({
      compat_path: 'qa/templates',
      future_source_path: 'references/qa/templates',
      current_source_path: 'qa/templates',
      kind: 'directory',
    });
    expect(REFERENCE_COMPAT_MAPPINGS).toContainEqual({
      compat_path: 'design/references',
      future_source_path: 'references/design',
      current_source_path: 'design/references',
      kind: 'directory',
    });
    expect(REFERENCE_COMPAT_MAPPINGS).toContainEqual({
      compat_path: 'cso/ACKNOWLEDGEMENTS.md',
      future_source_path: 'references/cso/ACKNOWLEDGEMENTS.md',
      current_source_path: 'cso/ACKNOWLEDGEMENTS.md',
      kind: 'file',
    });

    expect(referenceCompatSourceCandidates('review/specialists')).toEqual([
      'references/review/specialists',
      'review/specialists',
    ]);
  });

  test('documents all high-risk visible root directories that should not be moved ad hoc', () => {
    const documented = new Set(REPO_TAXONOMY_ENTRIES.map((entry) => entry.current_path));
    const highRiskRoots = [
      'browse',
      'design',
      'design-html',
      'review',
      'qa',
      'careful',
      'freeze',
      'upstream',
      'upstream-notes',
      '.agents',
      '.factory',
    ];

    expect(highRiskRoots.filter((root) => !documented.has(root))).toEqual([]);

    for (const root of highRiskRoots) {
      expect(existsSync(join(ROOT, root))).toBe(true);
      expect(findRepoTaxonomyEntry(root)?.move_policy).not.toBe('moved');
    }
  });

  test('architecture note explains the no-physical-move policy and target tree', () => {
    const doc = readFileSync(join(ROOT, 'docs/architecture/repo-taxonomy-v2.md'), 'utf8');

    expect(doc).toContain('No physical paths move in this phase.');
    expect(doc).toContain('hosts/gemini-cli');
    expect(doc).toContain('runtimes/browse');
    expect(doc).toContain('references/review');
    expect(doc).toContain('$NEXUS_ROOT/review/checklist.md');
  });
});
