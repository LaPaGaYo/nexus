import { readFileSync } from 'fs';
import { describe, expect, test } from 'bun:test';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';

const INVENTORIES = [
  'upstream-notes/pm-skills-inventory.md',
  'upstream-notes/gsd-inventory.md',
  'upstream-notes/superpowers-inventory.md',
  'upstream-notes/ccb-inventory.md',
  'upstream-notes/gstack-host-migration-inventory.md',
] as const;

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

describe('nexus inventories', () => {
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

  test('gstack host migration inventory stays identification-only and post-m2', () => {
    const markdown = readFileSync('upstream-notes/gstack-host-migration-inventory.md', 'utf8');
    const rows = parseInventory(markdown);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.cleanup_phase).toBe('post-m2');
      expect(row.notes.toLowerCase()).toContain('identification only');
      expect(row.host_disposition === 'retain_as_host' || row.host_disposition === 'retain_until_adapter_stable').toBe(
        true,
      );
    }
  });
});

describe('nexus runtime activation authority', () => {
  test('reserved future seams stay non-active in the runtime registry', () => {
    const registry = getDefaultAdapterRegistry();

    expect(registry.review.superpowers).toBe('reserved_future');
    expect(registry.review.ccb).toBe('reserved_future');
    expect(registry.ship.superpowers).toBe('reserved_future');
    expect(registry.build.superpowers).toBe('active');
    expect(registry.build.ccb).toBe('active');
    expect(registry.handoff.ccb).toBe('active');
  });
});
