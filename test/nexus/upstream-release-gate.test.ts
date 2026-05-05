import { readFileSync } from 'fs';
import { describe, expect, test } from 'bun:test';

type ReleaseChangeScenario = {
  importedSnapshotChangesOnly?: boolean;
  provenanceOnlyChanges?: boolean;
  nexusOwnedStageContentChanged?: boolean;
  nexusOwnedStagePackChanged?: boolean;
  providerCompatibilitySeamChanged?: boolean;
};

function requiresNexusRelease(change: ReleaseChangeScenario): boolean {
  return (
    change.nexusOwnedStageContentChanged === true ||
    change.nexusOwnedStagePackChanged === true ||
    change.providerCompatibilitySeamChanged === true
  );
}

describe('nexus upstream release gate', () => {
  test('requires release when Nexus-owned stage content changes', () => {
    expect(
      requiresNexusRelease({
        nexusOwnedStageContentChanged: true,
      }),
    ).toBe(true);
  });

  test('requires release when Nexus-owned stage pack changes', () => {
    expect(
      requiresNexusRelease({
        nexusOwnedStagePackChanged: true,
      }),
    ).toBe(true);
  });

  test('requires release when Nexus-owned changes are mixed with imported snapshot or provenance-only updates', () => {
    expect(
      requiresNexusRelease({
        importedSnapshotChangesOnly: true,
        nexusOwnedStageContentChanged: true,
      }),
    ).toBe(true);

    expect(
      requiresNexusRelease({
        provenanceOnlyChanges: true,
        nexusOwnedStagePackChanged: true,
      }),
    ).toBe(true);
  });

  test('treats imported snapshot changes alone as insufficient for release', () => {
    expect(requiresNexusRelease({ importedSnapshotChangesOnly: true })).toBe(false);
  });

  test('treats provenance-only source-map updates as non-releasing metadata changes', () => {
    expect(requiresNexusRelease({ provenanceOnlyChanges: true })).toBe(false);
  });

  test('allows provider compatibility changes to require release when they ship through Nexus-owned seams', () => {
    expect(
      requiresNexusRelease({
        providerCompatibilitySeamChanged: true,
      }),
    ).toBe(true);
  });

  test.skip('documents CCB as compatibility infrastructure and not a full-retirement target', () => {
    const ccbInventory = readFileSync('vendor/upstream-notes/ccb-inventory.md', 'utf8');
    const absorptionStatus = readFileSync('vendor/upstream-notes/absorption-status.md', 'utf8');
    const runbook = readFileSync('docs/superpowers/runbooks/upstream-refresh.md', 'utf8');

    expect(ccbInventory).toContain('compatibility infrastructure');
    expect(ccbInventory).toContain('not a full-retirement target');
    expect(absorptionStatus).toContain('compatibility infrastructure');
    expect(absorptionStatus).toContain('not a full-retirement target');
    expect(runbook).toContain('compatibility infrastructure');
    expect(runbook).toContain('not a full-retirement target');
  });

  test.skip('documents maintainer-only refresh decisions separately from governed truth', () => {
    const runbook = readFileSync('docs/superpowers/runbooks/upstream-refresh.md', 'utf8');
    const absorptionStatus = readFileSync('vendor/upstream-notes/absorption-status.md', 'utf8');

    for (const decision of ['ignore', 'defer', 'absorb_partial', 'absorb_full', 'reject'] as const) {
      expect(runbook).toContain(`\`${decision}\``);
      expect(absorptionStatus).toContain(`\`${decision}\``);
    }

    expect(runbook).toContain('maintainer-only');
    expect(runbook).toContain('not governed lifecycle truth');
    expect(absorptionStatus).toContain('maintainer-only');
    expect(absorptionStatus).toContain('not governed lifecycle truth');
  });
});
