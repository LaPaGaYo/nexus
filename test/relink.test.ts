import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const BIN = path.join(ROOT, 'bin');

let tmpDir: string;
let skillsDir: string;
let installDir: string;

function run(cmd: string, env: Record<string, string> = {}, expectFail = false): string {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      env: { ...process.env, GSTACK_STATE_DIR: tmpDir, ...env },
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e: any) {
    if (expectFail) return (e.stderr || e.stdout || '').toString().trim();
    throw e;
  }
}

// Create a mock gstack install directory with skill subdirs
function setupMockInstall(skills: string[]): void {
  installDir = path.join(tmpDir, 'gstack-install');
  skillsDir = path.join(tmpDir, 'skills');
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  // Copy the real gstack-config and gstack-relink to the mock install
  const mockBin = path.join(installDir, 'bin');
  fs.mkdirSync(mockBin, { recursive: true });
  fs.copyFileSync(path.join(BIN, 'gstack-config'), path.join(mockBin, 'gstack-config'));
  fs.chmodSync(path.join(mockBin, 'gstack-config'), 0o755);
  if (fs.existsSync(path.join(BIN, 'nexus-config'))) {
    fs.copyFileSync(path.join(BIN, 'nexus-config'), path.join(mockBin, 'nexus-config'));
    fs.chmodSync(path.join(mockBin, 'nexus-config'), 0o755);
  }
  if (fs.existsSync(path.join(BIN, 'gstack-relink'))) {
    fs.copyFileSync(path.join(BIN, 'gstack-relink'), path.join(mockBin, 'gstack-relink'));
    fs.chmodSync(path.join(mockBin, 'gstack-relink'), 0o755);
  }
  if (fs.existsSync(path.join(BIN, 'nexus-relink'))) {
    fs.copyFileSync(path.join(BIN, 'nexus-relink'), path.join(mockBin, 'nexus-relink'));
    fs.chmodSync(path.join(mockBin, 'nexus-relink'), 0o755);
  }
  if (fs.existsSync(path.join(BIN, 'gstack-patch-names'))) {
    fs.copyFileSync(path.join(BIN, 'gstack-patch-names'), path.join(mockBin, 'gstack-patch-names'));
    fs.chmodSync(path.join(mockBin, 'gstack-patch-names'), 0o755);
  }

  // Create mock skill directories with proper frontmatter
  for (const skill of skills) {
    fs.mkdirSync(path.join(installDir, skill), { recursive: true });
    fs.writeFileSync(
      path.join(installDir, skill, 'SKILL.md'),
      `---\nname: ${skill}\ndescription: test\n---\n# ${skill}`
    );
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-relink-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('gstack-relink (#578)', () => {
  test('creates nexus-* symlinks when skill_prefix=true', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    fs.symlinkSync(path.join(installDir, 'qa'), path.join(skillsDir, 'gstack-qa'));
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    const output = run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-ship'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-review'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'gstack-qa'))).toBe(false);
    expect(output).toContain('nexus-');
  });

  // Test 12: flat symlinks when skill_prefix=false
  test('creates flat symlinks when skill_prefix=false', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix false`);
    const output = run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'ship'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'review'))).toBe(true);
    expect(output).toContain('flat');
  });

  // Test 13: cleans stale symlinks from opposite mode
  test('cleans up stale symlinks from opposite mode', () => {
    setupMockInstall(['qa', 'ship']);
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    fs.symlinkSync(path.join(installDir, 'qa'), path.join(skillsDir, 'gstack-qa'));

    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix false`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(skillsDir, 'qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(false);
    expect(fs.existsSync(path.join(skillsDir, 'gstack-qa'))).toBe(false);
  });

  // Test 14: error when install dir missing
  test('prints error when install dir missing', () => {
    const output = run(`${BIN}/gstack-relink`, {
      GSTACK_INSTALL_DIR: '/nonexistent/path/gstack',
      GSTACK_SKILLS_DIR: '/nonexistent/path/skills',
    }, true);
    expect(output).toContain('setup');
  });

  test('does not double-prefix gstack-upgrade directory', () => {
    setupMockInstall(['qa', 'ship', 'gstack-upgrade']);
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'gstack-upgrade'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-gstack-upgrade'))).toBe(false);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
  });

  test('gstack-config set skill_prefix triggers relink', () => {
    setupMockInstall(['qa', 'ship']);
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-ship'))).toBe(true);
  });

  test('nexus-config and nexus-relink prefer NEXUS_STATE_DIR over GSTACK_STATE_DIR', () => {
    setupMockInstall(['qa', 'ship']);
    const nexusStateDir = path.join(tmpDir, 'nexus-state');

    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`, {
      NEXUS_STATE_DIR: nexusStateDir,
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(nexusStateDir, 'config.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'config.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-ship'))).toBe(true);
  });
});

describe('gstack-patch-names (#620/#578)', () => {
  // Helper to read name: from SKILL.md frontmatter
  function readSkillName(skillDir: string): string | null {
    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    const match = content.match(/^name:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  }

  test('prefix=true patches name: field in SKILL.md', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('nexus-qa');
    expect(readSkillName(path.join(installDir, 'ship'))).toBe('nexus-ship');
    expect(readSkillName(path.join(installDir, 'review'))).toBe('nexus-review');
  });

  test('prefix=false restores name: field in SKILL.md', () => {
    setupMockInstall(['qa', 'ship']);
    // First, prefix them
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('nexus-qa');
    // Now switch to flat mode
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix false`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    // Verify name: field is restored to unprefixed
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('qa');
    expect(readSkillName(path.join(installDir, 'ship'))).toBe('ship');
  });

  test('gstack-upgrade name: not double-prefixed', () => {
    setupMockInstall(['qa', 'gstack-upgrade']);
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    expect(readSkillName(path.join(installDir, 'gstack-upgrade'))).toBe('gstack-upgrade');
    expect(readSkillName(path.join(installDir, 'qa'))).toBe('nexus-qa');
  });

  test('SKILL.md without frontmatter is a no-op', () => {
    setupMockInstall(['qa']);
    // Overwrite qa SKILL.md with no frontmatter
    fs.writeFileSync(path.join(installDir, 'qa', 'SKILL.md'), '# qa\nSome content.');
    run(`${path.join(installDir, 'bin', 'gstack-config')} set skill_prefix true`);
    // Should not crash
    run(`${path.join(installDir, 'bin', 'gstack-relink')}`, {
      GSTACK_INSTALL_DIR: installDir,
      GSTACK_SKILLS_DIR: skillsDir,
    });
    // Content should be unchanged (no name: to patch)
    const content = fs.readFileSync(path.join(installDir, 'qa', 'SKILL.md'), 'utf-8');
    expect(content).toBe('# qa\nSome content.');
  });
});
