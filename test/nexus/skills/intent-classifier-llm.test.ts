import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  classifyIntent,
  classifyIntentAsync,
  isLLMEnabled,
  registerLLMClassifier,
  restoreLLMClassifier,
  type LLMClassifier,
} from '../../../lib/nexus/intent-classifier';
import {
  isLocalProviderMode,
  mergeLLMOutcome,
  shouldConsultLLM,
} from '../../../lib/nexus/intent-classifier/llm';
import type { SkillRecord } from '../../../lib/nexus/skill-registry/types';
import type { NexusSkillManifest } from '../../../lib/nexus/skill-registry/manifest-schema';
import type { IntentOutcome } from '../../../lib/nexus/intent-classifier/types';

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

describe('LLM classifier wiring (Phase 5 — Track D-D3)', () => {
  // Always restore the no-op classifier between tests so registration leaks
  // don't bleed across cases.
  afterEach(() => {
    restoreLLMClassifier();
  });

  describe('isLLMEnabled', () => {
    test('false by default (NEXUS_INTENT_LLM unset)', () => {
      expect(isLLMEnabled({})).toBe(false);
    });

    test('false when NEXUS_INTENT_LLM is "0"', () => {
      expect(isLLMEnabled({ NEXUS_INTENT_LLM: '0' })).toBe(false);
    });

    test('true when NEXUS_INTENT_LLM=1 and not local_provider mode', () => {
      expect(isLLMEnabled({ NEXUS_INTENT_LLM: '1' })).toBe(true);
    });

    test('false when NEXUS_INTENT_LLM=1 but local_provider mode active', () => {
      expect(
        isLLMEnabled({
          NEXUS_INTENT_LLM: '1',
          NEXUS_EXECUTION_MODE: 'local_provider',
        }),
      ).toBe(false);
    });
  });

  describe('isLocalProviderMode', () => {
    test('false by default', () => {
      expect(isLocalProviderMode({})).toBe(false);
    });

    test('true when NEXUS_EXECUTION_MODE=local_provider', () => {
      expect(isLocalProviderMode({ NEXUS_EXECUTION_MODE: 'local_provider' })).toBe(true);
    });

    test('false for governed_ccb mode', () => {
      expect(isLocalProviderMode({ NEXUS_EXECUTION_MODE: 'governed_ccb' })).toBe(false);
    });
  });

  describe('shouldConsultLLM (tiebreaker policy)', () => {
    test('false on confident_match (no need for tiebreaker)', () => {
      const outcome: IntentOutcome = {
        kind: 'confident_match',
        chosen: { name: 'x', surface: '/x', namespace: 'nexus_canonical', score: 10, matched_keywords: [], manifest_backed: true },
        candidates: [],
      };
      expect(shouldConsultLLM(outcome)).toBe(false);
    });

    test('true on ambiguous (tiebreaker case)', () => {
      const outcome: IntentOutcome = { kind: 'ambiguous', candidates: [] };
      expect(shouldConsultLLM(outcome)).toBe(true);
    });

    test('false on no_match (LLM cannot rescue out-of-scope)', () => {
      const outcome: IntentOutcome = { kind: 'no_match', closest: [] };
      expect(shouldConsultLLM(outcome)).toBe(false);
    });
  });

  describe('mergeLLMOutcome (LLM result integration)', () => {
    const candidateA = { name: 'a', surface: '/a', namespace: 'nexus_canonical' as const, score: 5, matched_keywords: ['x'], manifest_backed: true };
    const candidateB = { name: 'b', surface: '/b', namespace: 'nexus_canonical' as const, score: 5, matched_keywords: ['x'], manifest_backed: true };

    test('keeps keyword outcome when LLM returns no_match', () => {
      const keywordOutcome: IntentOutcome = { kind: 'ambiguous', candidates: [candidateA, candidateB] };
      const llmOutcome: IntentOutcome = { kind: 'no_match', closest: [] };
      expect(mergeLLMOutcome(keywordOutcome, llmOutcome)).toBe(keywordOutcome);
    });

    test('keeps keyword outcome when LLM returns ambiguous', () => {
      const keywordOutcome: IntentOutcome = { kind: 'ambiguous', candidates: [candidateA, candidateB] };
      const llmOutcome: IntentOutcome = { kind: 'ambiguous', candidates: [candidateA, candidateB] };
      expect(mergeLLMOutcome(keywordOutcome, llmOutcome)).toBe(keywordOutcome);
    });

    test('promotes to confident_match when LLM picks a keyword candidate', () => {
      const keywordOutcome: IntentOutcome = { kind: 'ambiguous', candidates: [candidateA, candidateB] };
      const llmOutcome: IntentOutcome = { kind: 'confident_match', chosen: candidateA, candidates: [candidateA] };
      const merged = mergeLLMOutcome(keywordOutcome, llmOutcome);
      expect(merged.kind).toBe('confident_match');
      if (merged.kind === 'confident_match') {
        expect(merged.chosen.name).toBe('a');
        // Candidate set preserved from keyword (not narrowed by LLM)
        expect(merged.candidates).toEqual(keywordOutcome.candidates);
      }
    });

    test('does NOT promote when LLM picks a skill not in keyword shortlist', () => {
      const keywordOutcome: IntentOutcome = { kind: 'ambiguous', candidates: [candidateA, candidateB] };
      const intruder = { ...candidateA, name: 'intruder', surface: '/intruder' };
      const llmOutcome: IntentOutcome = { kind: 'confident_match', chosen: intruder, candidates: [intruder] };
      expect(mergeLLMOutcome(keywordOutcome, llmOutcome)).toBe(keywordOutcome);
    });

    test('does not affect confident keyword outcomes', () => {
      const keywordOutcome: IntentOutcome = { kind: 'confident_match', chosen: candidateA, candidates: [candidateA] };
      const llmOutcome: IntentOutcome = { kind: 'confident_match', chosen: candidateB, candidates: [candidateB] };
      expect(mergeLLMOutcome(keywordOutcome, llmOutcome)).toBe(keywordOutcome);
    });
  });

  describe('classifyIntentAsync (end-to-end wiring)', () => {
    test('returns keyword outcome unchanged when LLM disabled (default)', async () => {
      const skills = [
        skill('ship', { manifest: manifest({ name: 'ship', summary: 's', intent_keywords: ['ship it'] }) }),
      ];
      // No LLM env var set
      const result = await classifyIntentAsync('ship it now', skills);
      const sync = classifyIntent('ship it now', skills);
      expect(result).toEqual(sync);
    });

    test('does NOT consult LLM on confident keyword match', async () => {
      let llmCalls = 0;
      const trackingClassifier: LLMClassifier = {
        name: 'tracker',
        async classify() {
          llmCalls++;
          return { kind: 'no_match', closest: [] };
        },
      };
      registerLLMClassifier(trackingClassifier);
      process.env.NEXUS_INTENT_LLM = '1';
      try {
        const skills = [
          skill('ship', { manifest: manifest({ name: 'ship', summary: 's', intent_keywords: ['ship it'] }) }),
        ];
        await classifyIntentAsync('ship it now', skills);
        expect(llmCalls).toBe(0); // confident keyword match → no LLM consult
      } finally {
        delete process.env.NEXUS_INTENT_LLM;
      }
    });

    test('consults LLM tiebreaker on ambiguous keyword match (when enabled)', async () => {
      let llmCalls = 0;
      const skills = [
        skill('a', { manifest: manifest({ name: 'a', summary: 's', intent_keywords: ['shared'] }) }),
        skill('b', { manifest: manifest({ name: 'b', summary: 's', intent_keywords: ['shared'] }) }),
      ];
      const llmPicksA: LLMClassifier = {
        name: 'picks-a',
        async classify(_intent, _skills) {
          llmCalls++;
          return {
            kind: 'confident_match',
            chosen: {
              name: 'a',
              surface: '/a',
              namespace: 'nexus_canonical',
              score: 99,
              matched_keywords: [],
              manifest_backed: true,
            },
            candidates: [],
          };
        },
      };
      registerLLMClassifier(llmPicksA);
      process.env.NEXUS_INTENT_LLM = '1';
      try {
        const result = await classifyIntentAsync('shared task', skills);
        expect(llmCalls).toBe(1);
        expect(result.kind).toBe('confident_match');
        if (result.kind === 'confident_match') {
          expect(result.chosen.name).toBe('a');
        }
      } finally {
        delete process.env.NEXUS_INTENT_LLM;
      }
    });

    test('falls back to keyword outcome when LLM throws', async () => {
      const skills = [
        skill('a', { manifest: manifest({ name: 'a', summary: 's', intent_keywords: ['shared'] }) }),
        skill('b', { manifest: manifest({ name: 'b', summary: 's', intent_keywords: ['shared'] }) }),
      ];
      const throwingClassifier: LLMClassifier = {
        name: 'thrower',
        async classify() {
          throw new Error('LLM unreachable');
        },
      };
      registerLLMClassifier(throwingClassifier);
      process.env.NEXUS_INTENT_LLM = '1';
      try {
        const result = await classifyIntentAsync('shared task', skills);
        // Did NOT crash; returned keyword outcome (ambiguous)
        expect(result.kind).toBe('ambiguous');
      } finally {
        delete process.env.NEXUS_INTENT_LLM;
      }
    });

    test('skips LLM in local_provider mode even when NEXUS_INTENT_LLM=1', async () => {
      let llmCalls = 0;
      const trackingClassifier: LLMClassifier = {
        name: 'tracker',
        async classify() {
          llmCalls++;
          return { kind: 'no_match', closest: [] };
        },
      };
      registerLLMClassifier(trackingClassifier);
      process.env.NEXUS_INTENT_LLM = '1';
      process.env.NEXUS_EXECUTION_MODE = 'local_provider';
      try {
        const skills = [
          skill('a', { manifest: manifest({ name: 'a', summary: 's', intent_keywords: ['shared'] }) }),
          skill('b', { manifest: manifest({ name: 'b', summary: 's', intent_keywords: ['shared'] }) }),
        ];
        await classifyIntentAsync('shared task', skills);
        expect(llmCalls).toBe(0); // local_provider mode forces keyword-only
      } finally {
        delete process.env.NEXUS_INTENT_LLM;
        delete process.env.NEXUS_EXECUTION_MODE;
      }
    });
  });

  describe('classifyIntent (sync path) is unchanged', () => {
    test('sync path never calls LLM regardless of env', () => {
      let llmCalls = 0;
      const trackingClassifier: LLMClassifier = {
        name: 'tracker',
        async classify() {
          llmCalls++;
          return { kind: 'no_match', closest: [] };
        },
      };
      registerLLMClassifier(trackingClassifier);
      process.env.NEXUS_INTENT_LLM = '1';
      try {
        const skills = [
          skill('a', { manifest: manifest({ name: 'a', summary: 's', intent_keywords: ['shared'] }) }),
          skill('b', { manifest: manifest({ name: 'b', summary: 's', intent_keywords: ['shared'] }) }),
        ];
        classifyIntent('shared task', skills);
        expect(llmCalls).toBe(0); // sync path bypasses LLM entirely
      } finally {
        delete process.env.NEXUS_INTENT_LLM;
      }
    });
  });
});
