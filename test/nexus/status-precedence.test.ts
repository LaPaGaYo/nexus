import { describe, expect, test } from 'bun:test';
import {
  stageAdapterOutputPath,
  stageConflictMarkdownPath,
  stageConflictPath,
  stageNormalizationPath,
} from '../../lib/nexus/artifacts';

describe('nexus canonical artifact precedence', () => {
  test('uses dedicated traceability paths that do not replace status.json', () => {
    expect(stageAdapterOutputPath('build')).toBe('.planning/current/build/adapter-output.json');
    expect(stageNormalizationPath('build')).toBe('.planning/current/build/normalization.json');
    expect(stageConflictPath('build', 'ccb')).toBe('.planning/current/conflicts/build-ccb.json');
    expect(stageConflictMarkdownPath('build', 'ccb')).toBe('.planning/current/conflicts/build-ccb.md');
  });
});
