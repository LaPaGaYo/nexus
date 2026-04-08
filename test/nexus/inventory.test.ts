import { existsSync, readFileSync } from 'fs';
import { describe, expect, test } from 'bun:test';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';
import {
  ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE,
  COMPATIBILITY_SURFACE_STATUSES,
  DEFERRED_LEGACY_REMOVAL_SURFACES,
  GSTACK_COMPATIBILITY_SURFACES,
  RETAINED_BOUNDARY_COMPATIBILITY_SHIMS,
} from '../../lib/nexus/compatibility-surface';
import { getStageContent } from '../../lib/nexus/stage-content';
import { NEXUS_STAGE_PACKS } from '../../lib/nexus/types';

const INVENTORIES = [
  'upstream-notes/pm-skills-inventory.md',
  'upstream-notes/gsd-inventory.md',
  'upstream-notes/superpowers-inventory.md',
  'upstream-notes/ccb-inventory.md',
  'upstream-notes/gstack-host-migration-inventory.md',
] as const;

const IMPORTED_SOURCE_INVENTORIES = [
  'upstream-notes/pm-skills-inventory.md',
  'upstream-notes/gsd-inventory.md',
  'upstream-notes/superpowers-inventory.md',
  'upstream-notes/ccb-inventory.md',
] as const;

const SURFACE_DOCS = ['README.md', 'docs/skills.md'] as const;

const MANDATORY_FIELDS = [
  'classification',
  'milestone_state',
  'canonical_nexus_commands',
  'nexus_adapter_seams',
  'governed_artifact_boundaries',
  'normalization_required',
  'conflict_policy',
  'conflict_artifact_paths',
] as const;

const PROVENANCE_FIELDS = [
  'upstream_repo_url',
  'pinned_commit',
  'imported_path',
  'absorption_intent',
  'forbidden_authorities',
] as const;

function parseInventory(markdown: string): Array<Record<string, string>> {
  const lines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));

  if (lines.length < 3) {
    throw new Error('Inventory table is missing');
  }

  const headers = lines[0]
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean);
  const rows = lines.slice(2).filter((line) => !/^\|\s*-/.test(line));

  return rows.map((line) => {
    const values = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);

    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function parseCsvField(value: string): string[] {
  return value
    .split(',')
    .map((cell) => cell.trim())
    .filter(Boolean);
}

describe('nexus inventories', () => {
  test('shared compatibility contract exposes removed, retained, and deferred gstack surfaces', () => {
    expect(COMPATIBILITY_SURFACE_STATUSES).toEqual({
      removed_from_active_path: 'removed_from_active_path',
      retained_compatibility_shim: 'retained_compatibility_shim',
      deferred_final_removal: 'deferred_final_removal',
    });
    expect(GSTACK_COMPATIBILITY_SURFACES.length).toBe(
      RETAINED_BOUNDARY_COMPATIBILITY_SHIMS.length +
        ACTIVE_PATH_GSTACK_IDENTITIES_TO_REMOVE.length +
        DEFERRED_LEGACY_REMOVAL_SURFACES.length,
    );
  });

  test.each(INVENTORIES)('%s includes populated mandatory fields', (path) => {
    const markdown = readFileSync(path, 'utf8');
    const rows = parseInventory(markdown);

    for (const field of MANDATORY_FIELDS) {
      expect(markdown).toContain(field);
      for (const row of rows) {
        expect(row[field]).not.toBe('');
      }
    }
  });

  test.each(IMPORTED_SOURCE_INVENTORIES)('%s includes populated upstream provenance fields', (path) => {
    const markdown = readFileSync(path, 'utf8');
    const rows = parseInventory(markdown);

    for (const field of PROVENANCE_FIELDS) {
      expect(markdown).toContain(field);
      for (const row of rows) {
        expect(row[field]).not.toBe('');
      }
    }

    for (const row of rows) {
      expect(row.upstream_repo_url).toMatch(/^https:\/\/github\.com\/.+\.git$/);
      expect(row.pinned_commit).toMatch(/^[0-9a-f]{40}$/);
      expect(row.imported_path.startsWith('upstream/')).toBe(true);
      expect(existsSync(row.imported_path)).toBe(true);
    }
  });

  test.each(IMPORTED_SOURCE_INVENTORIES)('%s links active rows to Nexus-owned stage packs', (path) => {
    const markdown = readFileSync(path, 'utf8');
    const rows = parseInventory(markdown);

    expect(markdown).toContain('nexus_stage_packs');

    for (const row of rows) {
      const isActiveRow = row.milestone_state === 'integrating' || row.activation_state === 'active_m2';
      if (!isActiveRow) {
        continue;
      }

      const packIds = parseCsvField(row.nexus_stage_packs);
      expect(packIds.length).toBeGreaterThan(0);
      for (const packId of packIds) {
        expect(NEXUS_STAGE_PACKS.includes(packId as (typeof NEXUS_STAGE_PACKS)[number])).toBe(true);
      }
    }
  });

  test('gstack host migration inventory remains migration-only and scheduled after the current host phase', () => {
    const markdown = readFileSync('upstream-notes/gstack-host-migration-inventory.md', 'utf8');
    const rows = parseInventory(markdown);

    expect(markdown).toContain('Nexus-primary');
    expect(markdown).toContain('~/.nexus');
    expect(markdown).toContain('.nexus-worktrees');
    expect(markdown).toContain('~/.nexus-dev');
    expect(markdown).toContain('~/.gstack');
    expect(markdown).toContain('.gstack-worktrees');
    expect(markdown).toContain('~/.gstack-dev');
    expect(markdown).toContain('nexus-*');
    expect(markdown).toContain('gstack-*');

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.cleanup_phase).toMatch(/^post-m\d+$/);
      expect(`${row.normalization_required} ${row.notes}`.toLowerCase()).toMatch(/host only|compatibility|no governed writeback/);
      expect(row.host_disposition === 'retain_as_host' || row.host_disposition === 'retain_until_adapter_stable').toBe(
        true,
      );
    }
  });
});

