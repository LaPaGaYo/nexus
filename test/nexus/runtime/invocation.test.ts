import { describe, expect, test } from 'bun:test';

import { resolveRuntimeInvocation } from '../../../lib/nexus/runtime/invocation';

describe('resolveRuntimeInvocation', () => {
  test('parses discover continuation mode from the CLI flag', () => {
    const resolved = resolveRuntimeInvocation(['discover', '--continuation-mode', 'task'], {});

    expect(resolved.command).toBe('discover');
    expect(resolved.continuationModeOverride).toBe('task');
  });

  test('prefers the CLI flag over NEXUS_CONTINUATION_MODE', () => {
    const resolved = resolveRuntimeInvocation(
      ['discover', '--continuation-mode', 'task'],
      { NEXUS_CONTINUATION_MODE: 'phase' },
    );

    expect(resolved.continuationModeOverride).toBe('task');
  });

  test('uses NEXUS_CONTINUATION_MODE when the CLI flag is absent', () => {
    const resolved = resolveRuntimeInvocation(['discover'], { NEXUS_CONTINUATION_MODE: 'phase' });

    expect(resolved.continuationModeOverride).toBe('phase');
  });

  test('parses review advisory disposition from the CLI flag', () => {
    const resolved = resolveRuntimeInvocation(['qa', '--review-advisory-disposition', 'continue_to_qa'], {});

    expect(resolved.command).toBe('qa');
    expect(resolved.reviewAdvisoryDispositionOverride).toBe('continue_to_qa');
  });

  test('uses NEXUS_REVIEW_ADVISORY_DISPOSITION when the CLI flag is absent', () => {
    const resolved = resolveRuntimeInvocation(['ship'], { NEXUS_REVIEW_ADVISORY_DISPOSITION: 'defer_to_follow_on' });

    expect(resolved.reviewAdvisoryDispositionOverride).toBe('defer_to_follow_on');
  });

  test('parses output mode from the CLI flag', () => {
    const resolved = resolveRuntimeInvocation(['qa', '--output', 'human'], {});

    expect(resolved.outputMode).toBe('human');
  });

  test('parses interactive output mode from the CLI flag', () => {
    const resolved = resolveRuntimeInvocation(['qa', '--output', 'interactive'], {});

    expect(resolved.outputMode).toBe('interactive');
  });

  test('prefers the CLI output mode over NEXUS_OUTPUT_MODE', () => {
    const resolved = resolveRuntimeInvocation(
      ['qa', '--output', 'json'],
      { NEXUS_OUTPUT_MODE: 'human' },
    );

    expect(resolved.outputMode).toBe('json');
  });

  test('uses NEXUS_OUTPUT_MODE when the CLI flag is absent', () => {
    const resolved = resolveRuntimeInvocation(['qa'], { NEXUS_OUTPUT_MODE: 'human' });

    expect(resolved.outputMode).toBe('human');
  });

  test('rejects invalid continuation modes', () => {
    expect(() => resolveRuntimeInvocation(['discover', '--continuation-mode', 'milestone'], {})).toThrow(
      /Invalid continuation mode/i,
    );
  });

  test('rejects invalid review advisory dispositions', () => {
    expect(() => resolveRuntimeInvocation(['qa', '--review-advisory-disposition', 'later'], {})).toThrow(
      /Invalid review advisory disposition/i,
    );
  });

  test('rejects invalid output modes', () => {
    expect(() => resolveRuntimeInvocation(['qa', '--output', 'pretty'], {})).toThrow(
      /Invalid output mode/i,
    );
  });

  test('rejects continuation mode flags on non-discover commands', () => {
    expect(() => resolveRuntimeInvocation(['review', '--continuation-mode', 'task'], {})).toThrow(
      /only supported for discover/i,
    );
  });

  test('rejects review advisory disposition flags on unsupported commands', () => {
    expect(() => resolveRuntimeInvocation(['review', '--review-advisory-disposition', 'continue_to_qa'], {})).toThrow(
      /only supported for build, qa, ship, or closeout/i,
    );
  });

  test('rejects unknown CLI arguments', () => {
    expect(() => resolveRuntimeInvocation(['discover', '--bogus'], {})).toThrow(/Unknown Nexus argument/i);
  });
});
