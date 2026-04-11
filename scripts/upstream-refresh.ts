#!/usr/bin/env bun

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  lstatSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { mkdtempSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { CCB_SOURCE_MAP } from '../lib/nexus/absorption/ccb/source-map';
import { GSD_SOURCE_MAP } from '../lib/nexus/absorption/gsd/source-map';
import { PM_SOURCE_MAP } from '../lib/nexus/absorption/pm/source-map';
import { SUPERPOWERS_SOURCE_MAP } from '../lib/nexus/absorption/superpowers/source-map';
import {
  alignUpstreamLockWithContract,
  buildUpstreamCheckResultFromRecord,
  getUpstreamMaintenanceDefinition,
  parseUpstreamMaintenanceLock,
  renderUpstreamCheckStatus,
  serializeUpstreamMaintenanceLock,
  type UpstreamMaintenanceDefinition,
  type UpstreamMaintenanceLock,
  type UpstreamName,
} from '../lib/nexus/upstream-maintenance';
import { getStageContentSourceBinding } from '../lib/nexus/stage-content/source-map';
import { getStagePackSourceBinding } from '../lib/nexus/stage-packs/source-map';
import { NEXUS_STAGE_CONTENT, NEXUS_STAGE_PACKS } from '../lib/nexus/types';

const DEFAULT_ROOT = resolve(import.meta.dir, '..');
const CLI_ROOT = process.env.UPSTREAM_REFRESH_ROOT ? resolve(process.env.UPSTREAM_REFRESH_ROOT) : DEFAULT_ROOT;
const REPO_URL_OVERRIDE = process.env.UPSTREAM_REFRESH_REPO_URL_OVERRIDE?.trim() || null;

const LOCK_TARGET = 'upstream-notes/upstream-lock.json';
const README_TARGET = 'upstream/README.md';
const STATUS_TARGET = 'upstream-notes/update-status.md';

interface UpstreamRefreshAnalysis {
  changed_upstream_paths: string[];
  impacted_source_map_refs: string[];
  impacted_stage_content_areas: string[];
  impacted_stage_pack_areas: string[];
  tests_to_rerun: string[];
}

interface SnapshotEntry {
  kind: 'file' | 'symlink';
  content: Buffer;
  mode: number;
  symlinkTarget?: string;
}

interface TextFileState {
  exists: boolean;
  content: string;
}

interface SourceMapIndexEntry {
  source_map_path: string;
  imported_path: string;
  source_refs: readonly { imported_path: string; upstream_file: string }[];
}

export interface UpstreamRefreshOutputs extends UpstreamRefreshAnalysis {
  upstream: UpstreamMaintenanceDefinition;
  previous_pinned_commit: string;
  new_pinned_commit: string;
  refreshed_at: string;
  updated_lock: UpstreamMaintenanceLock;
  updated_readme: string;
  candidate_note_path: string;
  candidate_note: string;
  write_targets: string[];
  root: string;
  source_root: string;
  target_snapshot_path: string;
  source_snapshot_path: string;
}

const CONTRACT_PIN_TARGETS: Record<UpstreamName, string[]> = {
  'pm-skills': [
    'lib/nexus/upstream-maintenance.ts',
    'lib/nexus/absorption/pm/source-map.ts',
    'upstream-notes/pm-skills-inventory.md',
  ],
  gsd: [
    'lib/nexus/upstream-maintenance.ts',
    'lib/nexus/absorption/gsd/source-map.ts',
    'lib/nexus/stage-content/source-map.ts',
    'upstream-notes/gsd-inventory.md',
  ],
  superpowers: [
    'lib/nexus/upstream-maintenance.ts',
    'lib/nexus/absorption/superpowers/source-map.ts',
    'lib/nexus/stage-content/source-map.ts',
    'upstream-notes/superpowers-inventory.md',
  ],
  'claude-code-bridge': [
    'lib/nexus/upstream-maintenance.ts',
    'lib/nexus/absorption/ccb/source-map.ts',
    'lib/nexus/stage-content/source-map.ts',
    'upstream-notes/ccb-inventory.md',
  ],
};

const SOURCE_MAP_INDEX: SourceMapIndexEntry[] = [
  {
    source_map_path: 'lib/nexus/absorption/pm/source-map.ts',
    imported_path: 'upstream/pm-skills',
    source_refs: PM_SOURCE_MAP,
  },
  {
    source_map_path: 'lib/nexus/absorption/gsd/source-map.ts',
    imported_path: 'upstream/gsd',
    source_refs: GSD_SOURCE_MAP,
  },
  {
    source_map_path: 'lib/nexus/absorption/superpowers/source-map.ts',
    imported_path: 'upstream/superpowers',
    source_refs: SUPERPOWERS_SOURCE_MAP,
  },
  {
    source_map_path: 'lib/nexus/absorption/ccb/source-map.ts',
    imported_path: 'upstream/claude-code-bridge',
    source_refs: CCB_SOURCE_MAP,
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function walkEntries(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files: string[] = [];

  function visit(dir: string, prefix: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') {
        continue;
      }
      const rel = prefix ? join(prefix, entry.name) : entry.name;
      const abs = join(dir, entry.name);

      if (entry.isDirectory()) {
        visit(abs, rel);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(rel);
      }
    }
  }

  visit(root, '');
  return files.sort();
}

function readSnapshot(root: string): Map<string, SnapshotEntry> {
  const snapshot = new Map<string, SnapshotEntry>();

  for (const rel of walkEntries(root)) {
    const absolutePath = join(root, rel);
    const fileStat = lstatSync(absolutePath);

    if (fileStat.isSymbolicLink()) {
      snapshot.set(rel, {
        kind: 'symlink',
        content: Buffer.alloc(0),
        mode: fileStat.mode & 0o777,
        symlinkTarget: readlinkSync(absolutePath),
      });
      continue;
    }

    snapshot.set(rel, {
      kind: 'file',
      content: readFileSync(absolutePath),
      mode: fileStat.mode & 0o777,
    });
  }

  return snapshot;
}

function writeSnapshot(root: string, snapshot: Map<string, SnapshotEntry>): void {
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });

  for (const [rel, entry] of snapshot) {
    const targetPath = join(root, rel);
    mkdirSync(dirname(targetPath), { recursive: true });
    if (entry.kind === 'symlink') {
      symlinkSync(entry.symlinkTarget ?? '', targetPath);
      continue;
    }

    writeFileSync(targetPath, entry.content);
    chmodSync(targetPath, entry.mode);
  }
}

