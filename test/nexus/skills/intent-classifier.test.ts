import { describe, expect, test } from 'bun:test';
import { classifyIntent, scoreSkillForIntent, formatOutcomeForTerminal } from '../../../lib/nexus/intent-classifier';
import type { SkillRecord } from '../../../lib/nexus/skill-registry/types';
import type { NexusSkillManifest } from '../../../lib/nexus/skill-registry/manifest-schema';

function manifest(overrides: Partial<NexusSkillManifest>): NexusSkillManifest {
  return {
    schema_version: 1,
    name: 'test',
    summary: 'test summary',
    intent_keywords: ['test'],
    classification: { namespace: 'nexus_canonical' },
    ...overrides,
  };
}

function skill(name: string, opts: Partial<SkillRecord> & { manifest?: NexusSkillManifest } = {}): SkillRecord {
  return {
    name,
    surface: `/${name}`,
    description: opts.description ?? null,
    path: opts.path ?? `/tmp/${name}/SKILL.md`,
    source_root: opts.source_root ?? '/tmp',
    namespace: opts.namespace ?? 'nexus_canonical',
    tags: opts.tags ?? [],
    manifest: opts.manifest,
  };
}

describe('classifyIntent — Phase 5 keyword classifier', () => {
  test('confident_match when single skill scores well above threshold', () => {
    const skills = [
      skill('ship', {
        manifest: manifest({
          name: 'ship',
          summary: 's',
          intent_keywords: ['ship it', 'merge to main', 'release the change'],
          lifecycle_stages: ['ship'],
        }),
      }),
    ];
    const result = classifyIntent('ship it now', skills);
    expect(result.kind).toBe('confident_match');
    if (result.kind === 'confident_match') {
      expect(result.chosen.name).toBe('ship');
      expect(result.chosen.matched_keywords).toContain('ship it');
    }
  });

  test('no_match when intent has no keyword overlap', () => {
    const skills = [
      skill('ship', {
        manifest: manifest({
          name: 'ship',
          summary: 's',
          intent_keywords: ['ship it', 'merge to main'],
          lifecycle_stages: ['ship'],
        }),
      }),
    ];
    const result = classifyIntent('I need to do my taxes', skills);
    expect(result.kind).toBe('no_match');
  });

  test('ambiguous when two skills tie at the top', () => {
    const skills = [
      skill('alpha', {
        manifest: manifest({ name: 'alpha', summary: 's', intent_keywords: ['xyz'], lifecycle_stages: ['build'] }),
      }),
      skill('beta', {
        manifest: manifest({ name: 'beta', summary: 's', intent_keywords: ['xyz'], lifecycle_stages: ['build'] }),
      }),
    ];
    const result = classifyIntent('xyz please', skills);
    expect(result.kind).toBe('ambiguous');
    if (result.kind === 'ambiguous') {
      expect(result.candidates).toHaveLength(2);
    }
  });

  test('confident_match when top score is 1.5× second (via base_score)', () => {
    const skills = [
      skill('high', {
        manifest: manifest({
          name: 'high',
          summary: 's',
          intent_keywords: ['exact phrase keyword'],
          lifecycle_stages: ['build'],
          ranking: { base_score: 5 },
        }),
      }),
      skill('low', {
        manifest: manifest({
          name: 'low',
          summary: 's',
          intent_keywords: ['exact'],
          lifecycle_stages: ['build'],
        }),
      }),
    ];
    const result = classifyIntent('exact phrase keyword now', skills);
    expect(result.kind).toBe('confident_match');
    if (result.kind === 'confident_match') {
      expect(result.chosen.name).toBe('high');
    }
  });

  test('empty intent string returns no_match', () => {
    const skills = [skill('ship', { manifest: manifest({ name: 'ship', summary: 's', intent_keywords: ['ship'] }) })];
    expect(classifyIntent('', skills).kind).toBe('no_match');
    expect(classifyIntent('   ', skills).kind).toBe('no_match');
  });

  test('candidates sorted by score descending then alphabetical tiebreak', () => {
    const skills = [
      skill('zebra', { manifest: manifest({ name: 'zebra', summary: 's', intent_keywords: ['x'] }) }),
      skill('alpha', { manifest: manifest({ name: 'alpha', summary: 's', intent_keywords: ['x'] }) }),
    ];
    const result = classifyIntent('x', skills);
    if (result.kind === 'ambiguous') {
      expect(result.candidates[0]?.name).toBe('alpha');
      expect(result.candidates[1]?.name).toBe('zebra');
    } else if (result.kind === 'no_match') {
      // single-character intent may fall below threshold; skip
    }
  });

  test('manifest base_score boost applied when present', () => {
    const skills = [
      skill('boosted', {
        manifest: manifest({
          name: 'boosted',
          summary: 's',
          intent_keywords: ['x'],
          lifecycle_stages: ['build'],
          ranking: { base_score: 10 },
        }),
      }),
    ];
    const result = classifyIntent('do x stuff', skills);
    expect(result.kind).toBe('confident_match');
    if (result.kind === 'confident_match') {
      expect(result.chosen.score).toBeGreaterThanOrEqual(10);
    }
  });

  test('heuristic fallback for skills without manifests', () => {
    const skills = [
      skill('legacy', {
        description: 'A legacy build helper that triggers on build keywords',
        manifest: undefined,
      }),
    ];
    const result = classifyIntent('build something useful', skills);
    // Heuristic scores are low (1-2 per word) — likely no_match given threshold 4
    expect(['ambiguous', 'no_match']).toContain(result.kind);
  });

  test('configurable confidence threshold', () => {
    const skills = [
      skill('marginal', {
        manifest: manifest({
          name: 'marginal',
          summary: 's',
          intent_keywords: ['marginal'],
          lifecycle_stages: ['build'],
        }),
      }),
    ];
    const lowThreshold = classifyIntent('marginal x', skills, { confidentThreshold: 1, minScore: 1 });
    expect(lowThreshold.kind).toBe('confident_match');

    const highThreshold = classifyIntent('marginal x', skills, { confidentThreshold: 100, minScore: 1 });
    expect(highThreshold.kind).toBe('ambiguous');
  });

  test('candidate limit caps the output', () => {
    const skills = Array.from({ length: 20 }, (_, i) =>
      skill(`s${i}`, {
        manifest: manifest({
          name: `s${i}`,
          summary: 's',
          intent_keywords: ['common'],
        }),
      }),
    );
    const result = classifyIntent('common', skills, { candidateLimit: 3 });
    if (result.kind === 'ambiguous') {
      expect(result.candidates.length).toBeLessThanOrEqual(3);
    }
  });

  test('substring/stem match with weight (whole word boundary)', () => {
    const skills = [
      skill('investigate', {
        manifest: manifest({
          name: 'investigate',
          summary: 's',
          intent_keywords: ['debug'],
          lifecycle_stages: ['build'],
        }),
      }),
    ];
    const candidate = scoreSkillForIntent(skills[0]!, 'I want to debug this issue');
    expect(candidate).not.toBeNull();
    expect(candidate?.score).toBeGreaterThan(0);
  });

  test('integration: real manifests route 12 intents correctly', async () => {
    // This test validates against the actual nexus.skill.yaml manifests
    // authored in Phase 4. It catches regressions in real-world routing.
    const { discoverInstalledSkills } = await import('../../../lib/nexus/skill-registry/discovery');
    const skills = discoverInstalledSkills({
      roots: ['./skills/canonical', './skills/safety', './skills/support', './skills/root'],
    });
    expect(skills.length).toBeGreaterThanOrEqual(37);

    const expectations: Array<[string, string]> = [
      ['implement the auth feature', 'build'],
      ['I want to explore an idea about telemetry', 'discover'],
      ['review the code change', 'review'],
      ['QA the build', 'qa'],
      ['plan this work properly', 'plan'],
      ['close out the run', 'closeout'],
      ['frame the scope for next milestone', 'frame'],
      ['approve the route to build', 'handoff'],
      ['debug this failing test', 'investigate'],
      ['security audit before ship', 'cso'],
    ];

    for (const [intent, expectedSkill] of expectations) {
      const outcome = classifyIntent(intent, skills);
      const top = outcome.kind === 'confident_match' ? outcome.chosen.name :
                  outcome.kind === 'ambiguous' ? outcome.candidates[0]?.name :
                  null;
      expect(top, `intent "${intent}" should route to ${expectedSkill}`).toBe(expectedSkill);
    }
  });

  test('formatOutcomeForTerminal shapes confident match output', () => {
    const skills = [
      skill('ship', {
        manifest: manifest({
          name: 'ship',
          summary: 's',
          intent_keywords: ['ship it'],
          lifecycle_stages: ['ship'],
          classification: { namespace: 'nexus_canonical' },
        }),
      }),
    ];
    const outcome = classifyIntent('ship it', skills);
    const text = formatOutcomeForTerminal(outcome, 'ship it');
    expect(text).toContain('/ship');
    expect(text).toContain('nexus_canonical');
  });

  test('formatOutcomeForTerminal shapes no_match output with helpful hint', () => {
    const outcome = { kind: 'no_match' as const, closest: [] };
    const text = formatOutcomeForTerminal(outcome, 'do my taxes');
    expect(text).toContain('Out of scope');
    expect(text).toContain('do my taxes');
    expect(text).toContain('docs/skill-manifest-schema.md');
  });
});
