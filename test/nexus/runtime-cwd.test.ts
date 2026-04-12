import { describe, expect, test } from 'bun:test';

import { resolveRuntimeCwd } from '../../lib/nexus/runtime-cwd';

describe('resolveRuntimeCwd', () => {
  test('returns the process cwd when no override is set', () => {
    expect(resolveRuntimeCwd({}, '/tmp/project')).toBe('/tmp/project');
  });

  test('prefers NEXUS_PROJECT_CWD when provided', () => {
    expect(resolveRuntimeCwd({ NEXUS_PROJECT_CWD: '/tmp/active-project' }, '/tmp/nexus-install')).toBe(
      '/tmp/active-project',
    );
  });

  test('ignores blank overrides', () => {
    expect(resolveRuntimeCwd({ NEXUS_PROJECT_CWD: '   ' }, '/tmp/project')).toBe('/tmp/project');
  });
});