function diffSnapshots(before: Map<string, SnapshotEntry>, after: Map<string, SnapshotEntry>): string[] {
  const changed = new Set<string>();

  for (const [rel, content] of before) {
    const next = after.get(rel);
    if (
      !next ||
      content.kind !== next.kind ||
      content.mode !== next.mode ||
      (content.kind === 'symlink'
        ? content.symlinkTarget !== next.symlinkTarget
        : !content.content.equals(next.content))
    ) {
      changed.add(rel);
    }
  }

  for (const rel of after.keys()) {
    if (!before.has(rel)) {
      changed.add(rel);
    }
  }

  return [...changed].sort();
}

function copySnapshotTree(sourceRoot: string, targetRoot: string): void {
  if (sourceRoot === targetRoot) {
    mkdirSync(targetRoot, { recursive: true });
    return;
  }

  if (!existsSync(sourceRoot)) {
    throw new Error(`Missing upstream snapshot root: ${sourceRoot}`);
  }

  writeSnapshot(targetRoot, readSnapshot(sourceRoot));
}

function captureTextFileState(path: string): TextFileState {
  if (!existsSync(path)) {
    return { exists: false, content: '' };
  }

  return { exists: true, content: readFileSync(path, 'utf8') };
}

function restoreTextFileState(path: string, state: TextFileState): void {
  if (!state.exists) {
    rmSync(path, { force: true });
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, state.content);
}

function rewritePinnedCommit(content: string, previousPinnedCommit: string, newPinnedCommit: string, targetLabel: string): string {
  if (!content.includes(previousPinnedCommit)) {
    throw new Error(`Unable to find pinned commit ${previousPinnedCommit} in ${targetLabel}`);
  }

  return content.split(previousPinnedCommit).join(newPinnedCommit);
}

function ensureImportedTreeIsClean(root: string, importedPath: string): void {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all', '--', importedPath], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    throw new Error(stderr || stdout || `git status --porcelain -- ${importedPath} failed`);
  }

  const dirtyEntries = (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (dirtyEntries.length > 0) {
    throw new Error(`Cannot refresh ${importedPath} because it has local tracked or untracked changes`);
  }
}

