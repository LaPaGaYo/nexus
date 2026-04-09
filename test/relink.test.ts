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
      env: { ...process.env, NEXUS_STATE_DIR: tmpDir, ...env },
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (e: any) {
    if (expectFail) return (e.stderr || e.stdout || '').toString().trim();
    throw e;
  }
}

function setupMockInstall(skills: string[]): void {
  installDir = path.join(tmpDir, 'nexus-install');
  skillsDir = path.join(tmpDir, 'skills');
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(skillsDir, { recursive: true });

  const mockBin = path.join(installDir, 'bin');
  fs.mkdirSync(mockBin, { recursive: true });
  for (const helper of ['nexus-config', 'nexus-relink', 'nexus-patch-names']) {
    fs.copyFileSync(path.join(BIN, helper), path.join(mockBin, helper));
    fs.chmodSync(path.join(mockBin, helper), 0o755);
  }

  for (const skill of skills) {
    fs.mkdirSync(path.join(installDir, skill), { recursive: true });
    fs.writeFileSync(path.join(installDir, skill, 'SKILL.md'), `---\nname: ${skill}\ndescription: test\n---\n# ${skill}`);
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-relink-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('nexus-relink', () => {
  test('creates nexus-* symlinks when skill_prefix=true', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`);

    const output = run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-ship'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-review'))).toBe(true);
    expect(output).toContain('nexus-*');
  });

  test('creates flat symlinks when skill_prefix=false', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix false`);

    const output = run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(skillsDir, 'qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'ship'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'review'))).toBe(true);
    expect(output).toContain('flat names');
  });

  test('cleans up stale symlinks from the opposite mode', () => {
    setupMockInstall(['qa', 'ship']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix false`);
    run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(skillsDir, 'qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(false);
  });

  test('prints an error when the install dir is missing', () => {
    const output = run(`${BIN}/nexus-relink`, {
      NEXUS_INSTALL_DIR: '/nonexistent/path/nexus',
      NEXUS_SKILLS_DIR: '/nonexistent/path/skills',
    }, true);

    expect(output).toContain('Nexus install directory not found');
  });

  test('does not double-prefix nexus-upgrade', () => {
    setupMockInstall(['qa', 'ship', 'nexus-upgrade']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(skillsDir, 'nexus-upgrade'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-nexus-upgrade'))).toBe(false);
  });

  test('nexus-config set skill_prefix triggers relink', () => {
    setupMockInstall(['qa', 'ship']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-ship'))).toBe(true);
  });

  test('nexus-config and nexus-relink use only NEXUS_* overrides', () => {
    setupMockInstall(['qa', 'ship']);
    const nexusStateDir = path.join(tmpDir, 'nexus-state');

    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`, {
      NEXUS_STATE_DIR: nexusStateDir,
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(fs.existsSync(path.join(nexusStateDir, 'config.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-qa'))).toBe(true);
    expect(fs.existsSync(path.join(skillsDir, 'nexus-ship'))).toBe(true);
  });

  test('legacy relink helper binaries are gone from the active surface', () => {
    expect(fs.existsSync(path.join(BIN, 'nexus-patch-names'))).toBe(true);
    expect(fs.existsSync(path.join(BIN, 'gstack-patch-names'))).toBe(false);
  });
});

describe('nexus-patch-names', () => {
  function readSkillName(skillDir: string): string | null {
    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
    const match = content.match(/^name:\s*(.+)$/m);
    return match ? match[1].trim() : null;
  }

  test('prefix=true patches name: fields to Nexus names', () => {
    setupMockInstall(['qa', 'ship', 'review']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(readSkillName(path.join(installDir, 'qa'))).toBe('nexus-qa');
    expect(readSkillName(path.join(installDir, 'ship'))).toBe('nexus-ship');
    expect(readSkillName(path.join(installDir, 'review'))).toBe('nexus-review');
  });

  test('prefix=false restores flat names', () => {
    setupMockInstall(['qa', 'ship']);
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix true`);
    run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });
    run(`${path.join(installDir, 'bin', 'nexus-config')} set skill_prefix false`);
    run(`${path.join(installDir, 'bin', 'nexus-relink')}`, {
      NEXUS_INSTALL_DIR: installDir,
      NEXUS_SKILLS_DIR: skillsDir,
    });

    expect(readSkillName(path.join(installDir, 'qa'))).toBe('qa');
    expect(readSkillName(path.join(installDir, 'ship'))).toBe('ship');
  });
});
