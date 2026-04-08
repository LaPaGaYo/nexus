import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  PRIMARY_DEV_ROOT,
  PRIMARY_SUPPORT_NAMESPACE,
  PRIMARY_WORKTREE_ROOT,
  LEGACY_DEV_ROOT,
  LEGACY_SUPPORT_NAMESPACE,
  LEGACY_WORKTREE_ROOT,
  PRODUCT_SURFACE_RULES,
  LEGACY_COMPAT_NAMESPACE,
  LEGACY_STATE_ROOT,
  PRIMARY_NAMESPACE,
  PRIMARY_PACKAGE_NAME,
  PRIMARY_PRODUCT_NAME,
} from '../../lib/nexus/product-surface';
import {
  ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE,
  RETAINED_BOUNDARY_COMPATIBILITY_SHIMS,
} from '../../lib/nexus/compatibility-surface';

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
    expect(PRIMARY_SUPPORT_NAMESPACE).toBe('nexus');
    expect(LEGACY_SUPPORT_NAMESPACE).toBe('gstack');
    expect(PRIMARY_WORKTREE_ROOT).toBe('.nexus-worktrees');
    expect(LEGACY_WORKTREE_ROOT).toBe('.gstack-worktrees');
    expect(PRIMARY_DEV_ROOT).toBe('.nexus-dev');
    expect(LEGACY_DEV_ROOT).toBe('.gstack-dev');
    expect(PRODUCT_SURFACE_RULES.primary_support_namespace).toBe('nexus');
    expect(PRODUCT_SURFACE_RULES.legacy_support_namespace).toBe('gstack');
    expect(PRODUCT_SURFACE_RULES.primary_worktree_root).toBe('.nexus-worktrees');
    expect(PRODUCT_SURFACE_RULES.legacy_worktree_root).toBe('.gstack-worktrees');
    expect(PRODUCT_SURFACE_RULES.primary_dev_root).toBe('.nexus-dev');
    expect(PRODUCT_SURFACE_RULES.legacy_dev_root).toBe('.gstack-dev');
  });

  test('readme and skills docs already anchor the lifecycle surface on Nexus', () => {
    const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
    const skills = readFileSync(join(ROOT, 'docs', 'skills.md'), 'utf8');

    expect(readme).toContain('# Nexus');
    expect(readme).toContain('Nexus is the only command surface.');
    expect(readme).toContain('~/.claude/skills/nexus');
    expect(readme).toContain('.claude/skills/nexus');
    expect(readme).toContain('~/.codex/skills/nexus');
    expect(readme).toContain('~/.factory/skills/nexus');
    expect(readme).toContain('/nexus-upgrade');
    expect(readme).toContain('nexus-analytics');
    expect(readme).toContain('nexus-config set telemetry off');
    expect(readme).toContain('~/.nexus/config.yaml');
    expect(readme).not.toContain('/gstack-upgrade');
    expect(readme).not.toContain('gstack-analytics');
    expect(readme).not.toContain('gstack-config set telemetry off');
    expect(readme).not.toContain('~/.gstack/config.yaml');
    expect(skills).toContain('Nexus is the only command surface.');
    expect(skills).toContain('Canonical Nexus commands:');
    expect(skills).toContain('/nexus-upgrade');
    expect(skills).toContain('~/.nexus/projects/');
    expect(skills).toContain('nexus-config set skip_eng_review true');
    expect(skills).toContain('~/.nexus/greptile-history.md');
    expect(skills).not.toContain('/gstack-upgrade');
    expect(skills).not.toContain('~/.gstack/projects/');
    expect(skills).not.toContain('gstack-config set skip_eng_review true');
    expect(skills).not.toContain('~/.gstack/greptile-history.md');
  });

  test('setup presents Nexus as the active install and helper surface', () => {
    const setup = readFileSync(join(ROOT, 'setup'), 'utf8');

    expect(setup).toContain('nexus-config');
    expect(setup).toContain('/nexus-upgrade');
    expect(setup).toContain('~/.nexus');
    expect(setup).toContain('$HOME/.nexus/repos/nexus');
    expect(setup).not.toContain('gstack setup failed');
    expect(setup).not.toContain('/gstack-upgrade');
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

  test('product surface keeps gstack limited to the retained compatibility budget', () => {
    expect(RETAINED_BOUNDARY_COMPATIBILITY_SHIMS).toEqual([
      'bin/gstack-config',
      'bin/gstack-relink',
      'bin/gstack-uninstall',
      'bin/gstack-update-check',
    ]);
    expect(ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE).toContain('gstack-upgrade');
    expect(ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE).toContain('bin/gstack-diff-scope');
    expect(ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE).not.toContain('bin/gstack-relink');
  });
});