function ensureWriteTargetsAreClean(root: string, paths: string[]): void {
  const result = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all', '--', ...paths], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    throw new Error(stderr || stdout || `git status --porcelain -- ${paths.join(' ')} failed`);
  }

  const dirtyEntries = (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (dirtyEntries.length > 0) {
    throw new Error(
      `Cannot refresh because one or more refresh metadata targets have local tracked or untracked changes: ${paths.join(', ')}`,
    );
  }
}

function runGit(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
    },
  });

  if (result.status !== 0) {
    const stderr = (result.stderr ?? '').trim();
    const stdout = (result.stdout ?? '').trim();
    throw new Error(stderr || stdout || `git ${args.join(' ')} failed`);
  }

  return (result.stdout ?? '').trim();
}

function materializeSnapshotFromRepo(repoUrl: string, commit: string): { snapshotPath: string; workspaceRoot: string } {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'nexus-upstream-refresh-git-'));
  const checkoutRoot = join(workspaceRoot, 'checkout');
  mkdirSync(workspaceRoot, { recursive: true });

  runGit(['clone', '--quiet', '--no-checkout', repoUrl, checkoutRoot], workspaceRoot);
  runGit(['checkout', '--quiet', '--detach', commit], checkoutRoot);

  const checkedOutCommit = runGit(['rev-parse', 'HEAD'], checkoutRoot);
  if (checkedOutCommit !== commit) {
    throw new Error(`Checked out commit ${checkedOutCommit} does not match requested ${commit}`);
  }

  return { snapshotPath: checkoutRoot, workspaceRoot };
}

function resolveRefreshRepoUrl(upstream: UpstreamMaintenanceDefinition): string {
  return REPO_URL_OVERRIDE ?? upstream.repo_url;
}

function formatList(items: readonly string[]): string {
  return items.length === 0 ? '- none' : items.map((item) => `- \`${item}\``).join('\n');
}

function formatTestsToRerun(analysis: UpstreamRefreshAnalysis): string[] {
  const tests = ['bun test test/nexus/upstream-refresh.test.ts test/nexus/upstream-check.test.ts test/nexus/inventory.test.ts'];

  if (analysis.impacted_source_map_refs.length > 0) {
    tests.push('bun test test/nexus/absorption-source-map.test.ts test/nexus/absorption-runtime.test.ts');
  }

  if (analysis.impacted_stage_content_areas.length > 0) {
    tests.push('bun test test/nexus/stage-content.test.ts');
  }

  const stagePackTests = new Set<string>();
  for (const packId of analysis.impacted_stage_pack_areas) {
    switch (packId) {
      case 'nexus-discover-pack':
      case 'nexus-frame-pack':
        stagePackTests.add('bun test test/nexus/discover-frame.test.ts');
        break;
      case 'nexus-plan-pack':
      case 'nexus-handoff-pack':
        stagePackTests.add('bun test test/nexus/plan-handoff-build.test.ts test/nexus/build-routing.test.ts');
        break;
      case 'nexus-build-pack':
        stagePackTests.add('bun test test/nexus/plan-handoff-build.test.ts test/nexus/build-routing.test.ts test/nexus/build-discipline.test.ts');
        break;
      case 'nexus-review-pack':
        stagePackTests.add('bun test test/nexus/review.test.ts');
        break;
      case 'nexus-qa-pack':
        stagePackTests.add('bun test test/nexus/qa.test.ts');
        break;
      case 'nexus-ship-pack':
        stagePackTests.add('bun test test/nexus/ship.test.ts');
        break;
      case 'nexus-closeout-pack':
        stagePackTests.add('bun test test/nexus/closeout.test.ts');
        break;
      default:
        break;
    }
  }

  tests.push(...stagePackTests);

  return tests;
}

function matchesChangedUpstreamFile(importedPath: string, changedRelativePath: string, upstreamFile: string): boolean {
  const fullChangedPath = `${importedPath}/${changedRelativePath}`;
  return upstreamFile === fullChangedPath || upstreamFile.startsWith(`${fullChangedPath}/`);
}

