import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  LEGACY_COMPAT_NAMESPACE,
  LEGACY_STATE_ROOT,
  PRIMARY_NAMESPACE,
  PRIMARY_PACKAGE_NAME,
  PRIMARY_PRODUCT_NAME,
} from '../../lib/nexus/product-surface';

const ROOT = join(import.meta.dir, '..', '..');

describe('nexus product surface contract', () => {
  test('freezes the primary and compatibility product identity', () => {
    expect(PRIMARY_PRODUCT_NAME).toBe('Nexus');
    expect(PRIMARY_PACKAGE_NAME).toBe('nexus');
    expect(PRIMARY_NAMESPACE).toBe('nexus');
    expect(LEGACY_COMPAT_NAMESPACE).toBe('gstack');
    expect(LEGACY_STATE_ROOT).toBe('.gstack');
  });

  test('readme and skills docs already anchor the lifecycle surface on Nexus', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const skills = readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8');

    expect(readme).toContain('# Nexus');
    expect(readme).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Canonical Nexus commands:');
  });
});
