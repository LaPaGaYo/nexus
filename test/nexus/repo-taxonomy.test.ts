import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  REFERENCE_COMPAT_MAPPINGS,
  REPO_TAXONOMY_CATEGORIES,
  REPO_TAXONOMY_ENTRIES,
  REPO_TAXONOMY_FACADES,
  classifyRepoPath,
  findRepoTaxonomyFacade,
  findRepoTaxonomyEntry,
  plannedFacadePaths,
  plannedTopLevelRoots,
  referenceCompatSourceCandidates,
  resolveReferenceCompatSource,
} from '../../lib/nexus/repo-taxonomy';

const ROOT = join(import.meta.dir, '..', '..');

describe('nexus repo taxonomy v2', () => {
  test('defines the intended top-level maintenance categories', () => {
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

    expect(findRepoTaxonomyEntry('review-reference-sidecars')).toMatchObject({
      current_path: 'references/review',
      target_path: 'references/review',
      move_policy: 'keep_in_place',
      risk_level: 'medium',
    });

    expect(findRepoTaxonomyEntry('design-references')).toMatchObject({
      current_path: 'references/design',
      target_path: 'references/design',
      move_policy: 'keep_in_place',
      risk_level: 'medium',
    });

    expect(findRepoTaxonomyEntry('qa')).toMatchObject({
      current_path: 'references/qa',
      target_path: 'references/qa',
      move_policy: 'keep_in_place',
      risk_level: 'medium',
    });

    expect(findRepoTaxonomyEntry('cso')).toMatchObject({
      current_path: 'references/cso',
      target_path: 'references/cso',
      move_policy: 'keep_in_place',
      risk_level: 'low',
    });

    expect(findRepoTaxonomyEntry('upstream')).toMatchObject({
      current_path: 'upstream',
      target_path: 'vendor/upstream',
      move_policy: 'future_move',
    });

    expect(findRepoTaxonomyEntry('gemini-cli-host')).toMatchObject({
      current_path: '.gemini',
      target_path: 'hosts/gemini-cli',
      move_policy: 'future_move',
    });

    expect(findRepoTaxonomyEntry('browse-extension')).toMatchObject({
      current_path: 'extension',
      target_path: 'runtimes/browse/extension',
      move_policy: 'compat_required',
    });

    expect(findRepoTaxonomyEntry('codex-openai-metadata')).toMatchObject({
      current_path: 'agents/openai.yaml',
      target_path: 'hosts/codex/openai.yaml',
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

  test('resolves reference compatibility sources by preferring future paths and falling back to current paths', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'nexus-reference-compat-'));

    try {
      mkdirSync(join(fixtureRoot, 'review'), { recursive: true });
      writeFileSync(join(fixtureRoot, 'review', 'checklist.md'), 'current');
      expect(resolveReferenceCompatSource('review/checklist.md', fixtureRoot)).toBe('review/checklist.md');

      mkdirSync(join(fixtureRoot, 'references', 'review'), { recursive: true });
      writeFileSync(join(fixtureRoot, 'references', 'review', 'checklist.md'), 'future');
      expect(resolveReferenceCompatSource('review/checklist.md', fixtureRoot)).toBe(
        'references/review/checklist.md'
      );

      mkdirSync(join(fixtureRoot, 'qa', 'templates'), { recursive: true });
      expect(resolveReferenceCompatSource('qa/templates', fixtureRoot)).toBe('qa/templates');

      mkdirSync(join(fixtureRoot, 'references', 'qa', 'templates'), { recursive: true });
      expect(resolveReferenceCompatSource('qa/templates', fixtureRoot)).toBe('references/qa/templates');

      expect(resolveReferenceCompatSource('cso/ACKNOWLEDGEMENTS.md', fixtureRoot)).toBeNull();
      expect(() => resolveReferenceCompatSource('unknown/reference.md', fixtureRoot)).toThrow(
        'Unknown reference compatibility path'
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  test('creates only safe navigation facades for physical taxonomy roots', () => {
    expect(plannedFacadePaths()).toEqual([
      'runtimes/README.md',
      'runtimes/browse.md',
      'runtimes/design.md',
      'runtimes/design-html.md',
      'runtimes/safety.md',
      'references/README.md',
      'references/review/README.md',
      'references/qa/README.md',
      'references/design/README.md',
      'references/cso/README.md',
      'hosts/README.md',
      'hosts/claude/README.md',
      'hosts/codex/README.md',
      'hosts/gemini-cli/README.md',
      'hosts/factory/README.md',
    ]);

    for (const facade of REPO_TAXONOMY_FACADES) {
      expect(facade.kind).toBe('navigation_only');
      expect(existsSync(join(ROOT, facade.facade_path))).toBe(true);
      expect(facade.active_source_paths.length).toBeGreaterThan(0);
      for (const activeSourcePath of facade.active_source_paths) {
        expect(existsSync(join(ROOT, activeSourcePath))).toBe(true);
      }
    }

    expect(findRepoTaxonomyFacade('references/review/README.md')).toMatchObject({
      active_source_paths: ['review', 'references/review'],
      guarded_future_paths: ['references/review/specialists'],
    });

    expect(findRepoTaxonomyFacade('references/qa/README.md')).toMatchObject({
      active_source_paths: ['references/qa'],
    });
    expect(findRepoTaxonomyFacade('references/qa/README.md')).not.toHaveProperty('guarded_future_paths');

    expect(findRepoTaxonomyFacade('references/design/README.md')).toMatchObject({
      active_source_paths: ['references/design'],
    });
    expect(findRepoTaxonomyFacade('references/design/README.md')).not.toHaveProperty('guarded_future_paths');

    expect(findRepoTaxonomyFacade('references/cso/README.md')).toMatchObject({
      active_source_paths: ['references/cso'],
    });
    expect(findRepoTaxonomyFacade('references/cso/README.md')).not.toHaveProperty('guarded_future_paths');

    const facadePaths = new Set(plannedFacadePaths());
    for (const mapping of REFERENCE_COMPAT_MAPPINGS) {
      expect(facadePaths.has(mapping.future_source_path)).toBe(false);
    }
  });

  test('moves reference batches under references while preserving runtime compatibility paths', () => {
    const movedReferencePaths = [
      ['review/checklist.md', 'references/review/checklist.md'],
      ['review/design-checklist.md', 'references/review/design-checklist.md'],
      ['review/greptile-triage.md', 'references/review/greptile-triage.md'],
      ['review/TODOS-format.md', 'references/review/TODOS-format.md'],
      ['qa/templates/qa-report-template.md', 'references/qa/templates/qa-report-template.md'],
      ['qa/references/issue-taxonomy.md', 'references/qa/references/issue-taxonomy.md'],
      ['cso/ACKNOWLEDGEMENTS.md', 'references/cso/ACKNOWLEDGEMENTS.md'],
      ['design/references/animations.md', 'references/design/animations.md'],
      ['design/references/design-consultation-cheatsheet.md', 'references/design/design-consultation-cheatsheet.md'],
      ['design/references/design-context.md', 'references/design/design-context.md'],
      ['design/references/design-review-methodology.md', 'references/design/design-review-methodology.md'],
      ['design/references/editable-pptx.md', 'references/design/editable-pptx.md'],
      ['design/references/governance.md', 'references/design/governance.md'],
      ['design/references/hard-rules.md', 'references/design/hard-rules.md'],
      ['design/references/outside-voices.md', 'references/design/outside-voices.md'],
      ['design/references/plan-design-principles.md', 'references/design/plan-design-principles.md'],
      ['design/references/pretext-html-engine.md', 'references/design/pretext-html-engine.md'],
      ['design/references/shotgun-loop.md', 'references/design/shotgun-loop.md'],
      ['design/references/slide-decks.md', 'references/design/slide-decks.md'],
      ['design/references/tweaks-system.md', 'references/design/tweaks-system.md'],
      ['design/references/verification.md', 'references/design/verification.md'],
      ['design/references/video-export.md', 'references/design/video-export.md'],
    ];

    for (const [legacySourcePath, movedSourcePath] of movedReferencePaths) {
      expect(existsSync(join(ROOT, movedSourcePath))).toBe(true);
      expect(existsSync(join(ROOT, legacySourcePath))).toBe(false);
    }

    expect(resolveReferenceCompatSource('review/checklist.md', ROOT)).toBe(
      'references/review/checklist.md'
    );
    expect(resolveReferenceCompatSource('qa/templates', ROOT)).toBe('references/qa/templates');
    expect(resolveReferenceCompatSource('cso/ACKNOWLEDGEMENTS.md', ROOT)).toBe(
      'references/cso/ACKNOWLEDGEMENTS.md'
    );
    expect(resolveReferenceCompatSource('design/references', ROOT)).toBe('references/design');
  });

  test('does not create remaining guarded future reference sources that setup would treat as real assets', () => {
    const guardedFuturePaths = REPO_TAXONOMY_FACADES.flatMap(
      (facade) => facade.guarded_future_paths ?? []
    );

    expect(guardedFuturePaths).toContain('references/review/specialists');
    expect(guardedFuturePaths).not.toContain('references/design');
    expect(guardedFuturePaths).not.toContain('references/review/checklist.md');
    expect(guardedFuturePaths).not.toContain('references/qa/templates');
    expect(guardedFuturePaths).not.toContain('references/cso/ACKNOWLEDGEMENTS.md');

    for (const guardedPath of guardedFuturePaths) {
      expect(existsSync(join(ROOT, guardedPath))).toBe(false);
    }
  });

  test('documents all high-risk visible root directories that should not be moved ad hoc', () => {
    const documented = new Set(REPO_TAXONOMY_ENTRIES.map((entry) => entry.current_path));
    const highRiskRoots = [
      'browse',
      'design',
      'design-html',
      'review',
      'careful',
      'freeze',
      'upstream',
      'upstream-notes',
      'extension',
      '.agents',
      '.factory',
    ];

    expect(highRiskRoots.filter((root) => !documented.has(root))).toEqual([]);

    for (const root of highRiskRoots) {
      expect(existsSync(join(ROOT, root))).toBe(true);
      expect(findRepoTaxonomyEntry(root)?.move_policy).not.toBe('moved');
    }
  });

  test('classifies representative repo files into exact future taxonomy paths', () => {
    expect(classifyRepoPath('extension/sidepanel.js')).toMatchObject({
      category: 'runtimes',
      target_path: 'runtimes/browse/extension/sidepanel.js',
      move_policy: 'compat_required',
    });

    expect(classifyRepoPath('agents/openai.yaml')).toMatchObject({
      category: 'hosts',
      target_path: 'hosts/codex/openai.yaml',
      move_policy: 'future_move',
    });

    expect(classifyRepoPath('references/design/hard-rules.md')).toMatchObject({
      category: 'references',
      target_path: 'references/design/hard-rules.md',
      move_policy: 'keep_in_place',
      rule: 'design-references',
    });

    expect(classifyRepoPath('references/review/checklist.md')).toMatchObject({
      category: 'references',
      target_path: 'references/review/checklist.md',
      move_policy: 'keep_in_place',
      rule: 'review-reference-sidecars',
    });

    expect(classifyRepoPath('skills/support/land/SKILL.md.tmpl')).toMatchObject({
      category: 'skills',
      target_path: 'skills/support/land/SKILL.md.tmpl',
      move_policy: 'keep_in_place',
    });

    expect(classifyRepoPath('README.md')).toMatchObject({
      category: 'root',
      target_path: 'README.md',
      move_policy: 'keep_in_place',
    });
  });

  test('repo path inventory documents every tracked file plus the inventory generator itself', () => {
    const inventoryPath = join(ROOT, 'docs/architecture/repo-path-inventory.md');
    const inventory = readFileSync(inventoryPath, 'utf8');
    const git = Bun.spawnSync(['git', 'ls-files'], { cwd: ROOT });
    const trackedFiles = new TextDecoder().decode(git.stdout).trim().split('\n').filter(Boolean);
    const expectedFiles = new Set([
      ...trackedFiles,
      'scripts/repo-path-inventory.ts',
      'docs/architecture/repo-path-inventory.md',
    ]);

    expect(inventory).toContain('# Nexus Repo Path Inventory');
    expect(inventory).toContain('Generated by `scripts/repo-path-inventory.ts`.');
    for (const file of expectedFiles) {
      expect(inventory).toContain(`| \`${file}\` |`);
    }
  });

  test('architecture note explains the conservative move policy and target tree', () => {
    const doc = readFileSync(join(ROOT, 'docs/architecture/repo-taxonomy-v2.md'), 'utf8');

    expect(doc).toContain('The root `/nexus` source template has moved into the skill taxonomy.');
    expect(doc).toContain('root `SKILL.md` remains a generated');
    expect(doc).toContain('documentation-only facades');
    expect(doc).toContain('hosts/gemini-cli');
    expect(doc).toContain('runtimes/browse');
    expect(doc).toContain('runtimes/browse/extension');
    expect(doc).toContain('references/review');
    expect(doc).toContain('references/design/README.md');
    expect(doc).toContain('hosts/codex/openai.yaml');
    expect(doc).toContain('$NEXUS_ROOT/review/checklist.md');
    expect(doc).toContain('docs/architecture/repo-path-inventory.md');
  });
});
