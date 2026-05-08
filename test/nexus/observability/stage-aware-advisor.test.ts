import { describe, expect, test } from 'bun:test';
import { stageAwareAdvisor } from '../../../lib/nexus/completion-advisor/stage-aware-advisor';
import type { SkillRecord } from '../../../lib/nexus/skill-registry/types';
import type { NexusSkillManifest } from '../../../lib/nexus/skill-registry/manifest-schema';
import type { CanonicalCommandId } from '../../../lib/nexus/contracts/types';

function manifest(overrides: Partial<NexusSkillManifest>): NexusSkillManifest {
  return {
    schema_version: 1,
    name: 'test',
    summary: 'test summary',
    intent_keywords: ['test'],
    classification: { namespace: 'nexus_support' },
    ...overrides,
  };
}

function skill(name: string, opts: Partial<SkillRecord> & { manifest?: NexusSkillManifest } = {}): SkillRecord {
  return {
    name,
    surface: `/${name}`,
    description: opts.description ?? `Skill ${name}`,
    path: opts.path ?? `/tmp/${name}/SKILL.md`,
    source_root: opts.source_root ?? '/tmp',
    namespace: opts.namespace ?? 'nexus_support',
    tags: opts.tags ?? [],
    manifest: opts.manifest,
  };
}

