import { existsSync, readFileSync } from 'fs';
import { describe, expect, test } from 'bun:test';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';
import {
  COMPATIBILITY_SURFACE_STATUSES,
  GSTACK_COMPATIBILITY_SURFACES,
  HISTORICAL_GSTACK_REFERENCES,
  REMOVED_GSTACK_RUNTIME_IDENTITIES,
  REMOVED_GSTACK_BOUNDARY_SHIMS,
} from '../../lib/nexus/compatibility-surface';
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
  test('shared compatibility contract exposes final removed vs historical gstack surface', () => {
    expect(COMPATIBILITY_SURFACE_STATUSES).toEqual({
      removed_from_active_path: 'removed_from_active_path',
      historical_record_only: 'historical_record_only',
    });

    expect(GSTACK_COMPATIBILITY_SURFACES.length).toBe(
      REMOVED_GSTACK_BOUNDARY_SHIMS.length +
        REMOVED_GSTACK_RUNTIME_IDENTITIES.length +
        HISTORICAL_GSTACK_REFERENCES.length,
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
      if (row.milestone_state !== 'integrating' && row.milestone_state !== 'verified') {
        continue;
      }

      const packIds = parseCsvField(row.nexus_stage_packs ?? '');
      if (packIds.length === 0) {
        continue;
      }

      for (const packId of packIds) {
        expect(NEXUS_STAGE_PACKS.includes(packId as (typeof NEXUS_STAGE_PACKS)[number])).toBe(true);
      }
    }
  });

  test('gstack host migration inventory marks active removal complete and leaves gstack only as history', () => {
    const markdown = readFileSync('upstream-notes/gstack-host-migration-inventory.md', 'utf8');
    const rows = parseInventory(markdown);

    expect(markdown).toContain('Milestone 11 final state');
    expect(markdown).toContain('removed_from_active_path');
    expect(markdown).toContain('historical_record_only');
    expect(markdown).not.toContain('retained_compatibility_shim');
    expect(markdown).not.toContain('deferred_final_removal');

    for (const surface of REMOVED_GSTACK_BOUNDARY_SHIMS) {
      expect(markdown).toContain(surface);
    }
    for (const surface of REMOVED_GSTACK_RUNTIME_IDENTITIES) {
      expect(markdown).toContain(surface);
    }
    for (const surface of HISTORICAL_GSTACK_REFERENCES) {
      expect(markdown).toContain(surface);
    }

    for (const row of rows) {
      expect(row.cleanup_phase).toBe('completed_m11');
      expect(`${row.normalization_required} ${row.notes}`.toLowerCase()).toMatch(
        /host only|removed from active path|historical only|no governed writeback/,
      );
    }
  });
});

describe('nexus docs describe absorbed upstreams as source material', () => {
  test('absorption status locks Nexus-owned stage packs as the active units', () => {
    const markdown = readFileSync('upstream-notes/absorption-status.md', 'utf8');

    expect(markdown).toContain('Nexus-owned stage packs');
    expect(markdown).toContain('source material only');
    expect(markdown).toContain('`~/.nexus` is now the primary host support state root');
    expect(markdown).toContain('`.nexus-worktrees` and `~/.nexus-dev` are now the primary developer substrate roots');
    expect(markdown).toContain('`nexus-*` host helpers are the active entrypoints');
    expect(markdown).toContain('`gstack` now survives only in historical references');
    expect(markdown).not.toContain('`gstack-*` host binaries still work as shims');
  });

  test.each(SURFACE_DOCS)('%s keeps upstream identity secondary to Nexus stage packs', (path) => {
    const markdown = readFileSync(path, 'utf8');

    expect(markdown).toContain('Nexus-owned stage packs');
    expect(markdown).toContain('source material');
  });
});

describe('nexus runtime activation authority', () => {
  test('governed tail seams remain active in the runtime registry', () => {
    const registry = getDefaultAdapterRegistry();

    expect(registry.review.superpowers).toBe('active');
    expect(registry.review.ccb).toBe('active');
    expect(registry.qa.ccb).toBe('active');
    expect(registry.ship.superpowers).toBe('active');
    expect(registry.build.superpowers).toBe('active');
    expect(registry.build.ccb).toBe('active');
    expect(registry.handoff.ccb).toBe('active');
  });
});