function collectUpstreamAnalysis(upstreamName: UpstreamName, changedUpstreamPaths: string[]): UpstreamRefreshAnalysis {
  const sourceMapRefs = new Set<string>();
  const stageContentAreas = new Set<string>();
  const stagePackAreas = new Set<string>();

  for (const changedPath of changedUpstreamPaths) {
    for (const entry of SOURCE_MAP_INDEX) {
      if (entry.imported_path !== `upstream/${upstreamName}`) {
        continue;
      }

      if (entry.source_refs.some((sourceRef) => matchesChangedUpstreamFile(entry.imported_path, changedPath, sourceRef.upstream_file))) {
        sourceMapRefs.add(entry.source_map_path);
      }
    }
  }

  for (const contentId of NEXUS_STAGE_CONTENT) {
    const binding = getStageContentSourceBinding(contentId);
    if (
      binding.source_refs.some((sourceRef) =>
        changedUpstreamPaths.some((changedPath) =>
          matchesChangedUpstreamFile(sourceRef.imported_path, changedPath, sourceRef.upstream_file),
        ),
      )
    ) {
      stageContentAreas.add(binding.content_id);
    }
  }

  for (const packId of NEXUS_STAGE_PACKS) {
    const binding = getStagePackSourceBinding(packId);
    if (
      binding.source_refs.some((sourceRef) =>
        changedUpstreamPaths.some((changedPath) =>
          matchesChangedUpstreamFile(sourceRef.imported_path, changedPath, sourceRef.upstream_file),
        ),
      )
    ) {
      stagePackAreas.add(binding.pack_id);
    }
  }

  const analysis: UpstreamRefreshAnalysis = {
    changed_upstream_paths: [...changedUpstreamPaths].sort(),
    impacted_source_map_refs: [...sourceMapRefs].sort(),
    impacted_stage_content_areas: [...stageContentAreas].sort(),
    impacted_stage_pack_areas: [...stagePackAreas].sort(),
    tests_to_rerun: [],
  };
  analysis.tests_to_rerun = formatTestsToRerun(analysis);

  return analysis;
}

function renderUpstreamRefreshCandidateNote(
  upstream: UpstreamMaintenanceDefinition,
  previousPinnedCommit: string,
  newPinnedCommit: string,
  refreshedAt: string,
  analysis: UpstreamRefreshAnalysis,
): string {
  const lines: string[] = [];

  lines.push(`# Upstream Refresh Candidate: ${upstream.name}`);
  lines.push('');
  lines.push(`Refreshed at: \`${refreshedAt}\``);
  lines.push(`Previous pinned commit: \`${previousPinnedCommit}\``);
  lines.push(`New pinned commit: \`${newPinnedCommit}\``);
  lines.push('');
  lines.push('## Changed upstream paths');
  lines.push('');
  lines.push(formatList(analysis.changed_upstream_paths.map((path) => `${upstream.imported_path}/${path}`)));
  lines.push('');
  lines.push('## Impacted `lib/nexus/absorption/*/source-map.ts` references');
  lines.push('');
  lines.push(formatList(analysis.impacted_source_map_refs));
  lines.push('');
  lines.push('## Likely affected stage-content areas');
  lines.push('');
  lines.push(formatList(analysis.impacted_stage_content_areas));
  lines.push('');
  lines.push('## Likely affected stage-pack areas');
  lines.push('');
  lines.push(formatList(analysis.impacted_stage_pack_areas));
  lines.push('');
  lines.push('## Tests to rerun before review');
  lines.push('');
  lines.push(formatList(analysis.tests_to_rerun));
  lines.push('');
  lines.push('## Absorption decision placeholder');
  lines.push('');
  lines.push(formatList(['ignore', 'defer', 'absorb_partial', 'absorb_full', 'reject']));
  lines.push('');
  lines.push('## Guardrails');
  lines.push('');
  lines.push('- Refresh stages imported source material and maintenance metadata only.');
  lines.push('- Refresh does not edit absorption review logic, stage-content, stage-packs, release docs, or `VERSION`.');
  lines.push('- Refresh uses the checked commit recorded in `upstream-notes/upstream-lock.json` as its target.');

  return `${lines.join('\n')}\n`;
}