describe('nexus docs describe absorbed upstreams as source material', () => {
  test('absorption status locks stage packs as the active Nexus-owned units', () => {
    const markdown = readFileSync('upstream-notes/absorption-status.md', 'utf8');

    expect(markdown).toContain('Nexus-owned stage packs');
    expect(markdown).toContain('source material only');
    expect(markdown).toContain('`lib/nexus/stage-packs/`');
    expect(markdown).toContain('`~/.nexus` is now the primary host support state root');
    expect(markdown).toContain('`.nexus-worktrees` and `~/.nexus-dev` are now the primary developer substrate roots');
    expect(markdown).toContain('`~/.gstack` remains compatibility-only');
    expect(markdown).toContain('`.gstack-worktrees` and `~/.gstack-dev` remain compatibility-only');
    expect(markdown).toContain('`nexus-*` host helpers are the preferred entrypoints');
    expect(markdown).toContain('`gstack-*` host binaries still work as shims');
  });

  test.each(SURFACE_DOCS)('%s keeps upstream identity secondary to Nexus stage packs', (path) => {
    const markdown = readFileSync(path, 'utf8');

    expect(markdown).toContain('Nexus-owned stage packs');
    expect(markdown).toContain('source material');
  });
});

describe('nexus runtime activation authority', () => {
  test('governed tail seams are active in the runtime registry', () => {
    const registry = getDefaultAdapterRegistry();

    expect(registry.review.superpowers).toBe('active');
    expect(registry.review.ccb).toBe('active');
    expect(registry.qa.ccb).toBe('active');
    expect(registry.ship.superpowers).toBe('active');
    expect(registry.build.superpowers).toBe('active');
    expect(registry.build.ccb).toBe('active');
    expect(registry.handoff.ccb).toBe('active');
  });

  test('review, qa, and ship stage content and stage packs exist for the active governed tail', () => {
    for (const file of [
      'lib/nexus/stage-content/review/index.ts',
      'lib/nexus/stage-content/review/overview.md',
      'lib/nexus/stage-content/review/checklist.md',
      'lib/nexus/stage-content/review/artifact-contract.md',
      'lib/nexus/stage-content/review/routing.md',
      'lib/nexus/stage-content/qa/index.ts',
      'lib/nexus/stage-content/qa/overview.md',
      'lib/nexus/stage-content/qa/checklist.md',
      'lib/nexus/stage-content/qa/artifact-contract.md',
      'lib/nexus/stage-content/qa/routing.md',
      'lib/nexus/stage-content/ship/index.ts',
      'lib/nexus/stage-content/ship/overview.md',
      'lib/nexus/stage-content/ship/checklist.md',
      'lib/nexus/stage-content/ship/artifact-contract.md',
      'lib/nexus/stage-content/ship/routing.md',
      'lib/nexus/stage-packs/review.ts',
      'lib/nexus/stage-packs/qa.ts',
      'lib/nexus/stage-packs/ship.ts',
    ]) {
      expect(existsSync(file)).toBe(true);
    }

    expect(getStageContent('nexus-review-content').sections.overview).toContain('Nexus-owned');
    expect(getStageContent('nexus-qa-content').sections.overview).toContain('Nexus-owned');
    expect(getStageContent('nexus-ship-content').sections.overview).toContain('Nexus-owned');
  });
});
