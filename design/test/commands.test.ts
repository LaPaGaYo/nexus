import { describe, expect, test } from 'bun:test';
import { COMMANDS } from '../src/commands';

describe('design command registry', () => {
  test('extract stays non-persistent by default and exposes an explicit DESIGN.md write flag', () => {
    const extract = COMMANDS.get('extract');
    expect(extract).toBeDefined();
    expect(extract?.description).toBe('Extract design language from an approved mockup');
    expect(extract?.usage).toContain('--write-design-md');
    expect(extract?.flags).toContain('--write-design-md');
  });
});
