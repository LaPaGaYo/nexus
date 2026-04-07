import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  PRODUCT_SURFACE_RULES,
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
    expect(PRODUCT_SURFACE_RULES.primary_state_root).toBe('.nexus');
    expect(PRODUCT_SURFACE_RULES.nexus_state_env_var).toBe('NEXUS_STATE_DIR');
    expect(PRODUCT_SURFACE_RULES.gstack_state_env_var).toBe('GSTACK_STATE_DIR');
  });

  test('readme and skills docs already anchor the lifecycle surface on Nexus', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const skills = readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8');

    expect(readme).toContain('# Nexus');
    expect(readme).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Canonical Nexus commands:');
  });

  test('package metadata is Nexus-primary', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

    expect(pkg.name).toBe('nexus');
    expect(pkg.description).toContain('Nexus');
    expect(pkg.description).not.toContain("Garry's Stack");
  });

  test('nexus-branded host helper entrypoints exist alongside compatibility helpers', () => {
    expect(existsSync(join(ROOT, 'bin', 'nexus-config'))).toBe(true);
    expect(existsSync(join(ROOT, 'bin', 'nexus-relink'))).toBe(true);
    expect(existsSync(join(ROOT, 'bin', 'nexus-uninstall'))).toBe(true);
    expect(existsSync(join(ROOT, 'bin', 'nexus-update-check'))).toBe(true);

    expect(existsSync(join(ROOT, 'bin', 'gstack-config'))).toBe(true);
    expect(existsSync(join(ROOT, 'bin', 'gstack-relink'))).toBe(true);
    expect(existsSync(join(ROOT, 'bin', 'gstack-uninstall'))).toBe(true);
    expect(existsSync(join(ROOT, 'bin', 'gstack-update-check'))).toBe(true);
  });

  test('nexus helpers own implementation while gstack helpers are shims', () => {
    const nexusConfig = readFileSync(join(ROOT, 'bin', 'nexus-config'), 'utf8');
    const nexusRelink = readFileSync(join(ROOT, 'bin', 'nexus-relink'), 'utf8');
    const nexusUninstall = readFileSync(join(ROOT, 'bin', 'nexus-uninstall'), 'utf8');
    const nexusUpdateCheck = readFileSync(join(ROOT, 'bin', 'nexus-update-check'), 'utf8');

    const gstackConfig = readFileSync(join(ROOT, 'bin', 'gstack-config'), 'utf8');
    const gstackRelink = readFileSync(join(ROOT, 'bin', 'gstack-relink'), 'utf8');
    const gstackUninstall = readFileSync(join(ROOT, 'bin', 'gstack-uninstall'), 'utf8');
    const gstackUpdateCheck = readFileSync(join(ROOT, 'bin', 'gstack-update-check'), 'utf8');

    expect(nexusConfig).not.toContain('exec "$SCRIPT_DIR/gstack-config"');
    expect(nexusRelink).not.toContain('exec "$SCRIPT_DIR/gstack-relink"');
    expect(nexusUninstall).not.toContain('exec "$SCRIPT_DIR/gstack-uninstall"');
    expect(nexusUpdateCheck).not.toContain('exec "$SCRIPT_DIR/gstack-update-check"');

    expect(gstackConfig).toContain('exec "$SCRIPT_DIR/nexus-config"');
    expect(gstackRelink).toContain('exec "$SCRIPT_DIR/nexus-relink"');
    expect(gstackUninstall).toContain('exec "$SCRIPT_DIR/nexus-uninstall"');
    expect(gstackUpdateCheck).toContain('exec "$SCRIPT_DIR/nexus-update-check"');
  });
});