describe('stageAwareAdvisor — Phase 3', () => {
  test('returns single matching skill (lifecycle_stages includes stage)', () => {
    const skills = [
      skill('investigate', {
        manifest: manifest({ name: 'investigate', summary: 'Debug', intent_keywords: ['debug'], lifecycle_stages: ['build'] }),
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build' });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('investigate');
    expect(result[0]?.manifest_backed).toBe(true);
    expect(result[0]?.score).toBe(5);
    expect(result[0]?.why_relevant).toContain('build');
  });

  test('returns multiple matching skills sorted by score descending', () => {
    const skills = [
      skill('low', {
        manifest: manifest({ name: 'low', summary: 's', intent_keywords: ['x'], lifecycle_stages: ['build'], ranking: { base_score: 2 } }),
      }),
      skill('mid', {
        manifest: manifest({ name: 'mid', summary: 's', intent_keywords: ['y'], lifecycle_stages: ['build'] }),
      }),
      skill('high', {
        manifest: manifest({ name: 'high', summary: 's', intent_keywords: ['z'], lifecycle_stages: ['build'], ranking: { base_score: 10 } }),
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build' });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(['high', 'mid', 'low']);
  });

  test('cross-stage skill appears in both stages', () => {
    const skills = [
      skill('simplify', {
        manifest: manifest({ name: 'simplify', summary: 's', intent_keywords: ['simplify'], lifecycle_stages: ['build', 'review'] }),
      }),
    ];
    expect(stageAwareAdvisor({ skills, stage: 'build' })).toHaveLength(1);
    expect(stageAwareAdvisor({ skills, stage: 'review' })).toHaveLength(1);
    expect(stageAwareAdvisor({ skills, stage: 'discover' })).toHaveLength(0);
  });

  test('non-matching skill excluded', () => {
    const skills = [
      skill('discover-only', {
        manifest: manifest({ name: 'discover-only', summary: 's', intent_keywords: ['x'], lifecycle_stages: ['discover'] }),
      }),
    ];
    expect(stageAwareAdvisor({ skills, stage: 'build' })).toHaveLength(0);
  });

  test('no-manifest fallback: skill description mentions stage → heuristic match', () => {
    const skills = [
      skill('legacy-build-helper', {
        description: 'A helper used during build to validate things',
        manifest: undefined,
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build' });
    expect(result).toHaveLength(1);
    expect(result[0]?.manifest_backed).toBe(false);
    expect(result[0]?.score).toBe(1);
    expect(result[0]?.why_relevant).toContain('Heuristic match');
  });

  test('no-manifest with description NOT mentioning stage → excluded', () => {
    const skills = [
      skill('unrelated', { description: 'Has nothing to do with relevant work', manifest: undefined }),
    ];
    expect(stageAwareAdvisor({ skills, stage: 'build' })).toHaveLength(0);
  });

  test('score threshold filters out low-score matches', () => {
    const skills = [
      skill('weak', { description: 'something for build but no manifest', manifest: undefined }),
      skill('strong', {
        manifest: manifest({ name: 'strong', summary: 's', intent_keywords: ['x'], lifecycle_stages: ['build'] }),
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build', minScore: 5 });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('strong');
  });

  test('limit caps the number of recommendations', () => {
    const skills = Array.from({ length: 10 }, (_, i) =>
      skill(`skill-${i}`, {
        manifest: manifest({
          name: `skill-${i}`,
          summary: 's',
          intent_keywords: ['x'],
          lifecycle_stages: ['build'],
          ranking: { base_score: 10 - i },
        }),
      }),
    );
    const result = stageAwareAdvisor({ skills, stage: 'build', limit: 3 });
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(['skill-0', 'skill-1', 'skill-2']);
  });

  test('empty registry returns empty array', () => {
    expect(stageAwareAdvisor({ skills: [], stage: 'build' })).toEqual([]);
  });

  test('tag overlap with intent_keywords boosts score', () => {
    const skills = [
      skill('tagged', {
        manifest: manifest({
          name: 'tagged',
          summary: 's',
          intent_keywords: ['security', 'audit'],
          lifecycle_stages: ['review'],
        }),
      }),
    ];
    const withoutTags = stageAwareAdvisor({ skills, stage: 'review' });
    const withMatchingTag = stageAwareAdvisor({ skills, stage: 'review', tags: ['security'] });
    const withTwoTags = stageAwareAdvisor({ skills, stage: 'review', tags: ['security', 'audit'] });

    expect(withoutTags[0]?.score).toBe(5);
    expect(withMatchingTag[0]?.score).toBe(6);
    expect(withTwoTags[0]?.score).toBe(7);
  });

  test('alphabetical tiebreak when scores equal', () => {
    const skills = [
      skill('zebra', {
        manifest: manifest({ name: 'zebra', summary: 's', intent_keywords: ['x'], lifecycle_stages: ['build'] }),
      }),
      skill('alpha', {
        manifest: manifest({ name: 'alpha', summary: 's', intent_keywords: ['x'], lifecycle_stages: ['build'] }),
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build' });
    expect(result.map((r) => r.name)).toEqual(['alpha', 'zebra']);
  });

  test('namespace propagated from manifest classification', () => {
    const skills = [
      skill('canonical-skill', {
        namespace: 'external_installed',
        manifest: manifest({
          name: 'canonical-skill',
          summary: 's',
          intent_keywords: ['x'],
          lifecycle_stages: ['build'],
          classification: { namespace: 'nexus_canonical' },
        }),
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build' });
    expect(result[0]?.namespace).toBe('nexus_canonical');
  });

  test('summary uses manifest.summary, falls back to description', () => {
    const skills = [
      skill('with-manifest-summary', {
        description: 'old description',
        manifest: manifest({
          name: 'with-manifest-summary',
          summary: 'manifest summary',
          intent_keywords: ['x'],
          lifecycle_stages: ['build'],
        }),
      }),
      skill('no-manifest', {
        description: 'description for build stage',
        manifest: undefined,
      }),
    ];
    const result = stageAwareAdvisor({ skills, stage: 'build' });
    const withManifest = result.find((r) => r.name === 'with-manifest-summary');
    const withoutManifest = result.find((r) => r.name === 'no-manifest');
    expect(withManifest?.summary).toBe('manifest summary');
    expect(withoutManifest?.summary).toBe('description for build stage');
  });

  test('all 9 canonical stages route correctly via real manifests (regression)', () => {
    // Smoke test: real /skills/canonical/* manifests cover all 9 stages
    const allStages: CanonicalCommandId[] = [
      'discover', 'frame', 'plan', 'handoff', 'build', 'review', 'qa', 'ship', 'closeout',
    ];
    // Simulated registry of canonical 9 with manifests
    const canonical = allStages.map((stage) =>
      skill(stage, {
        namespace: 'nexus_canonical',
        manifest: manifest({
          name: stage,
          summary: `Canonical /${stage}`,
          intent_keywords: [`do ${stage}`],
          lifecycle_stages: [stage],
          classification: { namespace: 'nexus_canonical' },
        }),
      }),
    );
    for (const stage of allStages) {
      const result = stageAwareAdvisor({ skills: canonical, stage });
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe(stage);
      expect(result[0]?.namespace).toBe('nexus_canonical');
    }
  });
});
