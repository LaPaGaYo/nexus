import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  NEXUS_STAGE_CONTENT,
  getStageContent,
  getStageContentSourceBinding,
} from '../../../lib/nexus/stage-content';

describe('nexus stage content', () => {
  test('every canonical lifecycle stage exposes a Nexus-owned stage-content pack', () => {
    expect(NEXUS_STAGE_CONTENT).toEqual([
      'nexus-discover-content',
      'nexus-frame-content',
      'nexus-plan-content',
      'nexus-handoff-content',
      'nexus-build-content',
      'nexus-review-content',
      'nexus-qa-content',
      'nexus-ship-content',
      'nexus-closeout-content',
    ]);
  });

  test('every stage-content pack provides the required sections', () => {
    for (const id of NEXUS_STAGE_CONTENT) {
      const pack = getStageContent(id);

      expect(pack.id).toBe(id);
      expect(pack.stage.length).toBeGreaterThan(0);
      expect(pack.sections.overview.length).toBeGreaterThan(0);
      expect(pack.sections.checklist.length).toBeGreaterThan(0);
      expect(pack.sections.artifact_contract.length).toBeGreaterThan(0);
      expect(pack.sections.routing.length).toBeGreaterThan(0);
    }
  });

  test('every stage-content source binding resolves to Nexus-owned content roots', () => {
    for (const id of NEXUS_STAGE_CONTENT) {
      const binding = getStageContentSourceBinding(id);

      expect(binding.content_id).toBe(id);
      expect(binding.content_root.startsWith('lib/nexus/stage-content/')).toBe(true);
      expect(existsSync(resolve(import.meta.dir, '..', '..', '..', binding.content_root))).toBe(true);
      expect(binding.source_refs).toEqual([]);
    }
  });

  test('discover, frame, and plan use dedicated Nexus-authored content directories', () => {
    const contentFiles = [
      'lib/nexus/stage-content/discover/index.ts',
      'lib/nexus/stage-content/discover/overview.md',
      'lib/nexus/stage-content/discover/checklist.md',
      'lib/nexus/stage-content/discover/artifact-contract.md',
      'lib/nexus/stage-content/discover/routing.md',
      'lib/nexus/stage-content/frame/index.ts',
      'lib/nexus/stage-content/frame/overview.md',
      'lib/nexus/stage-content/frame/checklist.md',
      'lib/nexus/stage-content/frame/artifact-contract.md',
      'lib/nexus/stage-content/frame/routing.md',
      'lib/nexus/stage-content/plan/index.ts',
      'lib/nexus/stage-content/plan/overview.md',
      'lib/nexus/stage-content/plan/checklist.md',
      'lib/nexus/stage-content/plan/artifact-contract.md',
      'lib/nexus/stage-content/plan/routing.md',
    ];

    for (const file of contentFiles) {
      expect(existsSync(resolve(import.meta.dir, '..', '..', '..', file))).toBe(true);
    }

    expect(getStageContent('nexus-discover-content').sections.overview).toContain('Nexus-owned');
    expect(getStageContent('nexus-frame-content').sections.overview).toContain('Nexus-owned');
    expect(getStageContent('nexus-plan-content').sections.overview).toContain('Nexus-owned');
  });

  test('handoff, build, and closeout use dedicated Nexus-authored content directories', () => {
    const contentFiles = [
      'lib/nexus/stage-content/handoff/index.ts',
      'lib/nexus/stage-content/handoff/overview.md',
      'lib/nexus/stage-content/handoff/checklist.md',
      'lib/nexus/stage-content/handoff/artifact-contract.md',
      'lib/nexus/stage-content/handoff/routing.md',
      'lib/nexus/stage-content/build/index.ts',
      'lib/nexus/stage-content/build/overview.md',
      'lib/nexus/stage-content/build/checklist.md',
      'lib/nexus/stage-content/build/artifact-contract.md',
      'lib/nexus/stage-content/build/routing.md',
      'lib/nexus/stage-content/closeout/index.ts',
      'lib/nexus/stage-content/closeout/overview.md',
      'lib/nexus/stage-content/closeout/checklist.md',
      'lib/nexus/stage-content/closeout/artifact-contract.md',
      'lib/nexus/stage-content/closeout/routing.md',
    ];

    for (const file of contentFiles) {
      expect(existsSync(resolve(import.meta.dir, '..', '..', '..', file))).toBe(true);
    }

    expect(getStageContent('nexus-handoff-content').sections.routing).toContain('approved');
    expect(getStageContent('nexus-build-content').sections.checklist).toContain('actual route');
    expect(getStageContent('nexus-closeout-content').sections.checklist).toContain('archive state');
  });

  test('review, qa, and ship use dedicated Nexus-authored content directories without implying runtime ownership', () => {
    const contentFiles = [
      'lib/nexus/stage-content/review/index.ts',
      'lib/nexus/stage-content/review/overview.md',
      'lib/nexus/stage-content/review/checklist.md',
      'lib/nexus/stage-content/review/artifact-contract.md',
      'lib/nexus/stage-content/review/routing.md',
      'lib/nexus/stage-content/qa/index.ts',
      'lib/nexus/stage-content/qa/overview.md',
      'lib/nexus/stage-content/qa/checklist.md',
      'lib/nexus/stage-content/qa/artifact-contract.md',
      'lib/nexus/stage-content/qa/routing.md',
      'lib/nexus/stage-content/ship/index.ts',
      'lib/nexus/stage-content/ship/overview.md',
      'lib/nexus/stage-content/ship/checklist.md',
      'lib/nexus/stage-content/ship/artifact-contract.md',
      'lib/nexus/stage-content/ship/routing.md',
    ];

    for (const file of contentFiles) {
      expect(existsSync(resolve(import.meta.dir, '..', '..', '..', file))).toBe(true);
    }

    expect(getStageContent('nexus-review-content').sections.overview).toContain('Nexus-owned');
    expect(getStageContent('nexus-qa-content').sections.artifact_contract).toContain('status.json');
    expect(getStageContent('nexus-ship-content').sections.routing).toContain('must not imply');
  });
});