function rewriteUpstreamReadmePinnedCommit(readme: string, upstream: UpstreamName, pinnedCommit: string): string {
  const pattern = new RegExp(
    `(- \\\`${escapeRegExp(upstream)}\\\`\\n\\s+- repo: \\\`[^\\\`]+\\\`\\n\\s+- pinned_commit: \\\`)` +
      `[^\\\`]+` +
      `(\\\`)`,
    'm',
  );

  if (!pattern.test(readme)) {
    throw new Error(`Unable to find upstream README entry for ${upstream}`);
  }

  return readme.replace(pattern, `$1${pinnedCommit}$2`);
}

function resolveStatusCheckedAt(lock: UpstreamMaintenanceLock): string {
  const latestCheckedAt = lock.upstreams
    .map((record) => record.last_checked_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1);

  return latestCheckedAt ?? lock.updated_at;
}

function renderUpdateStatusFromLock(lock: UpstreamMaintenanceLock): string {
  const results = lock.upstreams.map((record) =>
    buildUpstreamCheckResultFromRecord(
      {
        name: record.name,
        repo_url: record.repo_url,
        pinned_commit: record.pinned_commit,
        active_absorbed_capabilities: record.active_absorbed_capabilities,
      },
      record.last_checked_commit,
      record.behind_count,
    ),
  );

  return renderUpstreamCheckStatus(lock, results, resolveStatusCheckedAt(lock));
}

