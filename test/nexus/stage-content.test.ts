import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
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
});
