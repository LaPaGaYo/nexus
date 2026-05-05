import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { homedir } from 'os';
import { basename, join, resolve } from 'path';
import { hostSkillInstallRootPaths } from '../host-roots';
import { classifyInstalledSkill } from './classification';
import type { DiscoverInstalledSkillsOptions, SkillRecord } from './types';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function parseSkillFrontmatter(content: string): { name: string | null; description: string | null } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { name: null, description: null };
  }

  const frontmatter = match[1] ?? '';
  let name: string | null = null;
  let description: string | null = null;
  for (const line of frontmatter.split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    const key = field[1];
    const value = (field[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
    if (key === 'name') {
      name = value;
    } else if (key === 'description') {
      description = value;
    }
  }
  return { name, description };
}

export function discoverSkillFiles(root: string, maxDepth = 4): string[] {
  const files: string[] = [];
  const resolvedRoot = resolve(root);
  if (!existsSync(resolvedRoot)) {
    return files;
  }

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
          continue;
        }
        walk(join(dir, entry.name), depth + 1);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        files.push(join(dir, entry.name));
      }
    }
  }

  try {
    walk(resolvedRoot, 0);
  } catch {
    return files;
  }
  return files;
}

export function defaultExternalSkillRoots(cwd: string, home = homedir()): string[] {
  return unique(hostSkillInstallRootPaths(cwd, home));
}

export function discoverInstalledSkills(options: DiscoverInstalledSkillsOptions): SkillRecord[] {
  if (process.env.NEXUS_EXTERNAL_SKILLS === '0') {
    return [];
  }

  const roots = options.roots ?? defaultExternalSkillRoots(options.cwd, options.home);
  const skills: SkillRecord[] = [];
  const seenPaths = new Set<string>();
  for (const root of roots) {
    for (const skillPath of discoverSkillFiles(root)) {
      if (seenPaths.has(skillPath)) {
        continue;
      }
      seenPaths.add(skillPath);
      let content = '';
      try {
        if (!statSync(skillPath).isFile()) continue;
        content = readFileSync(skillPath, 'utf8');
      } catch {
        continue;
      }
      const parsed = parseSkillFrontmatter(content);
      const fallbackName = basename(skillPath.replace(/\/SKILL\.md$/, ''));
      skills.push(classifyInstalledSkill({
        name: parsed.name ?? fallbackName,
        description: parsed.description,
        path: skillPath,
        source_root: root,
      }));
    }
  }
  return skills;
}