export function runUpstreamRefresh(options: {
  upstreamName: string;
  root?: string;
  sourceRoot?: string;
  refreshedAt?: string;
}): UpstreamRefreshOutputs {
  const root = options.root ? resolve(options.root) : CLI_ROOT;
  const refreshedAt = options.refreshedAt ?? new Date().toISOString();
  const upstreamName = options.upstreamName as UpstreamName;

  if (!SOURCE_MAP_INDEX.some((entry) => entry.imported_path === `upstream/${upstreamName}`)) {
    throw new Error(`Unknown upstream: ${options.upstreamName}. Supported upstreams: ${SOURCE_MAP_INDEX.map((entry) => entry.imported_path.replace('upstream/', '')).join(', ')}`);
  }

  const lockPath = join(root, LOCK_TARGET);
  const readmePath = join(root, README_TARGET);
  const lock = parseUpstreamMaintenanceLock(readFileSync(lockPath, 'utf8'));
  alignUpstreamLockWithContract(lock);

  const upstream = getUpstreamMaintenanceDefinition(upstreamName);
  const record = lock.upstreams.find((row) => row.name === upstream.name);
  if (!record) {
    throw new Error(`Unable to find refresh target row for ${upstream.name}`);
  }

  if (record.last_checked_commit === null) {
    throw new Error(`Cannot refresh ${upstream.name} because last_checked_commit is missing in upstream-notes/upstream-lock.json`);
  }

  const targetSnapshotPath = join(root, upstream.imported_path);
  const beforeSnapshot = readSnapshot(targetSnapshotPath);
  ensureImportedTreeIsClean(root, upstream.imported_path);
  const candidateNotePath = join(root, 'upstream-notes/refresh-candidates', `${upstream.name}.md`);
  const contractTargets = CONTRACT_PIN_TARGETS[upstream.name];
  const metadataTargetPaths = [
    LOCK_TARGET,
    README_TARGET,
    STATUS_TARGET,
    `upstream-notes/refresh-candidates/${upstream.name}.md`,
    ...contractTargets,
  ];
  ensureWriteTargetsAreClean(root, metadataTargetPaths);
  const textStates = new Map(
    metadataTargetPaths.map((relativePath) => [relativePath, captureTextFileState(join(root, relativePath))] as const),
  );
  const sourceSnapshot =
    options.sourceRoot && resolve(options.sourceRoot) !== root
      ? { snapshotPath: resolve(options.sourceRoot), cleanupRoot: null as string | null }
      : null;
  const repoSnapshot = sourceSnapshot ?? materializeSnapshotFromRepo(resolveRefreshRepoUrl(upstream), record.last_checked_commit);
  const sourceSnapshotPath = repoSnapshot.snapshotPath;
  try {
    copySnapshotTree(sourceSnapshotPath, targetSnapshotPath);
    const afterSnapshot = readSnapshot(targetSnapshotPath);
    const changedUpstreamPaths = diffSnapshots(beforeSnapshot, afterSnapshot);
    const analysis = collectUpstreamAnalysis(upstream.name, changedUpstreamPaths);

    const previousPinnedCommit = record.pinned_commit;
    const newPinnedCommit = record.last_checked_commit;
    const updatedLock: UpstreamMaintenanceLock = {
      ...lock,
      updated_at: refreshedAt,
      upstreams: lock.upstreams.map((row) => {
        if (row.name !== upstream.name) {
          return row;
        }

        return {
          ...row,
          pinned_commit: newPinnedCommit,
          last_checked_commit: newPinnedCommit,
          behind_count: 0,
          last_refresh_candidate_at: refreshedAt,
          last_absorption_decision: null,
          refresh_status: 'refresh_candidate',
          notes:
            analysis.changed_upstream_paths.length === 0
              ? 'Refresh candidate staged from the checked snapshot; imported upstream source material remains non-authoritative until review.'
              : `Refresh candidate staged from the checked snapshot with ${analysis.changed_upstream_paths.length} changed upstream file(s); imported upstream source material remains non-authoritative until review.`,
        };
      }),
    };
    const updatedReadme = rewriteUpstreamReadmePinnedCommit(readFileSync(readmePath, 'utf8'), upstream.name, newPinnedCommit);
    const updatedStatus = renderUpdateStatusFromLock(updatedLock);
    const candidateNote = renderUpstreamRefreshCandidateNote(upstream, previousPinnedCommit, newPinnedCommit, refreshedAt, analysis);
    const rewrittenTargets = new Map<string, string>();

    for (const relativePath of contractTargets) {
      const targetPath = join(root, relativePath);
      rewrittenTargets.set(
        relativePath,
        rewritePinnedCommit(readFileSync(targetPath, 'utf8'), previousPinnedCommit, newPinnedCommit, relativePath),
      );
    }

    mkdirSync(dirname(candidateNotePath), { recursive: true });
    writeFileSync(lockPath, `${serializeUpstreamMaintenanceLock(updatedLock)}`);
    writeFileSync(readmePath, updatedReadme);
    writeFileSync(join(root, STATUS_TARGET), updatedStatus);
    writeFileSync(candidateNotePath, candidateNote);
    for (const [relativePath, updatedContent] of rewrittenTargets) {
      writeFileSync(join(root, relativePath), updatedContent);
    }

    return {
      upstream,
      previous_pinned_commit: previousPinnedCommit,
      new_pinned_commit: newPinnedCommit,
      refreshed_at: refreshedAt,
      changed_upstream_paths: analysis.changed_upstream_paths,
      impacted_source_map_refs: analysis.impacted_source_map_refs,
      impacted_stage_content_areas: analysis.impacted_stage_content_areas,
      impacted_stage_pack_areas: analysis.impacted_stage_pack_areas,
      tests_to_rerun: analysis.tests_to_rerun,
      updated_lock: updatedLock,
      updated_readme: updatedReadme,
      candidate_note_path: candidateNotePath,
      candidate_note: candidateNote,
      write_targets: [
        LOCK_TARGET,
        README_TARGET,
        STATUS_TARGET,
        `upstream-notes/refresh-candidates/${upstream.name}.md`,
        ...contractTargets,
        ...analysis.changed_upstream_paths.map((path) => `${upstream.imported_path}/${path}`),
      ],
      root,
      source_root: sourceSnapshotPath,
      target_snapshot_path: targetSnapshotPath,
      source_snapshot_path: sourceSnapshotPath,
    };
  } catch (error) {
    writeSnapshot(targetSnapshotPath, beforeSnapshot);
    for (const [relativePath, state] of textStates) {
      restoreTextFileState(join(root, relativePath), state);
    }
    throw error;
  } finally {
    if (!sourceSnapshot) {
      rmSync(repoSnapshot.workspaceRoot, { recursive: true, force: true });
    }
  }
}

function main(argv: string[]): void {
  if (argv.length !== 1) {
    throw new Error('Usage: bun run upstream:refresh <upstream-name>');
  }

  const outputs = runUpstreamRefresh({ upstreamName: argv[0] });
  console.log(
    `${outputs.upstream.name}: staged refresh candidate from ${outputs.previous_pinned_commit} to ${outputs.new_pinned_commit}`,
  );
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
