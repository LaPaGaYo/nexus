import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { resolve } from 'path';
import {
  NEXUS_STAGE_CONTENT,
  getStageContent,
  getStageContentSourceBinding,
} from '../../lib/nexus/stage-content';

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

  test('every stage-content source binding resolves to upstream material or Nexus-owned content roots', () => {
    for (const id of NEXUS_STAGE_CONTENT) {
      const binding = getStageContentSourceBinding(id);

      expect(binding.content_id).toBe(id);
      expect(binding.source_refs.length).toBeGreaterThan(0);
      expect(binding.content_root.startsWith('lib/nexus/stage-content/')).toBe(true);

      for (const entry of binding.source_refs) {
        expect(entry.imported_path.startsWith('upstream/')).toBe(true);
        expect(entry.upstream_file.startsWith(entry.imported_path)).toBe(true);
        expect(existsSync(entry.upstream_file)).toBe(true);
      }
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
      expect(existsSync(resolve(import.meta.dir, '..', '..', file))).toBe(true);
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
      expect(existsSync(resolve(import.meta.dir, '..', '..', file))).toBe(true);
    }

    expect(getStageContent('nexus-handoff-content').sections.routing).toContain('approved');
    expect(getStageContent('nexus-build-content').sections.checklist).toContain('actual route');
    expect(getStageContent('nexus-closeout-content').sections.checklist).toContain('archive state');
  });
});
