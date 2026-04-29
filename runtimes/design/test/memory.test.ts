import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { readDesignConstraints } from '../src/memory';

describe('design context loading', () => {
  test('combines DESIGN.md and brand-spec.md when both exist', () => {
    const tmpDir = `/tmp/design-memory-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'DESIGN.md'), '# Design System\nPrimary font: Satoshi');
    fs.writeFileSync(path.join(tmpDir, 'brand-spec.md'), '# Brand Spec\nLogo: assets/logo.svg');

    const combined = readDesignConstraints(tmpDir);
    expect(combined).toContain('DESIGN.md');
    expect(combined).toContain('Primary font: Satoshi');
    expect(combined).toContain('brand-spec.md');
    expect(combined).toContain('Logo: assets/logo.svg');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns null when no design context exists', () => {
    const tmpDir = `/tmp/design-memory-empty-${Date.now()}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    expect(readDesignConstraints(tmpDir)).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
