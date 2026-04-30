import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import {
  PM_SOURCE_MAP,
  GSD_SOURCE_MAP,
  SUPERPOWERS_SOURCE_MAP,
  CCB_SOURCE_MAP,
} from '../../lib/nexus/absorption';
import { getStagePackSourceBinding } from '../../lib/nexus/stage-packs/source-map';

describe('nexus absorbed source maps', () => {
  test('every absorbed source entry points at an imported upstream path', () => {
    for (const entry of [
      ...PM_SOURCE_MAP,
      ...GSD_SOURCE_MAP,
      ...SUPERPOWERS_SOURCE_MAP,
      ...CCB_SOURCE_MAP,
    ]) {
      expect(entry.imported_path.startsWith('vendor/upstream/')).toBe(true);
      expect(entry.upstream_file.startsWith(entry.imported_path)).toBe(true);
      expect(entry.canonical_stage.length).toBeGreaterThan(0);
      expect(existsSync(entry.upstream_file)).toBe(true);
    }
  });

  test('records newly absorbed Superpowers patterns as Nexus-owned capabilities', () => {
    const capabilities = SUPERPOWERS_SOURCE_MAP.map((entry) => entry.absorbed_capability);
    expect(capabilities).toContain('superpowers-build-two-stage-review');
    expect(capabilities).toContain('superpowers-review-feedback-triage');
    expect(capabilities).toContain('superpowers-qa-verification');

    expect(getStagePackSourceBinding('nexus-build-pack').absorbed_capabilities).toContain(
      'superpowers-build-two-stage-review',
    );
    expect(getStagePackSourceBinding('nexus-review-pack').absorbed_capabilities).toContain(
      'superpowers-review-feedback-triage',
    );
    expect(getStagePackSourceBinding('nexus-qa-pack').absorbed_capabilities).toContain(
      'superpowers-qa-verification',
    );
  });
});
