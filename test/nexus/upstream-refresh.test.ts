import { spawnSync } from 'child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  statSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { dirname, join, resolve } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import { describe, expect, test } from 'bun:test';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const SCRIPT_PATH = join(REPO_ROOT, 'scripts/upstream-refresh.ts');
const REPO_README_PATH = join(REPO_ROOT, 'upstream/README.md');
const REPO_LOCK_PATH = join(REPO_ROOT, 'upstream-notes/upstream-lock.json');
const REPO_UPDATE_STATUS_PATH = join(REPO_ROOT, 'upstream-notes/update-status.md');
const REPO_PM_INVENTORY_PATH = join(REPO_ROOT, 'upstream-notes/pm-skills-inventory.md');
const REPO_PM_SKILLS_PATH = join(REPO_ROOT, 'upstream/pm-skills');
const REPO_UPSTREAM_MAINTENANCE_PATH = join(REPO_ROOT, 'lib/nexus/upstream-maintenance.ts');
const REPO_PM_SOURCE_MAP_PATH = join(REPO_ROOT, 'lib/nexus/absorption/pm/source-map.ts');
const STAGE_CONTENT_SOURCE_MAP_PATH = join(REPO_ROOT, 'lib/nexus/stage-content/source-map.ts');
const STAGE_PACK_SOURCE_MAP_PATH = join(REPO_ROOT, 'lib/nexus/stage-packs/source-map.ts');

function copyTree(source: string, target: string): void {
  const stats = lstatSync(source);

  if (stats.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source)) {
      copyTree(join(source, entry), join(target, entry));
    }
    return;
  }

  mkdirSync(dirname(target), { recursive: true });
  if (stats.isSymbolicLink()) {
    symlinkSync(readlinkSync(source), target);
    return;
  }

  copyFileSync(source, target);
}

