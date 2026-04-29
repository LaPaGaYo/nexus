/**
 * find-browse — locate the nexus browse binary.
 *
 * Compiled to runtimes/browse/dist/find-browse (standalone binary, no bun runtime needed).
 * Outputs the absolute path to the browse binary on stdout, or exits 1 if not found.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ─── Binary Discovery ───────────────────────────────────────────

function getGitRoot(): string | null {
  try {
    const proc = Bun.spawnSync(['git', 'rev-parse', '--show-toplevel'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) return null;
    return proc.stdout.toString().trim();
  } catch {
    return null;
  }
}

export function locateBinary(): string | null {
  const root = getGitRoot();
  const home = homedir();
  const markers = ['.codex', '.agents', '.claude'];

  // Workspace-local takes priority (for development)
  if (root) {
    for (const m of markers) {
      const localCompat = join(root, m, 'skills', 'nexus', 'browse', 'dist', 'browse');
      if (existsSync(localCompat)) return localCompat;
      const localRuntime = join(root, m, 'skills', 'nexus', 'runtimes', 'browse', 'dist', 'browse');
      if (existsSync(localRuntime)) return localRuntime;
    }
  }

  // Global fallback
  for (const m of markers) {
    const globalCompat = join(home, m, 'skills', 'nexus', 'browse', 'dist', 'browse');
    if (existsSync(globalCompat)) return globalCompat;
    const globalRuntime = join(home, m, 'skills', 'nexus', 'runtimes', 'browse', 'dist', 'browse');
    if (existsSync(globalRuntime)) return globalRuntime;
  }

  return null;
}

// ─── Main ───────────────────────────────────────────────────────

function main() {
  const bin = locateBinary();
  if (!bin) {
    process.stderr.write('ERROR: browse binary not found. Run: cd <skill-dir> && ./setup\n');
    process.exit(1);
  }

  console.log(bin);
}

if (import.meta.main) {
  main();
}
