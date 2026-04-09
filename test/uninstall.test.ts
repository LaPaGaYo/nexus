import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ROOT = path.resolve(import.meta.dir, '..');
const NEXUS_UNINSTALL = path.join(ROOT, 'bin', 'nexus-uninstall');

describe('nexus-uninstall', () => {
  test('syntax check passes', () => {
    const result = spawnSync('bash', ['-n', NEXUS_UNINSTALL], { stdio: 'pipe' });
    expect(result.status).toBe(0);
  });

  test('--help prints Nexus-primary usage and exits 0', () => {
    const result = spawnSync('bash', [NEXUS_UNINSTALL, '--help'], { stdio: 'pipe' });
    expect(result.status).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain('nexus-uninstall');
    expect(output).toContain('--force');
    expect(output).toContain('--keep-state');
  });

  test('unknown flag exits with error', () => {
    const result = spawnSync('bash', [NEXUS_UNINSTALL, '--bogus'], {
      stdio: 'pipe',
      env: { ...process.env, HOME: '/nonexistent' },
    });
    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain('Unknown option');
  });

  describe('integration tests with mock layout', () => {
    let tmpDir: string;
    let mockHome: string;
    let mockGitRoot: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-uninstall-test-'));
      mockHome = path.join(tmpDir, 'home');
      mockGitRoot = path.join(tmpDir, 'repo');

      fs.mkdirSync(path.join(mockHome, '.claude', 'skills', 'nexus', 'review'), { recursive: true });
      fs.writeFileSync(path.join(mockHome, '.claude', 'skills', 'nexus', 'SKILL.md'), 'test');
      fs.symlinkSync('nexus/review', path.join(mockHome, '.claude', 'skills', 'review'));
      fs.symlinkSync('nexus/ship', path.join(mockHome, '.claude', 'skills', 'nexus-ship'));
      fs.mkdirSync(path.join(mockHome, '.claude', 'skills', 'other-tool'), { recursive: true });

      fs.mkdirSync(path.join(mockHome, '.nexus', 'projects'), { recursive: true });
      fs.writeFileSync(path.join(mockHome, '.nexus', 'config.json'), '{}');

      fs.mkdirSync(path.join(mockGitRoot, '.nexus-worktrees'), { recursive: true });
      fs.mkdirSync(path.join(mockGitRoot, '.nexus'), { recursive: true });
      spawnSync('git', ['init', '-b', 'main'], { cwd: mockGitRoot, stdio: 'pipe' });
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('--force removes global Claude skills and Nexus state', () => {
      const result = spawnSync('bash', [NEXUS_UNINSTALL, '--force'], {
        stdio: 'pipe',
        env: {
          ...process.env,
          HOME: mockHome,
          NEXUS_STATE_DIR: path.join(mockHome, '.nexus'),
        },
        cwd: mockGitRoot,
      });

      expect(result.status).toBe(0);
      expect(result.stdout.toString()).toContain('Nexus uninstalled');
      expect(fs.existsSync(path.join(mockHome, '.claude', 'skills', 'nexus'))).toBe(false);
      expect(fs.existsSync(path.join(mockHome, '.claude', 'skills', 'review'))).toBe(false);
      expect(fs.existsSync(path.join(mockHome, '.claude', 'skills', 'nexus-ship'))).toBe(false);
      expect(fs.existsSync(path.join(mockHome, '.claude', 'skills', 'other-tool'))).toBe(true);
      expect(fs.existsSync(path.join(mockHome, '.nexus'))).toBe(false);
    });

    test('--keep-state preserves the Nexus state directory', () => {
      const result = spawnSync('bash', [NEXUS_UNINSTALL, '--force', '--keep-state'], {
        stdio: 'pipe',
        env: {
          ...process.env,
          HOME: mockHome,
          NEXUS_STATE_DIR: path.join(mockHome, '.nexus'),
        },
        cwd: mockGitRoot,
      });

      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(mockHome, '.claude', 'skills', 'nexus'))).toBe(false);
      expect(fs.existsSync(path.join(mockHome, '.nexus'))).toBe(true);
      expect(fs.existsSync(path.join(mockHome, '.nexus', 'config.json'))).toBe(true);
    });

    test('removes repo-local Nexus roots', () => {
      const result = spawnSync('bash', [NEXUS_UNINSTALL, '--force'], {
        stdio: 'pipe',
        env: {
          ...process.env,
          HOME: mockHome,
          NEXUS_STATE_DIR: path.join(mockHome, '.nexus'),
        },
        cwd: mockGitRoot,
      });

      expect(result.status).toBe(0);
      expect(fs.existsSync(path.join(mockGitRoot, '.nexus'))).toBe(false);
      expect(fs.existsSync(path.join(mockGitRoot, '.nexus-worktrees'))).toBe(false);
    });

    test('clean system outputs nothing to remove', () => {
      const cleanHome = path.join(tmpDir, 'clean-home');
      const cleanRepo = path.join(tmpDir, 'clean-repo');
      fs.mkdirSync(cleanHome, { recursive: true });
      fs.mkdirSync(cleanRepo, { recursive: true });
      spawnSync('git', ['init', '-b', 'main'], { cwd: cleanRepo, stdio: 'pipe' });

      const result = spawnSync('bash', [NEXUS_UNINSTALL, '--force'], {
        stdio: 'pipe',
        env: {
          ...process.env,
          HOME: cleanHome,
          NEXUS_STATE_DIR: path.join(cleanHome, '.nexus'),
        },
        cwd: cleanRepo,
      });

      expect(result.status).toBe(0);
      expect(result.stdout.toString()).toContain('Nothing to remove');
      expect(result.stdout.toString()).toContain('Nexus');
    });
  });
});
