import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, test } from 'bun:test';
import { readNexusSkillManifest } from '../../../lib/nexus/skill-registry/manifest-parser';
import {
  NEXUS_SKILL_MANIFEST_SCHEMA_VERSION,
  NEXUS_SKILL_NAMESPACES,
  type NexusSkillManifest,
} from '../../../lib/nexus/skill-registry/manifest-schema';

const roots: string[] = [];

function tempManifest(content: string): string {
  const root = mkdtempSync(join(tmpdir(), 'nexus-skill-manifest-'));
  roots.push(root);
  const path = join(root, 'nexus.skill.yaml');
  writeFileSync(path, content);
  return path;
}

afterEach(() => {
  while (roots.length > 0) {
    rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe('nexus.skill.yaml manifest parser', () => {
  test('parses a minimal valid manifest', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: my-skill
summary: A skill that does a thing.
intent_keywords:
  - do the thing
`));

    expect(result).toEqual({
      kind: 'manifest',
      data: {
        schema_version: NEXUS_SKILL_MANIFEST_SCHEMA_VERSION,
        name: 'my-skill',
        summary: 'A skill that does a thing.',
        intent_keywords: ['do the thing'],
      } satisfies NexusSkillManifest,
    });
  });

  test('parses a full manifest with optional fields', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: prd-development
summary: Guide PMs through PRD creation.
intent_keywords:
  - write a PRD
  - product requirements document
lifecycle_stages:
  - frame
  - plan
classification:
  namespace: external_installed
  category: product-management
applies_to:
  hosts:
    - claude
    - codex
  contexts:
    - solo
    - pair
inputs:
  - name: discovery_artifact
    description: Output from discover.
    optional: true
outputs:
  - name: prd_document
    description: Structured PRD markdown.
    artifact: framing/prd.md
ranking:
  base_score: 5
  boosts:
    - context: stage:frame
      delta: 3
    - tag: code-review
      delta: -2
provenance:
  author: PM Skills
  source_url: https://github.com/dpcjjj/pm-skills
  version: 2.4.1
  license: MIT
notes:
  - Best after discovery.
`));

    expect(result).toMatchObject({
      kind: 'manifest',
      data: {
        name: 'prd-development',
        lifecycle_stages: ['frame', 'plan'],
        classification: {
          namespace: 'external_installed',
          category: 'product-management',
        },
        applies_to: {
          hosts: ['claude', 'codex'],
          contexts: ['solo', 'pair'],
        },
        ranking: {
          base_score: 5,
          boosts: [
            { context: 'stage:frame', delta: 3 },
            { tag: 'code-review', delta: -2 },
          ],
        },
      },
    });
  });

  test.each(['nexus_safety', 'nexus_root'] as const)('accepts %s classification namespace', (namespace) => {
    expect(NEXUS_SKILL_NAMESPACES).toContain(namespace);

    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: ${namespace}-skill
summary: Namespaced skill.
intent_keywords:
  - ${namespace} routing
classification:
  namespace: ${namespace}
`));

    expect(result).toMatchObject({
      kind: 'manifest',
      data: {
        classification: { namespace },
      },
    });
  });

  test('rejects a manifest missing a required name', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
summary: Missing name.
intent_keywords:
  - missing name
`));

    expect(result).toEqual({ kind: 'invalid', reason: 'name required' });
  });

  test('returns parse_error for invalid YAML syntax', () => {
    const result = readNexusSkillManifest(tempManifest('schema_version: ['));

    expect(result.kind).toBe('parse_error');
  });

  test('returns unsupported_version for future schema versions', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 2
name: future-skill
summary: Future schema.
intent_keywords:
  - future
`));

    expect(result).toEqual({ kind: 'unsupported_version', found: 2 });
  });

  test('warns but parses unknown top-level fields', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (message?: unknown): void => {
      warnings.push(String(message));
    };

    try {
      const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: unknown-field-skill
summary: Has an extra field.
intent_keywords:
  - extra
foo: bar
`));

      expect(result).toMatchObject({
        kind: 'manifest',
        data: {
          name: 'unknown-field-skill',
        },
      });
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toEqual(["[nexus] Unknown nexus.skill.yaml field 'foo' ignored."]);
  });

  test('rejects a missing schema_version', () => {
    const result = readNexusSkillManifest(tempManifest(`
name: no-version
summary: Missing schema.
intent_keywords:
  - no version
`));

    expect(result).toEqual({ kind: 'invalid', reason: 'schema_version required' });
  });

  test('returns parse_error for an empty file', () => {
    const result = readNexusSkillManifest(tempManifest(''));

    expect(result).toEqual({ kind: 'parse_error', reason: 'nexus.skill.yaml is empty' });
  });

  test('returns missing when the manifest path does not exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'nexus-skill-manifest-'));
    roots.push(root);

    expect(readNexusSkillManifest(join(root, 'nexus.skill.yaml'))).toEqual({ kind: 'missing' });
  });

  test('rejects an empty intent_keywords array', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: no-intent
summary: Missing intent phrases.
intent_keywords: []
`));

    expect(result).toEqual({ kind: 'invalid', reason: 'at least one intent_keyword required' });
  });

  test('rejects lifecycle stages outside the canonical enum', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: bad-stage
summary: Bad stage.
intent_keywords:
  - bad stage
lifecycle_stages:
  - foo
`));

    expect(result).toEqual({ kind: 'invalid', reason: "lifecycle_stages contains unsupported value 'foo'" });
  });

  test('rejects classification namespaces outside the enum', () => {
    const result = readNexusSkillManifest(tempManifest(`
schema_version: 1
name: bad-namespace
summary: Bad namespace.
intent_keywords:
  - bad namespace
classification:
  namespace: partner_magic
`));

    expect(result).toEqual({
      kind: 'invalid',
      reason: "classification.namespace contains unsupported value 'partner_magic'",
    });
  });
});
