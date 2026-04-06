import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import {
  PM_SOURCE_MAP,
  GSD_SOURCE_MAP,
  SUPERPOWERS_SOURCE_MAP,
  CCB_SOURCE_MAP,
} from '../../lib/nexus/absorption';

describe('nexus absorbed source maps', () => {
  test('every absorbed source entry points at an imported upstream path', () => {
    for (const entry of [
      ...PM_SOURCE_MAP,
      ...GSD_SOURCE_MAP,
      ...SUPERPOWERS_SOURCE_MAP,
      ...CCB_SOURCE_MAP,
    ]) {
      expect(entry.imported_path.startsWith('upstream/')).toBe(true);
      expect(entry.upstream_file.startsWith(entry.imported_path)).toBe(true);
      expect(entry.canonical_stage.length).toBeGreaterThan(0);
      expect(existsSync(entry.upstream_file)).toBe(true);
    }
  });
});
