import { existsSync, readFileSync } from 'fs';
import { describe, expect, test } from 'bun:test';
import { getDefaultAdapterRegistry } from '../../lib/nexus/adapters/registry';
import {
  COMPATIBILITY_SURFACES,
  COMPATIBILITY_SURFACE_STATUSES,
  HISTORICAL_LEGACY_REFERENCES,
  REMOVED_COMPATIBILITY_BOUNDARY_SHIMS,
  REMOVED_LEGACY_RUNTIME_IDENTITIES,
} from '../../lib/nexus/compatibility-surface';
import { NEXUS_STAGE_PACKS } from '../../lib/nexus/types';

const INVENTORIES = [
  'vendor/upstream-notes/pm-skills-inventory.md',
  'vendor/upstream-notes/gsd-inventory.md',
  'vendor/upstream-notes/superpowers-inventory.md',
  'vendor/upstream-notes/ccb-inventory.md',
  'vendor/upstream-notes/legacy-host-migration-history.md',
] as const;

const IMPORTED_SOURCE_INVENTORIES = [
  'vendor/upstream-notes/pm-skills-inventory.md',
  'vendor/upstream-notes/gsd-inventory.md',
  'vendor/upstream-notes/superpowers-inventory.md',
  'vendor/upstream-notes/ccb-inventory.md',
] as const;

const UPSTREAM_LOCK_PATH = 'vendor/upstream-notes/upstream-lock.json';
const UPSTREAM_README_PATH = 'vendor/upstream/README.md';
const UPDATE_STATUS_PATH = 'vendor/upstream-notes/update-status.md';

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

function parseUpstreamReadme(markdown: string): Array<{ name: string; repo_url: string; pinned_commit: string }> {
  const normalizedMarkdown = markdown.replace(/\r\n?/g, '\n');
  const matches = [...normalizedMarkdown.matchAll(/- `([^`]+)`\n\s+- repo: `([^`]+)`\n\s+- pinned_commit: `([^`]+)`/g)];

  return matches.map((match) => ({
    name: match[1],
    repo_url: match[2],
    pinned_commit: match[3],
  }));
}

describe('nexus inventories', () => {
  test('shared compatibility contract exposes final removed vs historical legacy surface', () => {
    expect(COMPATIBILITY_SURFACE_STATUSES).toEqual({
      removed_from_active_path: 'removed_from_active_path',
      historical_record_only: 'historical_record_only',
    });

    expect(COMPATIBILITY_SURFACES.length).toBe(
      REMOVED_COMPATIBILITY_BOUNDARY_SHIMS.length +
        REMOVED_LEGACY_RUNTIME_IDENTITIES.length +
        HISTORICAL_LEGACY_REFERENCES.length,
    );
  });

  test.skip('upstream inventory markdown checks are retired until Track D-D2 removes vendor snapshots', () => {});
});

describe('nexus docs describe absorbed upstreams as source material', () => {
  test.skip('absorption status locks Nexus-owned stage packs as the active units', () => {
    const markdown = readFileSync('vendor/upstream-notes/absorption-status.md', 'utf8');

    expect(markdown).toContain('Nexus-owned stage packs');
    expect(markdown).toContain('source material only');
    expect(markdown).toContain('`~/.nexus` is now the primary host support state root');
    expect(markdown).toContain('`.nexus-worktrees` and `~/.nexus-dev` are now the primary developer substrate roots');
    expect(markdown).toContain('`nexus-*` host helpers are the active entrypoints');
    expect(markdown).toContain('`gstack` now survives only in archived records');
    expect(markdown).not.toContain('`gstack-*` host binaries still work as shims');
  });

  test.each(SURFACE_DOCS)('%s keeps upstream identity secondary to Nexus stage packs', (path) => {
    const markdown = readFileSync(path, 'utf8');

    expect(markdown).toContain('Nexus-owned stage packs');
    expect(markdown).toContain('source material');
  });

  test.skip('upstream README stays aligned with the checked maintenance lock and live status summary', () => {
    const readme = readFileSync(UPSTREAM_README_PATH, 'utf8');
    const lock = JSON.parse(readFileSync(UPSTREAM_LOCK_PATH, 'utf8')) as {
      upstreams: Array<{
        name: string;
        repo_url: string;
        pinned_commit: string;
        bootstrap_state: string;
        last_checked_commit: string | null;
        last_checked_at: string | null;
        behind_count: number | null;
        refresh_status: string;
        active_absorbed_capabilities: string[];
      }>;
    };
    const readmeEntries = parseUpstreamReadme(readme);
    const updateStatus = readFileSync(UPDATE_STATUS_PATH, 'utf8');

    expect(readme).toContain('vendor/upstream-notes/upstream-lock.json');
    expect(readme).toContain('vendor/upstream-notes/update-status.md');
    expect(readme).toContain('bootstrap snapshot');
    expect(readmeEntries).toHaveLength(lock.upstreams.length);
    expect(updateStatus).toContain('Last checked:');
    expect(updateStatus).not.toContain('No upstream checks have run yet.');
    expect(updateStatus).not.toContain('Bootstrap Snapshot');

    const readmeByName = new Map(readmeEntries.map((entry) => [entry.name, entry]));

    for (const record of lock.upstreams) {
      const capabilities = record.active_absorbed_capabilities.map((capability) => `\`${capability}\``).join(', ');
      const triage =
        record.last_checked_commit === null
          ? 'defer'
          : record.behind_count === null
            ? 'defer'
            : record.behind_count === 0
            ? 'ignore'
            : record.behind_count > 1
              ? 'refresh_now'
              : 'review';

      expect(record.bootstrap_state).toBe('checked');
      expect(readmeByName.get(record.name)).toEqual({
        name: record.name,
        repo_url: record.repo_url,
        pinned_commit: record.pinned_commit,
      });
      expect(updateStatus).toContain(
        `| ${record.name} | \`${record.pinned_commit}\` | \`${record.last_checked_commit}\` | ${record.behind_count} | ${capabilities} | \`${triage}\` |`,
      );
    }
  });
});

describe('nexus runtime activation authority', () => {
  test('governed tail seams remain active in the runtime registry', () => {
    const registry = getDefaultAdapterRegistry();

    expect(registry.review.execution).toBe('active');
    expect(registry.review.ccb).toBe('active');
    expect(registry.qa.ccb).toBe('active');
    expect(registry.ship.execution).toBe('active');
    expect(registry.ship.local).toBe('active');
    expect(registry.build.execution).toBe('active');
    expect(registry.build.ccb).toBe('active');
    expect(registry.handoff.ccb).toBe('active');
  });
});
