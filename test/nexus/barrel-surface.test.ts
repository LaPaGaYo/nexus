/**
 * Pin the `lib/nexus` curated public barrel (#151).
 *
 * Two-way protection:
 *   - If a future contributor removes an export from `lib/nexus/index.ts`,
 *     these assertions fail. That's good — removing public API should be
 *     a conscious, documented decision.
 *   - If a future contributor adds a new export, the "must be present"
 *     assertions still pass but `expectedKeys` documents the intended
 *     surface. Reviewers can compare a PR's additions against this list
 *     to spot accidental over-exposure.
 *
 * Internal helpers (validation-helpers, normalizers, host-roots,
 * install-metadata, CLI entry points, observability/release/review
 * internals) are intentionally NOT in the barrel. They should be reached
 * via specific subdirectory imports if needed.
 */

import { describe, expect, test } from 'bun:test';
import * as nexus from '../../lib/nexus';

const EXPECTED_VALUE_EXPORTS = [
  // ── Canonical identifiers ──
  'CANONICAL_COMMANDS',
  'LEARNING_SOURCES',
  'LEARNING_TYPES',
  'NEXUS_LEDGER_SCHEMA_VERSION',
  'PRIMARY_PROVIDERS',
  'PROVIDER_TOPOLOGIES',
  'CANONICAL_MANIFEST',
  'LEGACY_ALIASES',
  // ── Adapter factories ──
  'getDefaultNexusAdapters',
  'getRuntimeNexusAdapters',
  'createRuntimeLocalAdapter',
  // ── Skill registry surface ──
  'NEXUS_SAFETY_SKILL_NAMES',
  'NEXUS_SUPPORT_SKILL_NAMES',
  'NEXUS_STRUCTURED_SUPPORT_SKILL_NAMES',
  'NEXUS_SKILL_NAMESPACES',
  'NEXUS_SKILL_MANIFEST_SCHEMA_VERSION',
  'discoverInstalledSkills',
  // ── Stage taxonomy and packs ──
  'NEXUS_STAGE_CONTENT',
  'getStagePackSourceMap',
  // ── Learning surface (SP1) ──
  'assertSchemaV2',
  'generateLearningId',
  'parseLearningId',
  'deriveLegacyId',
  'computeStrength',
  'normalizeLearningLine',
  'writeLearningCandidate',
] as const;

describe('lib/nexus barrel surface (#151)', () => {
  test('exposes every documented public value export', () => {
    const missing = EXPECTED_VALUE_EXPORTS.filter((key) => !(key in nexus));
    expect(missing).toEqual([]);
  });

  test('canonical command list resolves through the barrel', () => {
    // Spot check: the barrel must produce the same canonical commands as
    // direct subdir imports. Mismatches surface accidental re-export
    // shadowing or stale paths.
    expect(nexus.CANONICAL_COMMANDS).toContain('discover');
    expect(nexus.CANONICAL_COMMANDS).toContain('handoff');
    expect(nexus.CANONICAL_COMMANDS).toContain('closeout');
  });

  test('CANONICAL_MANIFEST surface matches the contracts/command-manifest source', async () => {
    const direct = await import('../../lib/nexus/contracts/command-manifest');
    expect(nexus.CANONICAL_MANIFEST).toBe(direct.CANONICAL_MANIFEST);
  });

  test('skill-registry constants resolve to the same arrays as the subdir', async () => {
    const direct = await import('../../lib/nexus/skill-registry');
    expect(nexus.NEXUS_SAFETY_SKILL_NAMES).toBe(direct.NEXUS_SAFETY_SKILL_NAMES);
    expect(nexus.NEXUS_SUPPORT_SKILL_NAMES).toBe(direct.NEXUS_SUPPORT_SKILL_NAMES);
  });

  test('adapter factories produce wireable adapter sets', () => {
    const adapters = nexus.getDefaultNexusAdapters();
    expect(adapters).toBeDefined();
    expect(typeof nexus.createRuntimeLocalAdapter).toBe('function');
  });

  test('does NOT re-export internal helpers', () => {
    // Pin the negative side: these subdirectory internals should stay
    // off the barrel. If a future contributor adds them, that's a real
    // architectural shift that should require a deliberate decision.
    const shouldNotBePresent = [
      'readJsonStrict',       // io/validation-helpers
      'getPrimaryStatePath',  // io/host-roots
      'normalizeBuildResult', // normalizers
      'runCommand',           // runtime
      // SP1 learning internals — closeout-only, must not leak through barrel
      'isMirrorEnabled',         // learning/config.ts
      'mirrorCanonicalToJsonl',  // learning/mirror.ts
    ];
    const leaked = shouldNotBePresent.filter((key) => key in nexus);
    expect(leaked).toEqual([]);
  });
});