function git(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(' ')} failed`).trim());
  }

  return (result.stdout || '').trim();
}

function hashFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function fileMode(path: string): number {
  return statSync(path).mode & 0o777;
}

function prepareWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'nexus-upstream-refresh-root-'));

  copyTree(REPO_PM_SKILLS_PATH, join(root, 'upstream/pm-skills'));
  copyTree(REPO_README_PATH, join(root, 'upstream/README.md'));
  copyTree(REPO_LOCK_PATH, join(root, 'upstream-notes/upstream-lock.json'));
  copyTree(REPO_UPDATE_STATUS_PATH, join(root, 'upstream-notes/update-status.md'));
  copyTree(REPO_PM_INVENTORY_PATH, join(root, 'upstream-notes/pm-skills-inventory.md'));
  copyTree(join(REPO_ROOT, 'upstream-notes/refresh-candidates/.gitkeep'), join(root, 'upstream-notes/refresh-candidates/.gitkeep'));
  copyTree(REPO_UPSTREAM_MAINTENANCE_PATH, join(root, 'lib/nexus/upstream-maintenance.ts'));
  copyTree(REPO_PM_SOURCE_MAP_PATH, join(root, 'lib/nexus/absorption/pm/source-map.ts'));
  copyTree(STAGE_CONTENT_SOURCE_MAP_PATH, join(root, 'lib/nexus/stage-content/source-map.ts'));
  copyTree(STAGE_PACK_SOURCE_MAP_PATH, join(root, 'lib/nexus/stage-packs/source-map.ts'));
  git(['init', '--quiet'], root);
  git(['config', 'core.filemode', 'true'], root);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'add', '-A'], root);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'commit', '--quiet', '-m', 'baseline'], root);

  return { root };
}

function createGitFixture(
  treeSource: string,
  options?: {
    prepareBase?: (repoRoot: string) => void;
    mutate?: (repoRoot: string) => void;
  },
): { repoUrl: string; commit: string } {
  const repoRoot = mkdtempSync(join(tmpdir(), 'nexus-upstream-refresh-fixture-'));
  copyTree(treeSource, repoRoot);
  options?.prepareBase?.(repoRoot);
  git(['init', '--quiet'], repoRoot);
  git(['config', 'core.filemode', 'true'], repoRoot);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'add', '-A'], repoRoot);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'commit', '--quiet', '-m', 'base snapshot'], repoRoot);

  if (options?.mutate) {
    options.mutate(repoRoot);
    git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'add', '-A'], repoRoot);
    git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'commit', '--quiet', '-m', 'refreshed snapshot'], repoRoot);
  }

  return {
    repoUrl: repoRoot,
    commit: git(['rev-parse', 'HEAD'], repoRoot),
  };
}

function updateLockRecord(
  root: string,
  upstreamName: string,
  updates: { last_checked_commit?: string; last_absorption_decision?: string | null },
): void {
  const lockPath = join(root, 'upstream-notes/upstream-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
    upstreams: Array<
      Record<string, unknown> & {
        name: string;
        repo_url: string;
        last_checked_commit: string | null;
        last_absorption_decision: string | null;
      }
    >;
  };

  const record = lock.upstreams.find((row) => row.name === upstreamName);
  if (!record) {
    throw new Error(`Missing lock row for ${upstreamName}`);
  }

  if (updates.last_checked_commit) {
    record.last_checked_commit = updates.last_checked_commit;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'last_absorption_decision')) {
    record.last_absorption_decision = updates.last_absorption_decision ?? null;
  }

  writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'add', 'upstream-notes/upstream-lock.json'], root);
  git(['-c', 'user.email=codex@example.com', '-c', 'user.name=Codex', 'commit', '--quiet', '-m', `update ${upstreamName} lock`], root);
}

function runRefresh(root: string, upstreamName: string) {
  return spawnSync('bun', ['run', SCRIPT_PATH, upstreamName], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      UPSTREAM_REFRESH_ROOT: root,
      GIT_TERMINAL_PROMPT: '0',
    },
  });
}

function readLock(root: string) {
  return JSON.parse(readFileSync(join(root, 'upstream-notes/upstream-lock.json'), 'utf8')) as {
    upstreams: Array<{
      name: string;
      repo_url: string;
      imported_path: string;
      pinned_commit: string;
      last_checked_commit: string | null;
      last_checked_at: string | null;
      behind_count: number | null;
      refresh_status: string;
      last_refresh_candidate_at: string | null;
      last_absorption_decision: string | null;
      active_absorbed_capabilities: string[];
      notes: string;
    }>;
  };
}

describe('nexus upstream refresh', () => {
  test('CLI refresh materializes the checked commit from repo_url and stages a no-op candidate on disk', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH);
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const stageContentBefore = hashFile(join(root, 'lib/nexus/stage-content/source-map.ts'));
    const stagePackBefore = hashFile(join(root, 'lib/nexus/stage-packs/source-map.ts'));
    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).toBe(0);

    const lock = readLock(root);
    const pm = lock.upstreams.find((row) => row.name === 'pm-skills');
    if (!pm) throw new Error('pm-skills row missing from lock');

    const candidate = readFileSync(join(root, 'upstream-notes/refresh-candidates/pm-skills.md'), 'utf8');
    const readme = readFileSync(join(root, 'upstream/README.md'), 'utf8');
    const updateStatus = readFileSync(join(root, 'upstream-notes/update-status.md'), 'utf8');
    const inventory = readFileSync(join(root, 'upstream-notes/pm-skills-inventory.md'), 'utf8');
    const maintenanceContract = readFileSync(join(root, 'lib/nexus/upstream-maintenance.ts'), 'utf8');
    const pmSourceMap = readFileSync(join(root, 'lib/nexus/absorption/pm/source-map.ts'), 'utf8');

    expect(candidate).toContain('Previous pinned commit: `4aa4196c14873b84f5af7316e7f66328cb6dee4c`');
    expect(candidate).toContain(`New pinned commit: \`${fixture.commit}\``);
    expect(candidate).toContain('## Changed upstream paths');
    expect(candidate).toContain('- none');
    expect(candidate).toContain('## Tests to rerun before review');
    expect(pm.pinned_commit).toBe(fixture.commit);
    expect(pm.last_checked_commit).toBe(fixture.commit);
    expect(pm.behind_count).toBe(0);
    expect(pm.last_refresh_candidate_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(pm.refresh_status).toBe('refresh_candidate');
    expect(readme).toContain(`\`${fixture.commit}\``);
    expect(updateStatus).toContain(`| pm-skills | \`${fixture.commit}\` | \`${fixture.commit}\` | 0 |`);
    expect(updateStatus).toContain('## Pending Refresh Candidates');
    expect(inventory).toContain(`| pm-discover-idea-brief | pm-skills | upstream/pm-skills | https://github.com/deanpeters/Product-Manager-Skills.git | ${fixture.commit} |`);
    expect(maintenanceContract).toContain(`pinned_commit: '${fixture.commit}'`);
    expect(pmSourceMap).toContain(`pinned_commit: '${fixture.commit}'`);
    expect(hashFile(join(root, 'lib/nexus/stage-content/source-map.ts'))).toBe(stageContentBefore);
    expect(hashFile(join(root, 'lib/nexus/stage-packs/source-map.ts'))).toBe(stagePackBefore);
  });

  test('CLI refresh refuses dirty imported upstream state and does not clobber local edits or untracked files', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH);
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const trackedPath = join(root, 'upstream/pm-skills/commands/discover.md');
    const untrackedPath = join(root, 'upstream/pm-skills/.local-refresh-note');
    writeFileSync(trackedPath, `${readFileSync(trackedPath, 'utf8')}\nLOCAL EDIT\n`);
    writeFileSync(untrackedPath, 'untracked change\n');

    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Cannot refresh upstream/pm-skills because it has local tracked or untracked changes');
    expect(readFileSync(trackedPath, 'utf8')).toContain('LOCAL EDIT');
    expect(existsSync(untrackedPath)).toBe(true);
    expect(existsSync(join(root, 'upstream-notes/refresh-candidates/pm-skills.md'))).toBe(false);
  });

  test('CLI refresh refuses dirty metadata targets before mutating the imported tree', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH);
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const readmePath = join(root, 'upstream/README.md');
    const candidatePath = join(root, 'upstream-notes/refresh-candidates/pm-skills.md');
    writeFileSync(readmePath, `${readFileSync(readmePath, 'utf8')}\nLOCAL README EDIT\n`);
    writeFileSync(candidatePath, 'local candidate note\n');

    const beforeImported = hashFile(join(root, 'upstream/pm-skills/commands/discover.md'));
    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('refresh metadata targets');
    expect(readFileSync(readmePath, 'utf8')).toContain('LOCAL README EDIT');
    expect(readFileSync(candidatePath, 'utf8')).toBe('local candidate note\n');
    expect(hashFile(join(root, 'upstream/pm-skills/commands/discover.md'))).toBe(beforeImported);
  });

  test('CLI refresh copies the checkout produced from repo_url + commit and stages a candidate note on disk', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH, {
      mutate: (repoRoot) => {
        writeFileSync(
          join(repoRoot, 'commands/discover.md'),
          `${readFileSync(join(repoRoot, 'commands/discover.md'), 'utf8')}\n<!-- refreshed candidate diff -->\n`,
        );
      },
    });
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });
    expect(result.status).toBe(0);

    const candidate = readFileSync(join(root, 'upstream-notes/refresh-candidates/pm-skills.md'), 'utf8');
    const readme = readFileSync(join(root, 'upstream/README.md'), 'utf8');
    const updateStatus = readFileSync(join(root, 'upstream-notes/update-status.md'), 'utf8');
    const inventory = readFileSync(join(root, 'upstream-notes/pm-skills-inventory.md'), 'utf8');
    const maintenanceContract = readFileSync(join(root, 'lib/nexus/upstream-maintenance.ts'), 'utf8');
    const pmSourceMap = readFileSync(join(root, 'lib/nexus/absorption/pm/source-map.ts'), 'utf8');
    const lock = readLock(root);
    const pm = lock.upstreams.find((row) => row.name === 'pm-skills');
    if (!pm) throw new Error('pm-skills row missing from lock');

    expect(candidate).toContain('## Changed upstream paths');
    expect(candidate).toContain('`upstream/pm-skills/commands/discover.md`');
    expect(candidate).toContain('lib/nexus/absorption/pm/source-map.ts');
    expect(candidate).toContain('nexus-discover-content');
    expect(candidate).toContain('nexus-discover-pack');
    expect(candidate).toContain('## Tests to rerun before review');
    expect(candidate).toContain('test/nexus/absorption-source-map.test.ts');
    expect(candidate).toContain('test/nexus/stage-content.test.ts');
    expect(candidate).toContain('test/nexus/discover-frame.test.ts');
    expect(readme).toContain(`\`${fixture.commit}\``);
    expect(pm.pinned_commit).toBe(fixture.commit);
    expect(pm.behind_count).toBe(0);
    expect(pm.last_refresh_candidate_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(pm.refresh_status).toBe('refresh_candidate');
    expect(pm.notes).toContain('1 changed upstream file');
    expect(updateStatus).toContain(`| pm-skills | \`${fixture.commit}\` | \`${fixture.commit}\` | 0 |`);
    expect(inventory).toContain(fixture.commit);
    expect(maintenanceContract).toContain(`pinned_commit: '${fixture.commit}'`);
    expect(pmSourceMap).toContain(`pinned_commit: '${fixture.commit}'`);
  });

  test('CLI refresh clears any stale prior absorption decision when staging a new candidate', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH);
    updateLockRecord(root, 'pm-skills', {
      last_checked_commit: fixture.commit,
      last_absorption_decision: 'ignore',
    });

    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).toBe(0);

    const lock = readLock(root);
    const pm = lock.upstreams.find((row) => row.name === 'pm-skills');
    if (!pm) throw new Error('pm-skills row missing from lock');

    expect(pm.last_absorption_decision).toBeNull();
    expect(pm.refresh_status).toBe('refresh_candidate');
  });

  test('CLI refresh preserves executable bits and reports mode-only upstream changes in the candidate note', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH, {
      mutate: (repoRoot) => {
        chmodSync(join(repoRoot, 'scripts/add-a-skill.sh'), 0o644);
      },
    });
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const sourceMode = fileMode(join(fixture.repoUrl, 'scripts/add-a-skill.sh'));
    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).toBe(0);

    const targetPath = join(root, 'upstream/pm-skills/scripts/add-a-skill.sh');
    const candidate = readFileSync(join(root, 'upstream-notes/refresh-candidates/pm-skills.md'), 'utf8');
    const lock = readLock(root);
    const pm = lock.upstreams.find((row) => row.name === 'pm-skills');
    if (!pm) throw new Error('pm-skills row missing from lock');

    expect(sourceMode).toBe(0o644);
    expect(fileMode(targetPath)).toBe(sourceMode);
    expect(candidate).toContain('## Changed upstream paths');
    expect(candidate).toContain('`upstream/pm-skills/scripts/add-a-skill.sh`');
    expect(candidate).not.toContain('## Changed upstream paths\n\n- none');
    expect(pm.last_refresh_candidate_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(pm.refresh_status).toBe('refresh_candidate');
    expect(pm.notes).toContain('1 changed upstream file');
  });

  test('CLI refresh preserves symlink entries in imported upstream snapshots', () => {
    const { root } = prepareWorkspace();
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH, {
      mutate: (repoRoot) => {
        rmSync(join(repoRoot, 'AGENTS.md'), { force: true });
        symlinkSync('commands/discover.md', join(repoRoot, 'AGENTS.md'));
      },
    });
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).toBe(0);

    const targetPath = join(root, 'upstream/pm-skills/AGENTS.md');
    const candidate = readFileSync(join(root, 'upstream-notes/refresh-candidates/pm-skills.md'), 'utf8');
    expect(lstatSync(targetPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(targetPath)).toBe('commands/discover.md');
    expect(candidate).toContain('`upstream/pm-skills/AGENTS.md`');
  });

  test('CLI refresh rolls back the imported upstream tree if a later write step fails', () => {
    const { root } = prepareWorkspace();
    chmodSync(join(root, 'upstream-notes/refresh-candidates'), 0o555);
    const fixture = createGitFixture(REPO_PM_SKILLS_PATH, {
      mutate: (repoRoot) => {
        writeFileSync(
          join(repoRoot, 'commands/discover.md'),
          `${readFileSync(join(repoRoot, 'commands/discover.md'), 'utf8')}\n<!-- rollback candidate diff -->\n`,
        );
      },
    });
    updateLockRecord(root, 'pm-skills', { last_checked_commit: fixture.commit });

    const beforeContent = readFileSync(join(root, 'upstream/pm-skills/commands/discover.md'), 'utf8');
    const result = spawnSync('bun', ['run', SCRIPT_PATH, 'pm-skills'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        UPSTREAM_REFRESH_ROOT: root,
        UPSTREAM_REFRESH_REPO_URL_OVERRIDE: fixture.repoUrl,
        GIT_TERMINAL_PROMPT: '0',
      },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('EACCES');
    expect(readFileSync(join(root, 'upstream/pm-skills/commands/discover.md'), 'utf8')).toBe(beforeContent);
    expect(existsSync(join(root, 'upstream-notes/refresh-candidates/pm-skills.md'))).toBe(false);
  });

  test('invalid upstream names are rejected through the CLI entrypoint', () => {
    const { root } = prepareWorkspace();
    const result = runRefresh(root, 'not-a-real-upstream');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown upstream: not-a-real-upstream');
  });
});
